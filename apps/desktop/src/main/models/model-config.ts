/**
 * T11 (EGO-FIND-54) — Configuración de modelo (BYOK) y registro de
 * proveedores en el `ModelRouter`.
 *
 * Extraído de `main.ts` (god-file) sin cambiar comportamiento:
 *  - Resolución de keys: bootstrap env + payload persistido (cifrado).
 *  - `applyModelConfig`: valida con Zod y registra el proveedor activo.
 *  - `setupModelProviders`: registra los proveedores con key + Ollama +
 *    `MockProvider` (fallback determinista, siempre presente).
 *  - `probeModelKey`: valida la key contra la API del proveedor ANTES de
 *    persistir. La key viaja solo en el header/query: nunca en logs.
 */
import { createHash } from "node:crypto";
import {
  AiSdkAnthropicProvider,
  AiSdkGoogleProvider,
  AiSdkOpenAICompatibleProvider,
  AiSdkOpenAIProvider,
  MockProvider,
  ModelRouter,
  OLLAMA_DEFAULT_BASE_URL,
  OpenAICompatibleProvider,
  type CatalogProviderId,
} from "@ego/models";
import { ModelConfigSchema, type ModelConfig } from "../../ipc/schema.js";
import { decryptCredential } from "../credentials/vault.js";

/**
 * Claves de proveedor resueltas SOLO en main (BYOK vía bootstrap env + gov/settings
 * cifrado con safeStorage). Este objeto nunca sale del main process: no se loguea,
 * no se envía por IPC, y las respuestas al renderer usan `maskKey`.
 */
export interface ResolvedModelKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  deepseek?: string;
  openaiBaseURL?: string;
  deepseekBaseURL?: string;
  ollamaBaseURL?: string;
}

export const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function isNonEmptyKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Bootstrap documentado INT-02, solo en main: lee `process.env` como fuente
 * inicial (`OPENAI_API_KEY`/`DEEPSEEK_API_KEY`/`OLLAMA_BASE_URL` más
 * `ANTHROPIC_API_KEY`/`GOOGLE_API_KEY` y base URLs custom). Sin keys → `{}` y
 * todo resuelve a mock (fallback seguro, nunca lanza).
 */
export function resolveEnvModelKeys(env: NodeJS.ProcessEnv = process.env): ResolvedModelKeys {
  const keys: ResolvedModelKeys = {};
  if (isNonEmptyKey(env.OPENAI_API_KEY)) keys.openai = env.OPENAI_API_KEY;
  if (isNonEmptyKey(env.ANTHROPIC_API_KEY)) keys.anthropic = env.ANTHROPIC_API_KEY;
  if (isNonEmptyKey(env.GOOGLE_API_KEY)) keys.google = env.GOOGLE_API_KEY;
  if (isNonEmptyKey(env.DEEPSEEK_API_KEY)) keys.deepseek = env.DEEPSEEK_API_KEY;
  if (isNonEmptyKey(env.OPENAI_BASE_URL)) keys.openaiBaseURL = env.OPENAI_BASE_URL;
  if (isNonEmptyKey(env.DEEPSEEK_BASE_URL)) keys.deepseekBaseURL = env.DEEPSEEK_BASE_URL;
  if (isNonEmptyKey(env.OLLAMA_BASE_URL)) keys.ollamaBaseURL = env.OLLAMA_BASE_URL;
  return keys;
}

/**
 * Resuelve keys desde el payload `gov/settings/model_config` (ya cargado en main).
 * Tolera el shape nuevo por proveedor (`<p>KeyEncrypted`/`<p>Key` + baseURLs) y el
 * legado de clave única (`apiKeyEncrypted`/`apiKey` + `activeProvider`/`baseUrl`).
 * Descifra con `decryptCredential` (safeStorage). Nunca lanza: payload
 * desconocido → `{}`.
 */
