import { randomUUID } from "node:crypto";
import type { EgoMemoryAdapter, EgoPut, EgoSearchOptions } from "@ego/memory";

/**
 * Clase base para errores del módulo SharedMemory.
 */
export class SharedMemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedMemoryError";
  }
}

/**
 * Error arrojado cuando se intenta acceder o escapar del espacio de nombres asignado a un proyecto.
 */
export class SharedMemoryAccessDeniedError extends SharedMemoryError {
  constructor(public readonly reason: string) {
    super(`[SharedMemory] Acceso Denegado: ${reason}`);
    this.name = "SharedMemoryAccessDeniedError";
  }
}

/**
 * Error arrojado ante colisión o conflicto de concurrencia al intentar adquirir o modificar
 * una clave retenida por otro Sub-Ego mediante un lease activo.
 */
export class SharedMemoryLeaseConflictError extends SharedMemoryError {
  constructor(
    public readonly projectId: string,
    public readonly key: string,
    public readonly currentHolderId: string,
    public readonly requestedHolderId: string,
    public readonly expiresAtMs: number
  ) {
    super(
      `[SharedMemory] Conflicto de Lease: La clave '${key}' en el proyecto '${projectId}' está retenida por '${currentHolderId}' hasta ${new Date(
        expiresAtMs
      ).toISOString()}. Solicitado por: '${requestedHolderId}'.`
    );
    this.name = "SharedMemoryLeaseConflictError";
  }
}

/**
 * Error arrojado cuando una operación de renovación o manipulación apunta a un lease ya vencido.
 */
export class SharedMemoryLeaseExpiredError extends SharedMemoryError {
  constructor(
    public readonly projectId: string,
    public readonly key: string,
    public readonly leaseId: string
  ) {
    super(
      `[SharedMemory] Lease Expirado: El lease '${leaseId}' para la clave '${key}' en el proyecto '${projectId}' ha expirado.`
    );
    this.name = "SharedMemoryLeaseExpiredError";
  }
}

/**
 * Error arrojado cuando un Sub-Ego no autorizado intenta renovar o liberar un lease perteneciente a otro titular.
 */
export class SharedMemoryLeaseInvalidError extends SharedMemoryError {
  constructor(
    public readonly projectId: string,
    public readonly key: string,
    public readonly reason: string
  ) {
    super(
      `[SharedMemory] Lease Inválido: Operación no autorizada sobre '${key}' en proyecto '${projectId}': ${reason}`
    );
    this.name = "SharedMemoryLeaseInvalidError";
  }
}

/**
 * Contrato de lease temporal con TTL para bloqueo y reserva atómica entre Sub-Egos concurrentes.
 */
