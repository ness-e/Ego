import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ModelRouter,
  DEFAULT_MODEL_ALIASES,
  DEFAULT_FALLBACK_MODEL_ID,
  effortProviderParams,
} from "../src/ModelRouter.js";
import type { EgoModelInterface, ModelGenerateOptions, ModelGenerateResult } from "../src/types.js";

function stubProvider(
  providerId: string,
  opts: { fail?: boolean; tag?: string } = {}
): EgoModelInterface {
  const tag = opts.tag ?? providerId;
  return {
    // NOTE: `providerId` tipado como cadena en tests (igual que el suite
    // existente con `custom-byok`/`failing-prov`): el router lo trata opaco.
    providerId: providerId as EgoModelInterface["providerId"],
    isAvailable: async () => true,
    generate: async (modelId: string, _options: ModelGenerateOptions): Promise<ModelGenerateResult> => {
      if (opts.fail) throw new Error(`503 ${tag} caído`);
      return {
        text: `[Stub:${tag}:${modelId}] ok`,
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      };
    },
    stream: async (modelId: string, options: ModelGenerateOptions, onChunk) => {
      if (opts.fail) throw new Error(`503 ${tag} stream caído`);
      const res = await stubProvider(providerId, { ...opts, fail: false }).generate(modelId, options);
      onChunk({ type: "text-delta", delta: res.text });
      onChunk({ type: "finish", finishReason: "stop" });
      return res;
    },
  };
}

