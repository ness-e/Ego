// EgoMemoryAdapter — Implementación oficial de acceso único a VantaDB
// IMPORTANTE: Usa NativeVantaDB (napi-rs in-process) para persistencia real.
// NUNCA usar Client de "vantadb" (WASM en memoria, sin persistencia en disco).
// Vía única de import: "vantadb/native" + "vantadb/types" (dep canónica
// versionada `vantadb`; F2T6/H05+M05). Prohibido importar `vantadb-wasm`,
// el entry bare "vantadb" o "vantadb-node" directo desde este paquete.
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { NativeVantaDB } from "vantadb/native";
import type { SearchHit, MemoryRecord } from "vantadb/types";
export type { SearchHit, MemoryRecord };
import { SubEgoManifest, validateSubEgoAccess } from "./sub-egos.js";
import { unwrapMetadata } from "./unwrapMetadata.js";
import { isSensitiveNamespace, isEnforcementDeferred } from "./SensitiveNamespaces.js";
import {
  getQuarantineAware,
  listQuarantineAware,
  type QuarantineAwareRecord,
} from "./QuarantineAwareReads.js";
import { sanitizeForLog, scanEgoPut } from "@ego/security";
import {
  normalizeNativeGraphRag,
  type GraphRagBinding,
  type NativeGraphRagResult,
} from "./GraphRag.js";
import {
  normalizeContextAssemble,
  normalizeMemoryRecall,
  resolveCognitiveBinding,
  type ContextAssembleOptions,
  type ContextAssembleResult,
  type MemoryRecallOptions,
  type MemoryRecallResult,
} from "./CognitivePath.js";
export type {
  ContextAssembleOptions,
  ContextAssembleResult,
  MemoryRecallOptions,
  MemoryRecallResult,
  RecalledMemory,
  MemoryRecallGovernance,
} from "./CognitivePath.js";
export type { QuarantineAwareRecord };

export interface EgoPut {
  namespace: string;
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  ttl_ms?: number;
  /**
   * Procedencia del registro (metadato obligatorio del esquema de
   * namespaces). Si se omite, `writeLive` fuerza `"ego"` (EGO-FIND-35).
   */
  source?: string;
}

/**
 * Opciones internas del borde de escritura (SEC-09).
 * `skipSensitiveNamespaceQuarantine` SOLO lo usa `promote()`: la promoción
 * es supervisión humana explícita (criterio de salida de KB-07), por lo que
 * libera la cuarentena por defecto de namespace. La regla de secretos
 * (SEC-04) NO se omite jamás, ni siquiera en promoción.
 */
export interface PutMultiOptions {
  skipSensitiveNamespaceQuarantine?: boolean;
}

export type RouteDestination = "live" | "quarantine";

/**
 * Reporte de routing por ítem (SEC-09). `put/putMulti` lo retornan para que
 * los llamantes (p. ej. el handler `ipc.memory` de main, sin cambios) puedan
 * surfear el aviso por los canales existentes (`ipc.event`, lista de
 * cuarentena). `notice` es texto listo-para-UI en español, sin valores
 * sensibles (solo reglas y etiquetas `namespace:key`).
 */
export interface PutRouteReport {
  namespace: string;
  key: string;
  routedTo: RouteDestination;
  destinationNamespace: string;
  destinationKey: string;
  reason: string;
  rules?: string[];
  notice: string;
  unencryptedAtRest: boolean;
  /** true cuando el namespace es sensible pero su enforcement está diferido. */
  deferred?: boolean;
}

/** Causa de cuarentena (SEC-09). `unreviewed_input` preserva el uso legacy. */
export type QuarantineKind = "secret_detected" | "sensitive_namespace" | "unreviewed_input";

export interface QuarantineOptions {
  kind?: QuarantineKind;
  /** Nombres de reglas SEC-04 (nunca valores). Solo con kind `secret_detected`. */
  rules?: string[];
  /** Aviso explícito listo-para-UI. Por defecto se construye desde `reason`. */
  notice?: string;
}

/**
 * Información de cuarentena para observabilidad (FIX-02 SEC-09).
 * Solo etiquetas `namespace:key`, reglas y motivos — NUNCA valores ni
 * payloads. El adapter la entrega al sink registrado (main la puentea al
 * `EventBus` → `memory.quarantined` + `system.alert` → canal `ipc.event`).
 */
export interface QuarantinedEventInfo {
  namespace: string;
  key: string;
  destinationNamespace: string;
  destinationKey: string;
  reason: string;
  kind: QuarantineKind;
  rules?: string[];
  notice: string;
}

/** Sink de observabilidad de cuarentena (inyección sin dependencias). */
export type QuarantineEventSink = (info: QuarantinedEventInfo) => void;

export interface EgoSearchOptions {
  topK?: number;
  excludeSuperseded?: boolean;
  minConfidence?: number;
}

export interface EgoDumpReport {
  path: string;
  recordsExported: number;
  namespaces: string[];
  checksum: string;
  durationMs: number;
}

export interface EgoImportReport {
  recordsImported: number;
  namespaces: string[];
  durationMs: number;
}

/**
 * Handle restringido de SOLO-LECTURA al binding nativo (F2T6/H04).
 * `getDb()` expone este subconjunto a nivel de tipos: lectura y barridos
 * (`get/list/search/listNamespaces/capabilities/flush`). Sin `put/putBatch/
 * delete/close`: toda escritura pasa por el adapter (normalización, auditoría,
 * cuarentena). El objeto runtime sigue siendo el binding completo — esta es
 * una barrera de compilación + auditoría, no revocación de runtime.
 */
export type ReadOnlyDbHandle = Pick<
  NativeVantaDB,
  "get" | "list" | "listNamespaces" | "search" | "capabilities" | "flush"
>;

export interface EgoListPage {
  records: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>;
  nextCursor?: number | string;
}

/** Mensaje de error seguro para logs estructurados (err: unknown, sin `any`). */
function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Serialización canónica determinista para digests de auditoría (SEC-06).
 * Claves de objeto ordenadas; `undefined`/funciones/símbolos se omiten
 * (semántica JSON). Dos cuerpos iguales → mismo digest.
 */
export function canonicalAuditJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val !== "object") return JSON.stringify(val) ?? "null";
  if (Array.isArray(val)) return `[${val.map(canonicalAuditJson).join(",")}]`;
  const obj = val as Record<string, unknown>;
  const pairs: string[] = [];
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v === undefined || typeof v === "function" || typeof v === "symbol") continue;
    pairs.push(`${JSON.stringify(k)}:${canonicalAuditJson(v)}`);
  }
  return `{${pairs.join(",")}}`;
}

export interface AuditDigestInput {
  action: string;
  actor: string;
  target?: string;
  subEgoId: string;
  details: Record<string, unknown>;
}

export interface AuditRecordPayload extends AuditDigestInput {
  timestamp: number;
  sha256: string;
}