export interface SharedMemoryLease {
  readonly leaseId: string;
  readonly projectId: string;
  readonly key: string;
  readonly holderId: string;
  readonly ttlMs: number;
  readonly acquiredAtMs: number;
  expiresAtMs: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Registro de dato estructurado publicado en la memoria compartida del proyecto.
 */
export interface SharedMemoryRecord<T = unknown> {
  readonly projectId: string;
  readonly key: string;
  readonly value: T;
  readonly namespace: string;
  readonly metadata?: Record<string, unknown>;
  readonly publishedBy?: string;
  readonly version: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly expiresAtMs?: number;
}

/**
 * Opciones para publicar un hecho o artefacto en la memoria compartida.
 */
export interface SharedMemoryPublishOptions {
  metadata?: Record<string, unknown>;
  publishedBy?: string;
  ttlMs?: number;
  leaseId?: string;
}

/**
 * Filtro de consulta para la búsqueda de memorias compartidas por proyecto.
 */
export interface SharedMemoryQueryFilter {
  prefix?: string;
  publishedBy?: string;
  textQuery?: string;
  limit?: number;
  unleasedOnly?: boolean;
}

/**
 * Suscripción descartable retornada al suscribirse a eventos de cambio.
 */
export interface SharedMemorySubscription {
  unsubscribe: () => void;
}

/**
 * Función suscriptora ante cambios en SharedMemory.
 */
export type SharedMemorySubscriber = (
  record: SharedMemoryRecord,
  operation: "publish" | "delete"
) => void | Promise<void>;

/**
 * Interfaz mínima desacoplada compatible con el EventBus del Cognitive Runtime.
 */
export interface SharedMemoryEventBus {
  emit(
    type: string,
    payload: unknown,
    options: {
      source: string;
      severity?: string;
      sessionId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    }
  ): unknown;
}

/**
 * Interfaz de almacenamiento desacoplada compatible con EgoMemoryAdapter.
 */
export interface SharedMemoryStorage {
  put(item: EgoPut): Promise<void>;
  putMulti?(items: EgoPut[]): Promise<void>;
  get(namespace: string, key: string): Promise<unknown>;
  delete(namespace: string, key: string): Promise<boolean>;
  searchMulti?(namespaces: string[], query: string, options?: EgoSearchOptions): Promise<any[]>;
  recall?(keyOrQuery: string, namespace?: string): Promise<unknown>;
}

/**
 * Opciones de inicialización de la clase SharedMemory.
 */
export interface SharedMemoryOptions {
  /** Bus de eventos para notificar actualizaciones de memoria a la arquitectura reactiva */
  eventBus?: SharedMemoryEventBus;
  /** Identificador por defecto del Sub-Ego si no se provee en la llamada */
  defaultCallerId?: string;
}

/**
 * SharedMemory — Canal de intercambio de contexto y memoria compartida inter-Sub-Ego (SUB-05).
 * 
 * Implementa el Principio Innegociable §2 (Project Memory) y §4 (Sub-Egos):
 * 1. Aislamiento estricto bajo el prefijo canónico `projects/<projectId>/shared/*`.
 * 2. Leases temporales atómicos con TTL (`acquireLease`, `renewLease`, `releaseLease`)
 *    para evitar colisiones y carreras de escritura entre Sub-Egos concurrentes.
 * 3. Publicación, lectura, consulta y eliminación con control de versiones monótonas.
 * 4. Difusión y notificación en tiempo real vía patrón pub/sub e integración con EventBus.
 */
export class SharedMemory {
  private readonly storage: SharedMemoryStorage;
  private readonly leases: Map<string, SharedMemoryLease> = new Map();
  private readonly projectKeys: Map<string, Set<string>> = new Map();
  private readonly subscribers: Set<{ pattern: string; callback: SharedMemorySubscriber }> = new Set();
  private readonly eventBus?: SharedMemoryEventBus;
  private readonly defaultCallerId: string;

  constructor(storage: SharedMemoryStorage | EgoMemoryAdapter, options: SharedMemoryOptions = {}) {
    if (!storage) {
      throw new SharedMemoryError("[SharedMemory] Se requiere una instancia válida de storage.");
    }
    this.storage = storage as SharedMemoryStorage;
    this.eventBus = options.eventBus;
    this.defaultCallerId = options.defaultCallerId ?? "ego.nucleus";
  }

  /**
   * Valida rigurosamente el identificador de proyecto para prevenir path traversal o namespace escaping.
   */
  private validateProjectId(projectId: string): void {
    if (!projectId || typeof projectId !== "string" || projectId.trim() === "") {
      throw new SharedMemoryAccessDeniedError("El identificador de proyecto (projectId) debe ser un string no vacío.");
    }
    if (projectId.includes("/") || projectId.includes("\\") || projectId.includes("..")) {
      throw new SharedMemoryAccessDeniedError(
        `El projectId '${projectId}' contiene caracteres prohibidos o intentos de path traversal.`
      );
    }
  }

  /**
   * Valida la clave compartida dentro del proyecto.
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== "string" || key.trim() === "") {
      throw new SharedMemoryAccessDeniedError("La clave compartida (key) debe ser un string no vacío.");
    }
    if (key.startsWith("/") || key.startsWith("\\") || key.includes("..")) {
      throw new SharedMemoryAccessDeniedError(
        `La clave '${key}' contiene caracteres no permitidos o intentos de escape de namespace.`
      );
    }
  }

  /**
   * Genera el namespace canónico bajo la jerarquía de VantaDB: `projects/<projectId>/shared`.
   */
  public getCanonicalNamespace(projectId: string): string {
    this.validateProjectId(projectId);
    return `projects/${projectId}/shared`;
  }

