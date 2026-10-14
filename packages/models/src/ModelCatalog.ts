/**
 * Catálogo live de modelos por proveedor (T15).
 * Discovery automático estilo hermes (`fetch_models_with_pricing`, timeout 8s,
 * parse `data|[]`, None en fallo) adaptado a main-process + IPC: fetch HTTP
 * directo (AI SDK es solo inferencia, sin list), NUNCA throw, fallback curado
 * y cache memoria + VantaDB (`gov/catalog`, TTL 1h).
 * Sin dependencias nuevas: solo `fetch` global. Sin `any`, sin logs.
 */

export type CatalogProviderId = "openai" | "anthropic" | "google" | "deepseek" | "ollama";

export const CATALOG_TIMEOUT_MS = 8000;
export const CATALOG_CACHE_TTL_MS = 3600_000;
const CATALOG_MAX_MODELS = 500;
const GOOGLE_MAX_PAGES = 10;

/**
 * Fallback curado por proveedor (misma fuente que el picker).
 * Se usa cuando el fetch live falla y no hay cache vigente.
 */
export const CURATED_MODELS: Record<CatalogProviderId, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
  google: ["gemini-3.8-flash", "gemini-3.5-flash"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  ollama: ["llama3.2:3b", "qwen2.5-coder:32b"],
};

export interface FetchLiveModelsInput {
  provider: CatalogProviderId;
  apiKey?: string;
  baseURL?: string;
  fetchImpl?: typeof fetch;
}

export type CatalogSource = "live" | "cache" | "curated";

export interface CatalogListInput extends FetchLiveModelsInput {
  /** Opaco para el catálogo: el main pasa el fingerprint SHA-256 (nunca la key). */
  credentialFingerprint?: string;
  refresh?: boolean;
}

export interface CatalogListResult {
  models: string[];
  source: CatalogSource;
}

export interface CatalogCacheEntry {
  models: string[];
  savedAtMs: number;
}

export interface CatalogCacheStore {
  load(key: string): Promise<CatalogCacheEntry | null>;
  save(key: string, value: CatalogCacheEntry): Promise<void>;
}

export interface ModelCatalogOptions {
  fetchImpl?: typeof fetch;
  cache?: CatalogCacheStore;
  now?: () => number;
}

function normBase(baseURL: string | undefined): string | undefined {
  const t = baseURL?.trim().replace(/\/+$/, "");
  return t ? t : undefined;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueIds(ids: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const clean = id.trim();
    if (clean.length === 0 || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= CATALOG_MAX_MODELS) break;
  }
  return out;
}

function openAiStyleIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return uniqueIds(data.map((item) => (item && typeof item === "object" ? (item as { id?: unknown }).id : undefined)));
}

async function fetchJson(url: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CATALOG_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { method: "GET", headers, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenAiStyle(base: string, apiKey: string, fetchImpl: typeof fetch): Promise<string[] | null> {
  const payload = await fetchJson(`${base}/models`, { Authorization: `Bearer ${apiKey}` }, fetchImpl);
  if (payload === null) return null;
  const ids = openAiStyleIds(payload);
  return ids.length > 0 ? ids : null;
}

async function fetchAnthropic(apiKey: string, fetchImpl: typeof fetch): Promise<string[] | null> {
  const payload = await fetchJson(
    "https://api.anthropic.com/v1/models",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    fetchImpl
  );
  if (payload === null) return null;
  const ids = openAiStyleIds(payload);
  return ids.length > 0 ? ids : null;
}

interface GoogleModelsPage {
  models?: Array<{ name?: unknown; supportedGenerationMethods?: unknown }>;
  nextPageToken?: unknown;
}

async function fetchGoogle(apiKey: string, fetchImpl: typeof fetch): Promise<string[] | null> {
  const collected: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < GOOGLE_MAX_PAGES; page++) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}` +
      `&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const payload = await fetchJson(url, {}, fetchImpl);
    if (payload === null || typeof payload !== "object") return null;
    const { models, nextPageToken } = payload as GoogleModelsPage;
    if (Array.isArray(models)) {
      for (const m of models) {
        const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        if (!methods.includes("generateContent")) continue;
        if (typeof m?.name !== "string") continue;
        const id = m.name.startsWith("models/") ? m.name.slice("models/".length) : m.name;
        if (id.trim().length > 0 && !collected.includes(id)) collected.push(id);
        if (collected.length >= CATALOG_MAX_MODELS) break;
      }
    }
    pageToken = typeof nextPageToken === "string" && nextPageToken.length > 0 ? nextPageToken : undefined;
    if (!pageToken) break;
  }
  return collected.length > 0 ? collected : null;
}

