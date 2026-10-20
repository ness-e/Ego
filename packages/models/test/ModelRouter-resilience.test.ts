import { describe, it, expect, vi } from "vitest";
import { ModelRouter, computeBackoffDelayMs } from "../src/ModelRouter.js";
import { AiSdkAnthropicProvider } from "../src/providers/AiSdkAnthropicProvider.js";
import type {
  EgoModelInterface,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "../src/types.js";

function makeProvider(
  providerId: string,
  onGenerate?: () => Promise<ModelGenerateResult>
): EgoModelInterface {
  return {
    providerId: providerId as ModelProviderId,
    isAvailable: async () => true,
    generate: async (modelId: string): Promise<ModelGenerateResult> => {
      if (onGenerate) return onGenerate();
      return {
        text: `[${providerId}:${modelId}]`,
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
      };
    },
    stream: async (modelId: string, _o, onChunk: (c: ModelStreamChunk) => void) => {
      onChunk({ type: "text-delta", delta: "x" });
      return {
        text: "x",
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
      };
    },
  };
}

function rateLimitedProvider(): EgoModelInterface {
  return {
    providerId: "rl" as ModelProviderId,
    isAvailable: async () => true,
    generate: async () => {
      throw new Error("Error HTTP 429: too many requests");
    },
    stream: async () => {
      throw new Error("Error HTTP 429: too many requests");
    },
  };
}

describe("ModelRouter — backoff, capabilities, coste y complejidad (T2)", () => {
  describe("EGO-FIND-37 — backoff exponencial con jitter", () => {
    it("(a1) computeBackoffDelayMs crece exponencialmente y respeta el tope", () => {
      const opts = { baseDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0 };
      expect(computeBackoffDelayMs(1, opts)).toBe(100);
      expect(computeBackoffDelayMs(2, opts)).toBe(200);
      expect(computeBackoffDelayMs(3, opts)).toBe(400);
      expect(computeBackoffDelayMs(4, opts)).toBe(800);
      expect(computeBackoffDelayMs(5, opts)).toBe(1000); // tope
      expect(computeBackoffDelayMs(9, opts)).toBe(1000);
    });

    it("(a2) el jitter mantiene el delay dentro del rango [d*(1-j), d]", () => {
      const opts = { baseDelayMs: 1000, maxDelayMs: 10000, jitterRatio: 0.5 };
      for (let i = 0; i < 50; i++) {
        const d = computeBackoffDelayMs(1, opts);
        expect(d).toBeGreaterThanOrEqual(500);
        expect(d).toBeLessThanOrEqual(1000);
      }
      // Con random()=0 el delay es el máximo; con random()=1 el mínimo.
      expect(computeBackoffDelayMs(1, { ...opts, random: () => 0 })).toBe(1000);
      expect(computeBackoffDelayMs(1, { ...opts, random: () => 1 })).toBe(500);
    });

    it("(a3) ante 429 el router NO reintenta la misma credencial", async () => {
      const router = new ModelRouter({ backoffBaseDelayMs: 5 });
      const usedKeys: string[] = [];
      let attempts = 0;
      const provider: EgoModelInterface = {
        providerId: "rl" as ModelProviderId,
        isAvailable: async () => true,
        generate: async () => {
          attempts++;
          throw new Error("Error HTTP 429: too many requests");
        },
        stream: async () => {
          attempts++;
          throw new Error("Error HTTP 429: too many requests");
        },
      };

      router.registerProvider(provider);
      router.registerModel({
        id: "rl-model",
        provider: "rl",
        displayName: "RL",
        contextWindow: 1000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["rl-model"]);

      // Pool "atascado": devuelve SIEMPRE la misma key.
      router.attachCredentialPool(
        {
          getPoolSize: () => 3,
          getActiveKey: async () => "key-A",
          getActiveFingerprint: () => "fp-A",
          reportRateLimited: async () => {},
        },
        (_p: ModelProviderId, apiKey: string) => {
          usedKeys.push(apiKey);
          return provider;
        }
      );

      const result = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "hola" }],
      });

      // Caiendo al mock (fail-closed), pero SIN reintentar la credencial caída.
      expect(result.text).toContain("[MockResponse:mock-core]");
      // Una sola credencial debe intentar: repetir la misma key es inútil.
      expect(attempts).toBe(1);
      expect(usedKeys).toEqual([]);
    });

    it("(a4) el router espera entre rotaciones (delay real antes del 2.º intento)", async () => {
      const router = new ModelRouter({ backoffBaseDelayMs: 60 });
      const usedKeys: string[] = [];
      let attempts = 0;
      const provider: EgoModelInterface = {
        providerId: "rl" as ModelProviderId,
        isAvailable: async () => true,
        generate: async () => {
          attempts++;
          throw new Error("Error HTTP 429: too many requests");
        },
        stream: async () => {
          attempts++;
          throw new Error("Error HTTP 429: too many requests");
        },
      };
      let idx = 0;

      router.registerProvider(provider);
      router.registerModel({
        id: "rl-model",
        provider: "rl",
        displayName: "RL",
        contextWindow: 1000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["rl-model"]);

      router.attachCredentialPool(
        {
          getPoolSize: () => 2,
          getActiveKey: async () => (idx === 0 ? "key-A" : "key-B"),
          getActiveFingerprint: () => (idx === 0 ? "fp-A" : "fp-B"),
          reportRateLimited: async () => {
            idx++;
          },
        },
        (_p: ModelProviderId, apiKey: string) => {
          usedKeys.push(apiKey);
          return provider;
        }
      );

      const t0 = Date.now();
      const result = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "hola" }],
      });
      const elapsed = Date.now() - t0;

      expect(result.text).toContain("[MockResponse:mock-core]");
      // Dos credenciales DISTINTAS probadas (la inicial + la rotada).
      expect(attempts).toBe(2);
      expect(usedKeys).toEqual(["key-B"]);
      // Hubo backoff real entre ambas.
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });
  });

  describe("EGO-FIND-38 — el fallback respeta requiredCapabilities", () => {
    it("(b) un modelo sin tool_calling NO sirve para una petición que lo exige", async () => {
      const router = new ModelRouter();
      router.registerProvider(makeProvider("p1"));
      router.registerProvider(makeProvider("p2"));

      router.registerModel({
        id: "weak",
        provider: "p1",
        displayName: "Weak",
        contextWindow: 1000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.registerModel({
        id: "strong",
        provider: "p2",
        displayName: "Strong",
        contextWindow: 1000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text", "tool_calling"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["weak"]);

      const desc = await router.resolveModel("general-chat", ["text", "tool_calling"]);
      expect(desc.id).toBe("strong");
      expect(desc.capabilities.has("tool_calling")).toBe(true);
    });
  });

  describe("EGO-FIND-39 — presupuesto de coste y routing por complejidad", () => {
    it("(c1) un modelo que excede maxCostPerCallUsd degrada a uno más barato", async () => {
      const router = new ModelRouter({ maxCostPerCallUsd: 0.5 });
      const expensiveCalls: string[] = [];
      const cheapCalls: string[] = [];

      router.registerProvider(
        makeProvider("exp", async () => {
          expensiveCalls.push("exp");
          return {
            text: "caro",
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
          };
        })
      );
      router.registerProvider(
        makeProvider("cheap", async () => {
          cheapCalls.push("cheap");
          return {
            text: "barato",
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
          };
        })
      );

      router.registerModel({
        id: "exp-model",
        provider: "exp",
        displayName: "Exp",
        contextWindow: 200000,
        costPerInputTokenUsd: 0.001,
        costPerOutputTokenUsd: 0.002,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.registerModel({
        id: "cheap-model",
        provider: "cheap",
        displayName: "Cheap",
        contextWindow: 200000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["exp-model", "cheap-model"]);

      const res = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "x" }],
        profile: { estimatedInputTokens: 1_000_000 },
      });

      expect(expensiveCalls.length).toBe(0);
      expect(cheapCalls.length).toBe(1);
      expect(res.text).toBe("barato");
    });

    it("(c2) si no hay modelo barato, se lanza un error tipado de presupuesto", async () => {
      const router = new ModelRouter({ maxCostPerCallUsd: 0.5 });
      router.registerProvider(
        makeProvider("exp", async () => ({
          text: "caro",
          finishReason: "stop",
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
        }))
      );
      router.registerModel({
        id: "exp-model",
        provider: "exp",
        displayName: "Exp",
        contextWindow: 200000,
        costPerInputTokenUsd: 0.001,
        costPerOutputTokenUsd: 0.002,
        capabilities: new Set(["text"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["exp-model"]);

      await expect(
        router.generateText("general-chat", {
          messages: [{ role: "user", content: "x" }],
          profile: { estimatedInputTokens: 1_000_000 },
        })
      ).rejects.toThrow(/budget|presupuesto|cost/i);
    });

    it("(d1) perfil simple enruta al alias fast; perfil complejo al alias smart", async () => {
      const router = new ModelRouter();
      router.registerProvider(makeProvider("p1"));
      router.registerProvider(makeProvider("p2"));
      router.setAliases({ fast: "fast-model", smart: "smart-model" });

      router.registerModel({
        id: "fast-model",
        provider: "p1",
        displayName: "Fast",
        contextWindow: 32000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: true,
      });
      router.registerModel({
        id: "smart-model",
        provider: "p2",
        displayName: "Smart",
        contextWindow: 200000,
        costPerInputTokenUsd: 0.000003,
        costPerOutputTokenUsd: 0.000015,
        capabilities: new Set(["text", "vision"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["smart-model"]);

      const simple = await router.resolveModel("general-chat", ["text"], undefined, {
        estimatedInputTokens: 200,
        fileCount: 0,
        multimodal: false,
      });
      expect(simple.id).toBe("fast-model");

      const complex = await router.resolveModel("general-chat", ["text"], undefined, {
        estimatedInputTokens: 200000,
        fileCount: 12,
        multimodal: true,
      });
      expect(complex.id).toBe("smart-model");
    });

    it("(d2) un request multimodal exige la capability vision", async () => {
      const router = new ModelRouter();
      router.registerProvider(makeProvider("p1"));
      router.registerProvider(makeProvider("p2"));
      router.registerModel({
        id: "text-only",
        provider: "p1",
        displayName: "TextOnly",
        contextWindow: 32000,
        costPerInputTokenUsd: 0,
        costPerOutputTokenUsd: 0,
        capabilities: new Set(["text"]),
        isLocal: true,
      });
      router.registerModel({
        id: "vision-model",
        provider: "p2",
        displayName: "Vision",
        contextWindow: 200000,
        costPerInputTokenUsd: 0.000003,
        costPerOutputTokenUsd: 0.000015,
        capabilities: new Set(["text", "vision"]),
        isLocal: false,
      });
      router.bindRole("general-chat", ["text-only", "vision-model"]);

      const desc = await router.resolveModel("general-chat", ["text"], undefined, {
        multimodal: true,
      });
      expect(desc.id).toBe("vision-model");
    });
  });

  describe("EGO-FIND-40 — prompt caching (cache_control) en Anthropic", () => {
    it("(e) el payload de Anthropic lleva cache_control en el bloque de sistema", async () => {
      let captured: unknown = null;
      const fetchMock = vi.fn(async (_url: unknown, init: { body?: string } | undefined) => {
        captured = init?.body ? JSON.parse(init.body) : null;
        return new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-3-5-sonnet-20241022",
            content: [{ type: "text", text: "ok" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const provider = new AiSdkAnthropicProvider({
        apiKey: "sk-test",
        fetch: fetchMock as unknown as typeof fetch,
      });

      await provider.generate("claude-3-5-sonnet-20241022", {
        messages: [{ role: "user", content: "hola" }],
        systemPrompt: "SYSTEM PROMPT ESTABLE",
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      });

      expect(captured).not.toBeNull();
      expect(JSON.stringify(captured)).toContain("cache_control");
    });

    it("(e2) sin providerOptions NO se inyecta cache_control", async () => {
      let captured: unknown = null;
      const fetchMock = vi.fn(async (_url: unknown, init: { body?: string } | undefined) => {
        captured = init?.body ? JSON.parse(init.body) : null;
        return new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-3-5-sonnet-20241022",
            content: [{ type: "text", text: "ok" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const provider = new AiSdkAnthropicProvider({
        apiKey: "sk-test",
        fetch: fetchMock as unknown as typeof fetch,
      });

      await provider.generate("claude-3-5-sonnet-20241022", {
        messages: [{ role: "user", content: "hola" }],
        systemPrompt: "SYSTEM PROMPT ESTABLE",
      });

      expect(JSON.stringify(captured)).not.toContain("cache_control");
    });
  });
});
