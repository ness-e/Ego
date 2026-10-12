import { z } from "zod";
import type { EgoMemoryAdapter, EgoPut } from "@ego/memory";
import type {
  SubEgoManifest,
  SubEgoState,
  SubEgoCreator
} from "./types.js";
import {
  validateSubEgoManifest,
  parseSubEgoManifest
} from "./SubEgoManifest.js";

/**
 * Error base para anomalías del registro y catálogo de Sub-Egos.
 */
export class SubEgoRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubEgoRegistryError";
  }
}

/**
 * Error emitido cuando un Sub-Ego solicitado no se encuentra registrado en el catálogo.
 */
export class SubEgoRegistryNotFoundError extends SubEgoRegistryError {
  constructor(public readonly subEgoId: string) {
    super(`Sub-Ego con identificador '${subEgoId}' no encontrado en el catálogo.`);
    this.name = "SubEgoRegistryNotFoundError";
  }
}

/**
 * Error emitido ante intentos de mutación, sobreescritura o eliminación de entidades
 * inmutables del sistema (ej. ego.nucleus o identidades nucleares protegidas).
 */
export class SubEgoSystemImmutableError extends SubEgoRegistryError {
  constructor(public readonly subEgoId: string, action: string = "modificar o eliminar") {
    super(
      `Operación no autorizada: el Sub-Ego '${subEgoId}' es una entidad protegida del sistema y no se puede ${action}.`
    );
    this.name = "SubEgoSystemImmutableError";
  }
}

/**
 * Error emitido cuando los datos proporcionados no cumplen con el esquema formal `SubEgoManifest`.
 */
export class SubEgoRegistryValidationError extends SubEgoRegistryError {
  constructor(public readonly subEgoId: string, public readonly issues: z.ZodIssue[]) {
    const formatted = issues
      .map((i) => `  - [${i.path.join(".") || "root"}]: ${i.message}`)
      .join("\n");
    super(`El manifiesto del Sub-Ego '${subEgoId}' no cumple con el esquema canónico:\n${formatted}`);
    this.name = "SubEgoRegistryValidationError";
  }
}

/**
 * Criterios de filtrado para consultas del catálogo de Sub-Egos.
 */
export interface SubEgoFilterOptions {
  /** Filtrar por dominio conceptual (ej. 'engineering', 'research', 'analytics') */
  domain?: string;
  /** Filtrar por etiquetas asignadas (debe contener todas las etiquetas indicadas) */
  tags?: string[];
  /** Filtrar por herramientas asignadas (debe contener todas las herramientas indicadas) */
  tools?: string[];
  /** Filtrar por capacidades cognitivas declaradas (debe contener todas las capacidades indicadas) */
  capabilities?: string[];
  /** Filtrar por estado de ciclo de vida ('active', 'paused', 'archived', 'enabled', 'disabled') */
  state?: SubEgoState | "enabled" | "disabled";
  /** Filtrar por entidad creadora ('user', 'ego-nucleus', 'template') */
  creator?: SubEgoCreator;
}

/**
 * Opciones de configuración para la instancia de `SubEgoRegistry`.
 */
export interface SubEgoRegistryOptions {
  /** Lista adicional de identificadores protegidos contra mutación o borrado */
  systemProtectedIds?: string[];
}

/**
 * Identificadores canónicos reservados e inmutables del núcleo de Ego.
 */
export const DEFAULT_SYSTEM_PROTECTED_IDS: readonly string[] = Object.freeze([
  "ego.nucleus"
]);

/**
 * Comprueba si un ID o manifiesto corresponde a una entidad de sistema inmutable.
 */
export function isSystemSubEgo(
  idOrManifest: string | SubEgoManifest,
  customProtectedIds: ReadonlySet<string> = new Set(DEFAULT_SYSTEM_PROTECTED_IDS)
): boolean {
  if (typeof idOrManifest === "string") {
    return customProtectedIds.has(idOrManifest) || idOrManifest === "ego.nucleus";
  }

  return (
    customProtectedIds.has(idOrManifest.id) ||
    idOrManifest.id === "ego.nucleus" ||
    idOrManifest.creator === "ego-nucleus"
  );
}

