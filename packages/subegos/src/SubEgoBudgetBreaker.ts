import { SubEgoBudgetError, SubEgoBudgetTracker } from "./SubEgoBudget.js";
import type { SubEgoBudget } from "./types.js";

/**
 * E5 (Ola 4b / A3 / T1) — Circuit breakers de presupuesto por Sub-Ego.
 *
 * ## Qué resuelve
 *
 * El Sub-Ego tenía cuotas (`maxTokensPerCall`, `maxDailyCostUsd`) pero:
 * - no había **tiempo** (un turno podía colgarse eternamente),
 * - no había **degradación**: al agotar el presupuesto, el Sub-Ego se
 *   detenía sin más,
 * - el tope de **coste por llamada** no estaba conectado al `ModelRouter`,
 *   que ya sabe degradar a un modelo más barato (`maxCostPerCallUsd`).
 *
 * ## Principio de diseño (no reimplementar el router)
 *
 * El **circuit breaker** decide *cuándo* abrir el circuito (política de
 * Sub-Ego: tokens, coste, tiempo). El **router** decide *con qué modelo*
 * seguir (mecánica de degradación). Por eso la conexión es **estructural**
 * (`BudgetAwareRouterLike`): este paquete NO depende de `@ego/models`.
 *
 * El tope efectivo es el **MÍNIMO** entre el tope del Sub-Ego y el tope
 * global del router: ninguna llamada puede costar más que lo que permite el
 * más restrictivo de los dos.
 */

/** Límites del circuito de presupuesto. */
export type SubEgoBudgetLimit =
  | "tokens_per_call"
  | "cost_per_call"
  | "daily_cost"
  | "turn_duration";

/**
 * Error tipado de circuito de presupuesto abierto.
 *
 * Se lanza (o se entrega en la decisión `stop`) cuando el Sub-Ego agota su
 * presupuesto y **no** hay degradación disponible.
 */
export class SubEgoBudgetCircuitBreakerError extends SubEgoBudgetError {
  constructor(
    public readonly subEgoId: string,
    public readonly limit: SubEgoBudgetLimit,
    public readonly current: number,
    public readonly maxAllowed: number,
    message?: string
  ) {
    super(
      message ??
        `[SubEgoBudget] Circuito de presupuesto abierto para '${subEgoId}': ${limit} = ${current} ` +
          `> máximo permitido ${maxAllowed}.`
    );
    this.name = "SubEgoBudgetCircuitBreakerError";
  }
}

/**
 * Superficie mínima del router que el breaker necesita (DIP).
 *
 * `packages/models` es zona de A2: este paquete no lo importa. El
 * `ModelRouter` puede satisfacer el contrato con dos métodos públicos
 * (ver handoff A3-ola4b §fuera-de-zona).
 */
export interface BudgetAwareRouterLike {
  /** Tope global de coste por llamada del router (USD), si lo expone. */
  getMaxCostPerCallUsd?(): number | undefined;
  /**
   * Resuelve el modelo más barato que cumple el tope indicado. `null` si no
   * hay ninguno disponible. Puede ser asíncrono (el router consulta la
   * disponibilidad de los providers).
   */
  resolveCheaperModel?(options: {
    maxCostPerCallUsd: number;
    capabilities?: readonly string[];
  }): string | null | Promise<string | null>;
}

/** Decisión del circuito de presupuesto. */
export type SubEgoBudgetDecision =
  | {
      readonly outcome: "allow";
      readonly reason?: string;
      /** Tope de coste por llamada vigente (USD), si lo hay. */
      readonly effectiveCostCapUsd?: number;
    }
  | {
      readonly outcome: "degrade";
      /** Modelo con el que continuar (más barato que el original). */
      readonly model: string;
      readonly reason: string;
      readonly estimatedCostUsd: number;
      readonly effectiveCostCapUsd: number;
    }
  | {
      readonly outcome: "stop";
      readonly error: SubEgoBudgetCircuitBreakerError;
    };

