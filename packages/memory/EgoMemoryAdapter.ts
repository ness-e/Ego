// EgoMemoryAdapter — Implementación oficial de acceso único a VantaDB
// IMPORTANTE: Usa NativeVantaDB (napi-rs in-process) para persistencia real.
// NUNCA usar Client de "vantadb" (WASM en memoria, sin persistencia en disco).
import { NativeVantaDB } from "vantadb/native";
import type { SearchHit, MemoryRecord } from "vantadb/types";
import { SubEgoManifest, validateSubEgoAccess } from "./sub-egos.js";

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
   * NativeVantaDB.connect() es async (abre el motor Fjall LSM en background threads).
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.db = await NativeVantaDB.connect(this.storagePath, { read_only: false });
    this.isInitialized = true;
  }

  public get ready(): boolean {
    return this.isInitialized && this.db !== null;
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

      const metadata: Record<string, string | number | boolean | null> = {};
      if (item.metadata) {
        for (const [k, v] of Object.entries(item.metadata)) {
          if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            metadata[k] = v;
          } else {
            metadata[k] = JSON.stringify(v);
          }
        }
      }

      metadata.org_id = String(item.metadata?.org_id || "org_default");
      metadata.ts = typeof item.metadata?.ts === "number" ? item.metadata.ts : Date.now();
      metadata.agent_id = String(item.metadata?.agent_id || "ego.nucleus");
      metadata.confidence = typeof item.metadata?.confidence === "number" ? item.metadata.confidence : 1.0;
      metadata.state = String(item.metadata?.state || "active");

      return {
        namespace: item.namespace,
        key: item.key,
        payload: payloadStr,
        metadata,
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

    try {
      // searchMulti es nativo en vantadb-node — búsqueda federada concurrente
      const hits = await db.searchMulti(namespaces, {
        text_query: query,
        top_k: topK,
        exclude_superseded: options.excludeSuperseded ?? true,
        min_confidence: options.minConfidence,
      });
      return hits.slice(0, topK);
    } catch (err) {
      console.warn("[EgoMemoryAdapter] Error en searchMulti, fallback a búsqueda secuencial:", err);
      // Fallback: búsqueda secuencial por namespace
      const allHits: SearchHit[] = [];
      for (const ns of namespaces) {
        try {
          const hits = await db.search({
            namespace: ns,
            text_query: query,
            top_k: topK,
            exclude_superseded: options.excludeSuperseded ?? true,
            min_confidence: options.minConfidence,
          });
          allHits.push(...hits);
        } catch (nsErr) {
          console.warn(`[EgoMemoryAdapter] Error en búsqueda de namespace ${ns}:`, nsErr);
        }
      }
      allHits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      return allHits.slice(0, topK);
    }
  }

  /**
   * Recuperación por clave exacta con fallback a búsqueda de texto
   */
  async recall(keyOrQuery: string, namespace: string): Promise<unknown> {
    const db = this.ensureReady();
    try {
      // 1. Intentar recuperación exacta por clave
      const exact = await db.get(namespace, keyOrQuery);
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
    const quarantined = await db.get("quarantine/pending", quarantineKey);

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

    // 2. Eliminar de cuarentena
    await db.delete("quarantine/pending", quarantineKey);

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
  async supersedeFact(oldKey: string, newItem: EgoPut): Promise<void> {
    const db = this.ensureReady();

    // 1. Guardar nuevo hecho
    await this.putMulti([newItem]);

    // 2. Notificar a VantaDB la sustitución atómica
    try {
      await db.supersede(newItem.namespace, oldKey, newItem.key);
    } catch (e) {
      console.warn("[EgoMemoryAdapter] VantaDB supersede call warning:", e);
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
   * Consultas IQL (Integrated Query Language v4)
   */
  async graphQuery(queryStr: string): Promise<unknown> {
    const db = this.ensureReady();
    try {
      return await db.query(queryStr);
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
      const page = await db.list("gov/sub_egos", { limit: 100 });
      return page.records.map((r) => this.parseRecord(r) as SubEgoManifest);
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
}