/**
 * Digest SHA-256 del cuerpo auditable (SEC-06). Excluye `timestamp`/`sha256`
 * para que cualquier lector pueda recomputarlo desde los campos almacenados.
 */
export function computeAuditDigest(input: AuditDigestInput): string {
  return crypto
    .createHash("sha256")
    .update(
      canonicalAuditJson({
        action: input.action,
        actor: input.actor,
        target: input.target ?? null,
        subEgoId: input.subEgoId,
        details: input.details,
      }),
      "utf8"
    )
    .digest("hex");
}

/**
 * Verifica la integridad de un payload de `gov/audit` (SEC-06): recomputa el
 * digest desde los campos almacenados y lo compara con `sha256`. Cualquier
 * manipulación posterior (details, actor, subEgoId, target, action) → false.
 */
export function verifyAuditPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (
    typeof p.action !== "string" ||
    typeof p.actor !== "string" ||
    typeof p.subEgoId !== "string" ||
    typeof p.sha256 !== "string" ||
    typeof p.timestamp !== "number" ||
    !p.details ||
    typeof p.details !== "object"
  ) {
    return false;
  }
  const recomputed = computeAuditDigest({
    action: p.action,
    actor: p.actor,
    target: typeof p.target === "string" ? p.target : undefined,
    subEgoId: p.subEgoId,
    details: p.details as Record<string, unknown>,
  });
  return recomputed === p.sha256;
}

export class EgoMemoryAdapter {
  private db: NativeVantaDB | null = null;
  private isInitialized = false;
  private storagePath: string;
  private quarantineSink?: QuarantineEventSink;

  constructor(storagePath: string, opts?: { onQuarantined?: QuarantineEventSink }) {
    if (!storagePath || storagePath === ":memory:") {
      throw new Error(
        "[EgoMemoryAdapter] Se requiere una ruta de almacenamiento real. " +
        "VantaDB en memoria no persiste datos."
      );
    }
    this.storagePath = storagePath;
    this.quarantineSink = opts?.onQuarantined;
  }

  /**
   * Registra (o sustituye) el sink de observabilidad de cuarentena
   * (FIX-02 SEC-09). Inversión de dependencias: el adapter no conoce el
   * `EventBus` (cero aristas nuevas `@ego/memory → @ego/events`); el main
   * process puentea el sink al bus. Los fallos del sink nunca rompen el
   * routing (fire-and-forget defensivo).
   */
  public setQuarantineSink(sink: QuarantineEventSink | undefined): void {
    this.quarantineSink = sink;
  }

