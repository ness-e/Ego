import { describe, it, expect, beforeEach } from "vitest";
import { ModelRouter } from "../src/ModelRouter.js";
import type { EgoModelInterface, ModelProviderId } from "../src/types.js";
// Import relativo (no hay arista de dependencia `@ego/models → @ego/subegos`):
// el circuit breaker de E5 satisface el contrato estructural `BudgetAwareRouterLike`,
// así que la prueba de integración se monta con las dos piezas REALES.
import {
  SubEgoBudgetCircuitBreaker,
  SubEgoBudgetCircuitBreakerError,
} from "../../subegos/src/SubEgoBudgetBreaker.js";
import { attributeModelId } from "../src/ModelCatalog.js";

/**
 * T1 (A2-bis) — El `ModelRouter` expone el presupuesto y la degradación (E5).
 *
 * Contrato que el circuit breaker de presupuesto de Sub-Ego necesita
 * (`packages/subegos/src/SubEgoBudgetBreaker.ts`, `BudgetAwareRouterLike`):
 * - `getMaxCostPerCallUsd()` → tope global de coste por llamada (USD).
 * - `resolveCheaperModel({maxCostPerCallUsd, capabilities?})` → id del modelo
 *   más barato que cumple el tope, o `null` (⇒ el circuito DETIENE).
 *
 * El router de prueba usa un provider **propio** (`test-e2e`): así el
 * registro por defecto (mock/anthropic/openai/ollama/google/deepseek) queda
 * sin provider disponible y NO compite en la selección de candidatos.
 */

/** Provider id exclusivo del test (no existe en el registro por defecto). */
const TEST_PROVIDER = "test-e2e" as ModelProviderId;

function fakeProvider(providerId: ModelProviderId): EgoModelInterface {
  return {
    providerId,
    isAvailable: async () => true,
    generate: async () => ({
      text: "",
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }),
    stream: async () => {
      throw new Error("no stream en el provider de prueba");
    },
  };
}

function buildRouter(): ModelRouter {
  const router = new ModelRouter({ maxCostPerCallUsd: 1.0 });
  router.registerProvider(fakeProvider(TEST_PROVIDER));

  router.registerModel({
    id: "cheap-model",
    provider: TEST_PROVIDER,
    displayName: "Barato",
    contextWindow: 200000,
    costPerInputTokenUsd: 0.000001,
    costPerOutputTokenUsd: 0.000001,
    capabilities: new Set(["text", "tool_calling", "streaming"]),
    isLocal: false,
  });
  router.registerModel({
    id: "mid-model",
    provider: TEST_PROVIDER,
    displayName: "Medio",
    contextWindow: 128000,
    costPerInputTokenUsd: 0.00001,
    costPerOutputTokenUsd: 0.00001,
    capabilities: new Set(["text", "tool_calling", "streaming"]),
    isLocal: false,
  });
  router.registerModel({
    id: "expensive-model",
    provider: TEST_PROVIDER,
    displayName: "Caro",
    contextWindow: 1048576,
    costPerInputTokenUsd: 0.0001,
    costPerOutputTokenUsd: 0.0001,
    capabilities: new Set(["text", "vision", "tool_calling", "streaming"]),
    isLocal: false,
  });
  return router;
}

