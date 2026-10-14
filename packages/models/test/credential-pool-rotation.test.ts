import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelRouter } from "../src/ModelRouter.js";
import type {
  CredentialPoolReader,
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
} from "../src/ModelRouter.js";

/**
 * Pool falso en memoria (sin red, sin secretos reales): implementa el
 * contrato lector que el router consume. Reloj manual para cooldown.
 */
function makeFakePool(keys: string[], cooldownMs = 60_000) {
  let now = 1_000_000;
  const order = [...keys];
  let cursor = 0;
  const cooledUntil = new Map<string, number>();
  let reportCalls = 0;
  const fp = (k: string) => `fp-${k}`;
  const peek = (): string | null => {
    for (let step = 0; step < order.length; step++) {
      const key = order[(cursor + step) % order.length] as string;
      if ((cooledUntil.get(key) ?? 0) <= now) return key;
    }
    return null;
  };
  const pool: CredentialPoolReader = {
    getPoolSize: () => order.length,
    getActiveKey: async () => peek(),
    getActiveFingerprint: () => {
      const active = peek();
      return active ? fp(active) : null;
    },
    reportRateLimited: async () => {
      reportCalls++;
      const active = peek();
      if (!active) return;
      cooledUntil.set(active, now + cooldownMs);
      cursor = (order.indexOf(active) + 1) % order.length;
    },
  };
  return { pool, reportCalls: () => reportCalls, advance: (ms: number) => { now += ms; } };
}

/** Provider falso que falla con 429 para keys marcadas y responde ok con el resto. */
function makeFlakyProvider(
  providerId: ModelProviderId,
  apiKey: string,
  failKeys: Set<string>,
  tag: string
): EgoModelInterface {
  const ok = (modelId: string): ModelGenerateResult => ({
    text: `[${tag}:${modelId}] ok con ${apiKey}`,
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
  });
  return {
    providerId,
    isAvailable: async () => true,
    generate: async (modelId: string, _options: ModelGenerateOptions) => {
      if (failKeys.has(apiKey)) {
        throw new Error(`[${providerId}] Error HTTP 429: Rate limit exceeded for ${modelId}`);
      }
      return ok(modelId);
    },
    stream: async (modelId: string, options: ModelGenerateOptions, onChunk) => {
      if (failKeys.has(apiKey)) {
        throw new Error(`[${providerId}] Streaming Error HTTP 429: rate_limit_exceeded`);
      }
      const res = ok(modelId);
      onChunk({ type: "text-delta", delta: res.text });
      onChunk({ type: "finish", finishReason: "stop", usage: res.usage });
      return res;
    },
  };
}

describe("ModelRouter — rotación del pool ante 429 (T21)", () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  it("reintenta con la siguiente key del MISMO proveedor antes de caer al mock", async () => {
    const keyA = "sk-test-A";
    const keyB = "sk-test-B";
    const { pool } = makeFakePool([keyA, keyB]);
    const failKeys = new Set([keyA]);
    router.attachCredentialPool(pool, (providerId, apiKey) =>
      makeFlakyProvider(providerId, apiKey, failKeys, "flaky")
    );
    router.registerProvider(makeFlakyProvider("openai", keyA, failKeys, "flaky"));
    router.registerModel({
      id: "pool-model",
      provider: "openai",
      displayName: "Pool Model",
      contextWindow: 8000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text"]),
      isLocal: false,
    });
    router.bindRole("general-chat", ["pool-model", "mock-core"]);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(result.text).toContain(`ok con ${keyB}`);
      expect(result.text).not.toContain("MockResponse");
    } finally {
      warn.mockRestore();
    }
  });

  it("agotado el pool (todo en cooldown) cae al mock fail-closed sin lanzar", async () => {
    const keyA = "sk-test-only";
    const { pool } = makeFakePool([keyA]);
    const failKeys = new Set([keyA]);
    router.attachCredentialPool(pool, (providerId, apiKey) =>
      makeFlakyProvider(providerId, apiKey, failKeys, "flaky")
    );
    router.registerProvider(makeFlakyProvider("openai", keyA, failKeys, "flaky"));
    router.registerModel({
      id: "pool-model",
      provider: "openai",
      displayName: "Pool Model",
      contextWindow: 8000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text"]),
      isLocal: false,
    });
    router.bindRole("general-chat", ["pool-model", "mock-core"]);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(result.text).toContain("[MockResponse:mock-core]");
    } finally {
      warn.mockRestore();
    }
  });

  it("un error NO-429 (500) no consume el pool y cae directo al mock", async () => {
    const keyA = "sk-test-A";
    const fake = makeFakePool([keyA, "sk-test-B"]);
    const badProvider: EgoModelInterface = {
      providerId: "openai",
      isAvailable: async () => true,
      generate: async () => {
        throw new Error("[openai] Error HTTP 500: Internal Server Error");
      },
      stream: async () => {
        throw new Error("[openai] Streaming Error HTTP 500: boom");
      },
    };
    router.attachCredentialPool(fake.pool, (providerId) => badProvider);
    router.registerProvider(badProvider);
    router.registerModel({
      id: "pool-model",
      provider: "openai",
      displayName: "Pool Model",
      contextWindow: 8000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text"]),
      isLocal: false,
    });
    router.bindRole("general-chat", ["pool-model", "mock-core"]);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await router.generateText("general-chat", {
        messages: [{ role: "user", content: "hola" }],
      });
      expect(result.text).toContain("[MockResponse:mock-core]");
      expect(fake.reportCalls()).toBe(0);
      await expect(fake.pool.getActiveKey("openai")).resolves.toBe(keyA);
    } finally {
      warn.mockRestore();
    }
  });

  it("streaming rota ante 429 igual que generate", async () => {
    const keyA = "sk-test-A";
    const keyB = "sk-test-B";
    const { pool } = makeFakePool([keyA, keyB]);
    const failKeys = new Set([keyA]);
    router.attachCredentialPool(pool, (providerId, apiKey) =>
      makeFlakyProvider(providerId, apiKey, failKeys, "flaky")
    );
    router.registerProvider(makeFlakyProvider("openai", keyA, failKeys, "flaky"));
    router.registerModel({
      id: "pool-model",
      provider: "openai",
      displayName: "Pool Model",
      contextWindow: 8000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text", "streaming"]),
      isLocal: false,
    });
    router.bindRole("general-chat", ["pool-model", "mock-core"]);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const chunks: Array<string | undefined> = [];
      const result = await router.streamText(
        "general-chat",
        { messages: [{ role: "user", content: "hola" }] },
        (chunk) => chunks.push(chunk.delta)
      );
      expect(chunks.join("")).toContain(`ok con ${keyB}`);
      expect(result.text).toContain(`ok con ${keyB}`);
    } finally {
      warn.mockRestore();
    }
  });
});
