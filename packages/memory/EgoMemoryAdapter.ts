// EgoMemoryAdapter — Implementación oficial de acceso único a VantaDB
// IMPORTANTE: Usa NativeVantaDB (napi-rs in-process) para persistencia real.
// NUNCA usar Client de "vantadb" (WASM en memoria, sin persistencia en disco).
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { NativeVantaDB } from "vantadb/native";
import type { SearchHit, MemoryRecord } from "vantadb/types";
export type { SearchHit, MemoryRecord };
import { SubEgoManifest, validateSubEgoAccess } from "./sub-egos.js";
import { unwrapMetadata } from "./unwrapMetadata.js";

export interface EgoPut {
  namespace: string;
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  ttl_ms?: number;
}

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

export interface VersionNode {
  key: string;
  namespace: string;
  payload: unknown;
  metadata: Record<string, unknown>;
  supersededBy?: string;
  supersedes?: string;
  supersededAt?: number;
  createdAt: number;
  isLatest: boolean;
  versionIndex: number;
}

export class EgoMemoryAdapter {
  private db: NativeVantaDB | null = null;
  private isInitialized = false;
  private storagePath: string;

  constructor(storagePath: string) {
    if (!storagePath || storagePath === ":memory:") {
      throw new Error(
        "[EgoMemoryAdapter] Se requiere una ruta de almacenamiento real. " +
        "VantaDB en memoria no persiste datos."
      );
    }
    this.storagePath = storagePath;
  }

  /**
   * Inicialización asíncrona obligatoria.
   * Carga dinámicamente NativeVantaDB (módulo ESM) y abre el motor Fjall LSM.
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

  public getDb(): NativeVantaDB | null {
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
   * NativeVantaDB auto-genera embeddings via ONNX Runtime si no se provee vector.
   */
  async putMulti(items: EgoPut[]): Promise<void> {
    const db = this.ensureReady();
    const records = items.map((item) => {
      const payloadStr =
        typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload);

      const metadata: Record<string, unknown> = {};
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
      // Fallback a escritura secuencial si putBatch tiene restricciones
      for (const rec of records) {
        await db.put(rec);
      }
    }
  }