/**
 * Registro y catálogo unificado de Sub-Egos sobre VantaDB (SUB-07 / Principios §1 y §4).
 * Gestiona la persistencia, indexación, ciclo de vida suave (enable/disable) y protección
 * inmutable de identidades de sistema bajo el namespace `gov/sub_egos/<id>`.
 */
export class SubEgoRegistry {
  private readonly storage: EgoMemoryAdapter;
  private readonly protectedIds: Set<string>;
  private readonly knownIds: Set<string> = new Set();

  public static readonly NAMESPACE = "gov/sub_egos";

  constructor(storage: EgoMemoryAdapter, options: SubEgoRegistryOptions = {}) {
    this.storage = storage;
    this.protectedIds = new Set([
      ...DEFAULT_SYSTEM_PROTECTED_IDS,
      ...(options.systemProtectedIds || [])
    ]);
  }

  /**
   * Garantiza la inicialización previa del almacenamiento subyacente de forma segura.
   */
  private async ensureStorageReady(): Promise<void> {
    if (
      "ready" in this.storage &&
      !this.storage.ready &&
      typeof (this.storage as unknown as { init?: () => Promise<void> }).init === "function"
    ) {
      await (this.storage as unknown as { init: () => Promise<void> }).init();
    }
  }

  /**
   * Verifica si un identificador o manifiesto pertenece a las identidades protegidas del sistema.
   */
  public isProtected(idOrManifest: string | SubEgoManifest): boolean {
    return isSystemSubEgo(idOrManifest, this.protectedIds);
  }

  /**
   * Registra o actualiza un Sub-Ego en el catálogo persistente `gov/sub_egos/<id>`.
   * Enforza validación Zod exhaustiva y bloquea la modificación de entidades de sistema inmutables.
   *
   * @param manifest Manifiesto formal del Sub-Ego a persistir.
   * @returns El manifiesto validado y almacenado.
   * @throws `SubEgoRegistryValidationError` si los datos violan el esquema canónico.
   * @throws `SubEgoSystemImmutableError` si se intenta sobrescribir una entidad de sistema protegida.
   */
  async register(manifest: SubEgoManifest): Promise<SubEgoManifest> {
    await this.ensureStorageReady();

    // 1. Validación sintáctica y semántica con Zod
    const validation = validateSubEgoManifest(manifest);
    if (!validation.success) {
      const candidateId = typeof manifest?.id === "string" ? manifest.id : "desconocido";
      throw new SubEgoRegistryValidationError(candidateId, validation.error.issues);
    }
    const validated = validation.data;

    // 2. Comprobación de inmutabilidad y protección de sistema
    const existing = await this.get(validated.id);
    if (existing) {
      if (this.isProtected(existing)) {
        throw new SubEgoSystemImmutableError(
          validated.id,
          "modificar ni sobreescribir porque es una entidad protegida del sistema"
        );
      }
    } else {
      // Si aún no existe, pero intenta reclamar un ID reservado del sistema sin creador nuclear
      if (this.isProtected(validated.id) && validated.creator !== "ego-nucleus") {
        throw new SubEgoSystemImmutableError(
          validated.id,
          `registrar con creador '${validated.creator}' porque es una identidad reservada del sistema`
        );
      }
    }

    // 3. Serialización y persistencia en VantaDB
    const domain = (validated.metadata?.domain ?? (validated as unknown as { domain?: string }).domain ?? "") as string;
    const rawTags = (validated.metadata?.tags ?? (validated as unknown as { tags?: unknown }).tags ?? []) as unknown;
    const tags = Array.isArray(rawTags) ? rawTags : [];

    const putItem: EgoPut = {
      namespace: SubEgoRegistry.NAMESPACE,
      key: validated.id,
      payload: validated,
      metadata: {
        id: validated.id,
        name: validated.name,
        role: validated.role,
        state: validated.state,
        creator: validated.creator,
        domain,
        tags: JSON.stringify(tags),
        tools: JSON.stringify(validated.tools),
        updatedAtMs: validated.updatedAtMs
      }
    };

    await this.storage.put(putItem);
    this.knownIds.add(validated.id);

    // 4. Registro de auditoría si está disponible
    if (typeof (this.storage as unknown as { recordAudit?: Function }).recordAudit === "function") {
      try {
        await (this.storage as unknown as {
          recordAudit: (action: string, actor: string, details: Record<string, unknown>) => Promise<void>;
        }).recordAudit(
          existing ? "subego_update" : "subego_register",
          validated.creator === "ego-nucleus" ? "ego.nucleus" : "user",
          { id: validated.id, name: validated.name, role: validated.role, state: validated.state }
        );
      } catch {
        // Auditoría no bloqueante
      }
    }

    return validated;
  }