describe("@ego/models — CFG-04 aliases + effort + fallback chain", () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  describe("aliases fast/smart", () => {
    it("defaults: fast = barato, smart = frontier", () => {
      expect(router.resolveAlias("fast")).toBe(DEFAULT_MODEL_ALIASES.fast);
      expect(router.resolveAlias("smart")).toBe(DEFAULT_MODEL_ALIASES.smart);
      expect(DEFAULT_MODEL_ALIASES.fast).toBe("llama3.2:3b");
      expect(DEFAULT_MODEL_ALIASES.smart).toBe("claude-3-5-sonnet-20241022");
      expect(router.getFallbackModel()).toBe(DEFAULT_FALLBACK_MODEL_ID);
    });

    it("passthrough: un id real no se altera", () => {
      expect(router.resolveModelIdOrAlias("gpt-4o")).toBe("gpt-4o");
      expect(router.resolveModelIdOrAlias("  deepseek-chat ")).toBe("deepseek-chat");
    });

    it("setAliases overridea y el binding por rol resuelve el alias", async () => {
      router.registerProvider(stubProvider("cheap-prov"));
      router.registerModel({
        id: "mini-model",
        provider: "cheap-prov",
        displayName: "Mini barato",
        contextWindow: 8000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.setAliases({ fast: "mini-model" });
      expect(router.getAliases().fast).toBe("mini-model");
      expect(router.resolveModelIdOrAlias("fast")).toBe("mini-model");

      router.bindRole("fast-classifier", ["fast", "mock-core"]);
      const desc = await router.resolveModel("fast-classifier");
      expect(desc.id).toBe("mini-model");
    });

    it("preferred {modelId:'smart'} resuelve contra el alias", async () => {
      router.registerProvider(stubProvider("frontier-prov"));
      router.registerModel({
        id: "opus-model",
        provider: "frontier-prov",
        displayName: "Opus frontier",
        contextWindow: 200000,
        costPerInputTokenUsd: 0.000003,
        costPerOutputTokenUsd: 0.000015,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.setAliases({ smart: "opus-model" });
      const desc = await router.resolveModel("general-chat", ["text"], { modelId: "smart" });
      expect(desc.id).toBe("opus-model");
    });
  });

  describe("cadena de fallback availableModels → fallbackModel → mock", () => {
    beforeEach(() => {
      router.registerProvider(stubProvider("flaky-prov", { fail: true, tag: "FLAKY" }));
      router.registerModel({
        id: "flaky-primary",
        provider: "flaky-prov",
        displayName: "Flaky Primary",
        contextWindow: 32000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text", "streaming"]),
        isLocal: false,
      });
      router.registerProvider(stubProvider("cheap-prov", { tag: "CHEAP" }));
      router.registerModel({
        id: "mini-model",
        provider: "cheap-prov",
        displayName: "Mini barato",
        contextWindow: 8000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text", "streaming"]),
        isLocal: false,
      });
      router.bindRole("fast-classifier", ["flaky-primary"]);
    });

    it("el primario caído cae a availableModels antes que al mock", async () => {
      router.setAvailableModels(["mini-model"]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await router.generateText("fast-classifier", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(res.text).toContain("[Stub:CHEAP:mini-model]");
      expect(res.text).not.toContain("MockResponse");
      warnSpy.mockRestore();
    });

    it("agotada la cadena, usa fallbackModel", async () => {
      router.setAvailableModels(["modelo-inexistente"]);
      router.setFallbackModel("mini-model");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await router.generateText("fast-classifier", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(res.text).toContain("[Stub:CHEAP:mini-model]");
      warnSpy.mockRestore();
    });

    it("sin cadena configurable, el mock sigue siendo el último recurso (legacy)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await router.generateText("fast-classifier", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(res.text).toContain("[MockResponse:mock-core]");
      warnSpy.mockRestore();
    });

    it("el streaming también recorre la cadena", async () => {
      router.setAvailableModels(["mini-model"]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const chunks: string[] = [];
      const res = await router.streamText(
        "fast-classifier",
        { messages: [{ role: "user", content: "hola" }] },
        (c) => chunks.push(c.delta ?? "")
      );
      expect(chunks.join("")).toContain("[Stub:CHEAP:mini-model]");
      expect(res.finishReason).toBe("stop");
      warnSpy.mockRestore();
    });

    it("los aliases valen dentro de availableModels", async () => {
      router.setAliases({ fast: "mini-model" });
      router.setAvailableModels(["fast"]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await router.generateText("fast-classifier", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(res.text).toContain("[Stub:CHEAP:mini-model]");
      warnSpy.mockRestore();
    });
  });

  describe("review model", () => {
    it("default = alias smart; sin provider disponible cae a mock", async () => {
      expect(router.getReviewModel()).toBe(router.resolveAlias("smart"));
      const desc = await router.resolveReviewModel();
      expect(desc.id).toBe("mock-core");
    });

    it("review custom registrado resuelve directo", async () => {
      router.registerProvider(stubProvider("frontier-prov"));
      router.registerModel({
        id: "opus-model",
        provider: "frontier-prov",
        displayName: "Opus frontier",
        contextWindow: 200000,
        costPerInputTokenUsd: 0.000003,
        costPerOutputTokenUsd: 0.000015,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.setReviewModel("opus-model");
      expect(router.getReviewModel()).toBe("opus-model");
      const desc = await router.resolveReviewModel();
      expect(desc.id).toBe("opus-model");
    });
  });

  describe("effortLevel → provider params", () => {
    it("mapea los 5 niveles y medium es no-op", () => {
      expect(effortProviderParams("minimal")).toEqual({ maxTokens: 256, temperature: 0 });
      expect(effortProviderParams("low")).toEqual({ maxTokens: 1024, temperature: 0.2 });
      expect(effortProviderParams("medium")).toEqual({});
      expect(effortProviderParams("high")).toEqual({ maxTokens: 4096, temperature: 0.5 });
      expect(effortProviderParams("xhigh")).toEqual({ maxTokens: 8192, temperature: 0.7 });
      expect(router.getEffortLevel()).toBe("medium");
    });

    it("applyEffort no pisa valores explícitos del llamador", () => {
      router.setEffortLevel("low");
      const base = { messages: [{ role: "user" as const, content: "h" }] };
      expect(router.applyEffort(base)).toMatchObject({ maxTokens: 1024, temperature: 0.2 });
      expect(router.applyEffort({ ...base, maxTokens: 99, temperature: 0.9 })).toMatchObject({
        maxTokens: 99,
        temperature: 0.9,
      });
    });

    it("configureFromSettings aplica el shape de ModelConfig sin importar desktop", () => {
      router.configureFromSettings({
        effortLevel: "high",
        modelAliases: { fast: "mini-model", smart: "opus-model" },
        reviewModel: "opus-model",
        availableModels: ["mini-model"],
        fallbackModel: "mini-model",
      });
      expect(router.getEffortLevel()).toBe("high");
      expect(router.getAliases()).toEqual({ fast: "mini-model", smart: "opus-model" });
      expect(router.getReviewModel()).toBe("opus-model");
      expect(router.getAvailableModels()).toEqual(["mini-model"]);
      expect(router.getFallbackModel()).toBe("mini-model");
    });
  });

  describe("abort mid-token (CFG-10)", () => {
    function abortingProvider(providerId: string): EgoModelInterface {
      return {
        providerId: providerId as EgoModelInterface["providerId"],
        isAvailable: async () => true,
        generate: async () => {
          throw new DOMException("This operation was aborted", "AbortError");
        },
        stream: async () => {
          throw new DOMException("This operation was aborted", "AbortError");
        },
      };
    }

    beforeEach(() => {
      router.registerProvider(abortingProvider("aborting-prov"));
      router.registerModel({
        id: "aborting-primary",
        provider: "aborting-prov",
        displayName: "Aborting Primary",
        contextWindow: 32000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text", "streaming"]),
        isLocal: false,
      });
      router.registerProvider(stubProvider("cheap-prov", { tag: "CHEAP" }));
      router.registerModel({
        id: "mini-model",
        provider: "cheap-prov",
        displayName: "Mini barato",
        contextWindow: 8000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text", "streaming"]),
        isLocal: false,
      });
      router.bindRole("fast-classifier", ["aborting-primary"]);
      router.setAvailableModels(["mini-model"]);
    });

    it("generate abortado re-lanza AbortError sin tocar el mock", async () => {
      // Arrange: señal ya abortada + espía sobre el mock interno
      const controller = new AbortController();
      controller.abort();
      const { MockProvider } = await import("../src/providers/MockProvider.js");
      const mockSpy = vi.spyOn(MockProvider.prototype, "generate");

      // Act: generate bajo abort
      const promise = router.generateText("fast-classifier", {
        messages: [{ role: "user", content: "hola" }],
        abortSignal: controller.signal,
      });

      // Assert: propaga AbortError en vez de resolver con mock fantasma
      await expect(promise).rejects.toSatisfy((err: unknown) => {
        return err instanceof DOMException && (err as DOMException).name === "AbortError";
      });
      expect(mockSpy).not.toHaveBeenCalled();
      mockSpy.mockRestore();
    });

    it("stream abortado re-lanza AbortError sin tocar el mock", async () => {
      // Arrange: señal ya abortada + espía sobre el mock interno
      const controller = new AbortController();
      controller.abort();
      const { MockProvider } = await import("../src/providers/MockProvider.js");
      const mockSpy = vi.spyOn(MockProvider.prototype, "stream");

      // Act: stream bajo abort
      const promise = router.streamText(
        "fast-classifier",
        {
          messages: [{ role: "user", content: "hola" }],
          abortSignal: controller.signal,
        },
        () => {}
      );

      // Assert: propaga AbortError en vez de caer a la cadena
      await expect(promise).rejects.toSatisfy((err: unknown) => {
        return err instanceof DOMException && (err as DOMException).name === "AbortError";
      });
      expect(mockSpy).not.toHaveBeenCalled();
      mockSpy.mockRestore();
    });
  });
});