  /**
   * Clave compuesta interna para indexar leases en memoria.
   */
  private getLeaseCoordinate(projectId: string, key: string): string {
    return `${projectId}:::${key}`;
  }

  /**
   * Adquiere un lease temporal atómico con TTL sobre una coordenada (projectId, key).
   * Si ya existe un lease activo no vencido, arronja `SharedMemoryLeaseConflictError`.
   */
  async acquireLease(
    projectId: string,
    key: string,
    holderId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>
  ): Promise<SharedMemoryLease> {
    this.validateProjectId(projectId);
    this.validateKey(key);

    if (!holderId || typeof holderId !== "string" || holderId.trim() === "") {
      throw new SharedMemoryAccessDeniedError("El holderId debe ser un identificador válido.");
    }
    if (typeof ttlMs !== "number" || ttlMs <= 0) {
      throw new SharedMemoryError("El ttlMs debe ser un número positivo mayor a 0.");
    }

    const coord = this.getLeaseCoordinate(projectId, key);
    const now = Date.now();
    const existing = this.leases.get(coord);

    if (existing) {
      if (now < existing.expiresAtMs) {
        throw new SharedMemoryLeaseConflictError(
          projectId,
          key,
          existing.holderId,
          holderId,
          existing.expiresAtMs
        );
      }
      // El lease anterior ya expiró; se limpia de inmediato
      this.leases.delete(coord);
    }

    const lease: SharedMemoryLease = {
      leaseId: randomUUID(),
      projectId,
      key,
      holderId,
      ttlMs,
      acquiredAtMs: now,
      expiresAtMs: now + ttlMs,
      metadata
    };

    this.leases.set(coord, lease);

    this.eventBus?.emit(
      "memory.updated",
      {
        namespace: this.getCanonicalNamespace(projectId),
        key,
        operation: "put"
      },
      {
        source: "SharedMemory",
        metadata: {
          action: "acquireLease",
          projectId,
          key,
          leaseId: lease.leaseId,
          holderId
        }
      }
    );

    return { ...lease };
  }

  /**
   * Renueva un lease activo extendiendo su fecha de expiración según el nuevo TTL provisto.
   */
  async renewLease(
    projectId: string,
    key: string,
    leaseId: string,
    ttlMs: number
  ): Promise<SharedMemoryLease> {
    this.validateProjectId(projectId);
    this.validateKey(key);

    if (!leaseId || typeof leaseId !== "string") {
      throw new SharedMemoryLeaseInvalidError(projectId, key, "leaseId requerido para renovación.");
    }
    if (typeof ttlMs !== "number" || ttlMs <= 0) {
      throw new SharedMemoryError("El ttlMs debe ser un número positivo mayor a 0.");
    }

    const coord = this.getLeaseCoordinate(projectId, key);
    const now = Date.now();
    const existing = this.leases.get(coord);

    if (!existing || now >= existing.expiresAtMs) {
      if (existing) {
        this.leases.delete(coord);
      }
      throw new SharedMemoryLeaseExpiredError(projectId, key, leaseId);
    }

    if (existing.leaseId !== leaseId) {
      throw new SharedMemoryLeaseInvalidError(
        projectId,
        key,
        `El leaseId provisto no coincide con el lease activo retenido por '${existing.holderId}'.`
      );
    }

    existing.expiresAtMs = now + ttlMs;

    return { ...existing };
  }

  /**
   * Libera voluntariamente un lease temporal.
   */
  async releaseLease(
    projectId: string,
    key: string,
    leaseId: string
  ): Promise<boolean> {
    this.validateProjectId(projectId);
    this.validateKey(key);

    const coord = this.getLeaseCoordinate(projectId, key);
    const now = Date.now();
    const existing = this.leases.get(coord);

    if (!existing) {
      return true; // Liberación idempotente
    }

    // Si ya expiró, simplemente se limpia
    if (now >= existing.expiresAtMs) {
      this.leases.delete(coord);
      return true;
    }

    if (existing.leaseId !== leaseId) {
      throw new SharedMemoryLeaseInvalidError(
        projectId,
        key,
        `No tiene autorización para liberar un lease retenido por '${existing.holderId}'.`
      );
    }

    this.leases.delete(coord);
    return true;
  }

