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
  private readonly delegate: AiSdkOpenAIProvider;

  constructor(opts: AiSdkOpenAICompatibleProviderOptions) {
    this.providerId = opts.providerId;
    this.apiKey = opts.apiKey ?? "";
    this.delegate = new AiSdkOpenAIProvider({
      apiKey: this.apiKey,
      baseURL: opts.baseURL ?? defaultBaseURL(opts.providerId),
      fetch: opts.fetch,
    });
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
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
