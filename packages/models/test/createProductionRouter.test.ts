import { describe, expect, it } from "vitest";
import { createProductionRouter } from "../src/createProductionRouter.js";
import { AiSdkOpenAICompatibleProvider } from "../src/providers/AiSdkOpenAICompatibleProvider.js";
import type { ModelRole } from "../src/types.js";

const ROLES: ModelRole[] = ["fast-classifier", "reasoning-heavy", "coder", "general-chat"];

function providerCount(router: unknown): number {
  const inner = router as unknown as { providers: Map<string, unknown> };
  return inner.providers.size;
}

describe("AiSdkOpenAICompatibleProvider", () => {
  it("expone providerId parametrizado deepseek/ollama (sin red)", async () => {
    const deepseek = new AiSdkOpenAICompatibleProvider({ providerId: "deepseek" });
    const ollama = new AiSdkOpenAICompatibleProvider({ providerId: "ollama" });
    expect(deepseek.providerId).toBe("deepseek");
    expect(ollama.providerId).toBe("ollama");
    expect(await deepseek.isAvailable()).toBe(false);
    expect(await ollama.isAvailable()).toBe(false);
  });

  it("está disponible con key configurada (sin red)", async () => {
    const p = new AiSdkOpenAICompatibleProvider({
      providerId: "deepseek",
      apiKey: "sk-deepseek-test-1234567890",
    });
    expect(await p.isAvailable()).toBe(true);
  });

  it("delega generate al endpoint baseURL custom vía SDK", async () => {
    const seen: Array<{ url: unknown; body: string }> = [];
    const stubFetch = async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url, body: (init?.body as string) ?? "" });
      return new Response(
        JSON.stringify({
          id: "chatcmpl-compat-1",
          object: "chat.completion",
          created: 1720000000,
          model: "deepseek-chat",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hola" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const p = new AiSdkOpenAICompatibleProvider({
      providerId: "deepseek",
      apiKey: "sk-deepseek-test-1234567890",
      baseURL: "https://api.deepseek.com/v1",
      fetch: stubFetch,
    });
    const res = await p.generate("deepseek-chat", {
      messages: [{ role: "user", content: "hola" }],
    });
    expect(seen).toHaveLength(1);
    expect(String(seen[0].url)).toContain("api.deepseek.com");
    expect(String(seen[0].url)).toContain("chat/completions");
    expect(res.text).toContain("Hola");
    expect(res.finishReason).toBe("stop");
  });
});

describe("createProductionRouter", () => {
  it("sin keys → solo mock resuelve (mock-core) y nunca lanza", async () => {
    const router = createProductionRouter({});
    expect(providerCount(router)).toBe(1);
    for (const role of ROLES) {
      const desc = await router.resolveModel(role);
      expect(desc.id).toBe("mock-core");
    }
  });

  it("sin argumento → solo mock resuelve y nunca lanza", async () => {
    const router = createProductionRouter();
    for (const role of ROLES) {
      const desc = await router.resolveModel(role);
      expect(desc.id).toBe("mock-core");
    }
  });

  it("con keys fake → registra 4+mock y resolveModel nunca lanza", async () => {
    const router = createProductionRouter({
      openai: "sk-test-1234567890",
      anthropic: "sk-ant-test-1234567890",
      google: "AIza-test-1234567890",
      deepseek: "sk-deepseek-test-1234567890",
    });
    expect(providerCount(router)).toBeGreaterThanOrEqual(5);
    for (const role of ROLES) {
      const desc = await router.resolveModel(role);
      expect(desc.id).toBeDefined();
    }
    const general = await router.resolveModel("general-chat");
    expect(general.id).not.toBe("mock-core");
  });

  it("ollama se registra solo con baseURL/key explícita (dummy sin key real)", async () => {
    const router = createProductionRouter({ ollamaBaseURL: "http://localhost:11434/v1" });
    expect(providerCount(router)).toBe(2);
    const fast = await router.resolveModel("fast-classifier");
    expect(fast.id).toBe("llama3.2:3b");
  });

  it("no lee process.env dentro del paquete", async () => {
    process.env.OPENAI_API_KEY = "sk-should-be-ignored";
    try {
      const router = createProductionRouter({});
      expect(providerCount(router)).toBe(1);
      const desc = await router.resolveModel("general-chat");
      expect(desc.id).toBe("mock-core");
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });
});
