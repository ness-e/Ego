// EgoMemoryAdapter — Implementación oficial de acceso único a VantaDB
import { Client } from "vantadb";
import type { SearchHit, MemoryRecord } from "vantadb/dist/types.js";
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
  private db: Client;
  private isInitialized = false;

  constructor(storagePath?: string) {
    try {
      if (storagePath && storagePath !== ":memory:") {
        this.db = Client.open(storagePath);
      } else {
        this.db = Client.create();
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn("[EgoMemoryAdapter] VantaDB fallback to in-memory create():", err);
      this.db = Client.create();
      this.isInitialized = true;
    }
  }

  public get ready(): boolean {
    return this.isInitialized;
  }

  /**
   * Escritura en lote con normalización obligatoria de metadatos de auditoría
   */
  async putMulti(items: EgoPut[]): Promise<void> {
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
      this.db.memory.putBatch(records as any);
    } catch (e) {
      // Fallback a escritura secuencial si putBatch tiene restricciones
      for (const rec of records) {
        this.db.memory.put(rec as any);
      }
    }
  }

  /**
   * Búsqueda híbrida multi-namespace con ordenamiento y deduplicación
   */
  async searchMulti(
    namespaces: string[],
    query: string,
    options: EgoSearchOptions = {}
  ): Promise<SearchHit[]> {
    const topK = options.topK ?? 10;
    const allHits: SearchHit[] = [];

    for (const ns of namespaces) {
      try {
        const hits = this.db.memory.search({
          namespace: ns,
          text_query: query,
          query_vector: [], // BM25 nativo cuando el vector está vacío
          top_k: topK,
          exclude_superseded: options.excludeSuperseded ?? true,
          min_confidence: options.minConfidence,
        });
        allHits.push(...hits);
      } catch (err) {
        console.warn(`[EgoMemoryAdapter] Error en búsqueda de namespace ${ns}:`, err);
      }
    }

    // Ordenar de mayor a menor puntuación (score)
    allHits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return allHits.slice(0, topK);
  }

  /**
   * Recuperación por clave exacta con fallback a búsqueda de texto
   */
  async recall(keyOrQuery: string, namespace: string): Promise<unknown> {
    try {
      // 1. Intentar recuperación exacta por clave
      const exact = this.db.memory.get({ namespace, key: keyOrQuery });
      if (exact) {
        return this.parseRecord(exact);
      }

      // 2. Si no es clave exacta, realizar búsqueda BM25 de recall
      const hits = this.db.memory.search({
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
   * Envía un hecho a cuarentena con TTL controlado
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
    const quarantined = this.db.memory.get({
      namespace: "quarantine/pending",
      key: quarantineKey,
    });

    if (!quarantined) {
      throw new Error(`Hecho no encontrado en cuarentena: ${quarantineKey}`);
    }

    const meta = quarantined.metadata as Record<string, any>;
    const destinationNs = targetNamespace || meta.original_namespace || "kb/docs";
    const destinationKey = targetKey || meta.original_key || quarantineKey;

    // 1. Escribir en destino
    await this.putMulti([
      {
        namespace: destinationNs,
        key: destinationKey,
        payload: quarantined.payload,
        metadata: {
          ...meta,
          state: "validated",
          promoted_at: Date.now(),
        },
      },
    ]);

    // 2. Eliminar de cuarentena
    this.db.memory.delete({
      namespace: "quarantine/pending",
      key: quarantineKey,
    });

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
   * Sustituye un hecho existente (supersede) marcando versión y arista en grafo
   */
  async supersedeFact(oldKey: string, newItem: EgoPut): Promise<void> {
    // 1. Guardar nuevo hecho
    await this.putMulti([newItem]);

    // 2. Notificar a VantaDB la sustitución atómica
    try {
      this.db.memory.supersede({
        namespace: newItem.namespace,
        oldKey,
        newKey: newItem.key,
      });
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
   * Consultas de grafo e IQL
   */
  async graphQuery(queryStr: string): Promise<unknown> {
    try {
      return this.db.system.query(queryStr);
    } catch (err) {
      console.warn("[EgoMemoryAdapter] Error ejecutando graphQuery:", err);
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Exportación de snapshot del sistema
   */
  async snapshot(exportPath: string): Promise<unknown> {
    try {
      const report = this.db.system.exportAll(exportPath);
      return { ok: true, report };
    } catch (err) {
      console.warn("[EgoMemoryAdapter] Error exportando snapshot:", err);
      return { ok: false, error: String(err) };
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
    try {
      const page = this.db.memory.list({
        namespace: "gov/sub_egos",
        limit: 100,
      });
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