  /**
   * Recupera un Sub-Ego del catálogo por su identificador único.
   *
   * @param id Identificador canónico (ej. 'ego.nucleus', 'ego.code-reviewer').
   * @returns El manifiesto validado o `null` si no existe o está corrupto.
   */
  async get(id: string): Promise<SubEgoManifest | null> {
    await this.ensureStorageReady();

    try {
      const envelope = await this.storage.get(SubEgoRegistry.NAMESPACE, id);
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

      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const validation = validateSubEgoManifest(parsed);
      if (!validation.success) {
        console.warn(
          `[SubEgoRegistry] Manifiesto corrupto detectado para ID '${id}':`,
          validation.error.issues
        );
        return null;
      }

      this.knownIds.add(validation.data.id);
      return validation.data;
    } catch (err) {
      console.warn(`[SubEgoRegistry] Error al recuperar Sub-Ego '${id}':`, err);
      return null;
    }
  }

  /**
   * Comprueba si un Sub-Ego existe en el catálogo.
   */
  async has(id: string): Promise<boolean> {
    const item = await this.get(id);
    return item !== null;
  }

  /**
   * Elimina un Sub-Ego del catálogo de VantaDB.
   * Rechaza categóricamente cualquier intento de desregistrar identidades de sistema inmutables.
   *
   * @param id Identificador del Sub-Ego a eliminar.
   * @param options Opciones adicionales (ej. throwIfNotFound).
   * @returns `true` si fue eliminado con éxito, `false` si no existía.
   * @throws `SubEgoSystemImmutableError` si se intenta eliminar una entidad de sistema protegida.
   * @throws `SubEgoNotFoundError` si `options.throwIfNotFound` es true y no existe.
   */
  async unregister(id: string, options: { throwIfNotFound?: boolean } = {}): Promise<boolean> {
    await this.ensureStorageReady();

    if (this.isProtected(id)) {
      throw new SubEgoSystemImmutableError(id, "eliminar ni desregistrar");
    }

    const existing = await this.get(id);
    if (!existing) {
      if (options.throwIfNotFound) {
        throw new SubEgoRegistryNotFoundError(id);
      }
      return false;
    }

    if (this.isProtected(existing)) {
      throw new SubEgoSystemImmutableError(id, "eliminar ni desregistrar");
    }

    const deleted = await this.storage.delete(SubEgoRegistry.NAMESPACE, id);
    if (deleted) {
      this.knownIds.delete(id);

      if (typeof (this.storage as unknown as { recordAudit?: Function }).recordAudit === "function") {
        try {
          await (this.storage as unknown as {
            recordAudit: (action: string, actor: string, details: Record<string, unknown>) => Promise<void>;
          }).recordAudit("subego_unregister", "user", { id });
        } catch {
          // Auditoría no bloqueante
        }
      }
    }

    return deleted;
  }

  /**
   * Habilita un Sub-Ego cambiando su estado a 'active'.
   *
   * @param id Identificador del Sub-Ego a habilitar.
   * @returns El manifiesto actualizado.
   * @throws `SubEgoNotFoundError` si el Sub-Ego no existe.
   */
  async enable(id: string): Promise<SubEgoManifest> {
    await this.ensureStorageReady();

    const existing = await this.get(id);
    if (!existing) {
      throw new SubEgoRegistryNotFoundError(id);
    }

    if (existing.state === "active") {
      return existing; // Idempotente
    }

    const updated: SubEgoManifest = {
      ...existing,
      state: "active",
      updatedAtMs: Date.now()
    };

    const validated = parseSubEgoManifest(updated);

    await this.storage.put({
      namespace: SubEgoRegistry.NAMESPACE,
      key: validated.id,
      payload: validated,
      metadata: {
        id: validated.id,
        name: validated.name,
        role: validated.role,
        state: validated.state,
        creator: validated.creator,
        updatedAtMs: validated.updatedAtMs
      }
    });

    if (typeof (this.storage as unknown as { recordAudit?: Function }).recordAudit === "function") {
      try {
        await (this.storage as unknown as {
          recordAudit: (action: string, actor: string, details: Record<string, unknown>) => Promise<void>;
        }).recordAudit("subego_enable", "user", { id, state: "active" });
      } catch {
        // Auditoría no bloqueante
      }
    }

    return validated;
  }