export function resolvePersistedModelKeys(payload: unknown): ResolvedModelKeys {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const keys: ResolvedModelKeys = {};
  const pick = (encrypted: unknown, plain: unknown): string | undefined => {
    if (typeof encrypted === "string" && encrypted.length > 0) {
      const decrypted = decryptCredential(encrypted);
      if (isNonEmptyKey(decrypted)) return decrypted;
    }
    if (isNonEmptyKey(plain)) return plain;
    return undefined;
  };
  const openai = pick(p.openaiKeyEncrypted, p.openaiKey);
  if (openai) keys.openai = openai;
  const anthropic = pick(p.anthropicKeyEncrypted, p.anthropicKey);
  if (anthropic) keys.anthropic = anthropic;
  const google = pick(p.googleKeyEncrypted, p.googleKey);
  if (google) keys.google = google;
  const deepseek = pick(p.deepseekKeyEncrypted, p.deepseekKey);
  if (deepseek) keys.deepseek = deepseek;

  // Legado de clave única: pertenece al activeProvider (openai/deepseek).
  const active = typeof p.activeProvider === "string" ? p.activeProvider : "";
  const legacy = pick(p.apiKeyEncrypted, p.apiKey);
  if (legacy && (active === "openai" || active === "deepseek") && !keys[active]) {
    keys[active] = legacy;
  }

  if (isNonEmptyKey(p.ollamaBaseURL)) {
    keys.ollamaBaseURL = p.ollamaBaseURL;
  } else if (active === "ollama" && isNonEmptyKey(p.baseUrl)) {
    keys.ollamaBaseURL = p.baseUrl;
  }
  if (isNonEmptyKey(p.openaiBaseURL)) {
    keys.openaiBaseURL = p.openaiBaseURL;
  } else if (active === "openai" && isNonEmptyKey(p.baseUrl)) {
    keys.openaiBaseURL = p.baseUrl;
  }
  if (isNonEmptyKey(p.deepseekBaseURL)) {
    keys.deepseekBaseURL = p.deepseekBaseURL;
  } else if (active === "deepseek" && isNonEmptyKey(p.baseUrl)) {
    keys.deepseekBaseURL = p.baseUrl;
  }
  return keys;
}

/**
 * Fusiona keys con precedencia explícita: lo persistido por UI (BYOK cifrado)
 * gana sobre el bootstrap env. Campos vacíos no pisan valores existentes.
 */
export function mergeModelKeys(base: ResolvedModelKeys, override: ResolvedModelKeys): ResolvedModelKeys {
  const merged: ResolvedModelKeys = { ...base };
  for (const [field, value] of Object.entries(override) as Array<[keyof ResolvedModelKeys, string | undefined]>) {
    if (isNonEmptyKey(value)) merged[field] = value;
  }
  return merged;
}

/**
 * Resuelve keys en memoria (plaintext de `currentModelConfig`, NUNCA sale
 * del main) al shape `ResolvedModelKeys`. Espeja la precedencia de
 * `resolvePersistedModelKeys` sin descifrado: por proveedor + legado.
 */
export function resolveMemoryModelKeys(config: ModelConfig): ResolvedModelKeys {
  const keys: ResolvedModelKeys = {};
  if (isNonEmptyKey(config.openaiKey)) keys.openai = config.openaiKey;
  if (isNonEmptyKey(config.anthropicKey)) keys.anthropic = config.anthropicKey;
  if (isNonEmptyKey(config.googleKey)) keys.google = config.googleKey;
  if (isNonEmptyKey(config.deepseekKey)) keys.deepseek = config.deepseekKey;
  const active = config.activeProvider;
  if (isNonEmptyKey(config.apiKey) && (active === "openai" || active === "deepseek") && !keys[active]) {
    keys[active] = config.apiKey;
  }
  if (isNonEmptyKey(config.openaiBaseURL)) keys.openaiBaseURL = config.openaiBaseURL;
  else if (active === "openai" && isNonEmptyKey(config.baseUrl)) keys.openaiBaseURL = config.baseUrl;
  if (isNonEmptyKey(config.deepseekBaseURL)) keys.deepseekBaseURL = config.deepseekBaseURL;
  else if (active === "deepseek" && isNonEmptyKey(config.baseUrl)) keys.deepseekBaseURL = config.baseUrl;
  if (isNonEmptyKey(config.ollamaBaseURL)) keys.ollamaBaseURL = config.ollamaBaseURL;
  else if (active === "ollama" && isNonEmptyKey(config.baseUrl)) keys.ollamaBaseURL = config.baseUrl;
  return keys;
}

export interface ConfiguredModelProvider {
  id: CatalogProviderId | "mock";
  configured: boolean;
}

/**
 * T15: proveedores con `configured` = key presente en memoria.
 * Ollama (local) y mock siempre configurados: no exigen secreto.
 */
