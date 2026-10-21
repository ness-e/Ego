import { describe, it, expect } from "vitest";
import { ModelRouter } from "../src/ModelRouter.js";
import { OpenAICompatibleProvider } from "../src/providers/OpenAICompatibleProvider.js";
import { attributeModelId, providerProfile } from "../src/ModelCatalog.js";
import type { ModelProviderId } from "../src/types.js";
import {
  SubEgoBudgetCircuitBreaker,
  SubEgoBudgetCircuitBreakerError,
} from "../../subegos/src/SubEgoBudgetBreaker.js";

/**
 * T1/T2 (A2-bis, Ola 6) — El contrato exacto de los 2 métodos del router.
 *
 * El consumidor real es `BudgetAwareRouterLike`
 * (`packages/subegos/src/SubEgoBudgetBreaker.ts`), que A4 re-exporta como
 * `BudgetRouter` (`apps/desktop/src/main/subegos/budget-guard.ts:37`):
 *
 * ```ts
 * getMaxCostPerCallUsd?(): number | undefined;
 * resolveCheaperModel?(options: {
 *   maxCostPerCallUsd: number;
 *   capabilities?: readonly string[];
 * }): string | null | Promise<string | null>;
 * ```
 *
 * Aquí se fija la semántica de los casos que el contrato no explicita:
 * - **sin tope** → `undefined` (NO `0`: `0` sería "todo cuesta 0" y el
 *   circuito pararía todos los turnos).
 * - **sin alternativa** → `null` (el circuito DETIENE con error tipado).
 * - el candidato **debe** cumplir las capacidades exigidas.
 */

/** El catálogo por defecto del router, con un provider REAL disponible. */
function buildRealCatalogueRouter(): ModelRouter {
  const router = new ModelRouter({ maxCostPerCallUsd: 1.0 });
  // Provider real (OpenAI-compatible) con una credencial de prueba: `isAvailable()`
  // no hace red (sólo comprueba que la key tenga longitud > 5).
  router.registerProvider(
    new OpenAICompatibleProvider({
      providerId: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-000000000000",
    })
  );
  return router;
}

describe("T1 — contrato de `getMaxCostPerCallUsd()`", () => {
  it("(a) SIN tope configurado explícitamente devuelve el DEFAULT del constructor (1.0 USD)", () => {
    // El default es 1.0: es el mismo valor que ya usa `enforceCostBudget`
    // (EGO-FIND-39), de modo que el tope global y el enforcement en línea
    // nunca se contradicen.
    expect(new ModelRouter().getMaxCostPerCallUsd()).toBe(1.0);
    expect(new ModelRouter({}).getMaxCostPerCallUsd()).toBe(1.0);
  });

  it("(a′) un tope NO positivo o no finito significa SIN tope ⇒ `undefined`", () => {
    // Contrato: `0` (o negativo, o NaN) = "no hay tope global". Devolver `0`
    // haría que el breaker calculara `MÍNIMO(Sub-Ego, 0) = 0` y **parase
    // todos los turnos**. `undefined` = "el circuito vigila sólo los demás
    // límites", que es la semántica que ya tiene `enforceCostBudget`.
    expect(new ModelRouter({ maxCostPerCallUsd: 0 }).getMaxCostPerCallUsd()).toBeUndefined();
    expect(new ModelRouter({ maxCostPerCallUsd: -1 }).getMaxCostPerCallUsd()).toBeUndefined();
    expect(
      new ModelRouter({ maxCostPerCallUsd: Number.NaN }).getMaxCostPerCallUsd(),
    ).toBeUndefined();
  });

  it("(b) con tope configurado devuelve EXACTAMENTE ese tope", () => {
    expect(new ModelRouter({ maxCostPerCallUsd: 2.5 }).getMaxCostPerCallUsd()).toBe(2.5);
    expect(new ModelRouter({ maxCostPerCallUsd: 0.05 }).getMaxCostPerCallUsd()).toBe(0.05);
  });
});

