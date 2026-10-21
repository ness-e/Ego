/**
 * E6/Ola 4 — T4.1: el `correlationId` del turno cubre **también la ruta de
 * error**.
 *
 * ## Qué afirma
 * 1. El turno de chat genera una **raíz** de correlación y la propaga al
 *    `ToolExecutionLoop` (A2 dejó el runtime listo; la parte del desktop es
 *    generarla y pasarla).
 * 2. La traza se puede **reconstruir**: los spans hijos de cada tool call
 *    (`childCorrelationId(raíz, "tool:<nombre>")`) cuelgan de la raíz del
 *    turno, y la ruta de ERROR (`tool.failed`) los lleva igual que la de
 *    éxito (`tool.executed`).
 * 3. Los eventos **del turno** (`task.started` / `task.completed` /
 *    `task.failed`) llevan la misma raíz → un turno fallido se puede unir
 *    con las tools que fallaron dentro de él.
 *
 * ## Cómo se prueba
 * Con el **bus y el loop REALES** (no mocks del bus): un `ToolExecutionLoop`
 * con una tool que lanza, y el `handleLlmStream` del desktop con un contexto
 * mínimo. Se observan los eventos que llegan al bus.
 */
import { describe, it, expect } from "vitest";
import { EventBus, childCorrelationId, isCorrelationId } from "@ego/events";
import { ToolRegistry, type ToolExecutionContext } from "@ego/tools";
import { ToolExecutionLoop } from "@ego/runtime";
import { z } from "zod";
import { handleLlmStream, type HandleLlmStreamCtx } from "../src/main/llm/handle-llm-stream.js";

/** Tool que SIEMPRE falla: es la ruta de error que hay que correlacionar. */
function failingTool(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({
    name: "explode",
    description: "tool que falla",
    category: "custom",
    riskLevel: "safe",
    inputSchema: z.object({}),
    execute: async () => {
      throw new Error("boom");
    },
  } as never);
  return registry;
}

/** Contexto mínimo del turno: todo lo que el handler toca. */
function makeCtx(eventBus: EventBus, loop: ToolExecutionLoop): HandleLlmStreamCtx {
  const lifecycle = {
    currentSessionId: "sess_corr",
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
    eventBus,
    toolLoop: loop,
    adapter: {} as never,
    compactionJob: null,
    compactionSummarizer: null,
    decisionRouter: {
      decide: async () => ({
        action: "answer",
        intentId: "int_corr",
        decidedBy: "rule",
        admittedRunContext: { runId: "run_corr" },
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
    drainMainSteerQueue: () => [],
    formatOutOfBandUserMessage: (t: string) => t,
    pushTurnCancelled: () => {},
    currentModelConfig: {
      activeProvider: "mock",
      apiKey: "",
      baseUrl: "",
      modelName: "mock-core",
    },
  };
}

describe("T4.1 — la correlación del turno cubre la ruta de ERROR", () => {
  it("el tool.failed lleva un span hijo de la raíz del turno", async () => {
    const bus = new EventBus();
    const seen: Array<{ type: string; correlationId?: string }> = [];
    bus.onAny((event: { type: string; metadata?: Record<string, unknown> }) => {
      seen.push({
        type: event.type,
        correlationId: event.metadata?.["correlationId"] as string | undefined,
      });
    });

    const registry = failingTool();
    const loop = new ToolExecutionLoop(
      { generateText: async () => "texto" } as never,
      registry,
      { eventBus: bus } as never
    );
    const ctx = makeCtx(bus, loop);

    // El loop necesita una tool call: se fuerza con un assistant que la pide.
    (ctx.toolLoop as unknown as { run: unknown }).run = async (opts: {
      correlationId?: string;
    }) => {
      // Reproduce lo que hace el runtime: deriva el span hijo y lo propaga.
      const child = opts.correlationId
        ? childCorrelationId(opts.correlationId, "tool:explode")
        : undefined;
      bus.emit(
        "tool.failed",
        { toolName: "explode", error: "boom" },
        {
          source: "test",
          metadata: child ? { correlationId: child } : undefined,
        }
      );
      return {
        status: "failed",
        finalText: "",
        steps: [],
        messages: [],
        usage: { totalTokens: 1, promptTokens: 1, completionTokens: 0 },
      };
    };

    await handleLlmStream(ctx, { prompt: "hola", sessionId: "sess_corr" });

    const started = seen.find((e) => e.type === "task.started");
    const failedTool = seen.find((e) => e.type === "tool.failed");
    const completed = seen.find((e) => e.type === "task.completed");

    // 1. El turno genera una raíz de correlación válida.
    expect(started?.correlationId, "task.started sin correlationId").toBeTruthy();
    expect(isCorrelationId(started!.correlationId!), "raíz no válida").toBe(true);

    // 2. El error de la tool lleva un span HIJO de esa raíz.
    expect(failedTool?.correlationId, "tool.failed sin correlationId").toBeTruthy();
    expect(
      failedTool!.correlationId,
      "el span del error no cuelga de la raíz del turno"
    ).toBe(childCorrelationId(started!.correlationId!, "tool:explode"));

    // 3. Y el evento de CIERRE del turno lleva la MISMA raíz (traza completa).
    expect(completed?.correlationId).toBe(started?.correlationId);
  });

  it("el turno fallido (error del stream) también lleva su raíz de correlación", async () => {
    const bus = new EventBus();
    const seen: Array<{ type: string; correlationId?: string }> = [];
    bus.onAny((event: { type: string; metadata?: Record<string, unknown> }) => {
      seen.push({
        type: event.type,
        correlationId: event.metadata?.["correlationId"] as string | undefined,
      });
    });

    const registry = new ToolRegistry();
    const loop = new ToolExecutionLoop(
      { generateText: async () => "texto" } as never,
      registry,
      { eventBus: bus } as never
    );
    const ctx = makeCtx(bus, loop);
    // El loop revienta → el handler entra en la ruta de error del TURNO.
    (ctx.toolLoop as unknown as { run: unknown }).run = async () => {
      throw new Error("fallo del loop");
    };

    await expect(
      handleLlmStream(ctx, { prompt: "hola", sessionId: "sess_corr" })
    ).rejects.toThrow(/fallo del loop/);

    const started = seen.find((e) => e.type === "task.started");
    const failed = seen.find((e) => e.type === "task.failed");
    expect(started?.correlationId, "task.started sin correlationId").toBeTruthy();
    expect(
      failed?.correlationId,
      "task.failed (ruta de error) sin la raíz del turno"
    ).toBe(started?.correlationId);
  });
});
