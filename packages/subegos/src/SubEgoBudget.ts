import { z } from "zod";
import type { EgoMemoryAdapter } from "@ego/memory";
import { getQuarantineAware } from "@ego/memory";
import type { SubEgoBudget } from "./types.js";

/**
 * Error base para límites de presupuesto de Sub-Egos.
 */
export class SubEgoBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubEgoBudgetError";
  }
}

/**
 * Error lanzado cuando un Sub-Ego excede sus cuotas de tokens o coste en USD.
 */
export class SubEgoBudgetExceededError extends SubEgoBudgetError {
  constructor(
    public readonly subEgoId: string,
    public readonly limitType: "tokens_per_call" | "daily_cost",
    public readonly current: number,
    public readonly maxAllowed: number
  ) {
    super(
      `[SubEgoBudget] Cuota excedida para Sub-Ego '${subEgoId}': ${limitType} actual = ${current}, máximo permitido = ${maxAllowed}.`
    );
    this.name = "SubEgoBudgetExceededError";
  }
}

/**
 * Error lanzado cuando el costo de una operación requiere confirmación humana (HITL).
 */
export class SubEgoApprovalRequiredError extends SubEgoBudgetError {
  constructor(
    public readonly subEgoId: string,
    public readonly estimatedCostUsd: number,
    public readonly thresholdUsd: number
  ) {
    super(
      `[SubEgoBudget] La operación para '${subEgoId}' tiene un costo estimado de $${estimatedCostUsd.toFixed(4)}, lo que supera el umbral de aprobación HITL de $${thresholdUsd.toFixed(4)}.`
    );
    this.name = "SubEgoApprovalRequiredError";
  }
}

/**
 * Estructura de métricas de consumo acumulado por Sub-Ego.
 */
export const SubEgoUsageMetricsSchema = z.object({
  subEgoId: z.string(),
  currentSessionInputTokens: z.number().nonnegative().default(0),
  currentSessionOutputTokens: z.number().nonnegative().default(0),
  currentSessionTotalTokens: z.number().nonnegative().default(0),
  currentSessionCostUsd: z.number().nonnegative().default(0),
  dailyInputTokens: z.number().nonnegative().default(0),
  dailyOutputTokens: z.number().nonnegative().default(0),
  dailyTotalTokens: z.number().nonnegative().default(0),
  dailyCostUsd: z.number().nonnegative().default(0),
  lifetimeTotalTokens: z.number().nonnegative().default(0),
  lifetimeTotalCostUsd: z.number().nonnegative().default(0),
  lastUpdatedDay: z.string(), // YYYY-MM-DD
  lastTurnTimestampMs: z.number().positive().default(() => Date.now())
});
export type SubEgoUsageMetrics = z.infer<typeof SubEgoUsageMetricsSchema>;

/**
 * Tabla de precios de referencia estándar por 1M tokens (USD).
 */
export const MODEL_PRICING_PER_MILLION: Record<
  string,
  { inputUsd: number; outputUsd: number }
> = {
  "gpt-4o": { inputUsd: 2.5, outputUsd: 10.0 },
  "gpt-4o-mini": { inputUsd: 0.15, outputUsd: 0.6 },
  "claude-3-5-sonnet": { inputUsd: 3.0, outputUsd: 15.0 },
  "deepseek-chat": { inputUsd: 0.14, outputUsd: 0.28 },
  "deepseek-reasoner": { inputUsd: 0.55, outputUsd: 2.19 },
  "mock-core": { inputUsd: 0.0, outputUsd: 0.0 },
  default: { inputUsd: 2.0, outputUsd: 8.0 }
};

/**
 * Calcula el costo estimado en USD a partir de tokens de entrada y salida.
 */
