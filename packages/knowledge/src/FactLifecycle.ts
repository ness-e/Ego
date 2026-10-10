import { EgoMemoryAdapter } from "@ego/memory";
import { Fact, FactSchema } from "./schemas/knowledge.js";

export interface PromotionOptions {
  promotedBy?: string;
  notes?: string;
}

/**
 * Gestor del ciclo de vida y versionado inmutable de hechos (KB-08, ADR-028).
 * Implementa la compuerta DSEK-01 (sustitución suave / soft-replace con aristas SUPERSEDED_BY).
 */
export class FactLifecycle {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Promueve un hecho de quarantine/pending a kb/facts de forma atómica.
   */
  public async promoteFromQuarantine(
    factId: string,
    options: PromotionOptions = {}
  ): Promise<Fact> {
    const quarantined = (await this.adapter.get("quarantine/pending", factId)) as {
      payload?: unknown;
      metadata?: Record<string, unknown>;
    } | null;

    if (!quarantined) {
      throw new Error(`Hecho no encontrado en cuarentena: ${factId}`);
    }

    const meta = quarantined.metadata || {};
    const now = Date.now();

    const promotedFact: Fact = {
      id: factId,
      subject: String(meta["subject"] || "Unknown"),
      predicate: String(meta["predicate"] || "related_to"),
      object: String(meta["object"] || quarantined.payload),
      confidence: typeof meta["confidence"] === "number" ? meta["confidence"] : 0.85,
      temporalScope: meta["temporal_scope"] === "ephemeral" ? ("ephemeral" as const) : ("persistent" as const),
      source: String(meta["source"] || "quarantine_promoted"),
      validAt: typeof meta["valid_at"] === "number" ? meta["valid_at"] : now,
      invalidAt: null,
      supersededBy: null,
      state: "active",
    };

    FactSchema.parse(promotedFact);

    // 1. Inserción en kb/facts
    await this.adapter.put({
      namespace: "kb/facts",
      key: factId,
      payload: `${promotedFact.subject} ${promotedFact.predicate} ${promotedFact.object}`,
      metadata: {
        ...meta,
        state: "active",
        is_latest: true,
        promoted_at: now,
        promoted_by: options.promotedBy || "user_approval",
        promotion_notes: options.notes || "",
      },
    });

    // 2. Eliminación de la cola de cuarentena
    await this.adapter.delete("quarantine/pending", factId);

    return promotedFact;
  }

  /**
   * Sustituye suavemente un hecho previo por uno nuevo (soft-replace / DSEK-01).
   * Vincula la arista SUPERSEDED_BY y marca is_latest: false en el registro previo.
   */
  public async supersedeFact(oldFactKey: string, newFact: Fact): Promise<void> {
    const now = Date.now();

    // 1. Guardar el nuevo hecho activo
    await this.adapter.put({
      namespace: "kb/facts",
      key: newFact.id,
      payload: `${newFact.subject} ${newFact.predicate} ${newFact.object}`,
      metadata: {
        fact_id: newFact.id,
        subject: newFact.subject,
        predicate: newFact.predicate,
        object: newFact.object,
        confidence: newFact.confidence,
        temporal_scope: newFact.temporalScope,
        source: newFact.source,
        valid_at: newFact.validAt,
        invalid_at: -1,
        supersedes: oldFactKey,
        is_latest: true,
        state: "active",
        ts: now,
      },
    });

    // 2. Actualizar el hecho previo marcándolo como superseded sin borrado destructivo
    try {
      const existing = (await this.adapter.get("kb/facts", oldFactKey)) as {
        payload?: unknown;
        metadata?: Record<string, unknown>;
      } | null;

      if (existing) {
        const oldMeta = existing.metadata || {};
        await this.adapter.put({
          namespace: "kb/facts",
          key: oldFactKey,
          payload: existing.payload,
          metadata: {
            ...oldMeta,
            state: "superseded",
            is_latest: false,
            superseded_by: newFact.id,
            invalid_at: now,
            updated_at: now,
          },
        });
      }
    } catch (err) {
      console.warn(`[FactLifecycle] Error marcando hecho superseded ${oldFactKey}:`, err);
    }
  }
}
