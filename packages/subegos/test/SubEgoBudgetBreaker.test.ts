import { describe, it, expect } from "vitest";
import {
  SubEgoBudgetCircuitBreaker,
  SubEgoBudgetCircuitBreakerError,
  SubEgoBudgetTracker,
  SubEgoRuntime,
  type SubEgoBudgetDecision,
  type BudgetAwareRouterLike,
} from "../src/index.js";
import { createSubEgoManifest } from "../src/SubEgoManifest.js";
import type { SubEgoBudget } from "../src/types.js";

/**
 * E5 (Ola 4b / A3 / T1) — Circuit breakers de presupuesto por Sub-Ego.
 *
 * Requisitos:
 * - presupuesto de **tokens / coste / tiempo** por Sub-Ego;
 * - al superarlo ⇒ **degradar a un modelo más barato** o **detener** con un
 *   error **tipado**;
 * - conexión con el `maxCostPerCallUsd` que A2 cableó en el `ModelRouter`
 *   (sin reimplementar su política: el router decide qué modelo es barato).
 *
 * El presupuesto debe ser **medible**: los contadores son asserts sobre
 * números, no flags.
 */

const BUDGET: SubEgoBudget = {
  maxTokensPerCall: 1000,
  maxDailyCostUsd: 5,
  requiresApprovalAboveUsd: 0.5,
  maxCostPerCallUsd: 0.5,
  maxTurnDurationMs: 30_000,
  degradeToCheaperModel: false
};

function breaker(
  budget: Partial<SubEgoBudget> = {},
  router?: BudgetAwareRouterLike
): SubEgoBudgetCircuitBreaker {
  return new SubEgoBudgetCircuitBreaker({
    subEgoId: "ego.auditor",
    budget: { ...BUDGET, ...budget },
    router
  });
}

function expectStop(decision: SubEgoBudgetDecision): SubEgoBudgetCircuitBreakerError {
  expect(decision.outcome).toBe("stop");
  if (decision.outcome !== "stop") throw new Error("decisión no es stop");
  expect(decision.error).toBeInstanceOf(SubEgoBudgetCircuitBreakerError);
  return decision.error;
}

describe("E5 — circuit breaker de presupuesto: tokens", () => {
  it("permite un turno dentro del presupuesto", async () => {
    const decision = await breaker().checkBeforeTurn({ tokens: 500 });

    expect(decision.outcome).toBe("allow");
  });

  it("detiene con error TIPADO si los tokens superan el tope por llamada", async () => {
    const decision = await breaker().checkBeforeTurn({ tokens: 5000 });

    const error = expectStop(decision);
    expect(error.limit).toBe("tokens_per_call");
    expect(error.current).toBe(5000);
    expect(error.maxAllowed).toBe(1000);
    expect(error.subEgoId).toBe("ego.auditor");
  });
});

describe("E5 — circuit breaker de presupuesto: coste", () => {
  it("degrada a un modelo más barato cuando el coste por llamada excede el tope", async () => {
    const decision = await breaker(
      { degradeToCheaperModel: true, cheaperModelId: "gpt-4o-mini" }
    ).checkBeforeTurn({ costUsd: 0.9 });

    expect(decision.outcome).toBe("degrade");
    if (decision.outcome !== "degrade") throw new Error("decisión no es degrade");
    expect(decision.model).toBe("gpt-4o-mini");
    expect(decision.estimatedCostUsd).toBeCloseTo(0.9, 6);
    expect(decision.effectiveCostCapUsd).toBeCloseTo(0.5, 6);
  });

  it("el modelo de degradación lo decide el ROUTER (no se reimplementa aquí)", async () => {
    const calls: number[] = [];
    const router: BudgetAwareRouterLike = {
      getMaxCostPerCallUsd: () => 2,
      resolveCheaperModel: (opts) => {
        calls.push(opts.maxCostPerCallUsd);
        return "router-cheap-model";
      }
    };

    const decision = await breaker({ degradeToCheaperModel: true }, router).checkBeforeTurn({
      costUsd: 0.9
    });

    expect(decision.outcome).toBe("degrade");
    if (decision.outcome !== "degrade") throw new Error("decisión no es degrade");
    expect(decision.model).toBe("router-cheap-model");
    expect(calls).toEqual([0.5]);
  });

  it("sin modelo de degradación disponible, DETIENE con error tipado", async () => {
    const decision = await breaker({ degradeToCheaperModel: true }).checkBeforeTurn({
      costUsd: 0.9
    });

    const error = expectStop(decision);
    expect(error.limit).toBe("cost_per_call");
  });

  it("sin degradación habilitada, DETIENE con error tipado", async () => {
    const decision = await breaker({ cheaperModelId: "gpt-4o-mini" }).checkBeforeTurn({
      costUsd: 0.9
    });

    expect(expectStop(decision).limit).toBe("cost_per_call");
  });

  it("el tope efectivo es el MÍNIMO entre el del Sub-Ego y el global del router", async () => {
    const router: BudgetAwareRouterLike = {
      getMaxCostPerCallUsd: () => 0.1,
      resolveCheaperModel: () => "cheap"
    };

    // 0.2 > 0.1 (tope del router) aunque < 0.5 (tope del Sub-Ego).
    const decision = await breaker({ degradeToCheaperModel: true }, router).checkBeforeTurn({
      costUsd: 0.2
    });

    expect(decision.outcome).toBe("degrade");
    if (decision.outcome !== "degrade") throw new Error("decisión no es degrade");
    expect(decision.effectiveCostCapUsd).toBeCloseTo(0.1, 6);
  });

  it("detiene si el gasto diario acumulado ya alcanzó el tope", async () => {
    const tracker = new SubEgoBudgetTracker();
    const b = new SubEgoBudgetCircuitBreaker({
      subEgoId: "ego.auditor",
      budget: { ...BUDGET, maxDailyCostUsd: 0.001 },
      tracker
    });

    await b.recordAfterTurn({ tokens: 10, costUsd: 0.001, durationMs: 5 });

    const decision = await b.checkBeforeTurn({ tokens: 10 });
    const error = expectStop(decision);
    expect(error.limit).toBe("daily_cost");
  });
});

