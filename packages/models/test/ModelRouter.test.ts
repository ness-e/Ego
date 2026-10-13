import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelRouter } from "../src/ModelRouter.js";
import { MockProvider } from "../src/providers/MockProvider.js";
import { OpenAICompatibleProvider } from "../src/providers/OpenAICompatibleProvider.js";
import { AiSdkGoogleProvider } from "../src/providers/AiSdkGoogleProvider.js";
import { AiSdkOpenAICompatibleProvider } from "../src/providers/AiSdkOpenAICompatibleProvider.js";
import type { EgoModelInterface, ModelGenerateOptions, ModelGenerateResult, ModelProviderId } from "../src/types.js";

describe("@ego/models — Comprehensive ModelRouter Test Suite", () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter({ preferLocal: false, maxCostPerCallUsd: 2.0 });
  });

  describe("Resolución y Enrutamiento de Modelos", () => {
    it("resuelve modelo por rol por defecto", async () => {
      // Como solo el mock está disponible por defecto sin API keys externas, debe resolver a mock
      const desc = await router.resolveModel("general-chat");
      expect(desc).toBeDefined();
      expect(desc.provider).toBe("mock");
      expect(desc.id).toBe("mock-core");
    });

    it("resuelve modelo por capacidades requeridas", async () => {
      const desc = await router.resolveModel("coder", ["text", "tool_calling"]);
      expect(desc).toBeDefined();
      expect(desc.capabilities.has("text")).toBe(true);
      expect(desc.capabilities.has("tool_calling")).toBe(true);
    });

    it("aplica fallback al mock cuando los candidatos no están disponibles", async () => {
      router.bindRole("reasoning-heavy", ["non-existent-model-1", "non-existent-model-2"]);
      const desc = await router.resolveModel("reasoning-heavy");
      expect(desc).toBeDefined();
      expect(desc.provider).toBe("mock");
      expect(desc.id).toBe("mock-core");
    });

    it("emite warn cuando un modelo candidato referencia un provider no registrado (M04)", async () => {
      router.registerModel({
        id: "orphan-model",
        provider: "unregistered-provider" as ModelProviderId,
        displayName: "Orphan Model (provider ausente)",
        contextWindow: 8000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.bindRole("coder", ["orphan-model", "mock-core"]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const desc = await router.resolveModel("coder");

      expect(desc.id).toBe("mock-core");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("unregistered-provider")
      );
      warnSpy.mockRestore();
    });
  });

  describe("Registro de Proveedores BYOK y Dinámicos", () => {
    it("registra un proveedor personalizado y enruta hacia él", async () => {
      const customProvider: EgoModelInterface = {
        providerId: "custom-byok",
        isAvailable: async () => true,
        generate: async (modelId: string, options: ModelGenerateOptions): Promise<ModelGenerateResult> => {
          return {
            text: `[CustomResponse:${modelId}] Respuesta BYOK`,
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
            },
            finishReason: "stop",
          };
        },
        stream: async () => {
          throw new Error("No implementado");
        },
      };

      router.registerProvider(customProvider);
      router.registerModel({
        id: "byok-deepseek-coder",
        provider: "custom-byok",
        displayName: "DeepSeek Coder V2 (BYOK)",
        contextWindow: 64000,
        costPerInputTokenUsd: 0.00000014,
        costPerOutputTokenUsd: 0.00000028,
        capabilities: new Set(["text", "tool_calling", "coding.high"]),
        isLocal: false,
      });

      router.bindRole("coder", ["byok-deepseek-coder", "mock-core"]);

      const resolved = await router.resolveModel("coder");
      expect(resolved.id).toBe("byok-deepseek-coder");
      expect(resolved.provider).toBe("custom-byok");

      const result = await router.generateText("coder", {
        messages: [{ role: "user", content: "Escribe una función" }],
      });

      expect(result.text).toContain("[CustomResponse:byok-deepseek-coder]");
      expect(result.usage.totalTokens).toBe(30);
    });

    it("OpenAICompatibleProvider reporta disponibilidad basada en apiKey", async () => {
      const withoutKey = new OpenAICompatibleProvider({
        providerId: "openai",
        baseUrl: "https://api.openai.com/v1",
      });
      expect(await withoutKey.isAvailable()).toBe(false);

      const withKey = new OpenAICompatibleProvider({
        providerId: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-proj-testkey12345678",
      });
      expect(await withKey.isAvailable()).toBe(true);
    });
  });

  describe("Cálculo de Costes de Tokens (Token Economics)", () => {
    it("calcula el coste estimado en USD según tarifas del modelo", async () => {
      const fixedProvider: EgoModelInterface = {
        providerId: "fixed-cost-prov",
        isAvailable: async () => true,
        generate: async () => ({
          text: "Respuesta tarifada",
          usage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
          },
          finishReason: "stop",
        }),
        stream: async () => {
          throw new Error("No streaming");
        },
      };

      router.registerProvider(fixedProvider);
      router.registerModel({
        id: "premium-reasoning-model",
        provider: "fixed-cost-prov",
        displayName: "Premium Reasoning Model",
        contextWindow: 128000,
        costPerInputTokenUsd: 0.000003, // $3 por 1M tokens
        costPerOutputTokenUsd: 0.000015, // $15 por 1M tokens
        capabilities: new Set(["text"]),
        isLocal: false,
      });

      router.bindRole("reasoning-heavy", ["premium-reasoning-model"]);

      const result = await router.generateText("reasoning-heavy", {
        messages: [{ role: "user", content: "Analiza el sistema" }],
      });

      // 1000 * 0.000003 = 0.003
      // 500 * 0.000015 = 0.0075
      // Total = 0.0105 USD
      expect(result.usage.estimatedCostUsd).toBeCloseTo(0.0105, 5);
    });

    it("asigna coste 0 a modelos locales", async () => {
      const result = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "Hola en local" }],
      });

      expect(result.usage.estimatedCostUsd).toBe(0);
    });
  });

  describe("Resiliencia y Fallback ante Errores", () => {
    it("activa fallback transparente a mock cuando el proveedor primario arroja error", async () => {
      const failingProvider: EgoModelInterface = {
        providerId: "failing-prov",
        isAvailable: async () => true,
        generate: async () => {
          throw new Error("503 Service Unavailable / Rate Limit Exceeded");
        },
        stream: async () => {
          throw new Error("503 Service Unavailable");
        },
      };

      router.registerProvider(failingProvider);
      router.registerModel({
        id: "flaky-cloud-model",
        provider: "failing-prov",
        displayName: "Flaky Cloud Model",
        contextWindow: 32000,
        costPerInputTokenUsd: 0.000001,
        costPerOutputTokenUsd: 0.000002,
        capabilities: new Set(["text"]),
        isLocal: false,
      });

      router.bindRole("fast-classifier", ["flaky-cloud-model", "mock-core"]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await router.generateText("fast-classifier", {
        messages: [{ role: "user", content: "¿Clasifica esto?" }],
      });

      expect(result).toBeDefined();
      expect(result.text).toContain("[MockResponse:mock-core]");
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("activa fallback transparente a mock durante streaming si el proveedor primario falla", async () => {
      const failingStreamProvider: EgoModelInterface = {
        providerId: "failing-stream",
        isAvailable: async () => true,
        generate: async () => ({
          text: "ok",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          finishReason: "stop",
        }),
        stream: async () => {
          throw new Error("Stream connection reset by peer");
        },
      };

      router.registerProvider(failingStreamProvider);
      router.registerModel({
        id: "broken-stream-model",
        provider: "failing-stream",
        displayName: "Broken Stream Model",
        contextWindow: 32000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text", "streaming"]),
        isLocal: false,
      });

      router.bindRole("coder", ["broken-stream-model", "mock-core"]);

      const chunks: string[] = [];
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await router.streamText(
        "coder",
        { messages: [{ role: "user", content: "Genera stream" }] },
        (chunk) => chunks.push(chunk.delta)
      );

      expect(result).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join("")).toContain("MockResponse");
      warnSpy.mockRestore();
    });
  });

  describe("Streaming con Proveedor Mock", () => {
    it("emite múltiples chunks y finishReason stop", async () => {
      const chunks: string[] = [];
      const result = await router.streamText(
        "general-chat",
        { messages: [{ role: "user", content: "Dime una historia" }] },
        (chunk) => chunks.push(chunk.delta)
      );

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(result.finishReason).toBe("stop");
      expect(chunks.join("").trim()).toBe(result.text.trim());
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });
  });

  describe("BYOK real resuelve antes que mock", () => {
    it("resuelve gemini-2.0-flash en general-chat con Google registrado", async () => {
      router.registerProvider(new AiSdkGoogleProvider({ apiKey: "sk-test-google-1234567890" }));
      const desc = await router.resolveModel("general-chat");
      expect(desc.id).toBe("gemini-2.0-flash");
      expect(desc.provider).toBe("google");
    });

    it("resuelve deepseek-chat en coder con DeepSeek registrado", async () => {
      router.registerProvider(
        new AiSdkOpenAICompatibleProvider({ providerId: "deepseek", apiKey: "sk-test-deepseek-1234567890" })
      );
      const desc = await router.resolveModel("coder", ["text", "tool_calling"]);
      expect(desc.id).toBe("deepseek-chat");
      expect(desc.provider).toBe("deepseek");
    });

    it("el fallback prefiere proveedor real registrado antes que mock", async () => {
      router.registerProvider(new AiSdkGoogleProvider({ apiKey: "sk-test-google-1234567890" }));
      router.bindRole("general-chat", ["modelo-inexistente"]);
      const desc = await router.resolveModel("general-chat");
      expect(desc.provider).not.toBe("mock");
    });
  });
});
