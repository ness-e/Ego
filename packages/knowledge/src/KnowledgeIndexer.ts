import { EgoMemoryAdapter, type EgoPut } from "@ego/memory";
import type { Fact, ParsedDocument } from "./schemas/knowledge.js";

export interface IndexDocResult {
  docId: string;
  totalChunks: number;
  indexedChunks: number;
  skippedDuplicates: number;
}

/**
 * Indexador de conocimiento de Ego en VantaDB (KB-03).
 * Gestiona la inserción de chunks de documentos en kb/docs y hechos estructurados en kb/facts.
 * Cumple con VDB-BUG-04 (serialización segura de metadatos complejos) y Guardrail §4
 * (BM25 léxico in-process en NativeVantaDB, inferencia densa delegada a vantadb-mcp).
 */
export class KnowledgeIndexer {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  /**
   * Actualiza la instancia del adaptador mnemónico (soporte para hot-recovery / VDB-INC-03).
   */
  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Indexa un documento parsed completo con todos sus chunks en VantaDB bajo kb/docs.
   */
  public async indexDocument(
    doc: ParsedDocument,
    options: { projectId?: string; orgId?: string } = {}
  ): Promise<IndexDocResult> {
    const projectId = options.projectId ?? "default";
    const orgId = options.orgId ?? "default";
    const now = Date.now();

    let indexed = 0;
    let skipped = 0;
    const namespace = `kb/docs/${doc.id}`;
    const pending: EgoPut[] = [];

    for (const chunk of doc.chunks) {
      const key = `chunk_${chunk.index}`;

      // Verificar idempotencia por contentHash para evitar duplicados en reprocesamiento
      try {
        const existing = (await this.adapter.get(namespace, key)) as {
          key: string;
          payload: unknown;
          metadata: Record<string, unknown>;
        } | null;
        if (existing) {
          const meta = existing?.metadata;
          if (meta && meta["content_hash"] === chunk.contentHash) {
            skipped++;
            continue;
          }
        }
      } catch {
        // Proceder con inserción si no existe
      }

      // Adherencia a VDB-BUG-04: serializar arrays o mapas anidados como string JSON en metadata
      pending.push({
        namespace,
        key,
        payload: chunk.content,
        metadata: {
          doc_id: doc.id,
          chunk_id: chunk.id,
          project_id: projectId,
          org_id: orgId,
          source_path: chunk.sourcePath,
          mime_type: chunk.mimeType,
          chunk_index: chunk.index,
          token_count: chunk.tokenCount,
          content_hash: chunk.contentHash,
          // VDB-BUG-04: serializar headingPath como cadena JSON para evitar fallo de Serde
          heading_path_json: JSON.stringify(chunk.headingPath),
          ts: now,
          state: "indexed",
        },
      });

      indexed++;
    }

    // M13: un solo batch por documento (put delega a putMulti: misma normalización,
    // 1 round-trip en vez de N). Sin pendientes no se escribe nada.
    if (pending.length > 0) {
      await this.adapter.putMulti(pending);
    }
    // M13: barrera de durabilidad — todo lo indexado queda sincronizado a disco.
    await this.adapter.flush();

    return {
      docId: doc.id,
      totalChunks: doc.chunks.length,
      indexedChunks: indexed,
      skippedDuplicates: skipped,
    };
  }

  /**
   * Indexa un hecho estructurado atómico en el namespace kb/facts.
   */
  public async indexFact(
    fact: Fact,
    options: { projectId?: string; orgId?: string } = {}
  ): Promise<void> {
    const projectId = options.projectId ?? "default";
    const orgId = options.orgId ?? "default";
    const namespace = "kb/facts";
    const key = fact.id;

    const summaryContent = `${fact.subject} ${fact.predicate} ${fact.object}`;

    await this.adapter.put({
      namespace,
      key,
      payload: summaryContent,
      metadata: {
        fact_id: fact.id,
        subject: fact.subject,
        predicate: fact.predicate,
        object: fact.object,
        confidence: fact.confidence,
        temporal_scope: fact.temporalScope,
        source: fact.source,
        source_chunk_id: fact.sourceChunkId || "",
        valid_at: fact.validAt,
        invalid_at: fact.invalidAt !== null ? fact.invalidAt : -1,
        superseded_by: fact.supersededBy || "",
        state: fact.state,
        is_latest: fact.state === "active",
        project_id: projectId,
        org_id: orgId,
        ts: Date.now(),
      },
    });
  }

  /**
   * Recupera un hecho por su clave canónica.
   */
  public async getFact(factId: string): Promise<Record<string, unknown> | null> {
    const res = (await this.adapter.get("kb/facts", factId)) as {
      key: string;
      payload: unknown;
      metadata: Record<string, unknown>;
    } | null;
    if (!res) return null;
    return {
      content: res.payload,
      metadata: res.metadata,
    };
  }
}
