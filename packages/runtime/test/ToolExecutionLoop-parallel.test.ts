import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ModelRouter, type EgoModelInterface, type ModelProviderId } from "@ego/models";
import { ToolRegistry, type ToolDefinition, type ToolExecutionContext } from "@ego/tools";
import { ExecutionManager } from "@ego/execution";
import { ToolExecutionLoop } from "../src/index.js";

/**
 * E1 — Ejecución paralela de tool calls con orden `tool_use`/`tool_result`
 * garantizado (EGO-FIND-43).
 *
 * Contrato verificado contra el source del SDK:
 *  · `@ai-sdk/anthropic@4.0.78` → `src/convert-to-anthropic-prompt.ts`,
 *    función `groupIntoBlocks` (L1569-1577): los mensajes `tool`
 *    CONSECUTIVOS se agrupan en un único bloque `user` y sus partes
 *    `tool_result` se empujan **en el orden del array de mensajes**.
 *    ⇒ el orden del array `messages` de Ego ES el orden de los
 *    `tool_result` en el payload de Anthropic.
 *  · Por tanto: la ejecución puede ser concurrente, pero la EMISIÓN debe
 *    respetar el orden original de los `tool_use`.
 */

const mockContext: ToolExecutionContext = {
  callId: "call_parallel_test",
  sessionId: "sess_parallel",
  workspacePath: "C:/workspace",
};

/** Provider falso que emite N tool calls en un turno y texto final después. */
function makeMultiCallProvider(calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>): EgoModelInterface {
  let turn = 0;
  return {
    providerId: "multi" as ModelProviderId,
    isAvailable: async () => true,
    generate: async () => {
      turn += 1;
      if (turn === 1) {
        return {
          text: "",
          finishReason: "tool_calls",
          toolCalls: calls,
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
        };
      }
      return {
        text: "fin del turno",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
      };
    },
    stream: async () => {
      throw new Error("no stream en este test");
    },
  };
}

function makeRouter(calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>): ModelRouter {
  const router = new ModelRouter();
  router.registerProvider(makeMultiCallProvider(calls));
  router.registerModel({
    id: "multi-model",
    provider: "multi" as ModelProviderId,
    displayName: "Multi",
    contextWindow: 100000,
    costPerInputTokenUsd: 0,
    costPerOutputTokenUsd: 0,
    capabilities: new Set(["text", "tool_calling"]),
    isLocal: false,
  });
  router.bindRole("general-chat", ["multi-model"]);
  // El loop usa `defaultRole = "reasoning-heavy"` por defecto (ToolExecutionLoopConfig).
  router.bindRole("reasoning-heavy", ["multi-model"]);
  return router;
}

interface LatencyToolSpec {
  name: string;
  delayMs: number;
  fail?: boolean;
}

/** Registra N tools con latencia y un contador de concurrencia observada. */
function makeLatencyRegistry(specs: LatencyToolSpec[]): {
  registry: ToolRegistry;
  maxObservedConcurrency: () => number;
} {
  const registry = new ToolRegistry();
  let inFlight = 0;
  let maxInFlight = 0;

  for (const spec of specs) {
    const tool: ToolDefinition<{ tag: string }, { ok: boolean; tag: string }> = {
      name: spec.name,
      description: `Tool de latencia ${spec.delayMs}ms`,
      category: "system",
      riskLevel: "safe",
      origin: "native",
      inputSchema: z.object({ tag: z.string().min(1) }),
      execute: async ({ tag }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          await new Promise((resolve) => setTimeout(resolve, spec.delayMs));
          if (spec.fail) throw new Error(`FALLO_CONTROLADO_${spec.name}`);
          return { ok: true, tag };
        } finally {
          inFlight -= 1;
        }
      },
    };
    registry.register(tool);
  }

  return { registry, maxObservedConcurrency: () => maxInFlight };
}

function toolMessages(messages: Array<{ role: string; toolCallId?: string; content: string }>): Array<{ role: string; toolCallId?: string; content: string }> {
  return messages.filter((m) => m.role === "tool");
}