  /**
   * Obtiene la información del lease activo si existe y no ha expirado.
   */
  getLease(projectId: string, key: string): SharedMemoryLease | null {
    this.validateProjectId(projectId);
    this.validateKey(key);

    const coord = this.getLeaseCoordinate(projectId, key);
    const lease = this.leases.get(coord);
    if (!lease) return null;

    if (Date.now() >= lease.expiresAtMs) {
      this.leases.delete(coord);
      return null;
    }

    return { ...lease };
  }

  /**
   * Comprueba si una coordenada (projectId, key) se encuentra bloqueada por un lease activo.
   */
  isLeaseActive(projectId: string, key: string): boolean {
    return this.getLease(projectId, key) !== null;
  }

  /**
   * Purga de forma determinística todos los leases expirados en memoria.
   */
  cleanExpiredLeases(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [coord, lease] of this.leases.entries()) {
      if (now >= lease.expiresAtMs) {
        this.leases.delete(coord);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Publica un valor en la memoria compartida del proyecto.
   * Si existe un lease activo no retenido por quien publica, arronja `SharedMemoryLeaseConflictError`.
   */
  async publish<T = unknown>(
    projectId: string,
    key: string,
    value: T,
    optionsOrMetadata?: Record<string, unknown> | SharedMemoryPublishOptions
  ): Promise<SharedMemoryRecord<T>> {
    this.validateProjectId(projectId);
    this.validateKey(key);

    const opts: SharedMemoryPublishOptions =
      optionsOrMetadata &&
      ("metadata" in optionsOrMetadata ||
        "publishedBy" in optionsOrMetadata ||
        "ttlMs" in optionsOrMetadata ||
        "leaseId" in optionsOrMetadata)
        ? (optionsOrMetadata as SharedMemoryPublishOptions)
        : { metadata: optionsOrMetadata as Record<string, unknown> | undefined };

    const activeLease = this.getLease(projectId, key);
    if (activeLease) {
      if (opts.leaseId !== activeLease.leaseId) {
        throw new SharedMemoryLeaseConflictError(
          projectId,
          key,
          activeLease.holderId,
          opts.publishedBy ?? "desconocido",
          activeLease.expiresAtMs
        );
      }
    }

    const namespace = this.getCanonicalNamespace(projectId);
    const now = Date.now();

    // Determinar versión previa si existe
    let previousVersion = 0;
    let createdAtMs = now;
    try {
      const existingEnvelope = await this.storage.get(namespace, key);
      const existingRaw =
        typeof existingEnvelope === "object" && existingEnvelope !== null && "payload" in existingEnvelope
          ? (existingEnvelope as { payload: unknown }).payload
          : existingEnvelope;
      if (existingRaw) {
        const parsed = typeof existingRaw === "string" ? JSON.parse(existingRaw) : existingRaw;
        if (parsed && typeof parsed === "object") {
          if ("version" in parsed && typeof (parsed as any).version === "number") {
            previousVersion = (parsed as any).version;
          }
          if ("createdAtMs" in parsed && typeof (parsed as any).createdAtMs === "number") {
            createdAtMs = (parsed as any).createdAtMs;
          }
        }
      }
    } catch {
      // Si no existe o falla parse, arranca en versión 0
    }

    const version = previousVersion + 1;
    const expiresAtMs = opts.ttlMs && opts.ttlMs > 0 ? now + opts.ttlMs : undefined;

    const record: SharedMemoryRecord<T> = {
      projectId,
      key,
      value,
      namespace,
      metadata: opts.metadata,
      publishedBy: opts.publishedBy ?? this.defaultCallerId,
      version,
      createdAtMs,
      updatedAtMs: now,
      expiresAtMs
    };

    const egoPut: EgoPut = {
      namespace,
      key,
      payload: record,
      metadata: {
        projectId,
        key,
        version,
        publishedBy: record.publishedBy,
        state: "active",
        ...(opts.metadata ?? {})
      },
      ttl_ms: opts.ttlMs
    };

    await this.storage.put(egoPut);

    this.trackKey(projectId, key);
    this.notifySubscribers(record as unknown as SharedMemoryRecord, "publish");

    this.eventBus?.emit(
      "memory.updated",
      {
        namespace,
        key,
        operation: "put",
        isLatest: true
      },
      {
        source: "SharedMemory",
        metadata: {
          projectId,
          key,
          version,
          publishedBy: record.publishedBy
        }
      }
    );

    return record;
  }

  /**
   * Lee un registro completo desde la memoria compartida del proyecto.
   * Si el registro ha vencido por TTL, lo remueve determinísticamente y retorna `null`.
   */
  async read<T = unknown>(projectId: string, key: string): Promise<SharedMemoryRecord<T> | null> {
    this.validateProjectId(projectId);
    this.validateKey(key);

    const namespace = this.getCanonicalNamespace(projectId);
    const envelope = await this.storage.get(namespace, key);
    if (!envelope) {
      return null;
    }

    const raw =
      typeof envelope === "object" && envelope !== null && "payload" in envelope
        ? (envelope as { payload: unknown }).payload
        : envelope;
    if (!raw) {
      return null;
    }

    let parsed: any = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        // payload como string literal
      }
    }

    let record: SharedMemoryRecord<T>;
    if (parsed && typeof parsed === "object" && "projectId" in parsed && "key" in parsed && "value" in parsed) {
      record = parsed as SharedMemoryRecord<T>;
    } else {
      record = {
        projectId,
        key,
        value: parsed as T,
        namespace,
        version: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now()
      };
    }

    // Comprobación de expiración de registro
    if (record.expiresAtMs && Date.now() >= record.expiresAtMs) {
      await this.storage.delete(namespace, key);
      this.untrackKey(projectId, key);
      return null;
    }

    this.trackKey(projectId, key);
    return record;
  }