async function fetchOllama(baseURL: string | undefined, fetchImpl: typeof fetch): Promise<string[] | null> {
  const apiBase = (normBase(baseURL) ?? "http://localhost:11434").replace(/\/v1$/, "");
  const payload = await fetchJson(`${apiBase}/api/tags`, {}, fetchImpl);
  if (payload === null || typeof payload !== "object") return null;
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return null;
  const ids = uniqueIds(
    models.map((m) => (m && typeof m === "object" ? (m as { name?: unknown }).name : undefined))
  );
  return ids.length > 0 ? ids : null;
}

/**
 * Fetch live de IDs por proveedor. Retorna `null` en cualquier fallo
 * (HTTP no-ok, red, JSON inválido, vacío) — NUNCA lanza.
 */
export async function fetchLiveModels(input: FetchLiveModelsInput): Promise<string[] | null> {
  try {
    const fetchImpl = input.fetchImpl ?? fetch;
    const { provider } = input;
    if (provider === "ollama") return await fetchOllama(input.baseURL, fetchImpl);
    if (!isNonEmpty(input.apiKey)) return null;
    const apiKey = input.apiKey.trim();
    if (provider === "openai") {
      return await fetchOpenAiStyle(normBase(input.baseURL) ?? "https://api.openai.com/v1", apiKey, fetchImpl);
    }
    if (provider === "deepseek") {
      return await fetchOpenAiStyle(normBase(input.baseURL) ?? "https://api.deepseek.com", apiKey, fetchImpl);
    }
    if (provider === "anthropic") return await fetchAnthropic(apiKey, fetchImpl);
    return await fetchGoogle(apiKey, fetchImpl);
  } catch {
    return null;
  }
}

/** Key de cache: incluye fingerprint opaco, NUNCA el secreto. */
export function catalogCacheKey(
  provider: CatalogProviderId,
  credentialFingerprint: string | undefined,
  baseURL: string | undefined
): string {
  return `catalog:v1:${provider}:${normBase(baseURL) ?? "default"}:${credentialFingerprint ?? "nokey"}`;
}

export class ModelCatalog {
  private readonly memory = new Map<string, CatalogCacheEntry>();
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly store: CatalogCacheStore | undefined;
  private readonly now: () => number;

  constructor(options: ModelCatalogOptions = {}) {
    this.fetchImpl = options.fetchImpl;
    this.store = options.cache;
    this.now = options.now ?? Date.now;
  }

  private fresh(entry: CatalogCacheEntry | null | undefined): entry is CatalogCacheEntry {
    return !!entry && this.now() - entry.savedAtMs < CATALOG_CACHE_TTL_MS;
  }

  async listModels(input: CatalogListInput): Promise<CatalogListResult> {
    const key = catalogCacheKey(input.provider, input.credentialFingerprint, input.baseURL);
    if (!input.refresh) {
      const mem = this.memory.get(key);
      if (this.fresh(mem)) return { models: mem.models, source: "cache" };
      if (this.store) {
        try {
          const persisted = await this.store.load(key);
          if (this.fresh(persisted)) {
            this.memory.set(key, persisted);
            return { models: persisted.models, source: "cache" };
          }
        } catch {
          // Cache persistente best-effort: se ignora y se sigue al live.
        }
      }
    }
    const fetchInput: FetchLiveModelsInput = { provider: input.provider };
    if (isNonEmpty(input.apiKey)) fetchInput.apiKey = input.apiKey;
    if (isNonEmpty(input.baseURL)) fetchInput.baseURL = input.baseURL;
    if (this.fetchImpl) fetchInput.fetchImpl = this.fetchImpl;
    const live = await fetchLiveModels(fetchInput);
    if (live !== null) {
      const entry: CatalogCacheEntry = { models: live, savedAtMs: this.now() };
      this.memory.set(key, entry);
      if (this.store) {
        try {
          await this.store.save(key, entry);
        } catch {
          // Best-effort: el live igual se retorna.
        }
      }
      return { models: live, source: "live" };
    }
    const mem = this.memory.get(key);
    if (this.fresh(mem)) return { models: mem.models, source: "cache" };
    if (this.store) {
      try {
        const persisted = await this.store.load(key);
        if (this.fresh(persisted)) {
          this.memory.set(key, persisted);
          return { models: persisted.models, source: "cache" };
        }
      } catch {
        // noop: se cae al curado.
      }
    }
    return { models: [...CURATED_MODELS[input.provider]], source: "curated" };
  }
}