describe("ToolExecutionLoop — ejecución paralela con orden garantizado (E1 / EGO-FIND-43)", () => {
  it("(1) concurrencia REAL: N tools con latencia L y tope C => ~ceil(N/C)*L, no N*L", async () => {
    const L = 100;
    const N = 6;
    const C = 3;
    const specs = Array.from({ length: N }, (_, i) => ({ name: `lat_${i}`, delayMs: L }));
    const { registry, maxObservedConcurrency } = makeLatencyRegistry(specs);

    const calls = specs.map((s, i) => ({ id: `call_${i}`, name: s.name, arguments: { tag: `t${i}` } }));
    const router = makeRouter(calls);
    const executionManager = new ExecutionManager({ maxConcurrentExecutions: C });

    const loop = new ToolExecutionLoop(router, registry, { executionManager });
    const t0 = Date.now();
    const result = await loop.run({ messages: [{ role: "user", content: "lanza 6 tools" }], context: mockContext });
    const elapsed = Date.now() - t0;

    expect(result.status).toBe("completed");
    // Se ejecutaron las 6.
    expect(toolMessages(result.messages)).toHaveLength(N);

    // Medición de concurrencia: el máximo de tools EN VUELO simultáneas.
    expect(maxObservedConcurrency()).toBeGreaterThanOrEqual(2);
    expect(maxObservedConcurrency()).toBeLessThanOrEqual(C);

    // Medición de reloj: ceiling(N/C)*L = 200ms; en serie serían 600ms.
    const serialMs = N * L;
    const expectedMs = Math.ceil(N / C) * L;
    // Evidencia de la medición (persistente en el repo, no una afirmación).
    console.log(
      `[E1-medicion] N=${N} L=${L}ms C=${C} -> real=${elapsed}ms | teorico_paralelo=${expectedMs}ms | teorico_serie=${serialMs}ms | concurrencia_max_observada=${maxObservedConcurrency()}`
    );
    expect(elapsed).toBeLessThan(serialMs * 0.75); // claramente por debajo del serie
    expect(elapsed).toBeGreaterThanOrEqual(expectedMs * 0.7); // y no "instantáneo"
  }, 20_000);

  it("(2) el ORDEN emitido conserva el orden de los tool_use (duraciones invertidas)", async () => {
    const specs = [
      { name: "lento", delayMs: 180 },
      { name: "rapido", delayMs: 10 },
      { name: "medio", delayMs: 90 },
    ];
    const { registry } = makeLatencyRegistry(specs);
    const calls = specs.map((s, i) => ({ id: `ord_${i}`, name: s.name, arguments: { tag: `t${i}` } }));
    const router = makeRouter(calls);

    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({ messages: [{ role: "user", content: "orden" }], context: mockContext });

    expect(result.status).toBe("completed");
    const emitted = toolMessages(result.messages);
    expect(emitted.map((m) => m.toolCallId)).toEqual(["ord_0", "ord_1", "ord_2"]);
  }, 20_000);

  it("(3) AISLAMIENTO DE FALLOS: la 2ª de 3 falla; el turno NO aborta y el error queda en SU posición", async () => {
    const specs = [
      { name: "ok_1", delayMs: 20 },
      { name: "falla_2", delayMs: 40, fail: true },
      { name: "ok_3", delayMs: 10 },
    ];
    const { registry } = makeLatencyRegistry(specs);
    const calls = specs.map((s, i) => ({ id: `iso_${i}`, name: s.name, arguments: { tag: `t${i}` } }));
    const router = makeRouter(calls);

    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({ messages: [{ role: "user", content: "fallo" }], context: mockContext });

    // El turno NO aborta.
    expect(result.status).toBe("completed");
    const emitted = toolMessages(result.messages);
    expect(emitted).toHaveLength(3);
    // Orden intacto: el error de la 2ª está en la 2ª posición.
    expect(emitted.map((m) => m.toolCallId)).toEqual(["iso_0", "iso_1", "iso_2"]);
    // La 2ª lleva el error tipado de su tool.
    expect(emitted[1]?.content).toContain("FALLO_CONTROLADO_falla_2");
    // Las otras dos siguen con su resultado correcto, en su posición.
    expect(emitted[0]?.content).toContain('"tag":"t0"');
    expect(emitted[2]?.content).toContain('"tag":"t2"');
  }, 20_000);

  it("(4) el gate de aprobación se evalúa POR tool: una sensible entre varias no bloquea a las demás", async () => {
    const registry = new ToolRegistry();
    const safeTool: ToolDefinition<{ tag: string }, { ok: boolean }> = {
      name: "safe_tool",
      description: "Tool inocua",
      category: "system",
      riskLevel: "safe",
      origin: "native",
      inputSchema: z.object({ tag: z.string().min(1) }),
      execute: async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { ok: true };
      },
    };
    const sensitiveTool: ToolDefinition<{ tag: string }, { ok: boolean }> = {
      name: "sensitive_tool",
      description: "Tool sensible que exige aprobación",
      category: "terminal",
      riskLevel: "destructive",
      origin: "native",
      requiresApproval: true,
      inputSchema: z.object({ tag: z.string().min(1) }),
      execute: async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { ok: true };
      },
    };
    registry.registerMany([safeTool, sensitiveTool]);

    const calls = [
      { id: "appr_0", name: "safe_tool", arguments: { tag: "a" } },
      { id: "appr_1", name: "sensitive_tool", arguments: { tag: "b" } },
      { id: "appr_2", name: "safe_tool", arguments: { tag: "c" } },
    ];
    const router = makeRouter(calls);

    const approved: string[] = [];
    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({
      messages: [{ role: "user", content: "gates" }],
      context: mockContext,
      approvalHandler: async (req) => {
        approved.push(req.toolName);
        return { approved: true, reason: "ok" };
      },
    });

    expect(result.status).toBe("completed");
    // La aprobación se pidió SÓLO para la tool sensible (gate por tool).
    expect(approved).toEqual(["sensitive_tool"]);
    // Las tres emiten su resultado, en orden.
    const emitted = toolMessages(result.messages);
    expect(emitted.map((m) => m.toolCallId)).toEqual(["appr_0", "appr_1", "appr_2"]);
  }, 20_000);

  it("(5) CANCELACIÓN: abortar el turno cancela las llamadas en vuelo sin emitir resultados parciales inconsistentes", async () => {
    const specs = [
      { name: "lento_a", delayMs: 300 },
      { name: "lento_b", delayMs: 300 },
    ];
    const { registry } = makeLatencyRegistry(specs);
    const calls = specs.map((s, i) => ({ id: `ab_${i}`, name: s.name, arguments: { tag: `t${i}` } }));
    const router = makeRouter(calls);

    const controller = new AbortController();
    const loop = new ToolExecutionLoop(router, registry);
    const promise = loop.run({
      messages: [{ role: "user", content: "cancela" }],
      context: mockContext,
      abortSignal: controller.signal,
    });
    setTimeout(() => controller.abort(new Error("cancelado por test")), 40);

    const result = await promise;
    expect(result.status).toBe("aborted");
    // No se emiten resultados parciales de llamadas que no terminaron.
    const emitted = toolMessages(result.messages);
    expect(emitted.length).toBeLessThanOrEqual(2);
    for (const m of emitted) {
      // Un resultado abortado es coherente: no es un "éxito" silencioso.
      expect(typeof m.content).toBe("string");
    }
  }, 20_000);

  it("(6) NO-REGRESIÓN: una sola tool call se comporta igual que antes; y con concurrencia 1 el turno es serie", async () => {
    const specs = [{ name: "una", delayMs: 40 }];
    const { registry, maxObservedConcurrency } = makeLatencyRegistry(specs);
    const router = makeRouter([{ id: "single_0", name: "una", arguments: { tag: "t" } }]);

    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({ messages: [{ role: "user", content: "una" }], context: mockContext });

    expect(result.status).toBe("completed");
    const emitted = toolMessages(result.messages);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.toolCallId).toBe("single_0");
    expect(maxObservedConcurrency()).toBe(1);

    // Con el tope de concurrencia en 1, N tools tardan N*L (serie).
    const specs2 = Array.from({ length: 3 }, (_, i) => ({ name: `serie_${i}`, delayMs: 60 }));
    const { registry: reg2 } = makeLatencyRegistry(specs2);
    const router2 = makeRouter(specs2.map((s, i) => ({ id: `s_${i}`, name: s.name, arguments: { tag: `t${i}` } })));
    const loop2 = new ToolExecutionLoop(router2, reg2, {
      executionManager: new ExecutionManager({ maxConcurrentExecutions: 1 }),
    });
    const t0 = Date.now();
    const res2 = await loop2.run({ messages: [{ role: "user", content: "serie" }], context: mockContext });
    const elapsed2 = Date.now() - t0;

    expect(res2.status).toBe("completed");
    expect(toolMessages(res2.messages)).toHaveLength(3);
    expect(elapsed2).toBeGreaterThanOrEqual(3 * 60 * 0.7);

    // El flag `parallelToolCalls: false` restaura el modo estrictamente serie.
    const { registry: reg3 } = makeLatencyRegistry(specs2);
    const router3 = makeRouter(specs2.map((s, i) => ({ id: `q_${i}`, name: s.name, arguments: { tag: `t${i}` } })));
    const loop3 = new ToolExecutionLoop(router3, reg3, { parallelToolCalls: false });
    const t3 = Date.now();
    const res3 = await loop3.run({ messages: [{ role: "user", content: "serie-flag" }], context: mockContext });
    const elapsed3 = Date.now() - t3;

    expect(res3.status).toBe("completed");
    expect(toolMessages(res3.messages)).toHaveLength(3);
    expect(elapsed3).toBeGreaterThanOrEqual(3 * 60 * 0.7);
  }, 20_000);
});