  /**
   * Lee directamente el valor de la clave compartida (retorna `null` si no existe o expiró).
   */
  async readValue<T = unknown>(projectId: string, key: string): Promise<T | null> {
    const record = await this.read<T>(projectId, key);
    return record ? record.value : null;
  }

  /**
   * Consulta registros compartidos de un proyecto aplicando filtros de prefijo, emisor o texto.
   */
  async query(
    projectId: string,
    filter?: SharedMemoryQueryFilter
  ): Promise<SharedMemoryRecord[]> {
    this.validateProjectId(projectId);

    const keys = Array.from(this.projectKeys.get(projectId) ?? []);
    const results: SharedMemoryRecord[] = [];

    for (const k of keys) {
      if (filter?.prefix && !k.startsWith(filter.prefix)) {
        continue;
      }

      if (filter?.unleasedOnly && this.isLeaseActive(projectId, k)) {
        continue;
      }

      const rec = await this.read(projectId, k);
      if (!rec) {
        continue;
      }

      if (filter?.publishedBy && rec.publishedBy !== filter.publishedBy) {
        continue;
      }

      if (filter?.textQuery) {
        const q = filter.textQuery.toLowerCase();
        const inKey = rec.key.toLowerCase().includes(q);
        const inVal = JSON.stringify(rec.value).toLowerCase().includes(q);
        if (!inKey && !inVal) {
          continue;
        }
      }

      results.push(rec);
    }

    // Ordenar de más reciente a más antiguo
    results.sort((a, b) => b.updatedAtMs - a.updatedAtMs);

    if (filter?.limit && filter.limit > 0) {
      return results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Elimina un registro de la memoria compartida.
   * Si la clave tiene un lease activo retenido por otro Sub-Ego, arroja `SharedMemoryLeaseConflictError`.
   */
  async delete(
    projectId: string,
    key: string,
    options?: { leaseId?: string; deletedBy?: string }
  ): Promise<boolean> {
    this.validateProjectId(projectId);
    this.validateKey(key);

    const activeLease = this.getLease(projectId, key);
    if (activeLease) {
      if (options?.leaseId !== activeLease.leaseId) {
        throw new SharedMemoryLeaseConflictError(
          projectId,
          key,
          activeLease.holderId,
          options?.deletedBy ?? "desconocido",
          activeLease.expiresAtMs
        );
      }
      // Si el titular elimina el registro, se libera el lease automáticamente
      this.leases.delete(this.getLeaseCoordinate(projectId, key));
    }

    const namespace = this.getCanonicalNamespace(projectId);
    const deleted = await this.storage.delete(namespace, key);
    this.untrackKey(projectId, key);

    const tombstone: SharedMemoryRecord<null> = {
      projectId,
      key,
      value: null,
      namespace,
      version: 0,
      createdAtMs: 0,
      updatedAtMs: Date.now()
    };

    this.notifySubscribers(tombstone, "delete");

    this.eventBus?.emit(
      "memory.updated",
      {
        namespace,
        key,
        operation: "delete"
      },
      {
        source: "SharedMemory",
        metadata: {
          projectId,
          key,
          deletedBy: options?.deletedBy
        }
      }
    );

    return deleted;
  }

  /**
   * Registra un suscriptor para recibir notificaciones sobre modificaciones o publicaciones.
   * Admite patrones como '*', 'specs/*', 'projects/<projectId>/shared/*'.
   */
  subscribe(
    keyPattern: string,
    callback: SharedMemorySubscriber
  ): SharedMemorySubscription {
    if (!keyPattern || typeof keyPattern !== "string" || keyPattern.trim() === "") {
      throw new SharedMemoryError("keyPattern debe ser un string no vacío.");
    }

    const entry = { pattern: keyPattern.trim(), callback };
    this.subscribers.add(entry);

    return {
      unsubscribe: () => {
        this.subscribers.delete(entry);
      }
    };
  }

  /**
   * Notifica asíncronamente a los suscriptores cuyos patrones coincidan.
   */
  private notifySubscribers(
    record: SharedMemoryRecord,
    operation: "publish" | "delete"
  ): void {
    for (const sub of this.subscribers) {
      if (this.matchesPattern(sub.pattern, record)) {
        queueMicrotask(async () => {
          try {
            await sub.callback(record, operation);
          } catch (err) {
            console.warn("[SharedMemory] Error en ejecución de suscriptor:", err);
          }
        });
      }
    }
  }

  /**
   * Evalúa la coincidencia de patrones simples o comodines.
   */
  private matchesPattern(pattern: string, record: SharedMemoryRecord): boolean {
    if (pattern === "*") return true;

    // Coincidencia con URI o namespace completo
    if (pattern.startsWith("projects/")) {
      const fullPath = `${record.namespace}/${record.key}`;
      if (pattern.endsWith("/*")) {
        const prefix = pattern.slice(0, -2);
        return fullPath.startsWith(prefix) || record.namespace.startsWith(prefix);
      }
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        return fullPath.startsWith(prefix);
      }
      return fullPath === pattern;
    }

    // Coincidencia sobre la clave directa
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return record.key.startsWith(prefix);
    }
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return record.key.startsWith(prefix);
    }

    return record.key === pattern;
  }

  /**
   * Registra una clave en el índice del proyecto.
   */
  private trackKey(projectId: string, key: string): void {
    let set = this.projectKeys.get(projectId);
    if (!set) {
      set = new Set();
      this.projectKeys.set(projectId, set);
    }
    set.add(key);
  }

  /**
   * Desvincula una clave del índice del proyecto.
   */
  private untrackKey(projectId: string, key: string): void {
    const set = this.projectKeys.get(projectId);
    if (set) {
      set.delete(key);
    }
  }

  /**
   * Retorna el número de claves conocidas en el índice de un proyecto.
   */
  getTrackedKeyCount(projectId: string): number {
    return this.projectKeys.get(projectId)?.size ?? 0;
  }
}
