import { describe, it, expect } from "vitest";
import {
  getConfiguredProviders,
  resolveCatalogCredentials,
  resolveMemoryModelKeys,
} from "../src/main.js";
import { ModelsListSchema, ModelProviderIdSchema } from "../src/ipc/schema.js";

describe("@ego/desktop — catálogo live de modelos por proveedor (T15)", () => {
  it("ModelsListSchema acepta provider válido con refresh opcional (default false)", () => {
    const r = ModelsListSchema.safeParse({ provider: "openai" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.refresh).toBe(false);
    const withRefresh = ModelsListSchema.safeParse({ provider: "google", refresh: true });
    expect(withRefresh.success).toBe(true);
  });

  it("ModelsListSchema rechaza provider desconocido o refresh inválido (fail-closed)", () => {
    expect(ModelsListSchema.safeParse({ provider: "evil" }).success).toBe(false);
    expect(ModelsListSchema.safeParse({}).success).toBe(false);
    expect(ModelsListSchema.safeParse({ provider: "openai", refresh: "sí" }).success).toBe(false);
    expect(ModelProviderIdSchema.safeParse("mock").success).toBe(false);
  });

  it("getConfiguredProviders: configured = key presente; ollama/mock siempre true", () => {
    const all = getConfiguredProviders({
      openai: "sk-o",
      anthropic: "sk-a",
      google: "sk-g",
      deepseek: "sk-d",
    });
    expect(all).toEqual([
      { id: "openai", configured: true },
      { id: "anthropic", configured: true },
      { id: "google", configured: true },
      { id: "deepseek", configured: true },
      { id: "ollama", configured: true },
      { id: "mock", configured: true },
    ]);
    const none = getConfiguredProviders({});
    expect(none.filter((p) => p.configured).map((p) => p.id).sort()).toEqual(["mock", "ollama"]);
  });

  it("resolveMemoryModelKeys: por proveedor + legado solo para openai/deepseek", () => {
    const keys = resolveMemoryModelKeys({
      activeProvider: "deepseek",
      apiKey: "legado",
      deepseekKey: "",
      ollamaBaseURL: "http://local:11434",
    });
    expect(keys.deepseek).toBe("legado");
    expect(keys.ollamaBaseURL).toBe("http://local:11434");
    expect(keys.openai).toBeUndefined();
  });

  it("resolveCatalogCredentials: fingerprint opaco, baseURL por proveedor, sin secreto expuesto", () => {
    const secret = "sk-super-secreta-123";
    const a = resolveCatalogCredentials("openai", { openai: secret });
    const b = resolveCatalogCredentials("openai", { openai: secret });
    const c = resolveCatalogCredentials("openai", { openai: "otra" });
    expect(a.credentialFingerprint).toBe(b.credentialFingerprint);
    expect(a.credentialFingerprint).not.toBe(c.credentialFingerprint);
    expect(a.credentialFingerprint).not.toContain(secret);
    expect(a.apiKey).toBe(secret);

    const deep = resolveCatalogCredentials("deepseek", { deepseek: "k", deepseekBaseURL: "https://x/v1" });
    expect(deep.baseURL).toBe("https://x/v1");

    const local = resolveCatalogCredentials("ollama", {});
    expect(local.apiKey).toBeUndefined();
    expect(local.credentialFingerprint).toHaveLength(32);
  });
});
