import type { EgoMemoryAdapter, EgoPut, EgoSearchOptions } from "@ego/memory";
import type { SubEgoManifest } from "./types.js";
import { validateNamespaceAccess } from "./SubEgoManifest.js";

/**
 * Error de seguridad emitido cuando un Sub-Ego intenta acceder a un namespace no autorizado.
 */
export class SubEgoMemoryAccessDeniedError extends Error {
  constructor(
    public readonly callerId: string,
    public readonly requestedNamespace: string,
    public readonly operation: "read" | "write"
  ) {
    super(
      `[SubEgoMemoryGuard] Acceso denegado: el Sub-Ego '${callerId}' no tiene permisos para la operación '${operation}' en el namespace '${requestedNamespace}'.`
    );
    this.name = "SubEgoMemoryAccessDeniedError";
  }
}

/**
 * Opciones para configurar el guardián de memoria perimetral.
 */
export interface SubEgoMemoryGuardOptions {
  /** Identificador canónico del Sub-Ego llamador (ej. "ego.auditor", "ego.nucleus") */
  callerSubEgoId: string;
  /** Manifiesto formal del Sub-Ego para validar namespaces declarados */
  manifest?: SubEgoManifest;
  /** Indica si el llamador posee facultades nucleares completas */
  isNucleus?: boolean;
}

/**
 * Guardián perimetral de memoria para Sub-Egos (SUB-04 / Namespaces Specification / DSEK-03).
 * Enforza el aislamiento estricto de estado privado `egos/<id>/*` y valida namespaces
 * autorizados antes de delegar cualquier operación a VantaDB (`EgoMemoryAdapter`).
 */
export class SubEgoMemoryGuard {
  public readonly callerId: string;
  public readonly isNucleus: boolean;
  private readonly manifest?: SubEgoManifest;
  private readonly storage: EgoMemoryAdapter;

  constructor(storage: EgoMemoryAdapter, options: SubEgoMemoryGuardOptions) {
    this.storage = storage;
    this.callerId = options.callerSubEgoId;
    this.manifest = options.manifest;
    this.isNucleus = options.isNucleus ?? (this.callerId === "ego.nucleus");
  }

  /**
   * Obtiene la identidad del Sub-Ego asociada a este guardián.
   */
  getCallerId(): string {
    return this.callerId;
  }

  /**
   * Valida si una operación en un namespace específico está autorizada.
   * Si no está autorizada, arroja `SubEgoMemoryAccessDeniedError`.
   */
  assertAccess(namespace: string, operation: "read" | "write"): void {
    if (this.canAccess(namespace, operation)) {
      return;
    }
    throw new SubEgoMemoryAccessDeniedError(this.callerId, namespace, operation);
  }

  /**
   * Comprueba de forma no disruptiva si una operación en un namespace está autorizada.
   */
  canAccess(namespace: string, operation: "read" | "write"): boolean {
    // 1. Privilegio Nuclear: ego.nucleus tiene acceso universal a todos los namespaces
    if (this.isNucleus) {
      return true;
    }

    // 2. Control perimetral estricto de estado privado egos/<id>/*
    if (namespace.startsWith("egos/")) {
      const privatePrefix = `egos/${this.callerId}`;
      const isOwnState = namespace === privatePrefix || namespace.startsWith(`${privatePrefix}/`);

      // Ningún Sub-Ego puede acceder al namespace privado de otro especialista
      return isOwnState;
    }

    // 3. Verificación de namespaces compartidos según manifiesto formal
    if (this.manifest) {
      return validateNamespaceAccess(this.manifest, namespace, operation);
    }

    // 4. Si no se proveyó manifiesto, aplicar defaults defensivos de mínimo privilegio
    if (operation === "read") {
      return namespace.startsWith("kb/") || namespace.startsWith("quarantine/");
    }
    if (operation === "write") {
      return namespace === "quarantine/pending";
    }

    return false;
  }

  /**
   * Escritura simple para un único ítem con verificación perimetral.
   */
  async put(item: EgoPut): Promise<void> {
    this.assertAccess(item.namespace, "write");
    return await this.storage.put(item);
  }

  /**
   * Escritura en lote atómica: Valida la totalidad de los items antes de delegar al storage.
   * Si un solo item viola las reglas perimetrales, se aborta la operación completa sin escrituras parciales.
   */
  async putMulti(items: EgoPut[]): Promise<void> {
    // Pre-validación atómica de todos los elementos
    for (const item of items) {
      this.assertAccess(item.namespace, "write");
    }

    // Delegación atómica segura al storage subyacente
    return await this.storage.putMulti(items);
  }

  /**
   * Obtiene un registro por namespace y clave (soporta sobrecarga con objeto o parámetros separados).
   */
  async get(namespaceOrParams: string | { namespace: string; key: string }, maybeKey?: string): Promise<unknown> {
    const ns = typeof namespaceOrParams === "string" ? namespaceOrParams : namespaceOrParams.namespace;
    const k = typeof namespaceOrParams === "string" ? maybeKey! : namespaceOrParams.key;

    this.assertAccess(ns, "read");
    return await this.storage.get(ns, k);
  }

  /**
   * Elimina un registro por namespace y clave (soporta sobrecarga con objeto o parámetros separados).
   */
  async delete(namespaceOrParams: string | { namespace: string; key: string }, maybeKey?: string): Promise<boolean> {
    const ns = typeof namespaceOrParams === "string" ? namespaceOrParams : namespaceOrParams.namespace;
    const k = typeof namespaceOrParams === "string" ? maybeKey! : namespaceOrParams.key;

    this.assertAccess(ns, "write");
    return await this.storage.delete(ns, k);
  }

  /**
   * Búsqueda híbrida multi-namespace con RRF (BM25 + HNSW) validando cada namespace consultado.
   */
  async searchMulti(
    namespaces: string[],
    query: string,
    options?: EgoSearchOptions
  ): Promise<Awaited<ReturnType<EgoMemoryAdapter["searchMulti"]>>> {
    for (const ns of namespaces) {
      this.assertAccess(ns, "read");
    }
    return await this.storage.searchMulti(namespaces, query, options);
  }

  /**
   * Recuperación por clave o consulta acotada a namespaces autorizados.
   */
  async recall(keyOrQuery: string, namespace?: string): Promise<unknown> {
    const targetNs = namespace ?? `egos/${this.callerId}`;
    this.assertAccess(targetNs, "read");
    return await this.storage.recall(keyOrQuery, targetNs);
  }

  /**
   * Retorna el adaptador de memoria subyacente.
   */
  getUnderlyingStorage(): EgoMemoryAdapter {
    return this.storage;
  }
}
