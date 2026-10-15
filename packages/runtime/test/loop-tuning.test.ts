import { describe, it, expect } from "vitest";
import {
  ModelRouter,
  type EgoModelInterface,
  type ModelGenerateOptions,
  type ModelGenerateResult,
} from "@ego/models";
import { ToolRegistry } from "@ego/tools";
import { ExecutionManager } from "@ego/execution";
import { ToolExecutionLoop } from "../src/index.js";

/**
 * STAB-06 — el loop hila `temperature`/`reasoningEffort` (per-call o vía
 * PreferredModel) hasta `router.generateText`. TDD RED.
 */
describe("ToolExecutionLoop tuning (STAB-06)", () => {
  function setup() {
    const router = new ModelRouter();
    const seen: Array<{ temperature?: number; reasoningEffort?: string }> = [];
    const recorder: EgoModelInterface = {
      providerId: "mock",
      isAvailable: async () => true,
      generate: async (
        _modelId: string,
        options: ModelGenerateOptions
      ): Promise<ModelGenerateResult> => {
        seen.push({ temperature: options.temperature, reasoningEffort: options.reasoningEffort });
        return {
          text: "ok",
          finishReason: "stop",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
        };
      },
      stream: async (
        modelId: string,
        options: ModelGenerateOptions,
        _onChunk: (c: never) => void
      ): Promise<ModelGenerateResult> => recorder.generate(modelId, options),
    };
    router.registerProvider(recorder);
    router.registerModel({
      id: "mock-tuned",
      provider: "mock",
      displayName: "Mock Tuned",
      contextWindow: 8000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text", "streaming", "tool_calling", "structured_output"]),
      isLocal: true,
    });
    router.bindRole("general-chat", ["mock-tuned"]);
    const registry = new ToolRegistry();
    const loop = new ToolExecutionLoop(router, registry, {
      executionManager: new ExecutionManager(),
    });
    return { loop, seen };
  }

  it("hila tuning del PreferredModel hasta el provider", async () => {
    const { loop, seen } = setup();
    const res = await loop.run({
      messages: [{ role: "user", content: "hola" }],
      context: { callId: "c1", sessionId: "s1", projectId: "p1" },
      role: "general-chat",
      preferredModel: { modelId: "mock-tuned", providerId: "mock", temperature: 1.2, reasoningEffort: "medium" },
    });
    expect(res.status).toBe("completed");
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].temperature).toBe(1.2);
    expect(seen[0].reasoningEffort).toBe("medium");
  });

  it("override per-call gana sobre el PreferredModel", async () => {
    const { loop, seen } = setup();
    await loop.run({
      messages: [{ role: "user", content: "hola" }],
      context: { callId: "c1", sessionId: "s1", projectId: "p1" },
      role: "general-chat",
      preferredModel: { modelId: "mock-tuned", temperature: 1.2 },
      temperature: 0.3,
    });
    expect(seen[0].temperature).toBe(0.3);
  });
});
