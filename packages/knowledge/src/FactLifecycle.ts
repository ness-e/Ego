import { EgoMemoryAdapter } from "@ego/memory";
import { Fact, FactSchema } from "./schemas/knowledge.js";
import { unwrapTaggedMetadata } from "./cursorListing.js";

export interface PromotionOptions {
  promotedBy?: string;
  notes?: string;
}

export type LifecycleAuditAction = "promote" | "supersede" | "retire";

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
   *
   * M11: la metadata de origen se desenvuelve (VDB-BUG-02) antes de
   * reinsertar y el registro `kb/facts` se construye canónico — sin
   * propagar campos de cuarentena (`quarantine_reason`, `expires_at`, …)
   * ni valores doblemente etiquetados.
   *
   * Ventana no atómica documentada: VantaDB no ofrece transacciones entre
   * namespaces, así que un crash entre el `put` en `kb/facts` y el `delete`
   * en `quarantine/pending` deja un duplicado benigno (mismo `fact_id` en
   * ambos lados). El orden put→audit→delete minimiza el riesgo (nunca hay
   * pérdida) y el registro `kb/audit` permite reconciliar; re-ejecutar la
   * promoción es idempotente (sobrescribe `kb/facts` y reintenta el delete).
   */
  public async promoteFromQuarantine(
    factId: string,
    options: PromotionOptions = {}
  ): Promise<Fact> {
    const quarantined = (await this.adapter.get("quarantine/pending", factId)) as {
      key: string;
      payload: unknown;
      metadata: Record<string, unknown>;
    } | null;

    if (!quarantined) {
      throw new Error(`Hecho no encontrado en cuarentena: ${factId}`);
    }

    const meta = unwrapTaggedMetadata(quarantined?.metadata);
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

    // 1. Inserción en kb/facts con metadata canónica (sin campos de cuarentena)
    await this.adapter.put({
      namespace: "kb/facts",
      key: factId,
      payload: `${promotedFact.subject} ${promotedFact.predicate} ${promotedFact.object}`,
      metadata: {
        fact_id: promotedFact.id,
        subject: promotedFact.subject,
        predicate: promotedFact.predicate,
        object: promotedFact.object,
        confidence: promotedFact.confidence,
        temporal_scope: promotedFact.temporalScope,
        source: promotedFact.source,
        valid_at: promotedFact.validAt,
        invalid_at: -1,
        state: "active",
        is_latest: true,
        promoted_at: now,
        promoted_by: options.promotedBy || "user_approval",
        promotion_notes: options.notes || "",
        promoted_from: "quarantine/pending",
      },
    });

    // 2. Auditoría best-effort (permite reconciliar la ventana no atómica)
    await this.writeAudit({
      action: "promote",
      factId,
      actor: options.promotedBy || "user_approval",
      detail: options.notes || "",
    });

    // 3. Eliminación de la cola de cuarentena
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
        key: string;
        payload: unknown;
        metadata: Record<string, unknown>;
      } | null;

      if (existing) {
        // M11: desenvolver antes de reinsertar (evita doble etiquetado).
        const oldMeta = unwrapTaggedMetadata(existing?.metadata);
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

    await this.writeAudit({
      action: "supersede",
      factId: oldFactKey,
      actor: "system",
      detail: `superseded_by=${newFact.id}`,
    });
  }

  /**
   * Consolida y actualiza autónomamente memorias y hechos cognitivos.
   * Procesa listas de hechos nuevos, sustituciones causales y retiros sin borrado destructivo.
   *
   * **Implementación propia de Ego.** Sin atribución de código derivado.
   */
  public async consolidateMemories(
    updates: {
      create?: Fact[];
      supersede?: Array<{ oldFactId: string; newFact: Fact }>;
      retire?: string[];
    }
  ): Promise<{
    createdCount: number;
    supersededCount: number;
    retiredCount: number;
    processedFactIds: string[];
  }> {
    const processedFactIds: string[] = [];
    let createdCount = 0;
    let supersededCount = 0;
    let retiredCount = 0;
    const now = Date.now();

    // 1. Crear hechos nuevos
    if (updates.create && updates.create.length > 0) {
      for (const fact of updates.create) {
        FactSchema.parse(fact);
        await this.adapter.put({
          namespace: "kb/facts",
          key: fact.id,
          payload: `${fact.subject} ${fact.predicate} ${fact.object}`,
          metadata: {
            fact_id: fact.id,
            subject: fact.subject,
            predicate: fact.predicate,
            object: fact.object,
            confidence: fact.confidence,
            temporal_scope: fact.temporalScope,
            source: fact.source,
            valid_at: fact.validAt,
            invalid_at: -1,
            is_latest: true,
            state: "active",
            ts: now,
          },
        });
        processedFactIds.push(fact.id);
        createdCount++;
      }
    }

    // 2. Sustituir hechos existentes vinculando aristas causales
    if (updates.supersede && updates.supersede.length > 0) {
      for (const item of updates.supersede) {
        await this.supersedeFact(item.oldFactId, item.newFact);
        processedFactIds.push(item.newFact.id);
        supersededCount++;
      }
    }

    // 3. Retirar hechos obsoletos (soft-retire en lugar de borrado físico destructivo)
    if (updates.retire && updates.retire.length > 0) {
      for (const oldFactId of updates.retire) {
        try {
          const existing = (await this.adapter.get("kb/facts", oldFactId)) as {
            key: string;
            payload: unknown;
            metadata: Record<string, unknown>;
          } | null;

          if (existing) {
            // M11: desenvolver antes de reinsertar (evita doble etiquetado).
            const oldMeta = unwrapTaggedMetadata(existing?.metadata);
            await this.adapter.put({
              namespace: "kb/facts",
              key: oldFactId,
              payload: existing.payload,
              metadata: {
                ...oldMeta,
                state: "retired",
                is_latest: false,
                invalid_at: now,
                retired_at: now,
              },
            });
            processedFactIds.push(oldFactId);
            retiredCount++;
            await this.writeAudit({
              action: "retire",
              factId: oldFactId,
              actor: "system",
              detail: "consolidateMemories",
            });
          }
        } catch (err) {
          console.warn(`[FactLifecycle] Error retirando hecho ${oldFactId}:`, err);
        }
      }
    }

    return {
      createdCount,
      supersededCount,
      retiredCount,
      processedFactIds,
    };
  }

  /**
   * Registra una transición del ciclo de vida en `kb/audit` (M11).
   * Best-effort con aviso: la auditoría es observabilidad para reconciliar
   * la ventana no atómica put→delete, nunca un gate que bloquee la
   * transición principal si el motor falla al escribirla.
   *
   * HIG-05: la key lleva sufijo aleatorio. Sin él, dos eventos con igual
   * (ms, action, factId) — p.ej. doble supersede del mismo hecho en un loop
   * dentro del mismo milisegundo — colisionan y el segundo `put` sobrescribe
   * al primero, perdiendo un registro. El prefijo `audit_<ms>_<action>_<fact>`
   * se conserva para reconciliación manual.
   */
  private async writeAudit(entry: {
    action: LifecycleAuditAction;
    factId: string;
    actor: string;
    detail: string;
  }): Promise<void> {
    const now = Date.now();
    const nonce = Math.random().toString(36).slice(2, 10);
    try {
      await this.adapter.put({
        namespace: "kb/audit",
        key: `audit_${now}_${entry.action}_${entry.factId}_${nonce}`,
        payload: `${entry.action} ${entry.factId} by ${entry.actor}`,
        metadata: {
          action: entry.action,
          fact_id: entry.factId,
          actor: entry.actor,
          detail: entry.detail,
          ts: now,
          state: "audited",
        },
      });
    } catch (err) {
      console.warn(`[FactLifecycle] No se pudo registrar auditoría ${entry.action} ${entry.factId}:`, err);
    }
  }
}
