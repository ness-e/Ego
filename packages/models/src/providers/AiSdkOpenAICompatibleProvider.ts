import { AiSdkOpenAIProvider } from "./AiSdkOpenAIProvider.js";
import type {
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "../types.js";

export type OpenAICompatibleProviderId = "deepseek" | "ollama";

export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

export interface AiSdkOpenAICompatibleProviderOptions {
  providerId: OpenAICompatibleProviderId;
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof fetch;
}

/**
 * Proveedor OpenAI-compatible (DeepSeek/Ollama/LMStudio/custom) sobre Vercel AI SDK.
 * Delega en `AiSdkOpenAIProvider` con `baseURL` custom (Chat Completions
 * `/chat/completions`, verificado en el source instalado `@ai-sdk/openai`
 * `dist/index.d.ts`: `createOpenAI(options?: OpenAIProviderSettings)` con
 * `baseURL?: string` + `.chat(modelId)`).
 * Tool calling real heredado del delegado. Sin red en `isAvailable`:
 * la disponibilidad se decide por presencia de key/config (el router resuelve).
 */
export class AiSdkOpenAICompatibleProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchFn?: typeof fetch;
  private readonly delegate: AiSdkOpenAIProvider;

  constructor(opts: AiSdkOpenAICompatibleProviderOptions) {
    this.providerId = opts.providerId;
    this.apiKey = opts.apiKey ?? "";
    this.baseURL = opts.baseURL ?? defaultBaseURL(opts.providerId);
    this.fetchFn = opts.fetch;
    this.delegate = new AiSdkOpenAIProvider({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      fetch: opts.fetch,
    });
  }

  async isAvailable(): Promise<boolean> {
    if (this.apiKey.length === 0) return false;
    // Ollama es local: probar liveness rápido (fail-fast sin reintentos) para
    // no elegir un servidor caído y colgar el turno en retries. Cloud (deepseek)
    // se decide por key; el fallback del router cubre el fallo de red.
    if (this.providerId !== "ollama") return true;
    try {
      const apiBase = this.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      try {
        const doFetch = this.fetchFn ?? fetch;
        const res = await doFetch(`${apiBase}/api/tags`, {
          method: "GET",
          signal: ctrl.signal,
        });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }

  async generate(
    modelId: string,
    options: ModelGenerateOptions,
  ): Promise<ModelGenerateResult> {
    return this.delegate.generate(modelId, options);
  }

  async stream(
    modelId: string,
    options: ModelGenerateOptions,
    onChunk: (chunk: ModelStreamChunk) => void,
  ): Promise<ModelGenerateResult> {
    return this.delegate.stream(modelId, options, onChunk);
  }
}

function defaultBaseURL(providerId: OpenAICompatibleProviderId): string {
  return providerId === "deepseek" ? DEEPSEEK_DEFAULT_BASE_URL : OLLAMA_DEFAULT_BASE_URL;
}
