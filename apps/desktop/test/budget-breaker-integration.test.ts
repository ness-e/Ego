/**
 * E5 (Ola 5 · T1) — El circuito de presupuesto de Sub-Ego LLEGA al producto.
 *
 * ## Qué afirma
 * 1. Con un presupuesto por llamada y un **router doble**, el circuito
 *    DEGRADA a un modelo más barato (y el turno usa ese modelo).
 * 2. Si el router no puede resolver un modelo barato, el circuito
 *    **DETIENE** con un error **tipado** (no sigue con el caro).
 * 3. Si la degradación no se puede traducir a una configuración de turno,
 *    el turno **se detiene** (fail-closed: seguir violaría el tope).
 * 4. El límite de **tokens por llamada** es efectivo SIN router (la
 *    heurística `chars/3` del propio producto).
 * 5. El límite de **duración** abre el circuito: el turno siguiente se
 *    detiene con error tipado.
 * 6. Sin manifiesto (Sub-Ego desconocido) → no hay presupuesto: se deja
 *    pasar el turno.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  SubEgoBudgetCircuitBreakerError,
  type SubEgoManifest,
} from "@ego/subegos";

import {
  clearBudgetBreakers,
  ensureBudgetBreaker,
  evaluateTurnBudget,
  estimateTokens,
  recordTurnBudget,
} from "../src/main/subegos/budget-guard.js";
import type { ModelConfig } from "../src/ipc/schema.js";

function manifest(budget: Partial<SubEgoManifest["budget"]> = {}): SubEgoManifest {
  return {
    id: `ego.tester-${Math.random().toString(36).slice(2, 8)}`,
    name: "Tester",
    role: "Probador",
    description: "Sub-Ego de pruebas",
    systemPrompt: "Eres un probador.",
    responsibilities: [],
    capabilities: [],
    tools: [],
    permissions: [],
    namespaces: { read: [], write: [] },
    behavior: {} as SubEgoManifest["behavior"],
    autonomy: {} as SubEgoManifest["autonomy"],
    budget: {
      maxTokensPerCall: 4000,
      maxDailyCostUsd: 2,
      requiresApprovalAboveUsd: 0.5,
      ...budget,
    },
    trigger: {} as SubEgoManifest["trigger"],
  } as SubEgoManifest;
}

const CHEAP_CONFIG: ModelConfig = {
  activeProvider: "openai",
  apiKey: "k",
  baseUrl: "",
  modelName: "modelo-barato",
} as ModelConfig;

beforeEach(() => {
  clearBudgetBreakers();
});

describe("E5 — el circuito de presupuesto llega al producto", () => {
  it("DEGRADA a un modelo más barato cuando el coste supera el tope", async () => {
    // `degradeToCheaperModel: true` es lo que autoriza la degradación (por
    // defecto el circuito DETIENE: degradar es una decisión del Sub-Ego).
    const m = manifest({ maxCostPerCallUsd: 0.5, degradeToCheaperModel: true });
    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      router: {
        getMaxCostPerCallUsd: () => 10,
        resolveCheaperModel: async () => "modelo-barato",
      },
      estimate: { costUsd: 2 },
      resolveModelConfig: (id) =>
        id === "modelo-barato" ? CHEAP_CONFIG : undefined,
    });

    expect(outcome.stop).toBe(false);
    expect(outcome.decision.outcome).toBe("degrade");
    expect(outcome.modelId).toBe("modelo-barato");
    expect(outcome.modelConfig?.modelName).toBe("modelo-barato");
    expect(outcome.reason).toContain("modelo-barato");
  });

  it("DETIENE con error tipado si el router no encuentra un modelo barato", async () => {
    const m = manifest({ maxCostPerCallUsd: 0.5 });
    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      router: {
        getMaxCostPerCallUsd: () => 10,
        resolveCheaperModel: async () => null,
      },
      estimate: { costUsd: 2 },
    });

    expect(outcome.stop, "sin modelo barato el circuito detiene").toBe(true);
    expect(outcome.decision.outcome).toBe("stop");
    const err = (outcome.decision as { error: SubEgoBudgetCircuitBreakerError }).error;
    expect(err).toBeInstanceOf(SubEgoBudgetCircuitBreakerError);
    // El error tipado dice QUÉ límite se superó (no un string suelto).
    expect(err.limit).toBe("cost_per_call");
    expect(err.maxAllowed).toBe(0.5);
    expect(outcome.reason).toContain("cost_per_call");
  });

  it("si la degradación no se puede traducir a configuración, el turno se detiene", async () => {
    const m = manifest({ maxCostPerCallUsd: 0.5, degradeToCheaperModel: true });
    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      router: {
        getMaxCostPerCallUsd: () => 10,
        resolveCheaperModel: async () => "modelo-barato",
      },
      estimate: { costUsd: 2 },
      resolveModelConfig: () => undefined, // no sabemos construirlo
    });

    expect(
      outcome.stop,
      "seguir con el modelo caro violaría el tope: fail-closed"
    ).toBe(true);
    expect(outcome.reason).toContain("modelo-barato");
  });

  it("el tope efectivo es el MÍNIMO entre el del Sub-Ego y el global del router", async () => {
    const m = manifest({ maxCostPerCallUsd: 0.5 });
    const breaker = ensureBudgetBreaker(m, {
      getMaxCostPerCallUsd: () => 0.1,
    });
    expect(breaker.effectiveCostCapUsd).toBe(0.1);

    const m2 = manifest({ maxCostPerCallUsd: 5 });
    const breaker2 = ensureBudgetBreaker(m2, {
      getMaxCostPerCallUsd: () => 0.1,
    });
    expect(breaker2.effectiveCostCapUsd).toBe(0.1);
  });

  it("el límite de tokens por llamada es efectivo SIN router", async () => {
    const m = manifest({ maxTokensPerCall: 100 });
    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      estimate: { tokens: 500 },
    });
    expect(outcome.stop).toBe(true);
    expect(outcome.decision.outcome).toBe("stop");
    expect(outcome.reason).toContain("tokens");
  });

  it("el límite de duración abre el circuito: el turno siguiente se detiene", async () => {
    const m = manifest({ maxTurnDurationMs: 1000 });
    // Turno 1: se registra un turno de 5000 ms → el circuito queda abierto.
    const after = await recordTurnBudget({
      subEgoId: m.id,
      manifest: m,
      usage: { tokens: 10, durationMs: 5000 },
    });
    expect(after?.outcome).toBe("stop");

    // Turno 2: el circuito sigue abierto → se detiene antes de empezar.
    const before = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
    });
    expect(before.stop).toBe(true);
    expect(before.decision.outcome).toBe("stop");
    expect(before.reason).toContain("turn_duration");
  });

  it("sin manifiesto no hay presupuesto: el turno pasa", async () => {
    const outcome = await evaluateTurnBudget({
      subEgoId: "ego.desconocido",
      manifest: null,
      estimate: { tokens: 999999, costUsd: 999 },
    });
    expect(outcome.stop).toBe(false);
    expect(outcome.decision.outcome).toBe("allow");
  });

  it("la estimación de tokens usa la heurística chars/3", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("a".repeat(300))).toBe(100);
  });
});
