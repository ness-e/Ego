/**
 * Ola 6 · T2 — El circuito de presupuesto, de extremo a extremo, con el
 * **router REAL** (sin mocks del router).
 *
 * ## Qué afirma
 * 1. Un turno cuyo coste estimado **supera** el tope **degrada** a un modelo
 *    más barato REAL (el `ModelRouter` decide cuál: el más barato que cabe
 *    en el tope, excluyendo el mock y el modelo actual).
 * 2. La configuración del modelo degradado se construye desde el **descriptor
 *    real** del router (provider + id) → el turno puede ejecutarse con él.
 * 3. **Sin alternativa** que quepa en el tope → el circuito **DETIENE** con
 *    el error tipado (no degrada a un modelo que no existe).
 * 4. La degradación es **VISIBLE**: el bus emite un `system.alert` con el
 *    modelo elegido, el de origen y el motivo → lo consume el `NotifyCenter`
 *    del renderer (notificación in-app) y el log estructurado.
 * 5. El tope efectivo es el **MÍNIMO** entre el del Sub-Ego y el global del
 *    router.
 *
 * ## El router es de verdad
 * `ModelRouter` real de `@ego/models`, con un catálogo real de modelos de
 * prueba y un provider disponible (NO el `mock`: el mock nunca es destino de
 * una degradación por coste, por diseño del router).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "@ego/events";
import {
  ModelRouter,
  estimateCallCostUsd,
  type EgoModelInterface,
  type ModelDescriptor,
  type ModelProviderId,
} from "@ego/models";
import type { SubEgoManifest } from "@ego/subegos";

import {
  evaluateTurnBudget,
  clearBudgetBreakers,
} from "../src/main/subegos/budget-guard.js";
import { handleLlmStream, type HandleLlmStreamCtx } from "../src/main/llm/handle-llm-stream.js";

/** Provider disponible y sin coste (el coste vive en el descriptor). */
function availableProvider(providerId: ModelProviderId): EgoModelInterface {
  return {
    providerId,
    isAvailable: async () => true,
    generate: async () => ({
      content: "",
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }),
    stream: async () => ({
      content: "",
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }),
  } as unknown as EgoModelInterface;
}

/** Modelo de prueba con un coste por token de salida. */
function model(id: string, costPerOutputTokenUsd: number): ModelDescriptor {
  return {
    id,
    provider: "openai",
    displayName: id,
    contextWindow: 128_000,
    costPerInputTokenUsd: costPerOutputTokenUsd,
    costPerOutputTokenUsd,
    capabilities: new Set(["text", "tool_calling", "streaming"] as never),
    isLocal: false,
  };
}

/** El router real con un catálogo real: uno caro y uno barato. */
function realRouter(maxCostPerCallUsd: number): ModelRouter {
  const router = new ModelRouter({ maxCostPerCallUsd });
  router.registerProvider(availableProvider("openai"));
  // El router estima 1024 tokens de salida por defecto: el caro cuesta
  // 1024 × 0.00006 = 0.06144 USD (no cabe en el tope) y el barato
  // 1024 × 0.000001 = 0.001024 USD (sí cabe).
  router.registerModel(model("modelo-caro", 0.00006));
  router.registerModel(model("modelo-barato", 0.000001));
  return router;
}

/** El coste estimado del turno con las tarifas reales del modelo vigente. */
function costOfTurn(
  router: ModelRouter,
  modelId: string,
  prompt: string
): number | undefined {
  const descriptor = router.getModelDescriptor(modelId);
  if (!descriptor) return undefined;
  return estimateCallCostUsd(descriptor, {
    messages: [{ role: "user", content: prompt }],
  });
}