export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  modelName: string = "default"
): number {
  const pricing = MODEL_PRICING_PER_MILLION[modelName] ?? MODEL_PRICING_PER_MILLION.default;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputUsd;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputUsd;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Máquina contable y monitor de presupuesto por Sub-Ego (SUB-09).
 */
export class SubEgoBudgetTracker {
  private inMemoryMetrics = new Map<string, SubEgoUsageMetrics>();

  constructor(private readonly memory?: EgoMemoryAdapter) {}

  /**
   * Obtiene la fecha actual en formato ISO "YYYY-MM-DD" para control diario de cuotas.
   */
  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Inicializa o recupera las métricas actuales del Sub-Ego.
   */
  async getMetrics(subEgoId: string): Promise<SubEgoUsageMetrics> {
    const today = this.getTodayString();

    if (this.inMemoryMetrics.has(subEgoId)) {
      const current = this.inMemoryMetrics.get(subEgoId)!;
      if (current.lastUpdatedDay !== today) {
        // Cambio de día: resetear cuotas diarias
        current.dailyInputTokens = 0;
        current.dailyOutputTokens = 0;
        current.dailyTotalTokens = 0;
        current.dailyCostUsd = 0;
        current.lastUpdatedDay = today;
      }
      return current;
    }

    if (this.memory) {
      // Quarantine-aware (FIX-01 SEC-09): `egos/*` sin diferimiento —
      // resuelve live + `quarantine/pending` (misma forma de sobre).
      const record = await getQuarantineAware(this.memory, `egos/${subEgoId}`, "metrics_usage");
      if (record) {
        let raw: unknown = record;
        if (typeof record === "object" && record !== null && "payload" in record) {
          raw = (record as { payload: unknown }).payload;
        }
        try {
          const parsed = SubEgoUsageMetricsSchema.parse(raw);
          if (parsed.lastUpdatedDay !== today) {
            parsed.dailyInputTokens = 0;
            parsed.dailyOutputTokens = 0;
            parsed.dailyTotalTokens = 0;
            parsed.dailyCostUsd = 0;
            parsed.lastUpdatedDay = today;
          }
          this.inMemoryMetrics.set(subEgoId, parsed);
          return parsed;
        } catch {
          // Si el registro está corrupto, inicializar en limpio
        }
      }
    }

    const initialMetrics: SubEgoUsageMetrics = {
      subEgoId,
      currentSessionInputTokens: 0,
      currentSessionOutputTokens: 0,
      currentSessionTotalTokens: 0,
      currentSessionCostUsd: 0,
      dailyInputTokens: 0,
      dailyOutputTokens: 0,
      dailyTotalTokens: 0,
      dailyCostUsd: 0,
      lifetimeTotalTokens: 0,
      lifetimeTotalCostUsd: 0,
      lastUpdatedDay: today,
      lastTurnTimestampMs: Date.now()
    };

    this.inMemoryMetrics.set(subEgoId, initialMetrics);
    return initialMetrics;
  }

  /**
   * Valida previamente si el Sub-Ego puede ejecutar un turno con la estimación de tokens.
   */
  async checkTurnBudget(
    subEgoId: string,
    estimatedTokens: number,
    budget: SubEgoBudget
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (estimatedTokens > budget.maxTokensPerCall) {
      return {
        allowed: false,
        reason: `Estimación de ${estimatedTokens} tokens supera el límite por turno (${budget.maxTokensPerCall})`
      };
    }

    const metrics = await this.getMetrics(subEgoId);
    if (metrics.dailyCostUsd >= budget.maxDailyCostUsd) {
      return {
        allowed: false,
        reason: `Gasto diario de $${metrics.dailyCostUsd.toFixed(3)} ha alcanzado el límite diario permitido ($${budget.maxDailyCostUsd.toFixed(3)})`
      };
    }

    return { allowed: true };
  }

  /**
   * Determina si el costo estimado de una acción amerita aprobación humana (HITL).
   */
  needsApprovalForCost(
    _subEgoId: string,
    estimatedCostUsd: number,
    budget: SubEgoBudget
  ): boolean {
    return estimatedCostUsd >= budget.requiresApprovalAboveUsd;
  }

  /**
   * Registra el consumo real de tokens y costo al finalizar un turno de ejecución.
   */
  async recordTurnUsage(
    subEgoId: string,
    usage: { inputTokens: number; outputTokens: number; model?: string },
    budget: SubEgoBudget
  ): Promise<SubEgoUsageMetrics> {
    const totalTurnTokens = usage.inputTokens + usage.outputTokens;

    if (totalTurnTokens > budget.maxTokensPerCall) {
      throw new SubEgoBudgetExceededError(
        subEgoId,
        "tokens_per_call",
        totalTurnTokens,
        budget.maxTokensPerCall
      );
    }

    const metrics = await this.getMetrics(subEgoId);
    const turnCostUsd = calculateTokenCost(usage.inputTokens, usage.outputTokens, usage.model);

    // Actualizar métricas acumuladas
    metrics.currentSessionInputTokens += usage.inputTokens;
    metrics.currentSessionOutputTokens += usage.outputTokens;
    metrics.currentSessionTotalTokens += totalTurnTokens;
    metrics.currentSessionCostUsd = Number((metrics.currentSessionCostUsd + turnCostUsd).toFixed(6));

    metrics.dailyInputTokens += usage.inputTokens;
    metrics.dailyOutputTokens += usage.outputTokens;
    metrics.dailyTotalTokens += totalTurnTokens;
    metrics.dailyCostUsd = Number((metrics.dailyCostUsd + turnCostUsd).toFixed(6));

    metrics.lifetimeTotalTokens += totalTurnTokens;
    metrics.lifetimeTotalCostUsd = Number((metrics.lifetimeTotalCostUsd + turnCostUsd).toFixed(6));
    metrics.lastTurnTimestampMs = Date.now();

    this.inMemoryMetrics.set(subEgoId, metrics);

    // Validar si el nuevo gasto diario acumulado excede el presupuesto
    if (metrics.dailyCostUsd > budget.maxDailyCostUsd) {
      // Persistir antes de lanzar para no perder el registro del consumo
      if (this.memory) {
        await this.persistMetrics(subEgoId, metrics);
      }
      throw new SubEgoBudgetExceededError(
        subEgoId,
        "daily_cost",
        metrics.dailyCostUsd,
        budget.maxDailyCostUsd
      );
    }

    if (this.memory) {
      await this.persistMetrics(subEgoId, metrics);
    }

    return metrics;
  }

  /**
   * Resetea las cuotas del día preservando los acumulados de por vida.
   */
  async resetDailyUsage(subEgoId: string): Promise<void> {
    const metrics = await this.getMetrics(subEgoId);
    metrics.dailyInputTokens = 0;
    metrics.dailyOutputTokens = 0;
    metrics.dailyTotalTokens = 0;
    metrics.dailyCostUsd = 0;
    metrics.lastUpdatedDay = this.getTodayString();

    this.inMemoryMetrics.set(subEgoId, metrics);

    if (this.memory) {
      await this.persistMetrics(subEgoId, metrics);
    }
  }

  /**
   * Persiste las métricas del Sub-Ego en VantaDB.
   */
  private async persistMetrics(subEgoId: string, metrics: SubEgoUsageMetrics): Promise<void> {
    if (!this.memory) return;
    await this.memory.put({
      namespace: `egos/${subEgoId}`,
      key: "metrics_usage",
      payload: metrics,
      metadata: {
        subEgoId,
        dailyCostUsd: metrics.dailyCostUsd,
        lifetimeTotalTokens: metrics.lifetimeTotalTokens,
        updatedAtMs: Date.now()
      }
    });
  }
}