describe("E5 — circuit breaker de presupuesto: tiempo", () => {
  it("un turno que excede la duración máxima abre el circuito", async () => {
    const b = breaker();

    const after = await b.recordAfterTurn({ tokens: 10, costUsd: 0.01, durationMs: 45_000 });
    expect(expectStop(after).limit).toBe("turn_duration");

    const next = await b.checkBeforeTurn({ tokens: 10 });
    expect(expectStop(next).limit).toBe("turn_duration");
  });

  it("un turno dentro del tiempo NO abre el circuito", async () => {
    const b = breaker();

    const after = await b.recordAfterTurn({ tokens: 10, costUsd: 0.01, durationMs: 100 });

    expect(after.outcome).toBe("allow");
    expect((await b.checkBeforeTurn({ tokens: 10 })).outcome).toBe("allow");
  });
});

describe("E5 — el presupuesto es MEDIBLE (contadores)", () => {
  it("acumula turnos, tokens, coste y duración", async () => {
    const b = breaker();

    await b.recordAfterTurn({ tokens: 120, costUsd: 0.01, durationMs: 30 });
    await b.recordAfterTurn({ tokens: 80, costUsd: 0.02, durationMs: 40 });

    const counters = b.getCounters();
    expect(counters.turns).toBe(2);
    expect(counters.tokensUsed).toBe(200);
    expect(counters.costUsd).toBeCloseTo(0.03, 6);
    expect(counters.totalDurationMs).toBe(70);
    expect(counters.degradedTurns).toBe(0);
    expect(counters.stoppedTurns).toBe(0);
  });

  it("cuenta las degradaciones y las paradas", async () => {
    const b = breaker({ degradeToCheaperModel: true, cheaperModelId: "cheap" });

    await b.checkBeforeTurn({ costUsd: 0.9 });
    await b.checkBeforeTurn({ tokens: 99_999 });

    const counters = b.getCounters();
    expect(counters.degradedTurns).toBe(1);
    expect(counters.stoppedTurns).toBe(1);
    expect(counters.lastLimit).toBe("tokens_per_call");
  });
});

describe("E5 — integración con el runtime de Sub-Egos", () => {
  it("el runtime detiene el turno con el error tipado cuando el presupuesto está agotado", async () => {
    const manifest = createSubEgoManifest({
      name: "Auditor Técnico",
      role: "Auditor",
      instructions: "Audita el código."
    });
    const runtime = new SubEgoRuntime();
    runtime.registerManifest(manifest);

    const b = new SubEgoBudgetCircuitBreaker({
      subEgoId: manifest.id,
      budget: { ...BUDGET, maxTokensPerCall: 10 }
    });
    const runtimeWithBudget = new SubEgoRuntime({ budgetBreaker: b });
    runtimeWithBudget.registerManifest(manifest);

    await expect(
      runtimeWithBudget.executeTurn(manifest.id, async () => {
        const decision = await b.checkBeforeTurn({ tokens: 100 });
        if (decision.outcome === "stop") throw decision.error;
        return { output: "nunca" };
      })
    ).rejects.toThrow(SubEgoBudgetCircuitBreakerError);
  });

  it("el runtime expone el modelo degradado en el scratchpad de la instancia", async () => {
    const manifest = createSubEgoManifest({
      name: "Auditor Técnico",
      role: "Auditor",
      instructions: "Audita el código."
    });
    const b = new SubEgoBudgetCircuitBreaker({
      subEgoId: manifest.id,
      budget: { ...BUDGET, degradeToCheaperModel: true, cheaperModelId: "gpt-4o-mini" }
    });
    const runtime = new SubEgoRuntime({ budgetBreaker: b });
    runtime.registerManifest(manifest);

    const decision = await runtime.consultBudget(manifest.id, { costUsd: 0.9 });

    expect(decision.outcome).toBe("degrade");
    const instance = runtime.getInstance(manifest.id);
    expect(instance?.scratchpad.get("__budget_model")).toBe("gpt-4o-mini");
  });

  it("el runtime detiene el turno si el circuito ya está abierto por duración", async () => {
    const manifest = createSubEgoManifest({
      name: "Auditor Técnico",
      role: "Auditor",
      instructions: "Audita el código."
    });
    const b = new SubEgoBudgetCircuitBreaker({
      subEgoId: manifest.id,
      budget: { ...BUDGET, maxTurnDurationMs: 1 }
    });
    const runtime = new SubEgoRuntime({ budgetBreaker: b });
    runtime.registerManifest(manifest);

    await b.recordAfterTurn({ tokens: 1, costUsd: 0, durationMs: 5000 });

    await expect(
      runtime.executeTurn(manifest.id, async () => ({ output: "nunca" }))
    ).rejects.toThrow(SubEgoBudgetCircuitBreakerError);
  });
});