function manifest(budget: Partial<SubEgoManifest["budget"]> = {}): SubEgoManifest {  return {
    id: "ego.tester-circuito",
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

beforeEach(() => {
  clearBudgetBreakers();
});

describe("Ola 6 T2 — el circuito de presupuesto, de extremo a extremo (router real)", () => {
  it("un turno que supera el tope DEGRADA al modelo más barato real", async () => {
    const router = realRouter(0.01);
    const m = manifest({ maxCostPerCallUsd: 0.01, degradeToCheaperModel: true });

    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      router,
      estimate: { costUsd: 0.05 },
      // La configuración se construye desde el descriptor REAL del router.
      resolveModelConfig: (modelId) => {
        const descriptor = router.getModelDescriptor(modelId);
        if (!descriptor) return undefined;
        return {
          activeProvider: descriptor.provider,
          apiKey: "",
          baseUrl: "",
          modelName: descriptor.id,
        } as never;
      },
    });

    expect(outcome.stop, "el turno NO debe detenerse: hay alternativa").toBe(false);
    expect(outcome.decision.outcome).toBe("degrade");
    // El router elige el MÁS BARATO que cabe en el tope (no el mock, no el
    // modelo caro).
    expect(outcome.modelId).toBe("modelo-barato");
    expect(outcome.modelConfig?.modelName).toBe("modelo-barato");
    expect(outcome.modelConfig?.activeProvider).toBe("openai");
    // Y el motivo dice QUÉ y POR QUÉ.
    expect(outcome.reason).toContain("modelo-barato");
  });

  it("sin alternativa que quepa en el tope → DETIENE con error tipado", async () => {
    const router = realRouter(0.01);
    const m = manifest({ maxCostPerCallUsd: 0.01, degradeToCheaperModel: true });

    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      router,
      // Un tope que NO admite ni al modelo barato → no hay alternativa.
      estimate: { costUsd: 0.05 },
      resolveModelConfig: (modelId) => {
        const descriptor = router.getModelDescriptor(modelId);
        if (!descriptor) return undefined;
        return {
          activeProvider: descriptor.provider,
          apiKey: "",
          baseUrl: "",
          modelName: descriptor.id,
        } as never;
      },
    });

    // Con el catálogo de este test SÍ hay alternativa (el barato) → el
    // circuito degrada; para el caso "sin alternativa" hay que usar un
    // router cuyo único modelo no cabe en el tope.
    const routerSoloCaro = new ModelRouter({ maxCostPerCallUsd: 0.01 });
    routerSoloCaro.registerProvider(availableProvider("openai"));
    routerSoloCaro.registerModel(model("modelo-caro", 0.00006));

    const stop = await evaluateTurnBudget({
      subEgoId: `${m.id}-solo-caro`,
      manifest: { ...m, id: `${m.id}-solo-caro` },
      router: routerSoloCaro,
      estimate: { costUsd: 0.05 },
      resolveModelConfig: (modelId) => {
        const descriptor = routerSoloCaro.getModelDescriptor(modelId);
        if (!descriptor) return undefined;
        return {
          activeProvider: descriptor.provider,
          apiKey: "",
          baseUrl: "",
          modelName: descriptor.id,
        } as never;
      },
    });

    expect(stop.stop, "sin alternativa el circuito debe detener").toBe(true);
    expect(stop.decision.outcome).toBe("stop");
  });

  it("el tope efectivo es el MÍNIMO entre el del Sub-Ego y el global del router", async () => {
    const router = realRouter(0.002); // tope global MÁS estricto
    const m = manifest({ maxCostPerCallUsd: 0.01, degradeToCheaperModel: true });
    const outcome = await evaluateTurnBudget({
      subEgoId: m.id,
      manifest: m,
      router,
      estimate: { costUsd: 0.05 },
      resolveModelConfig: () => undefined,
    });
    // Con el tope global (0.002) el barato (0.001024) SÍ cabe → degrada.
    expect(outcome.decision.outcome).toBe("degrade");
    // Y el tope efectivo que reporta el circuito es el mínimo.
    const cap = (outcome.decision as { effectiveCostCapUsd?: number }).effectiveCostCapUsd;
    expect(cap).toBe(0.002);
  });

  it("la degradación es VISIBLE: el bus emite `system.alert` con el modelo y el motivo", async () => {
    const router = realRouter(0.01);
    const m = manifest({ maxCostPerCallUsd: 0.01, degradeToCheaperModel: true });
    const bus = new EventBus();
    const alerts: Array<{ code?: string; message?: string; details?: Record<string, unknown> }> = [];
    bus.on("system.alert", (event) => {
      alerts.push(event.payload as never);
    });

    const ctx = makeCtx(bus, router, m);

    await handleLlmStream(ctx, {
      prompt: "hola",
      sessionId: "sess_circuito",
      subEgoId: m.id,
    });

    // El `EventBus` despacha con `queueMicrotask` (no bloqueante): se deja
    // correr la cola antes de afirmar.
    await new Promise((r) => setTimeout(r, 0));

    expect(
      alerts.length,
      "la degradación debe quedar visible en el bus (NotifyCenter + log estructurado)"
    ).toBeGreaterThan(0);
    const alert = alerts.find((a) => a.message?.includes("modelo-barato"));
    expect(alert, `no hay aviso de degradación: ${JSON.stringify(alerts)}`).toBeTruthy();
    // El aviso dice QUÉ modelo se eligió y POR QUÉ.
    expect(alert!.code).toBe("system.alert");
    expect(alert!.message).toContain("modelo-barato");
    expect(alert!.details?.["subEgoId"]).toBe(m.id);
    expect(alert!.details?.["to"]).toBe("modelo-barato");
  });
});

