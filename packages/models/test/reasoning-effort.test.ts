import { describe, it, expect } from "vitest";
import {
  ModelRouter,
  type EgoModelInterface,
  type ModelGenerateOptions,
  type ModelGenerateResult,
  type PreferredModel,
} from "../src/index.js";

/**
 * STAB-06 — `reasoningEffort low|medium|high` + `temperature` hilados
 * PreferredModel → router → provider. TDD RED.
 */

class RecordingProvider implements EgoModelInterface {
  readonly providerId = "mock" as const;
  public lastOptions: ModelGenerateOptions | null = null;
  async isAvailable(): Promise<boolean> {
    return true;
  }
  async generate(
    _modelId: string,
    options: ModelGenerateOptions
  ): Promise<ModelGenerateResult> {
    this.lastOptions = options;
    return {
      text: "ok",
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
    };
  }
  async stream(
    modelId: string,
    options: ModelGenerateOptions,
    _onChunk: (c: never) => void
  ): Promise<ModelGenerateResult> {
    return this.generate(modelId, options);
  }
}

function setupRouter(): { router: ModelRouter; provider: RecordingProvider } {
  const router = new ModelRouter();
  const provider = new RecordingProvider();
  router.registerProvider(provider);
  router.registerModel({
    id: "fake-reasoning",
    provider: "mock",
    displayName: "Fake Reasoning",
    contextWindow: 8000,
    costPerInputTokenUsd: 0,
    costPerOutputTokenUsd: 0,
    capabilities: new Set(["text", "streaming"]),
    isLocal: true,
  });
  router.bindRole("general-chat", ["fake-reasoning"]);
  return { router, provider };
}

const MSGS = [{ role: "user" as const, content: "hola" }];

describe("reasoningEffort + temperature (STAB-06)", () => {
  it("configureFromSettings aplica reasoningEffort al effort del router", () => {
    const { router } = setupRouter();
    router.configureFromSettings({ reasoningEffort: "high" });
    expect(router.getEffortLevel()).toBe("high");
  });

  it("effortLevel explícito gana sobre reasoningEffort", () => {
    const { router } = setupRouter();
    router.configureFromSettings({ effortLevel: "minimal", reasoningEffort: "high" });
    expect(router.getEffortLevel()).toBe("minimal");
  });

  it("generateText hila temperature+reasoningEffort del PreferredModel al provider", async () => {
    const { router, provider } = setupRouter();
    const preferred: PreferredModel = {
      modelId: "fake-reasoning",
      providerId: "mock",
      temperature: 1.5,
      reasoningEffort: "high",
    };
    await router.generateText("general-chat", { messages: MSGS }, undefined, preferred);
    expect(provider.lastOptions?.temperature).toBe(1.5);
    expect(provider.lastOptions?.reasoningEffort).toBe("high");
  });

  it("opciones explícitas ganan sobre el PreferredModel", async () => {
    const { router, provider } = setupRouter();
    const preferred: PreferredModel = { modelId: "fake-reasoning", temperature: 1.5 };
    await router.generateText(
      "general-chat",
      { messages: MSGS, temperature: 0.1 },
      undefined,
      preferred
    );
    expect(provider.lastOptions?.temperature).toBe(0.1);
  });

  it("sin tuning el provider recibe undefined (defaults del provider intactos)", async () => {
    const { router, provider } = setupRouter();
    await router.generateText("general-chat", { messages: MSGS });
    expect(provider.lastOptions?.temperature).toBeUndefined();
    expect(provider.lastOptions?.reasoningEffort).toBeUndefined();
  });

  it("streamText también hila el tuning", async () => {
    const { router, provider } = setupRouter();
    const preferred: PreferredModel = { modelId: "fake-reasoning", reasoningEffort: "low" };
    await router.streamText("general-chat", { messages: MSGS }, () => {}, undefined, preferred);
    expect(provider.lastOptions?.reasoningEffort).toBe("low");
  });
});