/** Contadores medibles del circuito. */
export interface SubEgoBudgetCounters {
  /** Turnos registrados. */
  turns: number;
  /** Turnos en los que se degradó el modelo. */
  degradedTurns: number;
  /** Turnos en los que el circuito se detuvo. */
  stoppedTurns: number;
  /** Tokens consumidos acumulados. */
  tokensUsed: number;
  /** Coste acumulado (USD). */
  costUsd: number;
  /** Duración acumulada (ms). */
  totalDurationMs: number;
  /** Último límite que abrió el circuito (si abrió). */
  lastLimit?: SubEgoBudgetLimit;
}

/** Opciones de construcción del circuit breaker. */
export interface SubEgoBudgetBreakerOptions {
  /** Sub-Ego cuyo presupuesto se vigila. */
  subEgoId: string;
  /** Presupuesto declarado por el manifiesto. */
  budget: SubEgoBudget;
  /** Contabilidad de uso (opcional): reutiliza `SubEgoBudgetTracker`. */
  tracker?: SubEgoBudgetTracker;
  /** Router para la degradación y el tope global (opcional). */
  router?: BudgetAwareRouterLike;
  /** Reloj inyectable (tests deterministas). */
  clock?: () => number;
}

/**
 * Circuit breaker de presupuesto de un Sub-Ego.
 *
 * Uso típico por turno:
 * ```ts
 * const before = await breaker.checkBeforeTurn({ tokens, costUsd });
 * if (before.outcome === "stop") throw before.error;
 * if (before.outcome === "degrade") modelId = before.model;
 * // ... ejecutar ...
 * await breaker.recordAfterTurn({ tokens, costUsd, durationMs });
 * ```
 */
export class SubEgoBudgetCircuitBreaker {
  private readonly counters: SubEgoBudgetCounters = {
    turns: 0,
    degradedTurns: 0,
    stoppedTurns: 0,
    tokensUsed: 0,
    costUsd: 0,
    totalDurationMs: 0
  };

  /** Duración del último turno (para el límite de tiempo). */
  private lastTurnDurationMs = 0;
  /** El circuito quedó abierto por duración: el siguiente turno se detiene. */
  private openByDuration = false;

  constructor(private readonly options: SubEgoBudgetBreakerOptions) {}

  /**
   * Tope de coste por llamada **efectivo**: el mínimo entre el declarado por
   * el Sub-Ego y el global del router. `undefined` si ninguno impose tope.
   */
  public get effectiveCostCapUsd(): number | undefined {
    const own = this.options.budget.maxCostPerCallUsd;
    const routerCap = this.options.router?.getMaxCostPerCallUsd?.();
    if (typeof own === "number" && typeof routerCap === "number") {
      return Math.min(own, routerCap);
    }
    return own ?? routerCap;
  }

  /** Contadores medibles del circuito (copia defensiva). */
  public getCounters(): SubEgoBudgetCounters {
    return { ...this.counters };
  }

  /**
   * Evalúa el circuito ANTES de un turno.
   *
   * @param estimate Estimación de tokens y/o coste de la llamada.
   */
  public async checkBeforeTurn(
    estimate: { tokens?: number; costUsd?: number } = {}
  ): Promise<SubEgoBudgetDecision> {
    const budget = this.options.budget;
    const cap = this.effectiveCostCapUsd;

    // 1) Duración: si el turno anterior excedió el tope, el circuito sigue
    //    abierto (no se encadena un turno más largo).
    if (this.openByDuration) {
      return this.stop("turn_duration", this.lastTurnDurationMs, budget.maxTurnDurationMs ?? 0);
    }

    // 2) Tokens por llamada.
    if (
      typeof estimate.tokens === "number" &&
      estimate.tokens > budget.maxTokensPerCall
    ) {
      return this.stop("tokens_per_call", estimate.tokens, budget.maxTokensPerCall);
    }

    // 3) Gasto diario acumulado (contabilidad del tracker).
    if (this.options.tracker) {
      const metrics = await this.options.tracker.getMetrics(this.options.subEgoId);
      if (metrics.dailyCostUsd >= budget.maxDailyCostUsd) {
        return this.stop("daily_cost", metrics.dailyCostUsd, budget.maxDailyCostUsd);
      }
    }

    // 4) Coste por llamada: degradar o detener.
    if (
      typeof estimate.costUsd === "number" &&
      typeof cap === "number" &&
      estimate.costUsd > cap
    ) {
      const model = await this.resolveDegradation(cap);
      if (model) {
        this.counters.degradedTurns += 1;
        return {
          outcome: "degrade",
          model,
          reason:
            `El coste estimado ($${estimate.costUsd.toFixed(6)}) supera el tope efectivo ` +
            `($${cap.toFixed(6)}); se degrada a '${model}'.`,
          estimatedCostUsd: estimate.costUsd,
          effectiveCostCapUsd: cap
        };
      }
      return this.stop("cost_per_call", estimate.costUsd, cap);
    }

    return { outcome: "allow", effectiveCostCapUsd: cap };
  }

