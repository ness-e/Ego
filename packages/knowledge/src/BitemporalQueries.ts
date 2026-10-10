import { EgoMemoryAdapter } from "@ego/memory";
import { Fact, FactSchema } from "./schemas/knowledge.js";

export interface AsOfOptions {
  namespace?: string;
  subject?: string;
  limit?: number;
}

/**
 * Motor de consultas bitemporales y reconstrucción histórica AS OF (KB-09, DSEK-02).
 * Resuelve VDB-REQ-06 emulando consultas temporales de intervalo [valid_at, invalid_at)
 * sobre registros versionados de VantaDB sin sobreescritura destructiva.
 */
export class BitemporalQueries {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Reconstruye el estado de los hechos vigentes en un momento exacto del pasado (AS OF <targetTime>).
   */
  public async asOf(targetTime: number, options: AsOfOptions = {}): Promise<Fact[]> {
    const namespace = options.namespace ?? "kb/facts";
    const limit = options.limit ?? 100;

    const records = await this.adapter.list(namespace, limit * 2);
    const historicalFacts: Fact[] = [];

    for (const rec of records) {
      const meta = rec.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;

      const validAt = typeof meta["valid_at"] === "number" ? meta["valid_at"] : 0;
      const invalidAt =
        typeof meta["invalid_at"] === "number" && meta["invalid_at"] !== -1
          ? meta["invalid_at"]
          : null;

      // Criterio Bitemporal: el hecho nació antes o en targetTime, y no había muerto aún en targetTime
      const wasValidAtTarget = validAt <= targetTime && (invalidAt === null || invalidAt > targetTime);

      if (wasValidAtTarget) {
        if (options.subject && meta["subject"] !== options.subject) {
          continue;
        }

        const factCandidate: Fact = {
          id: String(meta["fact_id"] || rec.key),
          subject: String(meta["subject"] || "General"),
          predicate: String(meta["predicate"] || "related_to"),
          object: String(meta["object"] || rec.payload),
          confidence: typeof meta["confidence"] === "number" ? meta["confidence"] : 0.8,
          temporalScope: meta["temporal_scope"] === "ephemeral" ? ("ephemeral" as const) : ("persistent" as const),
          source: String(meta["source"] || "historical"),
          validAt,
          invalidAt,
          supersededBy: typeof meta["superseded_by"] === "string" ? meta["superseded_by"] : null,
          state: invalidAt !== null && invalidAt <= Date.now() ? "superseded" : "active",
        };

        if (FactSchema.safeParse(factCandidate).success) {
          historicalFacts.push(factCandidate);
        }
      }
    }

    return historicalFacts.slice(0, limit);
  }
}
