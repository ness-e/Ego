import type { EgoMemoryAdapter, EgoPut, EgoSearchOptions, PutRouteReport } from "@ego/memory";
import {
  getQuarantineAware,
  searchQuarantineAware,
} from "@ego/memory";
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
 *
 * Quarantine-aware (FIX-01 SEC-09): `egos/*` ya no difiere su enforcement —
 * las lecturas (`get/recall/searchMulti`) resuelven vía `quarantine/pending`
 * cuando el live no contiene el registro, con marca explícita
 * (`metadata.quarantined:true` + motivo). La resolución interna de cuarentena
 * NO re-pasa por `assertAccess`: el acceso lógico ya fue autorizado y la
 * clave física (`${ns}:${key}`) es detalle de implementación del stopgap
 * FIND-249. La escritura a cuarentena la decide el borde del adapter; el
 * guard propaga su reporte para observabilidad.
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
   * Propaga el reporte de routing del borde (live vs quarantine) para
   * observabilidad; los llamantes que lo ignoran no se ven afectados.
   */
  async put(item: EgoPut): Promise<PutRouteReport | void> {
    this.assertAccess(item.namespace, "write");
    return (await this.storage.put(item)) as PutRouteReport | void;
  }

  /**
   * Escritura en lote atómica: Valida la totalidad de los items antes de delegar al storage.
   * Si un solo item viola las reglas perimetrales, se aborta la operación completa sin escrituras parciales.
   */
  async putMulti(items: EgoPut[]): Promise<PutRouteReport[] | void> {
    // Pre-validación atómica de todos los elementos
    for (const item of items) {
      this.assertAccess(item.namespace, "write");
    }

    // Delegación atómica segura al storage subyacente
    return (await this.storage.putMulti(items)) as PutRouteReport[] | void;
  }

  /**
   * Marca explícita de procedencia de cuarentena sobre un registro leído
   * (FIX-01): preserva `key/payload`, clona metadata y añade
   * `quarantined:true` + motivo. Sin `any`: narrowing estructural.
   */
  private static markQuarantined(
    record: unknown,
    reason: string
  ): Record<string, unknown> & { payload?: unknown } {
    if (record && typeof record === "object") {
      const rec = record as Record<string, unknown>;
      const meta =
        rec["metadata"] && typeof rec["metadata"] === "object"
          ? { ...(rec["metadata"] as Record<string, unknown>) }
          : {};
      meta["quarantined"] = true;
      meta["quarantine_reason"] = reason;
      return { ...rec, metadata: meta };
    }
    return { payload: record, metadata: { quarantined: true, quarantine_reason: reason } };
  }

  /**
   * Resolución interna vía cuarentena (implementación única compartida en
   * `@ego/memory`; sin re-autorizar: el acceso lógico ya pasó
   * `assertAccess`). Retorna el registro marcado o `null`.
   */
  private async resolveViaQuarantine(namespace: string, key: string): Promise<unknown> {
    const hit = await getQuarantineAware(this.storage, namespace, key);
    if (!hit || hit.quarantined !== true) return null;
    return SubEgoMemoryGuard.markQuarantined(
      { key, payload: hit.payload, metadata: hit.metadata ?? {} },
      typeof hit.quarantineReason === "string" ? hit.quarantineReason : "quarantined"
    );
  }

  /**
   * Obtiene un registro por namespace y clave (soporta sobrecarga con objeto o parámetros separados).
   * Quarantine-aware: ante ausencia en live, resuelve vía `quarantine/pending`
   * con marca explícita (FIX-01).
   */
  async get(namespaceOrParams: string | { namespace: string; key: string }, maybeKey?: string): Promise<unknown> {
    const ns = typeof namespaceOrParams === "string" ? namespaceOrParams : namespaceOrParams.namespace;
    const k = typeof namespaceOrParams === "string" ? maybeKey! : namespaceOrParams.key;

    this.assertAccess(ns, "read");
    let live: unknown = null;
    let liveThrew: unknown = null;
    try {
      live = await this.storage.get(ns, k);
    } catch (err) {
      liveThrew = err;
    }
    if (live !== null && live !== undefined) return live;
    const quarantined = await this.resolveViaQuarantine(ns, k);
    if (quarantined !== null && quarantined !== undefined) return quarantined;
    // Sin marca de error silenciosa: si el live lanzó y no hay copia en
    // cuarentena, el error original se propaga (contrato previo intacto).
    if (liveThrew !== null && liveThrew !== undefined) throw liveThrew;
    return null;
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
   * Quarantine-aware (FIX-01): fusiona los hits live con los de
   * `quarantine/pending` cuyo `original_namespace` cae bajo algún namespace
   * solicitado (prefijo exacto o `ns/`), marcados con
   * `metadata.quarantined:true`. La expansión interna no re-autoriza.
   */
  async searchMulti(
    namespaces: string[],
    query: string,
    options?: EgoSearchOptions
  ): Promise<Awaited<ReturnType<EgoMemoryAdapter["searchMulti"]>>> {
    for (const ns of namespaces) {
      this.assertAccess(ns, "read");
    }
    try {
      return await searchQuarantineAware(this.storage, namespaces, query, options);
    } catch {
      return await this.storage.searchMulti(namespaces, query, options);
    }
  }

  /**
   * Recuperación por clave o consulta acotada a namespaces autorizados.
   * Quarantine-aware: ante ausencia en live, resuelve vía cuarentena (FIX-01).
   */
  async recall(keyOrQuery: string, namespace?: string): Promise<unknown> {
    const targetNs = namespace ?? `egos/${this.callerId}`;
    this.assertAccess(targetNs, "read");
    let live: unknown = null;
    let liveThrew: unknown = null;
    try {
      live = await this.storage.recall(keyOrQuery, targetNs);
    } catch (err) {
      liveThrew = err;
    }
    if (live !== null && live !== undefined) return live;
    const quarantined = await this.resolveViaQuarantine(targetNs, keyOrQuery);
    if (quarantined !== null && quarantined !== undefined) return quarantined;
    if (liveThrew !== null && liveThrew !== undefined) throw liveThrew;
    return null;
  }

  /**
   * Retorna el adaptador de memoria subyacente.
   */
  getUnderlyingStorage(): EgoMemoryAdapter {
    return this.storage;
  }
}
