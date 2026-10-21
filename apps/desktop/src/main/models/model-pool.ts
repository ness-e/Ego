/**
 * E6-res (Ola 3) — El **pool multi-key** de modelos (T21 — T16-OAUTH).
 *
 * Extracción **verbatim** del god-file `main.ts`.
 *
 * - El pool (`CredentialPool` sobre `mainProcessCryptoBackend`) es el único
 *   dueño de las keys en memoria: el router SOLO lo lee vía
 *   `attachCredentialPool` y reintenta la siguiente key del MISMO proveedor
 *   ante 429 antes de caer al mock. Agotado → mock (fail-closed).
 * - main es el único que ve keys en claro: la factory reconstruye providers
 *   reales con la key rotada; al renderer solo llegan máscaras.
 * - El estado (`modelCredentialPool`, `modelCredentialManager`) vive en
 *   `state/app-context.ts`: este módulo lo consume y lo escribe por sus
 *   setters. No hay segunda copia.
 */
import { ModelRouter, OpenAICompatibleProvider, AiSdkOpenAIProvider, AiSdkAnthropicProvider, AiSdkGoogleProvider, AiSdkOpenAICompatibleProvider } from "@ego/models";
import type { ModelProviderFactory } from "@ego/models";
import { CredentialManager, CredentialPool } from "@ego/security";
import { DegradedObfBackend } from "../credentials/vault.js";
import { currentModelConfig, isCustomBaseURL, isNonEmptyKey, mergeModelKeys, OPENAI_DEFAULT_BASE_URL, resolveEnvModelKeys, type ResolvedModelKeys } from "../models/model-config.js";
import { modelCredentialPool } from "../state/app-context.js";
import { setModelCredentialManager, setModelCredentialPool } from "../state/app-context.js";

export const modelPoolProviderFactory: ModelProviderFactory = (providerId, apiKey) => {
  if (providerId === "openai") {
    const base = isNonEmptyKey(currentModelConfig.openaiBaseURL)
      ? currentModelConfig.openaiBaseURL
      : currentModelConfig.activeProvider === "openai" && isNonEmptyKey(currentModelConfig.baseUrl)
        ? currentModelConfig.baseUrl
        : undefined;
    if (isCustomBaseURL(base, OPENAI_DEFAULT_BASE_URL)) {
      return new OpenAICompatibleProvider({ providerId: "openai", baseUrl: base, apiKey });
    }
    return new AiSdkOpenAIProvider({ apiKey, ...(isNonEmptyKey(base) ? { baseURL: base } : {}) });
  }
  if (providerId === "anthropic") {
    return new AiSdkAnthropicProvider({ apiKey });
  }
  if (providerId === "google") {
    return new AiSdkGoogleProvider({ apiKey });
  }
  if (providerId === "deepseek") {
    const base = isNonEmptyKey(currentModelConfig.deepseekBaseURL)
      ? currentModelConfig.deepseekBaseURL
      : currentModelConfig.activeProvider === "deepseek" && isNonEmptyKey(currentModelConfig.baseUrl)
        ? currentModelConfig.baseUrl
        : undefined;
    return new AiSdkOpenAICompatibleProvider({
      providerId: "deepseek",
      apiKey,
      ...(isNonEmptyKey(base) ? { baseURL: base } : {}),
    });
  }
  throw new Error(
    `[ModelPool] Rotación no soportada para '${providerId}' (solo openai/anthropic/google/deepseek rotan; mock/ollama sin secreto).`
  );
};

export function getModelCredentialPool(): CredentialPool {
  const existing = modelCredentialPool;
  if (existing) return existing;
  // BUGFIX 2026-10-15 (saveModelConfig lanzaba tras T21): el pool usaba
  // `mainProcessCryptoBackend` directo (fail-closed: lanza sin safeStorage)
  // mientras `encryptCredential` degrada a `obf:` legacy. En esta máquina
  // safeStorage no está disponible, así que el save moría en
  // `setProviderKeys`. El pool usa el mismo degradado que el resto del
  // save (memoria del proceso + `obf:` reversible, nunca texto plano).
  const manager = new CredentialManager(new DegradedObfBackend());
  setModelCredentialManager(manager);
  const pool = new CredentialPool(manager);
  setModelCredentialPool(pool);
  return pool;
}

export function setModelCredentialPoolForTests(pool: CredentialPool | null): void {
  setModelCredentialPool(pool);
  if (pool === null) setModelCredentialManager(null);
}

export async function syncModelCredentialPool(
  router: ModelRouter,
  extraKeys: ResolvedModelKeys = {}
): Promise<void> {
  const keys = mergeModelKeys(resolveEnvModelKeys(), extraKeys);
  const pool = getModelCredentialPool();
  await pool.setProviderKeys("openai", isNonEmptyKey(keys.openai) ? [keys.openai] : []);
  await pool.setProviderKeys("anthropic", isNonEmptyKey(keys.anthropic) ? [keys.anthropic] : []);
  await pool.setProviderKeys("google", isNonEmptyKey(keys.google) ? [keys.google] : []);
  await pool.setProviderKeys("deepseek", isNonEmptyKey(keys.deepseek) ? [keys.deepseek] : []);
  router.attachCredentialPool(pool, modelPoolProviderFactory);
}