export function getConfiguredProviders(keys: ResolvedModelKeys): ConfiguredModelProvider[] {
  return [
    { id: "openai", configured: isNonEmptyKey(keys.openai) },
    { id: "anthropic", configured: isNonEmptyKey(keys.anthropic) },
    { id: "google", configured: isNonEmptyKey(keys.google) },
    { id: "deepseek", configured: isNonEmptyKey(keys.deepseek) },
    { id: "ollama", configured: true },
    { id: "mock", configured: true },
  ];
}

export interface CatalogCredentials {
  apiKey?: string;
  baseURL?: string;
  credentialFingerprint: string;
}

/**
 * T15: credenciales efectivas del catálogo desde keys en memoria.
 * El fingerprint es SHA-256 del secreto (opaco, no reversible): es lo
 * único que llega a la key de cache persistida. NUNCA se loguea la key
 * (cero `console.*` en esta función, como en `probeModelKey`).
 */
export function resolveCatalogCredentials(
  provider: CatalogProviderId,
  keys: ResolvedModelKeys
): CatalogCredentials {
  let apiKey: string | undefined;
  let baseURL: string | undefined;
  if (provider === "openai") {
    if (isNonEmptyKey(keys.openai)) apiKey = keys.openai;
    if (isNonEmptyKey(keys.openaiBaseURL)) baseURL = keys.openaiBaseURL;
  } else if (provider === "anthropic") {
    if (isNonEmptyKey(keys.anthropic)) apiKey = keys.anthropic;
  } else if (provider === "google") {
    if (isNonEmptyKey(keys.google)) apiKey = keys.google;
  } else if (provider === "deepseek") {
    if (isNonEmptyKey(keys.deepseek)) apiKey = keys.deepseek;
    if (isNonEmptyKey(keys.deepseekBaseURL)) baseURL = keys.deepseekBaseURL;
  } else {
    if (isNonEmptyKey(keys.ollamaBaseURL)) baseURL = keys.ollamaBaseURL;
  }
  const credentialFingerprint = createHash("sha256")
    .update(`${provider}:${apiKey ?? ""}:${baseURL ?? ""}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  const creds: CatalogCredentials = { credentialFingerprint };
  if (apiKey !== undefined) creds.apiKey = apiKey;
  if (baseURL !== undefined) creds.baseURL = baseURL;
  return creds;
}

export function isCustomBaseURL(url: string | undefined, def: string): url is string {
  return isNonEmptyKey(url) && url.replace(/\/+$/, "") !== def.replace(/\/+$/, "");
}

function registerOpenAIProvider(router: ModelRouter, apiKey: string, baseURL?: string): void {
  if (isCustomBaseURL(baseURL, OPENAI_DEFAULT_BASE_URL)) {
    // Endpoint custom (p. ej. LMStudio/proxy): adaptador directo legacy.
    router.registerProvider(
      new OpenAICompatibleProvider({ providerId: "openai", baseUrl: baseURL, apiKey })
    );
  } else {
    router.registerProvider(
      new AiSdkOpenAIProvider({ apiKey, ...(isNonEmptyKey(baseURL) ? { baseURL } : {}) })
    );
  }
}

/**
 * Registra proveedores AI SDK y BYOK en el ModelRouter (INT-02 + AI SDK adapters).
 * Solo main: combina el bootstrap env documentado con las keys persistidas
 * (gov/settings descifrado, segundo parámetro). Registra un `AiSdk*Provider`
 * por key presente, el legacy `OpenAICompatibleProvider` solo para custom
 * `baseUrl`, Ollama local por defecto y siempre `MockProvider` como fallback.
 * Ninguna key sale del main (sin logs de secretos, sin eventos al renderer).
 */
/**
 * Configuración de modelo vigente en memoria (NUNCA sale del main).
 * Es estado del módulo: `main.ts` lo lee (binding vivo) y lo escribe
 * con `setCurrentModelConfig`.
 */
export let currentModelConfig: ModelConfig = {
  activeProvider: process.env.OPENAI_API_KEY ? "openai" : process.env.DEEPSEEK_API_KEY ? "deepseek" : "mock",
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "",
  modelName: "",
};

/**
 * T13 probe-before-save (hermes P3): valida la key del proveedor activo
 * contra su API (list models, timeout 15s) ANTES de persistir.
 * - 401/403/404 → throw accionable "key inválida", el caller NO persiste.
 * - Red ausente/timeout/5xx → `{verified:false, networkUnreachable:true}`
 *   con `warn`: el caller advierte pero permite guardar (flag visible).
 * - `mock` → `{verified:true}` (nada que validar). `ollama` prueba
 *   conectividad local sin secreto.
 * Seguridad: la key viaja SOLO en el header/query del fetch y NUNCA se
 * incluye en mensajes, errores ni logs (cero `console.*` en esta función).
 */
export interface ModelKeyProbeResult {
  verified: boolean;
  warn?: string;
  networkUnreachable?: boolean;
}

export interface ModelKeyProbeInput {
  provider: ModelConfig["activeProvider"];
  key?: string;
  openaiBaseURL?: string;
  deepseekBaseURL?: string;
  ollamaBaseURL?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function probeModelKey(input: ModelKeyProbeInput): Promise<ModelKeyProbeResult> {
  const { provider } = input;
  if (provider === "mock") return { verified: true };
  const timeoutMs = input.timeoutMs ?? 15000;
  const fetchImpl = input.fetchImpl ?? fetch;
  const normBase = (b: string | undefined): string | undefined => {
    const t = b?.trim().replace(/\/+$/, "");
    return t ? t : undefined;
  };

  let url = "";
  const headers: Record<string, string> = {};
  const secret = input.key?.trim() ?? "";
  if (provider === "ollama") {
    url = `${normBase(input.ollamaBaseURL) ?? OLLAMA_DEFAULT_BASE_URL}/api/tags`;
  } else if (!secret) {
    return { verified: false, warn: "Sin key para validar: se guarda sin probe (fallback mock intacto)." };
  } else if (provider === "openai") {
    url = `${normBase(input.openaiBaseURL) ?? "https://api.openai.com/v1"}/models`;
    headers["Authorization"] = `Bearer ${secret}`;
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/models";
    headers["x-api-key"] = secret;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider === "google") {
    url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`;
  } else if (provider === "deepseek") {
    url = `${normBase(input.deepseekBaseURL) ?? "https://api.deepseek.com"}/models`;
    headers["Authorization"] = `Bearer ${secret}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: "GET", headers, signal: ctrl.signal });
    if (res.ok) return { verified: true };
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(
        `[BYOK] La key de ${provider} es inválida (HTTP ${res.status} al validar contra su API). ` +
          `Verificá la key y el proveedor activo. No se persistió ningún cambio.`
      );
    }
    return {
      verified: false,
      networkUnreachable: true,
      warn: `Validación no concluyente (HTTP ${res.status}): se guarda sin verificar.`,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[BYOK]")) throw err;
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "red no disponible";
    return {
      verified: false,
      networkUnreachable: true,
      warn: `No se pudo validar la key (${reason}): se guarda sin verificar.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Aplica una configuración de modelo validada al ModelRouter (INT-02 + Task 10).
 * Valida con `ModelConfigSchema` (zod) y exige key no vacía para openai/
 * anthropic/google/deepseek: sin key válida no registra nada y el fallback
 * mock queda intacto. Resuelve la key efectiva por proveedor (`<p>Key` con
 * fallback al legado `apiKey` cuando el proveedor activo coincide) y la
 * baseURL efectiva (`<p>BaseURL` con fallback al legado `baseUrl`).
 */
export function applyModelConfig(router: ModelRouter, config: ModelConfig): void {
  const parsed = ModelConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`[IPC Security] Configuración de modelo inválida: ${parsed.error.message}`);
  }
  const valid = parsed.data;
  setCurrentModelConfig({ ...valid });
  // STAB-06: hilar effort/aliases al router (CFG-04). `effortLevel`
  // explícito gana sobre `reasoningEffort` (lógica en `configureFromSettings`).
  router.configureFromSettings({
    ...(valid.effortLevel !== undefined ? { effortLevel: valid.effortLevel } : {}),
    ...(valid.reasoningEffort !== undefined ? { reasoningEffort: valid.reasoningEffort } : {}),
    ...(valid.modelAliases !== undefined ? { modelAliases: valid.modelAliases } : {}),
    ...(valid.reviewModel ? { reviewModel: valid.reviewModel } : {}),
    ...(valid.availableModels !== undefined ? { availableModels: valid.availableModels } : {}),
    ...(valid.fallbackModel ? { fallbackModel: valid.fallbackModel } : {}),
  });
  const legacyKey = isNonEmptyKey(valid.apiKey) ? valid.apiKey : undefined;
  const legacyBase = isNonEmptyKey(valid.baseUrl) ? valid.baseUrl : undefined;
  if (valid.activeProvider === "openai") {
    const key = isNonEmptyKey(valid.openaiKey) ? valid.openaiKey : legacyKey;
    if (!key) return;
    const base = isNonEmptyKey(valid.openaiBaseURL) ? valid.openaiBaseURL : legacyBase;
    registerOpenAIProvider(router, key, base);
  } else if (valid.activeProvider === "anthropic") {
    const key = isNonEmptyKey(valid.anthropicKey) ? valid.anthropicKey : legacyKey;
    if (!key) return;
    router.registerProvider(new AiSdkAnthropicProvider({ apiKey: key }));
  } else if (valid.activeProvider === "google") {
    const key = isNonEmptyKey(valid.googleKey) ? valid.googleKey : legacyKey;
    if (!key) return;
    router.registerProvider(new AiSdkGoogleProvider({ apiKey: key }));
  } else if (valid.activeProvider === "deepseek") {
    const key = isNonEmptyKey(valid.deepseekKey) ? valid.deepseekKey : legacyKey;
    if (!key) return;
    const base = isNonEmptyKey(valid.deepseekBaseURL) ? valid.deepseekBaseURL : legacyBase;
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "deepseek",
        apiKey: key,
        ...(base ? { baseURL: base } : {}),
      })
    );
  } else if (valid.activeProvider === "ollama") {
    const base = isNonEmptyKey(valid.ollamaBaseURL)
      ? valid.ollamaBaseURL
      : (legacyBase ?? OLLAMA_DEFAULT_BASE_URL);
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "ollama",
        apiKey: "ollama",
        baseURL: base,
      })
    );
  }
  // mock: nada que registrar (MockProvider siempre presente vía setup/ctor).
}