  /**
   * Registra el consumo real de un turno y reevalúa el circuito.
   */
  public async recordAfterTurn(usage: {
    tokens: number;
    costUsd: number;
    durationMs: number;
    model?: string;
  }): Promise<SubEgoBudgetDecision> {
    const budget = this.options.budget;

    this.counters.turns += 1;
    this.counters.tokensUsed += usage.tokens;
    this.counters.costUsd = Number((this.counters.costUsd + usage.costUsd).toFixed(6));
    this.counters.totalDurationMs += usage.durationMs;
    this.lastTurnDurationMs = usage.durationMs;

    // Contabilidad diaria (reutiliza el tracker; no se duplica la métrica).
    if (this.options.tracker) {
      await this.options.tracker.recordTurnUsage(
        this.options.subEgoId,
        {
          inputTokens: 0,
          outputTokens: usage.tokens,
          model: usage.model,
          costUsd: usage.costUsd
        },
        budget
      );
    }

    // Límite de tiempo: un turno que se pasó de plazo abre el circuito.
    if (
      typeof budget.maxTurnDurationMs === "number" &&
      usage.durationMs > budget.maxTurnDurationMs
    ) {
      this.openByDuration = true;
      return this.stop("turn_duration", usage.durationMs, budget.maxTurnDurationMs);
    }

    return { outcome: "allow", effectiveCostCapUsd: this.effectiveCostCapUsd };
  }

  /**
   * Resuelve el modelo de degradación.
   *
   * Orden: (1) `budget.cheaperModelId` explícito; (2) el router (que es quien
   * sabe qué modelos hay y cuánto cuestan). Si ninguno puede, devuelve
   * `null` ⇒ el circuito DETIENE.
   */
  private async resolveDegradation(cap: number): Promise<string | null> {
    if (!this.options.budget.degradeToCheaperModel) return null;

    const explicit = this.options.budget.cheaperModelId?.trim();
    if (explicit && explicit.length > 0) return explicit;

    const router = this.options.router;
    if (!router?.resolveCheaperModel) return null;

    const resolved = await router.resolveCheaperModel({ maxCostPerCallUsd: cap });
    return resolved && resolved.trim().length > 0 ? resolved : null;
  }

  /** Construye la decisión `stop` (con el error tipado) y cuenta la parada. */
  private stop(
    limit: SubEgoBudgetLimit,
    current: number,
    maxAllowed: number
  ): SubEgoBudgetDecision {
    this.counters.stoppedTurns += 1;
    this.counters.lastLimit = limit;
    return {
      outcome: "stop",
      error: new SubEgoBudgetCircuitBreakerError(
        this.options.subEgoId,
        limit,
        current,
        maxAllowed
      )
    };
  }
}

/**
 * Lanza el error de una decisión `stop`. Idempotente para `allow`/`degrade`.
 */
export function throwIfBudgetStopped(decision: SubEgoBudgetDecision): void {
  if (decision.outcome === "stop") throw decision.error;
}