  private emitQuarantined(info: QuarantinedEventInfo): void {
    const sink = this.quarantineSink;
    if (!sink) return;
    try {
      sink(info);
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] quarantine sink falló (routing intacto): ${sanitizeForLog(describeError(err))}`
      );
    }
  }

  /**
   * Inicialización asíncrona obligatoria.
   * Carga dinámicamente NativeVantaDB (módulo ESM) y abre el motor Fjall LSM.
   *
   * Workaround upstream: `VDB-REQ-14` — al conectar, el motor **pre-reserva
   * 320 MB por store** (4 segmentos `vstore_L*.vanta` de 64 MB + `0.jnl`) y
   * `ConnectOptions` **no lo parametriza**. Un store VACÍO ocupa 320,03 MB en
   * disco (medido 2026-10-21) y sólo ~0,45 MB de RSS: el coste es de disco,
   * no de RAM. Ego abre **un solo** store en producción
   * (`apps/desktop/src/main/window/create-window.ts:187`), así que el coste
   * es 320 MB de disco por instalación — cuantificado en el ADR-0023.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    const { NativeVantaDB } = await import("vantadb/native");
    this.db = await NativeVantaDB.connect(this.storagePath, { read_only: false });
    this.isInitialized = true;
  }

  public get ready(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Escape hatch restringido de SOLO-LECTURA al binding nativo (F2T6/H04).
   *
   * NO eliminar: 3 consumidores verificados (2026-10-12) dependen de la
   * paginación con cursor REAL para barridos completos —
   * - `packages/knowledge/src/BitemporalQueries.ts` (`listAllRecords`, F2T3),
   * - `packages/knowledge/src/cursorListing.ts` (`listAllNamespaceRecords`, F2T5),
   * - `packages/recovery/src/ProjectExport.ts` (`listNamespaces`).
   * Eliminar el acceso crudo los rompería; la restricción es por tipo
   * (`ReadOnlyDbHandle`: sin put/putBatch/delete/close) + esta auditoría.
   * Regla: lecturas/cursor aquí, escrituras SOLO vía `put/putMulti`.
   * Vía de migración futura: `listPaged()` en este gateway (F2T6).
   */
  public getDb(): ReadOnlyDbHandle | null {
    return this.db;
  }

  private ensureReady(): NativeVantaDB {
    if (!this.db) {
      throw new Error("[EgoMemoryAdapter] No inicializado. Llamar a init() primero.");
    }
    return this.db;
  }

  /**
   * Escritura en lote con normalización obligatoria de metadatos de auditoría.
   * Fast path BM25 puro (VDB-INC-01): el binding in-process napi-rs NO
   * auto-genera embeddings densos (sin inferencia ONNX en `put`); la vía
   * densa vive en el cognitive path `vantadb-mcp` (capas L0-L3).
   *
   * Borde de enforcement SEC-09 (FIND-249): cada ítem se enruta ANTES de
   * persistir — veredicto de contenido SEC-04 (`scanEgoPut`, sin excepciones)
   * y detector de namespace sensible (`SensitiveNamespaces`). Retorna un
   * reporte por ítem (los llamantes que ignoran el valor no se afectan).
   */
  async putMulti(items: EgoPut[], opts?: PutMultiOptions): Promise<PutRouteReport[]> {
    this.ensureReady();
    const liveItems: EgoPut[] = [];
    const reports: PutRouteReport[] = [];
    for (const item of items) {
      const routed = await this.routeOne(item, opts);
      reports.push(routed.report);
      if (routed.liveItem) liveItems.push(routed.liveItem);
    }
    if (liveItems.length > 0) {
      await this.writeLive(liveItems);
    }
    return reports;
  }

  /**
   * Enruta un ítem: `secret_detected` (bloqueo fail-closed + copia
   * redactada), `sensitive_namespace` (cuarentena por defecto FIND-249) o
   * `live`. Nunca persiste secretos; nunca hace eco de valores en avisos.
   */
  private async routeOne(
    item: EgoPut,
    opts?: PutMultiOptions
  ): Promise<{ report: PutRouteReport; liveItem?: EgoPut }> {
    const liveReport = (reason: string): PutRouteReport => ({
      namespace: item.namespace,
      key: item.key,
      routedTo: "live",
      destinationNamespace: item.namespace,
      destinationKey: item.key,
      reason,
      notice: "",
      unencryptedAtRest: false,
    });

    const secretScan = scanEgoPut({
      namespace: item.namespace,
      key: item.key,
      payload: item.payload,
      metadata: item.metadata,
    });
    if (secretScan.hasSecrets) {
      const rules = [...new Set(secretScan.findings.map((f) => f.rule))].sort();
      const reason = `secret_detected:${rules.join(",")}`;
      const notice =
        `⚠ [SEC-09] Secreto bloqueado en '${item.namespace}:${item.key}' ` +
        `(reglas: ${rules.join(",")}). Original NO persistido; copia redactada ` +
        `en quarantine/pending. Usa CredentialManager (keychain) para secretos.`;
      await this.quarantine(
        {
          namespace: item.namespace,
          key: item.key,
          payload: secretScan.redactedPayload,
          metadata: secretScan.redactedMetadata,
          ttl_ms: item.ttl_ms,
        },
        reason,
        { kind: "secret_detected", rules, notice }
      );
      console.warn(notice);
      this.emitQuarantined({
        namespace: item.namespace,
        key: item.key,
        destinationNamespace: "quarantine/pending",
        destinationKey: `${item.namespace}:${item.key}`,
        reason,
        kind: "secret_detected",
        rules,
        notice,
      });
      return {
        report: {
          ...liveReport(reason),
          routedTo: "quarantine",
          destinationNamespace: "quarantine/pending",
          destinationKey: `${item.namespace}:${item.key}`,
          rules,
          notice,
          unencryptedAtRest: true,
        },
      };
    }

    const verdict = isSensitiveNamespace(item.namespace);
    if (!opts?.skipSensitiveNamespaceQuarantine && verdict.sensitive) {
      if (isEnforcementDeferred(item.namespace)) {
        // Stopgap FIND-249: sensible pero con lectores operativos vivos sin
        // flujo quarantine-aware (ver QUARANTINE_ENFORCEMENT_DEFERRALS).
        // Vive con aviso explícito; la regla de secretos YA se aplicó arriba.
        const reason = "deferred_quarantine_pending_domain_migration";
        const notice =
          `⚠ [SEC-09] '${item.namespace}:${item.key}' escribe en LIVE aunque el ` +
          `namespace es sensible (${verdict.reason}) y no hay cifrado at-rest ` +
          `(VantaDB FIND-249 pendiente). Enforcement diferido hasta lectores ` +
          `quarantine-aware (FIX_PROPUESTO-SEC-09-01).`;
        console.warn(notice);
        return {
          report: {
            ...liveReport(reason),
            notice,
            unencryptedAtRest: true,
            deferred: true,
          },
          liveItem: item,
        };
      }
      const reason = "sensitive_namespace_no_at_rest_encryption";
      const notice =
        `⚠ [SEC-09] '${item.namespace}:${item.key}' → quarantine/pending: ` +
        `namespace sensible (${verdict.reason}) sin cifrado at-rest ` +
        `(VantaDB FIND-249 pendiente). Supervisión requerida para promover.`;
      await this.quarantine(item, reason, { kind: "sensitive_namespace", notice });
      console.warn(notice);
      this.emitQuarantined({
        namespace: item.namespace,
        key: item.key,
        destinationNamespace: "quarantine/pending",
        destinationKey: `${item.namespace}:${item.key}`,
        reason,
        kind: "sensitive_namespace",
        notice,
      });
      return {
        report: {
          ...liveReport(reason),
          routedTo: "quarantine",
          destinationNamespace: "quarantine/pending",
          destinationKey: `${item.namespace}:${item.key}`,
          notice,
          unencryptedAtRest: true,
        },
      };
    }

    return { report: liveReport("live"), liveItem: item };
  }

  /** Escritura física del lote live (normalización + putBatch con fallback). */
  private async writeLive(items: EgoPut[]): Promise<void> {
    const db = this.ensureReady();
    const records = items.map((item) => {
      const payloadStr =
        typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload);

      const metadata: Record<string, unknown> = {};
      // Workaround: VDB-BUG-02 (números JS son f64 IEEE-754; el binding espera
      // variantes etiquetadas `{Float|String|Bool}` / `'Null'`; ver registro).
      if (item.metadata) {
        for (const [k, v] of Object.entries(item.metadata)) {
          if (typeof v === "number") {
            metadata[k] = { Float: v };
          } else if (typeof v === "string") {
            metadata[k] = { String: v };
          } else if (typeof v === "boolean") {
            metadata[k] = { Bool: v };
          } else if (v === null) {
            metadata[k] = "Null";
          } else if (typeof v === "object" && v !== null) {
            metadata[k] = v;
          } else {
            metadata[k] = { String: JSON.stringify(v) };
          }
        }
      }

      const resolvedTs = typeof item.metadata?.ts === "number"
        ? item.metadata.ts
        : (typeof item.metadata?.created_at === "number"
          ? item.metadata.created_at
          : Date.now());

      metadata.org_id = { String: String(item.metadata?.org_id || "org_default") };
      metadata.ts = { Float: resolvedTs };
      metadata.created_at = { Float: resolvedTs };
      metadata.agent_id = { String: String(item.metadata?.agent_id || "ego.nucleus") };
      metadata.confidence = { Float: typeof item.metadata?.confidence === "number" ? item.metadata.confidence : 1.0 };
      metadata.state = { String: String(item.metadata?.state || "active") };
      // EGO-FIND-35: `source` es metadato obligatorio del esquema de
      // namespaces y antes NUNCA se escribía. Ahora se fuerza siempre.
      const source = item.source ?? item.metadata?.source ?? "ego";
      metadata.source = { String: String(source) };

      return {
        namespace: item.namespace,
        key: item.key,
        payload: payloadStr,
        metadata: metadata as Record<string, string | number | boolean | null>,
        ttl_ms: item.ttl_ms,
      };
    });

    try {
      await db.putBatch(records);
    } catch (e) {
      // Defensive fallback (engine-agnostic; NO implica defecto VDB registrado,
      // sin ID upstream): si putBatch rechaza el lote, reintentar secuencial
      // para no perder escrituras. Si el secuencial también falla, propaga.
      // FIX aplicado SEC-09 (diferido SEC-04, aprobado por el owner):
      // sanitizeForLog evita que un mensaje del motor con eco del record
      // filtre un secreto hacia los logs por esta vía lateral.
      console.error(
        `[EgoMemoryAdapter] putMulti putBatch falló, reintentando secuencial: ${sanitizeForLog(describeError(e))}`
      );
      for (const rec of records) {
        await db.put(rec);
      }
    }
  }

  /**
   * Escritura simple para un único ítem (SEC-09: retorna el reporte de
   * routing; los llamantes que ignoran el valor no se ven afectados).
   */
  async put(item: EgoPut, opts?: PutMultiOptions): Promise<PutRouteReport> {
    const reports = await this.putMulti([item], opts);
    const report = reports[0];
    if (!report) {
      throw new Error("[EgoMemoryAdapter] put: routing interno sin reporte (inesperado).");
    }
    return report;
  }

  /**
   * Obtiene un registro por namespace y clave
   */
  async get(namespace: string, key: string): Promise<{ key: string; payload: unknown; metadata: Record<string, unknown> } | null> {
    const db = this.ensureReady();
    const record = await db.get({ namespace, key });
    if (!record) return null;
    // Workaround: VDB-BUG-02 (metadata etiquetada en putMulti; aquí se desenvuelve)
    return { key, payload: this.parseRecord(record), metadata: unwrapMetadata(record.metadata as Record<string, unknown>) };
  }

  /**
   * Lectura quarantine-aware por clave (FIX-01 SEC-09).
   * Implementación única en `QuarantineAwareReads.getQuarantineAware`:
   * live primero, `quarantine/pending` después, con marca explícita.
   */
  async getWithQuarantine(namespace: string, key: string): Promise<QuarantineAwareRecord | null> {
    return getQuarantineAware(this, namespace, key);
  }

  /**
   * Listado quarantine-aware por namespace exacto (FIX-01 SEC-09).
   * Implementación única en `QuarantineAwareReads.listQuarantineAware`.
   * Ante fallo del barrido de cuarentena degrada al listado live con log.
   */
  async listWithQuarantine(namespace: string, limit: number = 100): Promise<QuarantineAwareRecord[]> {
    return listQuarantineAware(this, namespace, limit, (err) => {
      console.error(
        `[EgoMemoryAdapter] listWithQuarantine(${namespace}) barrido de cuarentena falló, solo live: ${sanitizeForLog(describeError(err))}`
      );
    });
  }

  /**
   * Lista registros por namespace usando la API de listado nativa de VantaDB.
   * Firma intacta (F2T6/M07): ante fallo del motor retorna `[]` PERO con log
   * estructurado — vacío NUNCA es silencioso (ver `test/gateway-errors.test.ts`).
   */
  async list(
    namespace: string,
    limit: number = 100
  ): Promise<Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>> {
    const db = this.ensureReady();
    try {
      const page = await db.list({ namespace, limit });
      return page.records.map((r: MemoryRecord) => ({
        key: r.key,
        payload: this.parseRecord(r),
        // Workaround: VDB-BUG-02 (envoltorio etiquetado de metadata)
        metadata: unwrapMetadata(r.metadata as Record<string, unknown>),
      }));
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] list(${namespace}, limit=${limit}) falló, retornando []: ${sanitizeForLog(describeError(err))}`
      );
      return [];
    }
  }

  /**
   * Una página del listado nativo con cursor opaco (F2T6/H04).
   * Vía canónica del gateway para barridos completos sin escapar vía `getDb()`.
   */
  async listPaged(
    namespace: string,
    limit: number = 100,
    cursor?: number | string
  ): Promise<EgoListPage> {
    const db = this.ensureReady();
    // Workaround: VDB-BUG-01 (cursor:undefined se serializa como Null y el
    // binding rechaza con "cursor must be a number"): omitir la clave salvo
    // number/string válidos.
    const page =
      cursor === undefined
        ? await db.list({ namespace, limit })
        : await db.list({ namespace, limit, cursor });
    const next = page.next_cursor;
    return {
      records: page.records.map((r: MemoryRecord) => ({
        key: r.key,
        payload: this.parseRecord(r),
        // Workaround: VDB-BUG-02 (envoltorio etiquetado de metadata)
        metadata: unwrapMetadata(r.metadata as Record<string, unknown>),
      })),
      nextCursor:
        typeof next === "number" || (typeof next === "string" && next !== "")
          ? next
          : undefined,
    };
  }

  /**
   * Elimina un registro por namespace y clave.
   * Firma intacta (F2T6/M07): ante fallo retorna `false` PERO con log
   * estructurado (ver `test/gateway-errors.test.ts`).
   */
  async delete(namespace: string, key: string): Promise<boolean> {
    const db = this.ensureReady();
    try {
      await db.delete({ namespace, key });
      return true;
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] delete(${namespace}, ${key}) falló, retornando false: ${sanitizeForLog(describeError(err))}`
      );
      return false;
    }
  }

  /**
   * Búsqueda federada multi-namespace sobre el fast path BM25.
   *
   * VantaDB soporta `searchMulti` nativo — no iterar manualmente. Las
   * búsquedas por namespace se lanzan en paralelo (`Promise.all`) y los
   * resultados se fusionan por score en un único ranking.
   *
   * **Sin RRF y sin lista vectorial (EGO-FIND-41):** el fast path napi-rs
   * opera en BM25 léxico puro (sin embeddings en el fast path —
   * `VDB-REQ-10`), de modo que no hay lista densa que fusionar ni score
   * coseno por hit. La firma se mantiene intacta (F2T6/M07); la degradación
   * por namespace emite log estructurado vía console.error (ver
   * `test/gateway-errors.test.ts`).
   *
   * `VDB-REQ-02` RESUELTO en 0.9.0: la API documenta el vector vacío para
   * búsqueda sólo-texto y, medido, `search` funciona **sin** `query_vector`
   * cuando hay `text_query`. El workaround `query_vector: []` está RETIRADO
   * (A2-bis, T3): lo que se retira es el workaround, no la limitación.
   *
   * Workaround upstream: `VDB-REQ-10` — el binding `vantadb-node@0.8.0` no
   * expone embeddings en el fast path (el path cognitivo L0-L3 vive en
   * `vantadb-mcp`), por lo que la fusión RRF real (BM25 + denso) no puede
   * calcularse: `searchMulti` devuelve una única lista léxica reordenada por
   * score, sin lista densa que fusionar ni score coseno por hit.
   * TODO(EGO-FIND-41): migrar a RRF real (BM25 + denso) cuando VantaDB
   * exponga scores vectoriales por hit en `search_multi`.
   */
  async searchMulti(
    namespaces: string[],
    query: string,
    options: EgoSearchOptions = {}
  ): Promise<SearchHit[]> {
    const db = this.ensureReady();
    const topK = options.topK ?? 10;

    // Workaround: VDB-BUG-05 (guards.js evalúa `text_query: ""` como falsy y
    // exige un vector **no vacío**; `query_vector: []` también se rechaza:
    // medido en 0.9.0 → "query_vector must be a non-empty array unless
    // text_query or query_sparse is provided"). Barridos sin término léxico
    // deben usar list()/listPaged().
    if (query.trim().length === 0) {
      console.error(
        `[EgoMemoryAdapter] searchMulti(${namespaces.join(",")}) rechazado: texto vacío (VDB-BUG-05); usar list()/listPaged() para barridos`
      );
      return [];
    }

    // Si algún namespace incluye comodín (*), expandir dinámicamente contra los namespaces existentes
    let targetNamespaces = namespaces;
    if (namespaces.some((ns) => ns.includes("*"))) {
      // Workaround: VDB-REQ-01 (search_multi nativo sin soporte de comodines):
      // expandir `prefijo/*` contra listNamespaces() antes de delegar a Rust.
      try {
        const existing = await db.listNamespaces();
        const expanded: string[] = [];
        for (const ns of namespaces) {
          if (ns.includes("*")) {
            const prefix = ns.replace(/\*.*$/, "");
            const matches = existing.filter((e) => e.startsWith(prefix));
            expanded.push(...matches);
          } else {
            expanded.push(ns);
          }
        }
        targetNamespaces = [...new Set(expanded)];
      } catch {
        targetNamespaces = namespaces.filter((ns) => !ns.includes("*"));
      }
    }

    if (targetNamespaces.length === 0) {
      return [];
    }

    // Búsqueda federada paralela a través de los namespaces resueltos
    const hitsPromises = targetNamespaces.map(async (ns) => {
      try {
        return await db.search({
          namespace: ns,
          text_query: query,
          top_k: topK,
          exclude_superseded: options.excludeSuperseded ?? true,
          min_confidence: options.minConfidence,
        });
      } catch (nsErr) {
        console.error(
          `[EgoMemoryAdapter] searchMulti namespace ${ns} falló, degradando a []: ${sanitizeForLog(describeError(nsErr))}`
        );
        return [];
      }
    });

    const results = await Promise.all(hitsPromises);
    const allHits = results.flat();
    allHits.sort((a: SearchHit, b: SearchHit) => (b.score ?? 0) - (a.score ?? 0));
    return allHits.slice(0, topK);
  }

  /**
   * Recuperación por clave exacta con fallback a búsqueda de texto
   */
  async recall(keyOrQuery: string, namespace: string = "kb/docs"): Promise<unknown> {
    const db = this.ensureReady();
    try {
      // 1. Intentar recuperación exacta por clave ({ namespace, key })
      const exact = await db.get({ namespace, key: keyOrQuery });
      if (exact) {
        return this.parseRecord(exact);
      }

      // 2. Si no es clave exacta, realizar búsqueda híbrida de recall
      const hits = await db.search({
        namespace,
        text_query: keyOrQuery,
        top_k: 1,
        exclude_superseded: true,
      });

      const firstHit = hits[0];
      if (firstHit?.record) {
        return this.parseRecord(firstHit.record);
      }

      return null;
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] recall(${namespace}, ${keyOrQuery}) falló, retornando null: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Envía un hecho a cuarentena con TTL controlado.
   * Usa la cuarentena nativa de VantaDB (ADR-046).
   */
  async quarantine(item: EgoPut, reason: string = "unreviewed_input", opts?: QuarantineOptions): Promise<void> {
    const ttlMs = item.ttl_ms || 14 * 24 * 60 * 60 * 1000; // 14 días
    const notice =
      opts?.notice ??
      `⚠ [SEC-09] '${item.namespace}:${item.key}' → quarantine/pending (${reason}). ` +
        `Sin cifrado at-rest (VantaDB FIND-249 pendiente).`;
    await this.putMulti([
      {
        namespace: "quarantine/pending",
        key: `${item.namespace}:${item.key}`,
        payload: item.payload,
        metadata: {
          ...item.metadata,
          original_namespace: item.namespace,
          original_key: item.key,
          quarantine_reason: reason,
          quarantine_kind: opts?.kind ?? "unreviewed_input",
          quarantine_rules: (opts?.rules ?? []).join(","),
          // FIND-249: el motor no cifra at-rest; el aviso viaja con el
          // registro para que la UI existente (lista de cuarentena vía
          // `ipc.knowledge.quarantine`) lo muestre sin crear UI nueva.
          unencrypted_at_rest: true,
          upstream: "VDB-FIND-249",
          ui_notice: notice,
          expires_at: Date.now() + ttlMs,
          state: "quarantined",
          quarantined_at: Date.now(),
        },
        ttl_ms: ttlMs,
      },
    ]);
  }

  /**
   * Promueve un hecho de cuarentena hacia su namespace destino
   */
  async promote(
    quarantineKey: string,
    targetNamespace?: string,
    targetKey?: string
  ): Promise<void> {
    const db = this.ensureReady();
    const quarantined = await db.get({ namespace: "quarantine/pending", key: quarantineKey });

    if (!quarantined) {
      throw new Error(`Hecho no encontrado en cuarentena: ${quarantineKey}`);
    }

    const meta = this.unwrapMetadata(quarantined.metadata as Record<string, unknown>);
    const destinationNs = targetNamespace || String(meta.original_namespace || "kb/docs");
    const destinationKey = targetKey || String(meta.original_key || quarantineKey);

    // 1. Escribir en destino. La promoción es supervisión humana explícita
    // (criterio de salida de KB-07): omite la cuarentena por defecto de
    // namespace, pero NUNCA la regla de secretos — si el destino contiene
    // secretos, se bloquea fail-closed y la fuente se preserva.
    const [destinationReport] = await this.putMulti(
      [
        {
          namespace: destinationNs,
          key: destinationKey,
          payload: quarantined.payload,
          metadata: {
            ...(meta as Record<string, unknown>),
            state: "validated",
            promoted_at: Date.now(),
          },
        },
      ],
      { skipSensitiveNamespaceQuarantine: true }
    );
    if (!destinationReport || destinationReport.routedTo === "quarantine") {
      const rules = destinationReport?.rules?.join(",") ?? "unknown";
      throw new Error(
        `[EgoMemoryAdapter] promote bloqueado: el contenido destino contiene secretos ` +
          `(reglas: ${rules}). Fuente preservada en cuarentena. Sanee el contenido y use CredentialManager.`
      );
    }

    // 2. Eliminar de cuarentena ({ namespace, key })
    await db.delete({ namespace: "quarantine/pending", key: quarantineKey });

    // 3. Registrar auditoría inmutable (SEC-06: vía recordAudit → sha256 + subEgoId)
    await this.recordAudit(
      "promote",
      "human_supervisor",
      {
        from: "quarantine/pending",
        to: `${destinationNs}:${destinationKey}`,
        promoted_by: "human_supervisor",
      },
      `${destinationNs}:${destinationKey}`
    );
  }

  /**
   * Sustituye un hecho existente (supersede) marcando versión y arista en grafo.
   * Usa la supersesión nativa de VantaDB (ADR-028: soft-replace, nunca borra en caliente).
   */
  async supersedeFact(oldKey: string, newItem: EgoPut): Promise<void>;
  async supersedeFact(
    namespace: string,
    oldKey: string,
    newKey: string,
    newPayload: unknown,
    newMetadata?: Record<string, unknown>
  ): Promise<void>;
  async supersedeFact(
    param1: string,
    param2: EgoPut | string,
    param3?: string,
    param4?: unknown,
    param5?: Record<string, unknown>
  ): Promise<void> {
    let oldKey: string;
    let newItem: EgoPut;

    if (typeof param2 === "string") {
      const namespace = param1;
      oldKey = param2;
      const newKey = param3!;
      const payload = param4;
      const metadata = param5;
      newItem = {
        namespace,
        key: newKey,
        payload,
        metadata,
      };
    } else {
      oldKey = param1;
      newItem = param2;
    }

    const db = this.ensureReady();
    const now = Date.now();

    // 1. Guardar nuevo hecho marcando is_latest: true y enlace causal hacia el hecho sustituido
    const newRecord: EgoPut = {
      ...newItem,
      metadata: {
        ...(newItem.metadata || {}),
        is_latest: true,
        supersedes: oldKey,
        created_at: typeof newItem.metadata?.created_at === "number" ? newItem.metadata.created_at : now,
      },
    };
    await this.putMulti([newRecord]);

    // 2. Marcar hecho previo como superseded con is_latest: false conservando trazabilidad causal inmutable
    try {
      const existing = await db.get({ namespace: newItem.namespace, key: oldKey });
      if (existing) {
        const prevMeta = this.unwrapMetadata(existing.metadata as Record<string, unknown>);
        await this.putMulti([
          {
            namespace: newItem.namespace,
            key: oldKey,
            payload: existing.payload,
            metadata: {
              ...prevMeta,
              is_latest: false,
              state: "superseded",
              superseded_by: newItem.key,
              superseded_at: now,
            },
          },
        ]);
      }
    } catch (e) {
      console.warn(
        `[EgoMemoryAdapter] VantaDB supersede versioning warning: ${sanitizeForLog(describeError(e))}`
      );
    }

    // 3. Registrar auditoría (SEC-06: vía recordAudit → sha256 + subEgoId)
    await this.recordAudit(
      "supersede",
      "ego.nucleus",
      {
        namespace: newItem.namespace,
        old_key: oldKey,
        new_key: newItem.key,
        superseded_at: Date.now(),
      },
      `${newItem.namespace}:${newItem.key}`
    );
  }

  private unwrapMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
    if (!metadata) return {};
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === "object" && v !== null) {
        if ("String" in v) clean[k] = (v as { String: unknown }).String;
        else if ("Float" in v) clean[k] = (v as { Float: unknown }).Float;
        else if ("Bool" in v) clean[k] = (v as { Bool: unknown }).Bool;
        else clean[k] = v;
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  /**
   * Id de nodo de grafo (`node_id`, u128 decimal) de un registro KV.
   *
   * Es la llave que une el registro del namespace con su nodo en el sustrato
   * de grafo: `graphragSearch` siembra por búsqueda en el namespace y expande
   * por aristas sobre esos mismos ids.
   *
   * Workaround: VDB-REQ-12 — el sustrato de grafo no se sembraba, de modo que
   * la expansión nativa del GraphRAG devolvía `edges: []`.
   */
  async getGraphNodeId(namespace: string, key: string): Promise<string | null> {
    const db = this.ensureReady();
    try {
      const record = await db.get({ namespace, key });
      const nodeId = record?.node_id;
      return nodeId === undefined || nodeId === null ? null : String(nodeId);
    } catch (err) {
      console.warn(
        `[EgoMemoryAdapter] getGraphNodeId(${namespace}:${key}) falló: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Inserta (o actualiza) un nodo del sustrato de grafo.
   *
   * El binding napi-rs 0.8.0 expone `insertNode`/`addEdge`/`getNode`; este
   * adaptador los delega con *capability probe* para no romper con bindings
   * que no los expongan.
   *
   * Workaround: VDB-REQ-12 — siembra del sustrato de grafo, que no existía
   * (sin `insertNode`/`addEdge` el GraphRAG nativo no tenía aristas).
   */
  async insertGraphNode(id: string, content: string): Promise<boolean> {
    const db = this.ensureReady();
    const binding = db as unknown as {
      insertNode?: (input: { id: string; content?: string }) => Promise<void>;
    };
    if (typeof binding.insertNode !== "function") return false;
    try {
      await binding.insertNode({ id, content });
      return true;
    } catch (err) {
      console.warn(
        `[EgoMemoryAdapter] insertGraphNode(${id}) falló: ${sanitizeForLog(describeError(err))}`
      );
      return false;
    }
  }

  /**
   * Crea una arista dirigida entre dos nodos del grafo.
   * El binding crea automáticamente la arista inversa.
   *
   * Workaround: VDB-REQ-12 — siembra del sustrato de grafo (sin aristas, el
   * GraphRAG nativo no tenía relaciones que recorrer).
   */
  async addGraphEdge(
    sourceId: string,
    targetId: string,
    label: string,
    weight?: number
  ): Promise<boolean> {
    const db = this.ensureReady();
    const binding = db as unknown as {
      addEdge?: (source: string, target: string, label: string, weight?: number) => Promise<void>;
    };
    if (typeof binding.addEdge !== "function") return false;
    try {
      await binding.addEdge(sourceId, targetId, label, weight);
      return true;
    } catch (err) {
      console.warn(
        `[EgoMemoryAdapter] addGraphEdge(${sourceId}→${targetId}) falló: ${sanitizeForLog(describeError(err))}`
      );
      return false;
    }
  }

  /**
   * Enlaza dos registros KV como nodos del grafo.
   *
   * Resuelve el `node_id` de ambos y crea la arista. Es la vía por la que
   * las relaciones que Ego ya conoce (cadena causal de ingeniería, hechos
   * derivados, supersedes) se convierten en **aristas reales** que el
   * pipeline GraphRAG nativo puede recorrer.
   *
   * Workaround: VDB-REQ-12 — siembra del sustrato de grafo (el binding 0.8.0
   * sí expone `insertNode`/`addEdge`, pero Ego no lo invocaba y el grafo
   * quedaba vacío).
   */
  async linkGraphNodes(
    sourceNamespace: string,
    sourceKey: string,
    targetNamespace: string,
    targetKey: string,
    label: string,
    weight?: number
  ): Promise<boolean> {
    const [sourceId, targetId] = await Promise.all([
      this.getGraphNodeId(sourceNamespace, sourceKey),
      this.getGraphNodeId(targetNamespace, targetKey),
    ]);
    if (!sourceId || !targetId) return false;
    return this.addGraphEdge(sourceId, targetId, label, weight);
  }

  /**
   * Pipeline GraphRAG nativo de VantaDB (DIST-15).
   *
   * El binding napi-rs 0.8.0 expone `graphragSearch(namespace, query, queryVector?)`
   * con la forma canónica `{ nodes, edges, context_text, stats }`; las aristas
   * provienen del **sustrato de grafo real** (`insertNode`/`addEdge`), no de
   * heurísticas de metadatos.
   *
   * Workaround upstream: `VDB-REQ-11` — el binding 0.8.0 no expone el motor
   * IQL (`query`), de modo que el descubrimiento de aristas del GraphRAG se
   * hace vía `graphragSearch` y, si el grafo no aporta aristas, degrada a
   * heurística (metadata + regex).
   * Workaround: `VDB-REQ-12` — siembra del sustrato de grafo: sin
   * `insertNode`/`addEdge` la fase nativa devolvía `edges: []`; hoy Ego
   * puebla aristas reales (ver `linkGraphNodes`).
   *
   * Capability probe: si el binding no expone el método (versiones
   * anteriores) se devuelve `null` y el llamante degrada a su método
   * heurístico. Si el grafo está vacío (todavía sin sembrar), el resultado
   * llega con `edges: []` y también degrada.
   */
  async graphRagSearch(
    namespace: string,
    query: string,
    queryVector?: number[]
  ): Promise<NativeGraphRagResult | null> {
    const db = this.ensureReady();
    const binding = db as unknown as Partial<GraphRagBinding>;
    if (typeof binding.graphragSearch !== "function") return null;
    try {
      const raw = await binding.graphragSearch(namespace, query, queryVector ?? null);
      return normalizeNativeGraphRag(raw);
    } catch (err) {
      console.warn(
        `[EgoMemoryAdapter] graphRagSearch(${namespace}) falló, degradando a null: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Recall cognitivo nativo con re-rank compuesto por CONFIANZA (VDB-REQ-15).
   *
   * La capacidad **YA EXISTE** en el motor 0.9.0: `memoryRecall({trust_aware:true})`
   * (ver `vantadb-node@0.9.0/index.d.ts:614`). Lo que faltaba era el cableado
   * en Ego: el `TrustBoundary` (ADR-0019) decide qué procedencias son de
   * confianza y el motor las pondera en el re-rank, de modo que el contenido
   * no confiable no sube por repetición de término.
   *
   * `trust_aware` por defecto **true** (es el path que el `TrustBoundary`
   * quiere); `false` conserva el orden legacy byte a byte.
   *
   * `allow_prefixes` es la ACL de inyección (la produce
   * `trustedAllowPrefixes` del `TrustBoundary`). **No se envía si está vacía**:
   * el motor interpreta una lista vacía como "allow-all", y eso sería un
   * fail-open. La puerta fina (qué se inyecta al final en el prompt) es
   * `selectTrustedForInjection` del runtime, que sí es fail-closed.
   *
   * Alcance: la API pública de la fachada no expone el método (`VDB-REQ-16`);
   * el puente de alcance vive en `CognitivePath.ts` (ADR-0023). Si el motor no
   * está disponible, degrada a `null` (fail-soft) sin romper el turno.
   */
  async memoryRecall(options: MemoryRecallOptions): Promise<MemoryRecallResult | null> {
    const db = this.ensureReady();
    const binding = resolveCognitiveBinding(db);
    if (!binding) {
      console.warn(
        "[EgoMemoryAdapter] memoryRecall no disponible: el binding no expone la API cognitiva (VDB-REQ-16); se degrada a null."
      );
      return null;
    }
    try {
      const allow = options.allow_prefixes?.filter((p) => p.trim().length > 0) ?? [];
      const payload: Record<string, unknown> = {
        ...options,
        trust_aware: options.trust_aware ?? true,
        now_ms: options.now_ms ?? Date.now(),
      };
      // Lista vacía = allow-all en el motor ⇒ no se envía en ese caso.
      if (allow.length > 0) payload["allow_prefixes"] = allow;
      else delete payload["allow_prefixes"];

      const raw = await binding.memoryRecall(payload);
      return normalizeMemoryRecall(raw);
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] memoryRecall falló, degradando a null: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Compactación NATIVA del contexto (`contextAssemble`).
   *
   * El motor es una función pura sin estado de motor (funciona con la base
   * de datos cerrándose) y preserva el prefijo protegido y los pares
   * `tool_call`/`tool_result` — la **puerta de invariantes** del ADR-0020.
   *
   * Alcance: la API pública de la fachada no expone el método (`VDB-REQ-16`);
   * el puente de alcance vive en `CognitivePath.ts` (ADR-0023).
   */
  async contextAssemble(
    options: ContextAssembleOptions
  ): Promise<ContextAssembleResult | null> {
    const db = this.ensureReady();
    const binding = resolveCognitiveBinding(db);
    if (!binding) {
      console.warn(
        "[EgoMemoryAdapter] contextAssemble no disponible: el binding no expone la API cognitiva (VDB-REQ-16); se degrada a null."
      );
      return null;
    }
    try {
      const raw = await binding.contextAssemble(options);
      return normalizeContextAssemble(raw);
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] contextAssemble falló, degradando a null: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Consolidación LLM-free de una sesión (`memoryConsolidate`).
   *
   * El motor es fail-closed: una sesión que no está idle es un error, nunca
   * un no-op silencioso. Aquí el error se traduce a `null` + log (el turno no
   * se cae por una consolidación fallida).
   */
  async memoryConsolidate(options: {
    session_id: string;
    now_ms?: number;
    last_active_at_ms?: number;
    idle_threshold_ms?: number;
  }): Promise<unknown | null> {
    const db = this.ensureReady();
    const binding = resolveCognitiveBinding(db);
    if (!binding) {
      console.warn(
        "[EgoMemoryAdapter] memoryConsolidate no disponible: el binding no expone la API cognitiva (VDB-REQ-16); se degrada a null."
      );
      return null;
    }
    try {
      return await binding.memoryConsolidate(options);
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] memoryConsolidate falló, degradando a null: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Refuerza un recuerdo recuperado (`memoryReinforce`).
   *
   * `outcome` es el desenlace del uso del recuerdo: `used` | `corrected` |
   * `unused`. El motor rechaza tokens desconocidos (nunca los infiere).
   */
  async memoryReinforce(hit: unknown, outcome: "used" | "corrected" | "unused"): Promise<unknown | null> {
    const db = this.ensureReady();
    const binding = resolveCognitiveBinding(db);
    if (!binding) {
      console.warn(
        "[EgoMemoryAdapter] memoryReinforce no disponible: el binding no expone la API cognitiva (VDB-REQ-16); se degrada a null."
      );
      return null;
    }
    try {
      return await binding.memoryReinforce(hit, outcome);
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] memoryReinforce falló, degradando a null: ${sanitizeForLog(describeError(err))}`
      );
      return null;
    }
  }

  /**
   * Consultas IQL (Integrated Query Language v4).
   *
   * Capability probe: el binding napi-rs 0.8.0 **no expone** el motor IQL
   * (no existe método `query` en `NativeVantaDB`), por lo que la llamada
   * devuelve `{ ok: false }` y el grafo debe consultarse vía
   * `graphragSearch()` / API de grafo (`getNode`, `graphBfs`, …).
   *
   * Workaround upstream: `VDB-REQ-11` — ausencia de `query`/IQL en el
   * binding napi-rs 0.8.0: el descubrimiento de aristas del GraphRAG no
   * puede consultarse con `graphQuery` y usa `graphragSearch()` / API de
   * grafo (`getNode`, `graphBfs`, …). Registrado en
   * `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (handoff A2 → A1).
   */
  async graphQuery(queryStr: string): Promise<unknown> {
    const db = this.ensureReady();
    try {
      if (typeof (db as unknown as { query?: (q: string) => Promise<unknown> }).query === "function") {
        return await (db as unknown as { query: (q: string) => Promise<unknown> }).query(queryStr);
      }
      return { ok: false, error: "IQL query engine not exposed on NativeVantaDB binding yet" };
    } catch (err) {
      console.warn(
        `[EgoMemoryAdapter] Error ejecutando graphQuery: ${sanitizeForLog(describeError(err))}`
      );
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Listado de namespaces activos
   */
  async listNamespaces(): Promise<string[]> {
    const db = this.ensureReady();
    return await db.listNamespaces();
  }

  /**
   * Flush: sincroniza WAL y buffers a disco
   */
  async flush(): Promise<void> {
    const db = this.ensureReady();
    await db.flush();
  }

  /**
   * Cierre ordenado con barrera de durabilidad (OpGate).
   * Espera a que todas las operaciones en vuelo terminen antes de cerrar.
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Registro y gestión de Sub-Egos
   */
  async registerSubEgo(manifest: SubEgoManifest): Promise<void> {
    await this.putMulti([
      {
        namespace: "gov/sub_egos",
        key: manifest.id,
        payload: manifest,
        metadata: {
          name: manifest.name,
          role: manifest.role,
          state: manifest.state,
          creator: manifest.creator,
        },
      },
    ]);
  }

  async listSubEgos(): Promise<SubEgoManifest[]> {
    const db = this.ensureReady();
    try {
      const page = await db.list({ namespace: "gov/sub_egos", limit: 100 });
      return page.records.map((r: MemoryRecord) => this.parseRecord(r) as SubEgoManifest);
    } catch (err) {
      console.error(
        `[EgoMemoryAdapter] listSubEgos() falló, retornando []: ${sanitizeForLog(describeError(err))}`
      );
      return [];
    }
  }

  private parseRecord(record: MemoryRecord): unknown {
    try {
      return JSON.parse(record.payload);
    } catch {
      return record.payload;
    }
  }

  /**
   * Valida permisos de un Sub-Ego antes de operar
   */
  public checkSubEgoPermission(
    manifest: SubEgoManifest,
    namespace: string,
    op: "read" | "write"
  ): boolean {
    return validateSubEgoAccess(manifest, namespace, op);
  }

  /**
   * Registra una acción sensible en el log inmutable de auditoría (gov/audit).
   * SEC-06: cada entrada porta `sha256` (digest canónico recomputable vía
   * `verifyAuditPayload`) + `subEgoId` (por defecto `ego.nucleus`).
   * Retorna la key asignada (`<action>:<ts>:<digest12>`) para verificación.
   * Firma compatible: `target` y `subEgoId` opcionales posicionales.
   */
  async recordAudit(
    action: string,
    actor: string,
    details: Record<string, unknown>,
    target?: string,
    subEgoId?: string
  ): Promise<string> {
    const resolvedSubEgo = subEgoId ?? "ego.nucleus";
    const timestamp = Date.now();
    const sha256 = computeAuditDigest({ action, actor, target, subEgoId: resolvedSubEgo, details });
    const key = `${action}:${timestamp}:${sha256.slice(0, 12)}`;
    await this.putMulti([
      {
        namespace: "gov/audit",
        key,
        payload: {
          action,
          actor,
          target,
          subEgoId: resolvedSubEgo,
          details,
          timestamp,
          sha256,
        },
        metadata: {
          audit_action: action,
          sub_ego: resolvedSubEgo,
          sha256,
          ts: timestamp,
        },
      },
    ]);
    return key;
  }

  /**
   * Exporta la base de datos o namespaces seleccionados a un archivo .vdbdump
   * Formato canónico: Cabecera "VDBJSON\n" seguida de un JSON por línea con el registro completo (ADR-046/§15).
   */
  async exportDump(targetFilePath?: string, targetNamespaces?: string[]): Promise<EgoDumpReport> {
    const db = this.ensureReady();
    const startTime = Date.now();

    const dumpPath =
      targetFilePath || path.join(this.storagePath, `ego_backup_${Date.now()}.vdbdump`);
    const namespaces = targetNamespaces || (await this.listNamespaces());

    let totalRecords = 0;
    const lines: string[] = ["VDBJSON\n"];
    const hash = crypto.createHash("sha256");
    hash.update("VDBJSON\n");

    for (const ns of namespaces) {
      let cursor: number | undefined = undefined;
      do {
        const listOpts: { namespace: string; limit: number; cursor?: number } = {
          namespace: ns,
          limit: 100,
        };
        // Workaround: VDB-BUG-01 (cursor:undefined → Null → "cursor must be a
        // number"): inyectar la clave SOLO cuando es number válido.
        if (typeof cursor === "number") {
          listOpts.cursor = cursor;
        }
        const page = await db.list(listOpts);
        for (const record of page.records) {
          totalRecords++;
          const jsonLine = JSON.stringify(record) + "\n";
          lines.push(jsonLine);
          hash.update(jsonLine);
        }
        cursor =
          typeof page.next_cursor === "number"
            ? page.next_cursor
            : typeof page.next_cursor === "string" && !isNaN(Number(page.next_cursor))
            ? Number(page.next_cursor)
            : undefined;
      } while (cursor !== undefined);
    }

    await fs.mkdir(path.dirname(dumpPath), { recursive: true });
    await fs.writeFile(dumpPath, lines.join(""), "utf8");

    const checksum = hash.digest("hex");
    return {
      path: dumpPath,
      recordsExported: totalRecords,
      namespaces,
      checksum,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Importa y restaura registros desde un archivo .vdbdump
   * Valida la cabecera canónica VDBJSON e inserta por lotes en NativeVantaDB.
   */
  async importDump(sourceFilePath: string): Promise<EgoImportReport> {
    const startTime = Date.now();

    const content = await fs.readFile(sourceFilePath, "utf8");
    const rawLines = content.split("\n").filter((l) => l.trim().length > 0);

    if (rawLines.length === 0 || rawLines[0] !== "VDBJSON") {
      throw new Error(
        `[EgoMemoryAdapter] Archivo de backup inválido: falta cabecera VDBJSON en ${sourceFilePath}`
      );
    }

    const recordsToPut: EgoPut[] = [];
    const namespacesSeen = new Set<string>();

    for (let i = 1; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      if (!rawLine) continue;
      try {
        const parsed = JSON.parse(rawLine) as MemoryRecord;
        if (parsed.namespace && parsed.key) {
          namespacesSeen.add(parsed.namespace);
          recordsToPut.push({
            namespace: parsed.namespace,
            key: parsed.key,
            payload: parsed.payload,
            metadata: parsed.metadata as Record<string, unknown>,
          });
        }
      } catch (e) {
        console.warn(
          `[EgoMemoryAdapter] Línea ${i + 1} corrupta en ${sourceFilePath}: ${sanitizeForLog(describeError(e))}`
        );
      }
    }

    if (recordsToPut.length > 0) {
      await this.putMulti(recordsToPut);
      await this.flush();
    }

    return {
      recordsImported: recordsToPut.length,
      namespaces: Array.from(namespacesSeen),
      durationMs: Date.now() - startTime,
    };
  }
}
