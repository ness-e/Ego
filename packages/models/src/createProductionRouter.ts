import { ModelRouter } from "./ModelRouter.js";
import { AiSdkAnthropicProvider } from "./providers/AiSdkAnthropicProvider.js";
import { AiSdkGoogleProvider } from "./providers/AiSdkGoogleProvider.js";
import {
  AiSdkOpenAICompatibleProvider,
  OLLAMA_DEFAULT_BASE_URL,
} from "./providers/AiSdkOpenAICompatibleProvider.js";
import { AiSdkOpenAIProvider } from "./providers/AiSdkOpenAIProvider.js";

export interface ProductionRouterKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  deepseek?: string;
  ollamaBaseURL?: string;
  ollamaApiKey?: string;
}

/**
 * Factory de producción: registra un `AiSdk*Provider` por key presente más
 * el wrapper OpenAI-compatible para DeepSeek/Ollama, siempre con fallback Mock
 * (registrado por defecto en `ModelRouter`). Nunca lee `process.env`: las keys
 * entran por parámetro desde el main process (BYOK vía safeStorage).
 */
export function createProductionRouter(keys: ProductionRouterKeys = {}): ModelRouter {
  const router = new ModelRouter();

  if (keys.openai) {
    router.registerProvider(new AiSdkOpenAIProvider({ apiKey: keys.openai }));
  }
  if (keys.anthropic) {
    router.registerProvider(new AiSdkAnthropicProvider({ apiKey: keys.anthropic }));
  }
  if (keys.google) {
    router.registerProvider(new AiSdkGoogleProvider({ apiKey: keys.google }));
  }
  if (keys.deepseek) {
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({ providerId: "deepseek", apiKey: keys.deepseek }),
    );
  }
  if (keys.ollamaBaseURL !== undefined || keys.ollamaApiKey !== undefined) {
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "ollama",
        // Ollama local no exige key real: dummy "ollama" (patrón de main.ts).
        apiKey: keys.ollamaApiKey ?? "ollama",
        baseURL: keys.ollamaBaseURL ?? OLLAMA_DEFAULT_BASE_URL,
      }),
    );
  }

  return router;
}
