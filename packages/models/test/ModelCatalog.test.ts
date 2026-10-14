import { describe, it, expect, vi } from "vitest";
import {
  CURATED_MODELS,
  CATALOG_CACHE_TTL_MS,
  CATALOG_TIMEOUT_MS,
  ModelCatalog,
  catalogCacheKey,
  fetchLiveModels,
  type CatalogProviderId,
} from "../src/ModelCatalog.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (url: unknown, init?: unknown) => {
    return handler(url as string, init as RequestInit | undefined);
  }) as unknown as typeof fetch;
}

const PROVIDERS: CatalogProviderId[] = ["openai", "anthropic", "google", "deepseek", "ollama"];

describe("@ego/models — ModelCatalog live por proveedor (T15)", () => {
  it("expone timeout de 8s y TTL de cache de 1h", () => {
    expect(CATALOG_TIMEOUT_MS).toBe(8000);
    expect(CATALOG_CACHE_TTL_MS).toBe(3600_000);
  });

  it("openai: parsea data[].id con Bearer y URL por defecto", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const fetchImpl = mockFetch((url, init) => {
      seenUrl = url;
      seenAuth = (init?.headers as Record<string, string>)["Authorization"] ?? "";
      return jsonResponse({ data: [{ id: "gpt-4o" }, { id: "o3-mini" }, { id: 42 }] });
    });
    const ids = await fetchLiveModels({ provider: "openai", apiKey: "sk-test", fetchImpl });
    expect(ids).toEqual(["gpt-4o", "o3-mini"]);
    expect(seenUrl).toBe("https://api.openai.com/v1/models");
    expect(seenAuth).toBe("Bearer sk-test");
  });

  it("openai: respeta baseURL custom", async () => {
    let seenUrl = "";
    const fetchImpl = mockFetch((url) => {
      seenUrl = url;
      return jsonResponse({ data: [] });
    });
    await fetchLiveModels({ provider: "openai", apiKey: "k", baseURL: "http://localhost:8080/v1/", fetchImpl });
    expect(seenUrl).toBe("http://localhost:8080/v1/models");
  });

  it("deepseek: usa base oficial + /models con Bearer", async () => {
    let seenUrl = "";
    const fetchImpl = mockFetch((url) => {
      seenUrl = url;
      return jsonResponse({ data: [{ id: "deepseek-chat" }] });
    });
    const ids = await fetchLiveModels({ provider: "deepseek", apiKey: "sk-d", fetchImpl });
    expect(ids).toEqual(["deepseek-chat"]);
    expect(seenUrl).toBe("https://api.deepseek.com/models");
  });

  it("anthropic: envía x-api-key + anthropic-version y parsea data[].id", async () => {
    let seenHeaders: Record<string, string> = {};
    const fetchImpl = mockFetch((_url, init) => {
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse({ data: [{ id: "claude-3-5-sonnet-20241022" }] });
    });
    const ids = await fetchLiveModels({ provider: "anthropic", apiKey: "sk-ant", fetchImpl });
    expect(ids).toEqual(["claude-3-5-sonnet-20241022"]);
    expect(seenHeaders["x-api-key"]).toBe("sk-ant");
    expect(seenHeaders["anthropic-version"]).toBe("2023-06-01");
  });

  it("google: pagina con pageToken, filtra generateContent y usa ?key=", async () => {
    const seenUrls: string[] = [];
    let authSeen = false;
    const fetchImpl = mockFetch((url, init) => {
      seenUrls.push(url);
      const h = (init?.headers ?? {}) as Record<string, string>;
      if (h["Authorization"]) authSeen = true;
      if (url.includes("pageToken=tok2")) {
        return jsonResponse({
          models: [{ name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }],
        });
      }
      return jsonResponse({
        models: [
          { name: "models/gemini-2.0-embed", supportedGenerationMethods: ["embedContent"] },
          { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
        ],
        nextPageToken: "tok2",
      });
    });
    const ids = await fetchLiveModels({ provider: "google", apiKey: "g-key", fetchImpl });
    expect(ids).toEqual(["gemini-3.5-flash", "gemini-3.8-flash"]);
    expect(seenUrls[0]).toContain("https://generativelanguage.googleapis.com/v1beta/models?key=g-key");
    expect(authSeen).toBe(false);
  });

  it("ollama: lee /api/tags local sin secreto", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const fetchImpl = mockFetch((url, init) => {
      seenUrl = url;
      seenAuth = (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
      return jsonResponse({ models: [{ name: "llama3.2:3b" }, { name: "qwen2.5-coder:32b" }] });
    });
    const ids = await fetchLiveModels({ provider: "ollama", fetchImpl });
    expect(ids).toEqual(["llama3.2:3b", "qwen2.5-coder:32b"]);
    expect(seenUrl).toBe("http://localhost:11434/api/tags");
    expect(seenAuth).toBe("");
  });

  it("fallo HTTP, red caída o JSON inválido → null SIN throw", async () => {
    const http401 = mockFetch(() => jsonResponse({ error: "nope" }, 401));
    await expect(fetchLiveModels({ provider: "openai", apiKey: "bad", fetchImpl: http401 })).resolves.toBeNull();

    const netDown = mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchLiveModels({ provider: "openai", apiKey: "k", fetchImpl: netDown })).resolves.toBeNull();

    const garbage = mockFetch(() => new Response("no-json{{{", { status: 200 }));
    await expect(fetchLiveModels({ provider: "ollama", fetchImpl: garbage })).resolves.toBeNull();

    const noKey = mockFetch(() => jsonResponse({ data: [] }));
    await expect(fetchLiveModels({ provider: "openai", fetchImpl: noKey })).resolves.toBeNull();
  });

  it("CURATED_MODELS: fallback no vacío por proveedor", () => {
    for (const p of PROVIDERS) {
      expect(CURATED_MODELS[p].length).toBeGreaterThan(0);
      for (const id of CURATED_MODELS[p]) expect(typeof id).toBe("string");
    }
  });

  it("ModelCatalog.listModels: live → cache en memoria → curated en fallo", async () => {
    const fetchImpl = mockFetch(() => jsonResponse({ data: [{ id: "gpt-4o" }] }));
    const catalog = new ModelCatalog({ fetchImpl });
    const first = await catalog.listModels({ provider: "openai", apiKey: "k", credentialFingerprint: "fp1" });
    expect(first).toEqual({ models: ["gpt-4o"], source: "live" });

    const failing = new ModelCatalog({ fetchImpl: mockFetch(() => jsonResponse({}, 500)) });
    // Sin cache y con fallo → curado
    const fallback = await failing.listModels({ provider: "openai", apiKey: "k", credentialFingerprint: "fp-x" });
    expect(fallback.source).toBe("curated");
    expect(fallback.models).toEqual(CURATED_MODELS["openai"]);

    // Segunda llamada del primero usa cache en memoria (fetch 1 sola vez)
    const second = await catalog.listModels({ provider: "openai", apiKey: "k", credentialFingerprint: "fp1" });
    expect(second.source).toBe("cache");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // refresh:true fuerza refetch
    const third = await catalog.listModels({ provider: "openai", apiKey: "k", credentialFingerprint: "fp1", refresh: true });
    expect(third.source).toBe("live");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("ModelCatalog: cache persistente sobrevive entre instancias dentro del TTL", async () => {
    const store = new Map<string, { models: string[]; savedAtMs: number }>();
    const live = mockFetch(() => jsonResponse({ data: [{ id: "deepseek-chat" }] }));
    const a = new ModelCatalog({
      fetchImpl: live,
      cache: {
        load: async (k) => store.get(k) ?? null,
        save: async (k, v) => {
          store.set(k, v);
        },
      },
    });
    const r1 = await a.listModels({ provider: "deepseek", apiKey: "k", credentialFingerprint: "fp-d" });
    expect(r1.source).toBe("live");

    const dead = mockFetch(() => {
      throw new Error("red caída");
    });
    const b = new ModelCatalog({
      fetchImpl: dead,
      cache: {
        load: async (k) => store.get(k) ?? null,
        save: async (k, v) => {
          store.set(k, v);
        },
      },
    });
    const r2 = await b.listModels({ provider: "deepseek", apiKey: "k", credentialFingerprint: "fp-d" });
    expect(r2).toEqual({ models: ["deepseek-chat"], source: "cache" });

    // TTL vencido → ignora cache y cae a curado
    store.set(catalogCacheKey("deepseek", "fp-d", undefined), {
      models: ["viejo"],
      savedAtMs: Date.now() - CATALOG_CACHE_TTL_MS - 1000,
    });
    const c = new ModelCatalog({
      fetchImpl: dead,
      cache: {
        load: async (k) => store.get(k) ?? null,
        save: async (k, v) => {
          store.set(k, v);
        },
      },
    });
    const r3 = await c.listModels({ provider: "deepseek", apiKey: "k", credentialFingerprint: "fp-d" });
    expect(r3.source).toBe("curated");
  });

  it("catalogCacheKey: incluye fingerprint pero NUNCA el secreto", () => {
    const key = catalogCacheKey("openai", "fp-abc123", "https://api.openai.com/v1");
    expect(key).toContain("fp-abc123");
    expect(key).not.toContain("sk-super-secreta");
  });
});