describe("T1 — ModelRouter: presupuesto global y degradación (E5)", () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = buildRouter();
  });

  it("getMaxCostPerCallUsd expone el tope global de coste por llamada", () => {
    expect(router.getMaxCostPerCallUsd()).toBe(1.0);
  });

  it("resolveCheaperModel devuelve el modelo más barato dentro del tope", async () => {
    // Coste estimado = 1024 tokens de salida por defecto:
    //   cheap-model  = 1024 * 0.000001 = 0.001024
    //   mid-model    = 1024 * 0.00001  = 0.01024
    //   expensive    = 1024 * 0.0001   = 0.1024
    await expect(router.resolveCheaperModel({ maxCostPerCallUsd: 0.05 })).resolves.toBe(
      "cheap-model",
    );
    // El tope discrimina: excluyendo el más barato, el siguiente es el medio.
    await expect(
      router.resolveCheaperModel({ maxCostPerCallUsd: 0.05, excludeModelId: "cheap-model" }),
    ).resolves.toBe("mid-model");
  });

  it("resolveCheaperModel devuelve null si ningún modelo cabe en el tope", async () => {
    await expect(
      router.resolveCheaperModel({ maxCostPerCallUsd: 0.0001 }),
    ).resolves.toBeNull();
  });

  it("resolveCheaperModel NUNCA degrada al mock (fail-closed hacia un modelo real)", async () => {
    const resolved = await router.resolveCheaperModel({ maxCostPerCallUsd: 10 });
    expect(resolved).not.toBe("mock-core");
    expect(resolved).toBe("cheap-model");
  });

  it("resolveCheaperModel respeta el filtro de capacidades", async () => {
    // Sólo `expensive-model` tiene `vision` entre los disponibles.
    await expect(
      router.resolveCheaperModel({ maxCostPerCallUsd: 1, capabilities: ["vision"] }),
    ).resolves.toBe("expensive-model");
  });

  it("resolveCheaperModel con una capacidad desconocida no devuelve nada (fail-closed)", async () => {
    await expect(
      router.resolveCheaperModel({ maxCostPerCallUsd: 1, capabilities: ["telepatia"] }),
    ).resolves.toBeNull();
  });

  it("el circuit breaker DEGRADA de verdad a un modelo más barato al pasar el umbral de coste", async () => {
    const breaker = new SubEgoBudgetCircuitBreaker({
      subEgoId: "ego.nucleus",
      budget: {
        maxTokensPerCall: 100_000,
        maxDailyCostUsd: 10,
        requiresApprovalAboveUsd: 1,
        maxCostPerCallUsd: 0.05,
        degradeToCheaperModel: true,
      },
      router,
    });

    const decision = await breaker.checkBeforeTurn({ costUsd: 0.2 });

    expect(decision.outcome).toBe("degrade");
    if (decision.outcome !== "degrade") throw new Error("se esperaba degrade");
    expect(decision.model).toBe("cheap-model");
    expect(decision.effectiveCostCapUsd).toBe(0.05);
  });

  it("el circuit breaker DETIENE con error tipado cuando no hay ningún modelo más barato", async () => {
    const breaker = new SubEgoBudgetCircuitBreaker({
      subEgoId: "ego.nucleus",
      budget: {
        maxTokensPerCall: 100_000,
        maxDailyCostUsd: 10,
        requiresApprovalAboveUsd: 1,
        maxCostPerCallUsd: 0.0001,
        degradeToCheaperModel: true,
      },
      router,
    });

    const decision = await breaker.checkBeforeTurn({ costUsd: 0.2 });

    expect(decision.outcome).toBe("stop");
    if (decision.outcome !== "stop") throw new Error("se esperaba stop");
    expect(decision.error).toBeInstanceOf(SubEgoBudgetCircuitBreakerError);
    expect(decision.error.name).toBe("SubEgoBudgetCircuitBreakerError");
    expect(decision.error.limit).toBe("cost_per_call");
  });

  it("el tope efectivo es el MÍNIMO entre el del Sub-Ego y el global del router", async () => {
    const breaker = new SubEgoBudgetCircuitBreaker({
      subEgoId: "ego.nucleus",
      budget: {
        maxTokensPerCall: 100_000,
        maxDailyCostUsd: 10,
        requiresApprovalAboveUsd: 1,
        maxCostPerCallUsd: 0.5,
        degradeToCheaperModel: true,
      },
      router,
    });

    // Router = 1.0 · Sub-Ego = 0.5 → efectivo = 0.5.
    expect(breaker.effectiveCostCapUsd).toBe(0.5);
  });

  it("fuente 'id de modelo → configuración': el descriptor trae provider, capacidades y coste", async () => {
    const descriptor = await router.resolveModelDescriptor("cheap-model");
    expect(descriptor).not.toBeNull();
    expect(descriptor!.provider).toBe(TEST_PROVIDER);
    expect(descriptor!.capabilities.has("tool_calling")).toBe(true);
    expect(descriptor!.costPerOutputTokenUsd).toBe(0.000001);

    // Id NO registrado, pero con provider conocido y disponible → descriptor
    // dinámico (así el desktop puede construir la configuración del id degradado).
    const dynamic = await router.resolveModelDescriptor("modelo-degradado", {
      providerId: TEST_PROVIDER,
    });
    expect(dynamic).not.toBeNull();
    expect(dynamic!.id).toBe("modelo-degradado");
    expect(dynamic!.provider).toBe(TEST_PROVIDER);

    // Id no registrado y SIN provider → no se puede construir configuración.
    expect(await router.resolveModelDescriptor("modelo-desconocido")).toBeNull();
  });

  it("el catálogo atribuye un id de modelo curado a su provider (fallback offline)", () => {
    expect(attributeModelId("gpt-4o")).toBe("openai");
    expect(attributeModelId("claude-3-5-sonnet-20241022")).toBe("anthropic");
    expect(attributeModelId("gemini-3.8-flash")).toBe("google");
    expect(attributeModelId("modelo-inventado")).toBeNull();
  });
});