/**
 * Registra proveedores reales y BYOK en el ModelRouter (INT-02 + AI SDK adapters).
 */
export function setupModelProviders(router: ModelRouter, extraKeys: ResolvedModelKeys = {}): void {
  // 1. Bootstrap env documentado (INT-02 stop-condition) + keys persistidas (BYOK UI).
  const keys = mergeModelKeys(resolveEnvModelKeys(), extraKeys);

  // 2. OpenAI (BYOK vía key presente; legacy solo para custom baseUrl).
  if (isNonEmptyKey(keys.openai)) {
    registerOpenAIProvider(router, keys.openai, keys.openaiBaseURL);
  }

  // 3. Anthropic (Claude, formato nativo vía SDK).
  if (isNonEmptyKey(keys.anthropic)) {
    router.registerProvider(new AiSdkAnthropicProvider({ apiKey: keys.anthropic }));
  }

  // 4. Google (Gemini, formato nativo vía SDK).
  if (isNonEmptyKey(keys.google)) {
    router.registerProvider(new AiSdkGoogleProvider({ apiKey: keys.google }));
  }

  // 5. DeepSeek (BYOK vía key presente, OpenAI-compatible vía SDK).
  if (isNonEmptyKey(keys.deepseek)) {
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "deepseek",
        apiKey: keys.deepseek,
        ...(isNonEmptyKey(keys.deepseekBaseURL) ? { baseURL: keys.deepseekBaseURL } : {}),
      })
    );
  }

  // 6. Ollama (Local Offline por defecto; dummy key sin secreto real).
  router.registerProvider(
    new AiSdkOpenAICompatibleProvider({
      providerId: "ollama",
      apiKey: "ollama",
      baseURL: keys.ollamaBaseURL ?? OLLAMA_DEFAULT_BASE_URL,
    })
  );

  // 7. Mock siempre: fallback determinista sin keys ni red.
  router.registerProvider(new MockProvider());
}

/**
 * Escribe la configuración vigente (solo main). Sustituye la asignación
 * directa a `currentModelConfig` desde fuera del módulo.
 */
export function setCurrentModelConfig(config: ModelConfig): void {
  currentModelConfig = { ...config };
}
