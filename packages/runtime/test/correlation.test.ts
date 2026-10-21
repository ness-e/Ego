import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ModelRouter, type EgoModelInterface, type ModelProviderId } from "@ego/models";
import { ToolRegistry, type ToolDefinition, type ToolExecutionContext } from "@ego/tools";
import { EventBus } from "@ego/events";
import { childCorrelationId, isCorrelationId, newCorrelationId } from "@ego/events";
import { ToolExecutionLoop } from "../src/index.js";

const mockContext: ToolExecutionContext = {
  callId: "call_corr",
  sessionId: "sess_corr",
  workspacePath: "C:/w",
};

function makeRouterAndRegistry(): { router: ModelRouter; registry: ToolRegistry } {
  let turn = 0;
  const provider: EgoModelInterface = {
    providerId: "corr" as ModelProviderId,
    isAvailable: async () => true,
    generate: async () => {
      turn += 1;
      if (turn > 1) {
        return {
          text: "fin del turno",
          finishReason: "stop",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
        };
      }
      return {
        text: "",
        finishReason: "tool_calls",
        toolCalls: [
          { id: "c1", name: "tool_a", arguments: { tag: "a" } },
          { id: "c2", name: "tool_b", arguments: { tag: "b" } },
        ],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
      };
    },
    stream: async () => {
      throw new Error("no stream");
    },
  };
  const router = new ModelRouter();
  router.registerProvider(provider);
  router.registerModel({
    id: "corr-model",
    provider: "corr" as ModelProviderId,
    displayName: "Corr",
    contextWindow: 1000,
    costPerInputTokenUsd: 0,
    costPerOutputTokenUsd: 0,
    capabilities: new Set(["text", "tool_calling"]),
    isLocal: false,
  });
  router.bindRole("reasoning-heavy", ["corr-model"]);
  router.bindRole("general-chat", ["corr-model"]);

  const registry = new ToolRegistry();
  for (const name of ["tool_a", "tool_b"]) {
    const tool: ToolDefinition<{ tag: string }, { ok: boolean }> = {
      name,
      description: name,
      category: "system",
      riskLevel: "safe",
      origin: "native",
      inputSchema: z.object({ tag: z.string().min(1) }),
      execute: async () => ({ ok: true }),
    };
    registry.register(tool);
  }
  return { router, registry };
}

describe("correlationId — propagación turno → tool call → evento (EGO-FIND-74)", () => {
  it("(1) el helper de @ego/events cumple el contrato (id opaco + derivación determinista)", () => {
    const id = newCorrelationId();
    expect(isCorrelationId(id)).toBe(true);
    expect(childCorrelationId(id, "tool:fs_read_file")).toBe(
      childCorrelationId(id, "tool:fs_read_file")
    );
    expect(childCorrelationId(id, "tool:a")).not.toBe(childCorrelationId(id, "tool:b"));
  });

  it("(2) los eventos de tool llevan el span de correlación DERIVADO por tool", async () => {
    const { router, registry } = makeRouterAndRegistry();
    const eventBus = new EventBus();
    const seen: Array<{ type: string; correlationId?: string }> = [];
    eventBus.onAny((event) => {
      seen.push({
        type: event.type,
        correlationId: (event.metadata as { correlationId?: string } | undefined)?.correlationId,
      });
    });

    const correlationId = newCorrelationId();
    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({
      messages: [{ role: "user", content: "correlaciona" }],
      context: mockContext,
      eventBus,
      correlationId,
    });

    expect(result.status).toBe("completed");

    const started = seen.filter((e) => e.type === "tool.started");
    expect(started).toHaveLength(2);
    // El span de cada tool es el DERIVADO del padre (no el id del turno).
    expect(started[0]?.correlationId).toBe(childCorrelationId(correlationId, "tool:tool_a"));
    expect(started[1]?.correlationId).toBe(childCorrelationId(correlationId, "tool:tool_b"));

    const executed = seen.filter((e) => e.type === "tool.executed");
    expect(executed).toHaveLength(2);
    // start ↔ executed comparten span: se puede reconstruir la traza.
    expect(executed[0]?.correlationId).toBe(started[0]?.correlationId);
    expect(executed[1]?.correlationId).toBe(started[1]?.correlationId);
  });

  it("(3) sin correlationId el loop funciona igual (no se inyecta metadata)", async () => {
    const { router, registry } = makeRouterAndRegistry();
    const eventBus = new EventBus();
    const seen: Array<{ type: string; correlationId?: string }> = [];
    eventBus.onAny((event) => {
      seen.push({
        type: event.type,
        correlationId: (event.metadata as { correlationId?: string } | undefined)?.correlationId,
      });
    });

    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({
      messages: [{ role: "user", content: "sin correlacion" }],
      context: mockContext,
      eventBus,
    });

    expect(result.status).toBe("completed");
    expect(seen.filter((e) => e.type === "tool.executed")).toHaveLength(2);
    for (const e of seen) expect(e.correlationId).toBeUndefined();
  });
});