  /**
   * Deshabilita un Sub-Ego de forma suave (Soft-delete / DSEK-01) pasando su estado
   * a 'paused' (o 'archived' si se especifica la opción).
   * Prohíbe deshabilitar entidades críticas del sistema.
   *
   * @param id Identificador del Sub-Ego a deshabilitar.
   * @param options Opciones de deshabilitación (`archive: true` para estado 'archived').
   * @returns El manifiesto actualizado.
   * @throws `SubEgoSystemImmutableError` si se intenta deshabilitar una entidad de sistema protegida.
   * @throws `SubEgoNotFoundError` si el Sub-Ego no existe.
   */
  async disable(id: string, options: { archive?: boolean } = {}): Promise<SubEgoManifest> {
    await this.ensureStorageReady();

    if (this.isProtected(id)) {
      throw new SubEgoSystemImmutableError(id, "deshabilitar");
    }

    const existing = await this.get(id);
    if (!existing) {
      throw new SubEgoRegistryNotFoundError(id);
    }

    if (this.isProtected(existing)) {
      throw new SubEgoSystemImmutableError(id, "deshabilitar");
    }

    const targetState: SubEgoState = options.archive ? "archived" : "paused";
    if (existing.state === targetState) {
      return existing; // Idempotente
    }

    const updated: SubEgoManifest = {
      ...existing,
      state: targetState,
      updatedAtMs: Date.now()
    };

    const validated = parseSubEgoManifest(updated);

    await this.storage.put({
      namespace: SubEgoRegistry.NAMESPACE,
      key: validated.id,
      payload: validated,
      metadata: {
        id: validated.id,
        name: validated.name,
        role: validated.role,
        state: validated.state,
        creator: validated.creator,
        updatedAtMs: validated.updatedAtMs
      }
    });

    if (typeof (this.storage as unknown as { recordAudit?: Function }).recordAudit === "function") {
      try {
        await (this.storage as unknown as {
          recordAudit: (action: string, actor: string, details: Record<string, unknown>) => Promise<void>;
        }).recordAudit("subego_disable", "user", { id, state: targetState });
      } catch {
        // Auditoría no bloqueante
      }
    }

    return validated;
  }

  /**
   * Recupera todos los registros almacenados en `gov/sub_egos` desde VantaDB.
   */
  private async fetchAllRawRecords(): Promise<unknown[]> {
    const storageAny = this.storage as unknown as {
      db?: {
        list?: (opts: { namespace: string; limit: number; cursor?: number }) => Promise<{
          records: Array<{ payload: unknown }>;
          next_cursor?: number | string;
        }>;
      };
      listSubEgos?: () => Promise<SubEgoManifest[]>;
    };

    // 1. Si db.list está disponible, paginar de forma exhaustiva
    if (storageAny.db && typeof storageAny.db.list === "function") {
      try {
        const records: unknown[] = [];
        let cursor: number | undefined = undefined;

        do {
          const listOpts: { namespace: string; limit: number; cursor?: number } = {
            namespace: SubEgoRegistry.NAMESPACE,
            limit: 100
          };
          if (typeof cursor === "number") {
            listOpts.cursor = cursor;
          }

          const page = await storageAny.db.list(listOpts);
          for (const item of page.records) {
            try {
              const parsed = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
              records.push(parsed);
            } catch {
              records.push(item.payload);
            }
          }

          cursor =
            typeof page.next_cursor === "number"
              ? page.next_cursor
              : typeof page.next_cursor === "string" && !isNaN(Number(page.next_cursor))
              ? Number(page.next_cursor)
              : undefined;
        } while (cursor !== undefined);

        if (records.length > 0) {
          return records;
        }
      } catch (err) {
        console.warn("[SubEgoRegistry] Fallback en db.list paginado:", err);
      }
    }

    // 2. Método estándar de EgoMemoryAdapter
    if (typeof storageAny.listSubEgos === "function") {
      try {
        const list = await storageAny.listSubEgos();
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      } catch (err) {
        console.warn("[SubEgoRegistry] Fallback en storage.listSubEgos:", err);
      }
    }

    // 3. Fallback de resiliencia: resolver claves conocidas en la sesión
    if (this.knownIds.size > 0) {
      const recovered: unknown[] = [];
      for (const id of this.knownIds) {
        const found = await this.storage.get(SubEgoRegistry.NAMESPACE, id);
        if (found) {
          const payload =
            typeof found === "object" && found !== null && "payload" in found
              ? (found as { payload: unknown }).payload
              : found;
          const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
          recovered.push(parsed);
        }
      }
      return recovered;
    }

    return [];
  }