/** Contexto mínimo del turno (mismo patrón que el test de correlación). */
function makeCtx(
  bus: EventBus,
  router: ModelRouter,
  m: SubEgoManifest
): HandleLlmStreamCtx {
  const lifecycle = {
    currentSessionId: "sess_circuito",
    assemblePreTurn: async () => ({
      contextText: "",
      recallStatus: {
        count: 0,
        glyph: "🧠",
        sources: [],
        tokensEstimate: 0,
        hits: [],
      },
    }),
    startSession: async () => {},
    syncTurn: async () => {},
    maybePreCompact: async () => null,
  };
  return {
    lifecycle: lifecycle as never,
    eventBus: bus,
    toolLoop: {
      run: async () => ({
        status: "ok",
        finalText: "listo",
        steps: [],
        messages: [],
        usage: { totalTokens: 10, promptTokens: 10, completionTokens: 0 },
      }),
    } as never,
    adapter: {} as never,
    compactionJob: null,
    compactionSummarizer: null,
    decisionRouter: {
      decide: async () => ({
        action: "answer",
        intentId: "int_circuito",
        decidedBy: "rule",
        admittedRunContext: { runId: "run_circuito" },
      }),
    } as never,
    decisionAuditor: { recordVerdict: async () => {} } as never,
    decisionTelemetry: { record: () => {} } as never,
    loopBreaker: { evaluate: () => ({ shouldContinue: true }) } as never,
    llmAbortControllers: new Map<string, AbortController>(),
    activeProjectId: "default",
    win: null,
    enqueueMainPush: () => {},
    getCachedCompressionSettings: () => ({
      thresholdRatio: 0.8,
      targetRatio: 0.6,
      autoCompact: false,
      maxWindowTokens: 100000,
      cleanupPeriodDays: 30,
      maxSnapshots: 5,
    }),
    getLoopStableHash: () => undefined,
    updateLoopStableHash: () => "hash",
    buildTurnPrompt: () => ({
      assembled: {
        systemPrompt: "sys",
        userText: "hola",
        ephemeralText: "",
        stableSystemPrompt: "sys",
        fingerprint: "fp",
      } as never,
      effectiveSystemPrompt: "sys",
      fingerprint: "fp",
    }),
    resolveTurnSoul: async () => ({}) as never,
    evaluateTurnBudget: (args) =>
      evaluateTurnBudget({
        subEgoId: args.subEgoId,
        manifest: m,
        router,
        // El coste se estima con las tarifas REALES del modelo vigente (lo
        // mismo que hace `main.ts`): sin él, el tope de coste no se evalúa.
        estimate: {
          ...args.estimate,
          costUsd:
            args.estimate.costUsd ??
            costOfTurn(router, "modelo-caro", args.prompt ?? ""),
        },
        resolveModelConfig: (modelId) => {
          const descriptor = router.getModelDescriptor(modelId);
          if (!descriptor) return undefined;
          return {
            activeProvider: descriptor.provider,
            apiKey: "",
            baseUrl: "",
            modelName: descriptor.id,
          } as never;
        },
      }),
    recordTurnBudget: async () => {},
    drainMainSteerQueue: () => [],
    formatOutOfBandUserMessage: (t: string) => t,
    pushTurnCancelled: () => {},
    currentModelConfig: {
      activeProvider: "openai",
      apiKey: "",
      baseUrl: "",
      modelName: "modelo-caro",
    },
  };
}