  /**
   * Escritura simple para un único ítem
   */
  async put(item: EgoPut): Promise<void> {
    return this.putMulti([item]);
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
   * Lista registros por namespace usando la API de listado nativa de VantaDB
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
        metadata: r.metadata as Record<string, unknown>,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Elimina un registro por namespace y clave
   */
  async delete(namespace: string, key: string): Promise<boolean> {
    const db = this.ensureReady();
    try {
      await db.delete({ namespace, key });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Búsqueda híbrida multi-namespace con RRF (BM25 + HNSW).
   * VantaDB soporta searchMulti nativo — no iterar manualmente.
   */
  async searchMulti(
    namespaces: string[],
    query: string,
    options: EgoSearchOptions = {}
  ): Promise<SearchHit[]> {
    const db = this.ensureReady();
    const topK = options.topK ?? 10;

    // Si algún namespace incluye comodín (*), expandir dinámicamente contra los namespaces existentes
    let targetNamespaces = namespaces;
    if (namespaces.some((ns) => ns.includes("*"))) {
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
          query_vector: [],
          top_k: topK,
          exclude_superseded: options.excludeSuperseded ?? true,
          min_confidence: options.minConfidence,
        });
      } catch (nsErr) {
        console.warn(`[EgoMemoryAdapter] Error en búsqueda de namespace ${ns}:`, nsErr);
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
        query_vector: [],
        top_k: 1,
        exclude_superseded: true,
      });

      if (hits.length > 0 && hits[0].record) {
        return this.parseRecord(hits[0].record);
      }

      return null;
    } catch (err) {
      console.warn(`[EgoMemoryAdapter] Error en recall (${namespace}, ${keyOrQuery}):`, err);
      return null;
    }
  }

  /**
   * Envía un hecho a cuarentena con TTL controlado.
   * Usa la cuarentena nativa de VantaDB (ADR-046).
   */
  async quarantine(item: EgoPut, reason: string = "unreviewed_input"): Promise<void> {
    const ttlMs = item.ttl_ms || 14 * 24 * 60 * 60 * 1000; // 14 días
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

    const meta = quarantined.metadata as Record<string, unknown>;
    const destinationNs = targetNamespace || String(meta.original_namespace || "kb/docs");
    const destinationKey = targetKey || String(meta.original_key || quarantineKey);

    // 1. Escribir en destino
    await this.putMulti([
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
    ]);

    // 2. Eliminar de cuarentena ({ namespace, key })
    await db.delete({ namespace: "quarantine/pending", key: quarantineKey });

    // 3. Registrar auditoría inmutable
    await this.putMulti([
      {
        namespace: "gov/audit",
        key: `promote:${Date.now()}:${destinationKey}`,
        payload: {
          action: "promote",
          from: "quarantine/pending",
          to: `${destinationNs}:${destinationKey}`,
          promoted_by: "human_supervisor",
        },
      },
    ]);
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
      console.warn("[EgoMemoryAdapter] VantaDB supersede versioning warning:", e);
    }

    // 3. Registrar auditoría
    await this.putMulti([
      {
        namespace: "gov/audit",
        key: `supersede:${Date.now()}:${oldKey}`,
        payload: {
          action: "supersede",
          namespace: newItem.namespace,
          old_key: oldKey,
          new_key: newItem.key,
          superseded_at: Date.now(),
        },
      },
    ]);
  }

  /**
   * Reconstruye el árbol/cadena de versiones de un hecho o entidad (DSEK-02).
   * Sigue los punteros causales `supersedes` hacia atrás y `superseded_by` hacia adelante.
   */
  async getVersionHistory(namespace: string, key: string): Promise<VersionNode[]> {
    const db = this.ensureReady();
    const visited = new Set<string>();

    // 1. Obtener el registro inicial
    const startRecord = await db.get({ namespace, key });
    if (!startRecord) return [];

    // 2. Caminar hacia atrás para encontrar la raíz (versión 1)
    let rootKey = key;
    let curr = startRecord;
    while (curr) {
      visited.add(curr.key);
      const meta = this.unwrapMetadata(curr.metadata as Record<string, unknown>);
      const parentKey = typeof meta.supersedes === "string" ? meta.supersedes : null;
      if (!parentKey || visited.has(parentKey)) break;
      const parentRec = await db.get({ namespace, key: parentKey });
      if (!parentRec) break;
      curr = parentRec;
      rootKey = parentKey;
    }

    // 3. Caminar hacia adelante desde la raíz siguiendo superseded_by
    const chain: VersionNode[] = [];
    visited.clear();
    let forwardKey: string | null = rootKey;
    let versionIndex = 1;

    while (forwardKey && !visited.has(forwardKey)) {
      visited.add(forwardKey);
      const rec = await db.get({ namespace, key: forwardKey });
      if (!rec) break;

      const meta = this.unwrapMetadata(rec.metadata as Record<string, unknown>);
      const supersededBy = typeof meta.superseded_by === "string" ? meta.superseded_by : undefined;
      const supersedes = typeof meta.supersedes === "string" ? meta.supersedes : undefined;
      const supersededAt = typeof meta.superseded_at === "number" ? meta.superseded_at : undefined;
      const createdAt = typeof meta.ts === "number" ? meta.ts : (typeof meta.created_at === "number" ? meta.created_at : 0);
      const isLatest = meta.is_latest === true || (!supersededBy && meta.state !== "superseded");

      chain.push({
        key: rec.key,
        namespace,
        payload: this.parseRecord(rec),
        metadata: meta,
        supersededBy,
        supersedes,
        supersededAt,
        createdAt,
        isLatest,
        versionIndex: versionIndex++,
      });

      forwardKey = supersededBy || null;
    }

    return chain;
  }

  /**
   * Consulta time-travel (DSEK-02): Recupera el estado de una entidad en un instante temporal específico.
   */
  async getAtTimestamp(namespace: string, key: string, targetTimestamp: number): Promise<VersionNode | null> {
    const history = await this.getVersionHistory(namespace, key);
    if (history.length === 0) return null;

    for (const node of history) {
      const created = node.createdAt;
      const supersededAt = node.supersededAt;
      if (created <= targetTimestamp) {
        if (!supersededAt || supersededAt > targetTimestamp) {
          return node;
        }
      }
    }

    if (history[0].createdAt > targetTimestamp) {
      return null;
    }

    const priorNodes = history.filter((n) => n.createdAt <= targetTimestamp);
    return priorNodes.length > 0 ? priorNodes[priorNodes.length - 1] : null;
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
   * Consultas IQL (Integrated Query Language v4)
   */
  async graphQuery(queryStr: string): Promise<unknown> {
    const db = this.ensureReady();
    try {
      if (typeof (db as unknown as { query?: (q: string) => Promise<unknown> }).query === "function") {
        return await (db as unknown as { query: (q: string) => Promise<unknown> }).query(queryStr);
      }
      return { ok: false, error: "IQL query engine not exposed on NativeVantaDB binding yet" };
    } catch (err) {
      console.warn("[EgoMemoryAdapter] Error ejecutando graphQuery:", err);
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
    } catch {
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
   * Registra una acción sensible en el log inmutable de auditoría (gov/audit)
   */
  async recordAudit(
    action: string,
    actor: string,
    details: Record<string, unknown>,
    target?: string
  ): Promise<void> {
    await this.putMulti([
      {
        namespace: "gov/audit",
        key: `${action}:${Date.now()}`,
        payload: {
          action,
          actor,
          target,
          details,
          timestamp: Date.now(),
        },
      },
    ]);
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
      try {
        const parsed = JSON.parse(rawLines[i]) as MemoryRecord;
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
        console.warn(`[EgoMemoryAdapter] Línea ${i + 1} corrupta en ${sourceFilePath}:`, e);
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