  /**
   * Lista y filtra los Sub-Egos registrados en el catálogo.
   * Omite de forma segura cualquier manifiesto corrupto sin interrumpir el arranque.
   *
   * @param filter Filtros opcionales por dominio, tags, tools, capacidades, estado o creador.
   * @returns Lista de manifiestos coincidentes.
   */
  async list(filter?: SubEgoFilterOptions): Promise<SubEgoManifest[]> {
    await this.ensureStorageReady();

    const rawRecords = await this.fetchAllRawRecords();

    // Validar y filtrar registros corruptos
    const validManifests: SubEgoManifest[] = [];
    for (const record of rawRecords) {
      const validation = validateSubEgoManifest(record);
      if (validation.success) {
        validManifests.push(validation.data);
        this.knownIds.add(validation.data.id);
      } else {
        const candidateId =
          typeof (record as { id?: unknown })?.id === "string"
            ? (record as { id: string }).id
            : "desconocido";
        console.warn(
          `[SubEgoRegistry] Omitiendo manifiesto corrupto en catálogo (ID: '${candidateId}')`
        );
      }
    }

    if (!filter) {
      return validManifests;
    }

    return validManifests.filter((m) => {
      // 1. Filtrado por estado de ciclo de vida
      if (filter.state) {
        if (filter.state === "enabled") {
          if (m.state !== "active") return false;
        } else if (filter.state === "disabled") {
          if (m.state !== "paused" && m.state !== "archived") return false;
        } else {
          if (m.state !== filter.state) return false;
        }
      }

      // 2. Filtrado por entidad creadora
      if (filter.creator && m.creator !== filter.creator) {
        return false;
      }

      // 3. Filtrado por dominio conceptual
      if (filter.domain) {
        const targetDomain = filter.domain.trim().toLowerCase();
        const manifestDomain = String(
          m.metadata?.domain ??
          (m as unknown as { domain?: string }).domain ??
          m.metadata?.templateId ??
          ""
        )
          .trim()
          .toLowerCase();

        if (manifestDomain !== targetDomain) {
          return false;
        }
      }

      // 4. Filtrado por etiquetas (tags)
      if (filter.tags && filter.tags.length > 0) {
        const rawTags = (m.metadata?.tags ??
          (m as unknown as { tags?: unknown }).tags ??
          []) as unknown;
        const manifestTags: string[] = Array.isArray(rawTags)
          ? rawTags.map((t) => String(t).trim().toLowerCase())
          : [];

        const matchesAllTags = filter.tags.every((tag) =>
          manifestTags.includes(tag.trim().toLowerCase())
        );
        if (!matchesAllTags) {
          return false;
        }
      }

      // 5. Filtrado por herramientas requeridas (tools)
      if (filter.tools && filter.tools.length > 0) {
        const matchesAllTools = filter.tools.every((tool) =>
          m.tools.includes(tool)
        );
        if (!matchesAllTools) {
          return false;
        }
      }

      // 6. Filtrado por capacidades requeridas (capabilities)
      if (filter.capabilities && filter.capabilities.length > 0) {
        const matchesAllCaps = filter.capabilities.every((cap) =>
          m.capabilities.includes(cap)
        );
        if (!matchesAllCaps) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Devuelve el total de Sub-Egos registrados que cumplen con el filtro.
   */
  async count(filter?: SubEgoFilterOptions): Promise<number> {
    const items = await this.list(filter);
    return items.length;
  }
}