describe("T1 — contrato de `resolveCheaperModel()`", () => {
  it("(c) con un modelo más barato disponible devuelve su id", async () => {
    const router = buildRealCatalogueRouter();
    // Catálogo real: `gpt-4o` cuesta 1024 × 0.00001 = 0.01024 USD.
    await expect(router.resolveCheaperModel({ maxCostPerCallUsd: 0.05 })).resolves.toBe(
      "gpt-4o",
    );
  });

  it("(d) SIN modelo más barato devuelve `null` (el circuito DETIENE)", async () => {
    const router = buildRealCatalogueRouter();
    // Ningún modelo del catálogo real cabe en 0.0001 USD.
    await expect(
      router.resolveCheaperModel({ maxCostPerCallUsd: 0.0001 }),
    ).resolves.toBeNull();
  });

  it("(e) el candidato DEBE cumplir `requiredCapabilities` (no degrada a un modelo sin `tool_calling`)", async () => {
    // Provider exclusivo del test: el catálogo por defecto queda fuera de la
    // selección (para que el resultado dependa sólo de los dos modelos de
    // abajo, no de `gpt-4o` & compañía).
    const router = new ModelRouter({ maxCostPerCallUsd: 1.0 });
    router.registerProvider({
      providerId: "test-e2e" as ModelProviderId,
      isAvailable: async () => true,
      generate: async () => ({
        text: "",
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }),
      stream: async () => {
        throw new Error("no stream");
      },
    });
    // Un modelo barato SIN `tool_calling` y uno caro CON `tool_calling`.
    router.registerModel({
      id: "barato-sin-tools",
      provider: "test-e2e" as ModelProviderId,
      displayName: "Barato sin tool_calling",
      contextWindow: 8000,
      costPerInputTokenUsd: 0.0000001,
      costPerOutputTokenUsd: 0.0000001,
      capabilities: new Set(["text"]),
      isLocal: false,
    });
    router.registerModel({
      id: "caro-con-tools",
      provider: "test-e2e" as ModelProviderId,
      displayName: "Caro con tool_calling",
      contextWindow: 128000,
      costPerInputTokenUsd: 0.00001,
      costPerOutputTokenUsd: 0.00001,
      capabilities: new Set(["text", "tool_calling"]),
      isLocal: false,
    });

    // Sin filtro: gana el más barato.
    await expect(
      router.resolveCheaperModel({ maxCostPerCallUsd: 0.05 }),
    ).resolves.toBe("barato-sin-tools");
    // Con `tool_calling` exigido: el barato **no** es elegible.
    await expect(
      router.resolveCheaperModel({
        maxCostPerCallUsd: 0.05,
        capabilities: ["tool_calling"],
      }),
    ).resolves.toBe("caro-con-tools");
  });

  it("(f) acepta también la forma abreviada (un número suelto) del handoff A1-ola6 §4.1", async () => {
    const router = buildRealCatalogueRouter();
    await expect(router.resolveCheaperModel(0.05)).resolves.toBe("gpt-4o");
    await expect(router.resolveCheaperModel(0.0001)).resolves.toBeNull();
  });
});

describe("T1 — el circuito REAL degrada y detiene con el router REAL y el catálogo REAL", () => {
  it("DEGRADA de verdad a un modelo más barato al superar el tope de coste", async () => {
    const router = buildRealCatalogueRouter();
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
    expect(decision.model).toBe("gpt-4o");
    expect(decision.effectiveCostCapUsd).toBe(0.05);
  });

  it("DETIENE con error tipado cuando no hay alternativa", async () => {
    const router = buildRealCatalogueRouter();
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
    const router = new ModelRouter({ maxCostPerCallUsd: 1.0 });
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
    expect(breaker.effectiveCostCapUsd).toBe(0.5);
  });

  it("con el router SIN tope global (`undefined`), el tope efectivo es el del Sub-Ego", async () => {
    const router = new ModelRouter({ maxCostPerCallUsd: 0 });
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
    // Si el router devolviera `0`, el mínimo sería 0 y el circuito pararía
    // todos los turnos. Con `undefined` (sin tope global) manda el del Sub-Ego.
    expect(breaker.effectiveCostCapUsd).toBe(0.05);
  });
});

describe("T2 — el destino operable: id de modelo → provider + credencial + capacidades", () => {
  it("resuelve un id REGISTRADO a su provider, credencial, baseUrl y capacidades", () => {
    const router = buildRealCatalogueRouter();
    const target = router.resolveModelTarget("gpt-4o");

    expect(target).not.toBeNull();
    expect(target!.modelId).toBe("gpt-4o");
    expect(target!.provider).toBe("openai");
    expect(target!.profile.credentialSlot).toBe("openaiKey");
    expect(target!.profile.baseUrlSlot).toBe("openaiBaseURL");
    expect(target!.capabilities).toContain("tool_calling");
    expect(target!.registered).toBe(true);
    expect(target!.providerRegistered).toBe(true);
    // El coste estimado por llamada (1024 tokens de salida).
    expect(target!.estimatedCostUsd).toBeCloseTo(0.01024, 6);
  });

  it("resuelve un id NO registrado por el catálogo curado (attribution offline)", () => {
    const router = buildRealCatalogueRouter();
    const target = router.resolveModelTarget("claude-3-5-haiku-20241022");

    expect(target).not.toBeNull();
    expect(target!.modelId).toBe("claude-3-5-haiku-20241022");
    expect(target!.provider).toBe("anthropic");
    expect(target!.profile.credentialSlot).toBe("anthropicKey");
    // Id no registrado: sus capacidades NO se conocen (no se inventan).
    expect(target!.registered).toBe(false);
    expect(target!.capabilities).toEqual([]);
  });

  it("devuelve `null` si el id no se puede atribuir a ningún provider (fail-closed)", () => {
    const router = buildRealCatalogueRouter();
    expect(router.resolveModelTarget("modelo-inventado")).toBeNull();
    expect(router.resolveModelTarget("")).toBeNull();
  });

  it("el perfil de provider dice qué credencial necesita (y los locales, ninguna)", () => {
    expect(providerProfile("openai").credentialSlot).toBe("openaiKey");
    expect(providerProfile("anthropic").credentialSlot).toBe("anthropicKey");
    expect(providerProfile("google").credentialSlot).toBe("googleKey");
    expect(providerProfile("deepseek").credentialSlot).toBe("deepseekKey");
    expect(providerProfile("ollama").credentialSlot).toBeNull();
    expect(providerProfile("ollama").isLocal).toBe(true);
    expect(providerProfile("mock").credentialSlot).toBeNull();
  });

  it("la atribución offline del catálogo sigue funcionando", () => {
    expect(attributeModelId("gpt-4o")).toBe("openai");
    expect(attributeModelId("claude-3-5-sonnet-20241022")).toBe("anthropic");
    expect(attributeModelId("modelo-inventado")).toBeNull();
  });
});
