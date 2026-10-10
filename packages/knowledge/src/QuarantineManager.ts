import { EgoMemoryAdapter } from "@ego/memory";
import { Fact, FactSchema } from "./schemas/knowledge.js";

export const QUARANTINE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 días (ADR-046, CARP-04)

/**
 * Gestor de Cuarentena mnemónica para hechos y fuentes no verificadas (KB-07, ADR-046).
 * Implementa la compuerta CARP-04 (aislamiento con TTL de 14 días y supervisión explícita).
 */
export class QuarantineManager {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Deposita un hecho o aserción no verificada en cuarentena con TTL y razón explícita.
   */
  public async quarantine(fact: Fact, reason: string = "unreviewed_external_source"): Promise<void> {
    const quarantinedFact: Fact = {
      ...fact,
      state: "quarantined",
    };

    const now = Date.now();
    await this.adapter.put({
      namespace: "quarantine/pending",
      key: quarantinedFact.id,
      payload: `${quarantinedFact.subject} ${quarantinedFact.predicate} ${quarantinedFact.object}`,
      metadata: {
        fact_id: quarantinedFact.id,
        subject: quarantinedFact.subject,
        predicate: quarantinedFact.predicate,
        object: quarantinedFact.object,
        confidence: quarantinedFact.confidence,
        temporal_scope: quarantinedFact.temporalScope,
        source: quarantinedFact.source,
        valid_at: quarantinedFact.validAt,
        invalid_at: quarantinedFact.invalidAt !== null ? quarantinedFact.invalidAt : -1,
        quarantine_reason: reason,
        quarantined_at: now,
        expires_at: now + QUARANTINE_TTL_MS,
        state: "quarantined",
      },
      ttl_ms: QUARANTINE_TTL_MS,
    });
  }

  /**
   * Lista todos los hechos pendientes de revisión en la cuarentena.
   */
  public async listPending(): Promise<Fact[]> {
    const records = await this.adapter.list("quarantine/pending", 100);
    const facts: Fact[] = [];

    for (const rec of records) {
      const meta = rec.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;

      const factCandidate = {
        id: String(meta["fact_id"] || rec.key),
        subject: String(meta["subject"] || "Unknown"),
        predicate: String(meta["predicate"] || "related_to"),
        object: String(meta["object"] || rec.payload),
        confidence: typeof meta["confidence"] === "number" ? meta["confidence"] : 0.5,
        temporalScope: meta["temporal_scope"] === "ephemeral" ? ("ephemeral" as const) : ("persistent" as const),
        source: String(meta["source"] || "quarantine"),
        validAt: typeof meta["valid_at"] === "number" ? meta["valid_at"] : Date.now(),
        invalidAt: typeof meta["invalid_at"] === "number" && meta["invalid_at"] !== -1 ? meta["invalid_at"] : null,
        supersededBy: null,
        state: "quarantined" as const,
      };

      const parseResult = FactSchema.safeParse(factCandidate);
      if (parseResult.success) {
        facts.push(parseResult.data);
      }
    }

    return facts;
  }

  /**
   * Rechaza y descarta permanentemente un hecho de la cuarentena.
   */
  public async reject(factId: string): Promise<boolean> {
    return this.adapter.delete("quarantine/pending", factId);
  }

  /**
   * Purga manualmente registros cuya fecha de expiración haya sido superada.
   */
  public async purgeExpired(): Promise<number> {
    const pending = await this.adapter.list("quarantine/pending", 200);
    const now = Date.now();
    let purged = 0;

    for (const rec of pending) {
      const meta = rec.metadata as Record<string, unknown> | undefined;
      const expiresAt = typeof meta?.["expires_at"] === "number" ? meta["expires_at"] : 0;
      if (expiresAt > 0 && now >= expiresAt) {
        await this.adapter.delete("quarantine/pending", rec.key);
        purged++;
      }
    }

    return purged;
  }
}
