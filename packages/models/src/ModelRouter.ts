import type {
  EgoModelInterface,
  ModelCapability,
  ModelDescriptor,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelRequestProfile,
  ModelRole,
  ModelStreamChunk,
  PreferredModel,
  ReasoningEffort,
} from "./types.js";
import { MockProvider } from "./providers/MockProvider.js";

export interface ModelRouterConfig {
  preferLocal?: boolean;
  maxCostPerCallUsd?: number;
  /** Base del backoff exponencial ante 429 (ms). */
  backoffBaseDelayMs?: number;
  /** Tope del backoff exponencial ante 429 (ms). */
  backoffMaxDelayMs?: number;
  /** Proporción de jitter aplicado al delay (0 = determinista, 1 = hasta -100 %). */
  backoffJitterRatio?: number;
}

/**
 * Error tipado: la llamada superaría el presupuesto de coste configurado y
 * no existe un modelo más barato que cumpla las capacidades exigidas.
 */
export class ModelCostBudgetExceededError extends Error {
  public readonly modelId: string;
  public readonly estimatedCostUsd: number;
  public readonly budgetUsd: number;

  constructor(modelId: string, estimatedCostUsd: number, budgetUsd: number) {
    super(
      `Model cost budget exceeded: '${modelId}' estimated $${estimatedCostUsd.toFixed(6)} ` +
        `> budget $${budgetUsd.toFixed(6)}`
    );
    this.name = "ModelCostBudgetExceededError";
    this.modelId = modelId;
    this.estimatedCostUsd = estimatedCostUsd;
    this.budgetUsd = budgetUsd;
  }
}

/** Opciones del cálculo de backoff exponencial con jitter. */
export interface BackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  /** Fuente de aleatoriedad (inyectable para tests deterministas). */
  random?: () => number;
}

/**
 * Calcula el delay del backoff exponencial con jitter (EGO-FIND-37).
 *
 * `delay = min(base * 2^(attempt-1), max) * (1 - jitterRatio * random())`
 * ⇒ el resultado vive en `[delay*(1-jitterRatio), delay]`.
 */
export function computeBackoffDelayMs(attempt: number, options: BackoffOptions): number {
  const base = Math.max(0, options.baseDelayMs);
  const max = Math.max(base, options.maxDelayMs);
  const jitterRatio = Math.min(1, Math.max(0, options.jitterRatio));
  const exp = Math.max(1, Math.floor(attempt));
  const raw = base * Math.pow(2, exp - 1);
  const capped = Math.min(raw, max);
  const random = options.random ?? Math.random;
  const jitter = 1 - jitterRatio * random();
  return Math.max(0, Math.round(capped * jitter));
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Complejidad estimada de una petición (EGO-FIND-39). */
export interface RequestComplexity {
  /** Puntuación 0..1. */
  score: number;
  tier: "simple" | "moderate" | "complex";
  multimodal: boolean;
}

const COMPLEXITY_TOKEN_SATURATION = 120_000;
const COMPLEXITY_FILE_SATURATION = 20;

/**
 * Puntúa la complejidad de una petición a partir del perfil declarado por el
 * caller. Determinista y sin red: sólo depende del perfil.
 */
export function scoreRequestComplexity(profile?: ModelRequestProfile): RequestComplexity {
  const tokens = Math.max(0, profile?.estimatedInputTokens ?? 0);
  const files = Math.max(0, profile?.fileCount ?? 0);
  const multimodal = profile?.multimodal === true;

  const tokenScore = Math.min(1, tokens / COMPLEXITY_TOKEN_SATURATION);
  const fileScore = Math.min(1, files / COMPLEXITY_FILE_SATURATION);
  const multiScore = multimodal ? 1 : 0;
  const score = Math.min(1, tokenScore * 0.5 + fileScore * 0.3 + multiScore * 0.2);
  const tier: RequestComplexity["tier"] =
    score >= 0.6 ? "complex" : score >= 0.25 ? "moderate" : "simple";

  return { score, tier, multimodal };
}

/** Tokens de salida estimados cuando el caller no fija `maxTokens`. */
const DEFAULT_ESTIMATED_OUTPUT_TOKENS = 1024;

/** Estimación grosera de tokens de entrada (4 caracteres ≈ 1 token). */
function estimateInputTokens(options: ModelGenerateOptions): number {
  const declared = options.profile?.estimatedInputTokens;
  if (typeof declared === "number" && Number.isFinite(declared)) return Math.max(0, declared);
  let chars = 0;
  for (const m of options.messages) chars += m.content?.length ?? 0;
  return Math.ceil(chars / 4);
}

/**
 * Coste estimado (USD) de una llamada con el descriptor dado.
 * `maxCostPerCallUsd` se compara contra este valor.
 */
export function estimateCallCostUsd(
  descriptor: ModelDescriptor,
  options: ModelGenerateOptions
): number {
  const inputTokens = estimateInputTokens(options);
  const outputTokens = Math.max(0, options.maxTokens ?? DEFAULT_ESTIMATED_OUTPUT_TOKENS);
  return (
    inputTokens * descriptor.costPerInputTokenUsd +
    outputTokens * descriptor.costPerOutputTokenUsd
  );
}

/**
 * Superficie lectora mínima del pool de credenciales (T21). El router NO
 * importa `@ego/security` (DIP): cualquier pool que cumpla este contrato
 * estructural sirve, incluido `CredentialPool` del main process. Solo
 * fingerprints opacos en logs — nunca keys.
 */
export interface CredentialPoolReader {
  getPoolSize(provider: ModelProviderId): number;
  getActiveKey(provider: ModelProviderId): Promise<string | null>;
  getActiveFingerprint(provider: ModelProviderId): string | null;
  reportRateLimited(provider: ModelProviderId): Promise<void>;
}

/** Reconstruye el provider de un id con una key rotada (inyectada por main). */
export type ModelProviderFactory = (
  provider: ModelProviderId,
  apiKey: string
) => EgoModelInterface;

/** 429/rate-limit en mensajes de error de providers (forma `Error HTTP <status>`). */
const RATE_LIMIT_PATTERN = /\b429\b|rate.?limit|too many requests|quota exceeded/i;

export function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return RATE_LIMIT_PATTERN.test(message);
}

/**
 * Error de cancelación cooperativa (CFG-10, espejo de
 * `ToolExecutionLoop.isAbortError`). Local a models a propósito (DIP: el
 * runtime depende del router, nunca al revés).
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    const msg = err.message.toLowerCase();
    if (msg.includes("aborted") || msg.includes("operation was aborted")) return true;
  }
  return false;
}

/**
 * Reasoning effort + aliases + review model (CFG-04).
 * Decisión: `fast` = barato (clase haiku/mini — planner delega a hijos
 * baratos), `smart` = frontier (clase opus/sonnet — planner frontier).
 */
export type EffortLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

export type ModelAliasName = "fast" | "smart";

export interface ModelAliasMap {
  fast?: string;
  smart?: string;
}

/** Defaults CFG-04: barato local vs frontier cloud. */
export const DEFAULT_MODEL_ALIASES: Required<ModelAliasMap> = {
  fast: "llama3.2:3b",
  smart: "claude-3-5-sonnet-20241022",
};

export const DEFAULT_FALLBACK_MODEL_ID = "mock-core";

/**
 * effort → params de provider (CFG-04). `medium` = sin override
 * (conducta legacy intacta: las opciones explícitas siempre ganan).
 */
export function effortProviderParams(level: EffortLevel): {
  maxTokens?: number;
  temperature?: number;
} {
  switch (level) {
    case "minimal":
      return { maxTokens: 256, temperature: 0 };
    case "low":
      return { maxTokens: 1024, temperature: 0.2 };
    case "medium":
      return {};
    case "high":
      return { maxTokens: 4096, temperature: 0.5 };
    case "xhigh":
      return { maxTokens: 8192, temperature: 0.7 };
  }
}

/**
 * Subconjunto de `ModelConfig` (Zod, desktop) que el router entiende.
 * Estructural a propósito (DIP): el router NO importa `@ego/desktop`.
 */
export interface RouterModelSettings {
  effortLevel?: EffortLevel;
  /** STAB-06: mapea a `effortLevel` solo si este está ausente. */
  reasoningEffort?: ReasoningEffort;
  modelAliases?: ModelAliasMap;
  reviewModel?: string;
  availableModels?: string[];
  fallbackModel?: string;
}

/**
 * Mapea `reasoningEffort` (3 niveles provider) a `EffortLevel` (5 niveles
 * internos). Identidad en el subconjunto común.
 */
export function reasoningEffortToEffortLevel(level: ReasoningEffort): EffortLevel {
  return level;
}

/**
 * ModelRouter canónico de Ego (CORE-03).
 * Enrutamiento inteligente multi-proveedor desacoplado, con fallbacks automáticos,
 * conciencia de costos, roles funcionales y soporte Cloud + Local Offline.
 */
export class ModelRouter {
  private providers: Map<ModelProviderId, EgoModelInterface> = new Map();
  private models: Map<string, ModelDescriptor> = new Map();
  private roleBindings: Map<ModelRole, string[]> = new Map();
  private config: ModelRouterConfig;
  private credentialPool: CredentialPoolReader | null = null;
  private providerFactory: ModelProviderFactory | null = null;
  /** CFG-04: aliases semánticos, effort, cadena de fallback y review model. */
  private aliases: ModelAliasMap = {};
  private effortLevel: EffortLevel = "medium";
  private availableModelIds: string[] = [];
  private fallbackModelId: string = DEFAULT_FALLBACK_MODEL_ID;
  private reviewModelId: string | undefined = undefined;

  constructor(config: ModelRouterConfig = {}) {
    this.config = {
      preferLocal: false,
      maxCostPerCallUsd: 1.0,
      backoffBaseDelayMs: 200,
      backoffMaxDelayMs: 5000,
      backoffJitterRatio: 0.25,
      ...config,
    };

    // Registrar proveedor Mock por defecto para pruebas y resiliencia
    this.registerProvider(new MockProvider());
    this.registerDefaultModels();
  }

  public get routerConfig(): ModelRouterConfig {
    return this.config;
  }

  public registerProvider(provider: EgoModelInterface): void {
    this.providers.set(provider.providerId, provider);
  }

  public registerModel(descriptor: ModelDescriptor): void {
    this.models.set(descriptor.id, descriptor);
  }

  public bindRole(role: ModelRole, modelIds: string[]): void {
    this.roleBindings.set(role, modelIds);
  }

  /**
   * Conecta el pool multi-key (T21). Sin pool, la conducta es la legacy:
   * ante cualquier error se cae directo al mock.
   */
  public attachCredentialPool(pool: CredentialPoolReader, factory: ModelProviderFactory): void {
    this.credentialPool = pool;
    this.providerFactory = factory;
  }

  public detachCredentialPool(): void {
    this.credentialPool = null;
    this.providerFactory = null;
  }

  /**
   * CFG-04: aliases `fast`/`smart` → id de modelo real.
   * Sin override, `fast` = barato local y `smart` = frontier cloud.
   */
  public setAliases(aliases: ModelAliasMap): void {
    this.aliases = { ...aliases };
  }

  public getAliases(): Required<ModelAliasMap> {
    return {
      fast: this.aliases.fast ?? DEFAULT_MODEL_ALIASES.fast,
      smart: this.aliases.smart ?? DEFAULT_MODEL_ALIASES.smart,
    };
  }

  public resolveAlias(name: ModelAliasName): string {
    return this.aliases[name] ?? DEFAULT_MODEL_ALIASES[name];
  }

  /** Resuelve alias (`fast`/`smart`) o devuelve el id tal cual. */
  public resolveModelIdOrAlias(idOrAlias: string): string {
    const t = idOrAlias.trim();
    if (t === "fast" || t === "smart") return this.resolveAlias(t);
    return t;
  }

  /** CFG-04: effort global del router (default `medium` = sin override). */
  public setEffortLevel(level: EffortLevel): void {
    this.effortLevel = level;
  }

  public getEffortLevel(): EffortLevel {
    return this.effortLevel;
  }

  /**
   * Aplica effort a las opciones: los params de effort van por debajo de
   * los valores explícitos del llamador (nunca los pisan).
   */
  public applyEffort(options: ModelGenerateOptions, level: EffortLevel = this.effortLevel): ModelGenerateOptions {
    const params = effortProviderParams(level);
    return {
      ...options,
      ...(params.maxTokens !== undefined && options.maxTokens === undefined
        ? { maxTokens: params.maxTokens }
        : {}),
      ...(params.temperature !== undefined && options.temperature === undefined
        ? { temperature: params.temperature }
        : {}),
    };
  }

  /**
   * STAB-06: aplica el tuning del `PreferredModel` por debajo de las
   * opciones explícitas y por encima de los defaults de effort.
   * Precedencia: explícito > preferido > effort > default del provider.
   */
  public applyPreferredTuning(
    options: ModelGenerateOptions,
    preferred?: PreferredModel
  ): ModelGenerateOptions {
    if (!preferred) return { ...options };
    return {
      ...options,
      ...(preferred.temperature !== undefined && options.temperature === undefined
        ? { temperature: preferred.temperature }
        : {}),
      ...(preferred.reasoningEffort !== undefined && options.reasoningEffort === undefined
        ? { reasoningEffort: preferred.reasoningEffort }
        : {}),
    };
  }

  /** CFG-04: cadena de fallback ordenada (ids o aliases) tras el primario. */
  public setAvailableModels(ids: string[]): void {
    this.availableModelIds = [...ids];
  }

  public getAvailableModels(): string[] {
    return [...this.availableModelIds];
  }

  /** CFG-04: último recurso antes del mock (default `mock-core`). */
  public setFallbackModel(id: string): void {
    this.fallbackModelId = id;
  }

  public getFallbackModel(): string {
    return this.fallbackModelId;
  }

  /** CFG-04: modelo de revisión (default: alias `smart`). */
  public setReviewModel(id: string | undefined): void {
    this.reviewModelId = id?.trim() ? id.trim() : undefined;
  }

  public getReviewModel(): string {
    return this.reviewModelId ?? this.resolveAlias("smart");
  }

  /** Resuelve el review model a descriptor (review → smart → mock). */
  public async resolveReviewModel(
    requiredCapabilities: ModelCapability[] = ["text"]
  ): Promise<ModelDescriptor> {
    for (const id of [this.getReviewModel(), this.resolveAlias("smart")]) {
      const found = await this.lookupAvailable(this.resolveModelIdOrAlias(id), requiredCapabilities);
      if (found) return found.descriptor;
    }
    return this.models.get("mock-core")!;
  }

  /**
   * Aplica `RouterModelSettings` (shape de `ModelConfig` desktop) al router.
   * Glue futura para `applyModelConfig` en main (sin dependencia a desktop).
   */
  public configureFromSettings(settings: RouterModelSettings): void {
    if (settings.effortLevel !== undefined) {
      this.setEffortLevel(settings.effortLevel);
    } else if (settings.reasoningEffort !== undefined) {
      this.setEffortLevel(reasoningEffortToEffortLevel(settings.reasoningEffort));
    }
    if (settings.modelAliases !== undefined) this.setAliases(settings.modelAliases);
    if (settings.reviewModel !== undefined) this.setReviewModel(settings.reviewModel || undefined);
    if (settings.availableModels !== undefined) this.setAvailableModels(settings.availableModels);
    if (settings.fallbackModel !== undefined && settings.fallbackModel.trim()) {
      this.setFallbackModel(settings.fallbackModel.trim());
    }
  }

  /**
   * Resuelve el mejor modelo disponible según el rol solicitado o capacidades.
   *
   * @param profile Perfil de complejidad (opcional). Cuando se aporta, el
   *   router (a) infiere la capability `vision` si el request es multimodal y
   *   (b) prefiere el alias `fast` (perfil simple) o `smart` (perfil complejo).
   *   Sin perfil, la conducta es la del binding por rol puro.
   */
  public async resolveModel(
    role: ModelRole,
    requiredCapabilities: ModelCapability[] = ["text"],
    preferred?: PreferredModel,
    profile?: ModelRequestProfile
  ): Promise<ModelDescriptor> {
    const complexity = scoreRequestComplexity(profile);
    const effectiveCaps: ModelCapability[] = [...requiredCapabilities];
    if (complexity.multimodal && !effectiveCaps.includes("vision")) {
      effectiveCaps.push("vision");
    }
    // Sin perfil no se infiere `vision` (el caller legacy no lo declara).
    const caps = profile === undefined ? [...requiredCapabilities] : effectiveCaps;

    // Preferencia explícita del usuario (2026-10-14: el picker/Ajustes elige
    // modelo real, no decorativo). Gana al binding por rol si resuelve.
    if (preferred?.modelId) {
      const wanted = this.resolveModelIdOrAlias(preferred.modelId);
      if (wanted.length > 0) {
        const registered = this.models.get(wanted);
        if (registered) {
          const provider = this.providers.get(registered.provider);
          if (
            provider &&
            (await provider.isAvailable()) &&
            caps.every((cap) => registered.capabilities.has(cap))
          ) {
            return registered;
          }
        }
        if (preferred.providerId && preferred.providerId !== "mock") {
          const provider = this.providers.get(preferred.providerId);
          if (provider && (await provider.isAvailable())) {
            return {
              id: wanted,
              provider: preferred.providerId,
              displayName: `${wanted} (personalizado)`,
              contextWindow: 0,
              costPerInputTokenUsd: 0,
              costPerOutputTokenUsd: 0,
              capabilities: new Set<ModelCapability>(["text", "tool_calling", "streaming"]),
              isLocal: preferred.providerId === "ollama",
            };
          }
        }
      }
    }
    const candidates = this.buildCandidateIds(role, profile, complexity);

    for (const rawId of candidates) {
      // CFG-04: los bindings pueden contener aliases (`fast`/`smart`).
      const modelId = this.resolveModelIdOrAlias(rawId);
      const desc = this.models.get(modelId);
      if (!desc) continue;

      const provider = this.providers.get(desc.provider);
      if (!provider) {
        // M04: salto explícito con warn — un candidato que referencia un
        // provider no registrado indica mala configuración, no se silencia.
        console.warn(
          `[ModelRouter] Modelo candidato '${modelId}' referencia provider no registrado '${desc.provider}'; se omite.`
        );
        continue;
      }

      // Verificar si el proveedor está listo (ej. API key configurada o servidor local activo)
      const available = await provider.isAvailable();
      if (!available) continue;

      // Verificar que cumple con todas las capacidades requeridas
      const hasCaps = caps.every((cap) => desc.capabilities.has(cap));
      if (!hasCaps) continue;

      return desc;
    }

    // Fallback a cualquier modelo real disponible; mock solo como último recurso.
    // (Antes el mock ganaba por orden de registro aunque hubiera BYOK real.)
    // EGO-FIND-38: el fallback TAMBIÉN respeta `requiredCapabilities`: un modelo
    // sin `tool_calling` no puede atender una petición que lo exige.
    for (const desc of this.models.values()) {
      if (desc.provider === "mock") continue;
      if (!caps.every((cap) => desc.capabilities.has(cap))) continue;
      const provider = this.providers.get(desc.provider);
      if (provider && (await provider.isAvailable())) {
        return desc;
      }
    }
    for (const desc of this.models.values()) {
      if (!caps.every((cap) => desc.capabilities.has(cap))) continue;
      const provider = this.providers.get(desc.provider);
      if (provider && (await provider.isAvailable())) {
        return desc;
      }
    }

    // Fallback absoluto a mock
    return this.models.get("mock-core")!;
  }

  /**
   * Construye la lista ordenada de candidatos para un rol.
   * Con perfil de complejidad, el alias `fast`/`smart` encabeza la lista
   * según el tier calculado; sin perfil, es el binding por rol puro.
   */
  private buildCandidateIds(
    role: ModelRole,
    profile: ModelRequestProfile | undefined,
    complexity: RequestComplexity
  ): string[] {
    const bound = this.roleBindings.get(role) ?? [];
    if (profile === undefined) return [...bound];
    if (complexity.tier === "simple") {
      return [this.resolveAlias("fast"), ...bound];
    }
    if (complexity.tier === "complex") {
      return [this.resolveAlias("smart"), ...bound];
    }
    return [...bound];
  }

  /**
   * EGO-FIND-39: hace cumplir `maxCostPerCallUsd`.
   * Si el modelo resuelto excede el presupuesto, degrada al modelo real más
   * barato que cumpla las capacidades exigidas. El mock NO es destino de
   * degradación por coste (devolvería una respuesta ficticia al usuario).
   */
  private async enforceCostBudget(
    descriptor: ModelDescriptor,
    options: ModelGenerateOptions,
    requiredCapabilities: ModelCapability[]
  ): Promise<ModelDescriptor> {
    const budget = this.config.maxCostPerCallUsd;
    if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) {
      return descriptor;
    }

    const estimated = estimateCallCostUsd(descriptor, options);
    if (estimated <= budget) return descriptor;

    let best: ModelDescriptor | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const candidate of this.models.values()) {
      if (candidate.id === descriptor.id) continue;
      if (candidate.provider === "mock") continue;
      if (!requiredCapabilities.every((cap) => candidate.capabilities.has(cap))) continue;
      const provider = this.providers.get(candidate.provider);
      if (!provider) continue;
      if (!(await provider.isAvailable())) continue;
      const cost = estimateCallCostUsd(candidate, options);
      if (cost <= budget && cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
    }

    if (best) {
      console.warn(
        `[ModelRouter] Coste estimado de '${descriptor.id}' ($${estimated.toFixed(6)}) excede el ` +
          `presupuesto ($${budget.toFixed(6)}); se degrada a '${best.id}' ($${bestCost.toFixed(6)}).`
      );
      return best;
    }

    throw new ModelCostBudgetExceededError(descriptor.id, estimated, budget);
  }

  private applyCost(res: ModelGenerateResult, descriptor: ModelDescriptor): ModelGenerateResult {
    // Coste real estimado según tarifas del descriptor
    res.usage.estimatedCostUsd =
      res.usage.promptTokens * descriptor.costPerInputTokenUsd +
      res.usage.completionTokens * descriptor.costPerOutputTokenUsd;
    return res;
  }

  private isRotatable(provider: ModelProviderId): boolean {
    // mock/ollama no tienen secreto que rotar; sin pool/factory no hay a dónde rotar
    return (
      provider !== "mock" &&
      provider !== "ollama" &&
      this.credentialPool !== null &&
      this.providerFactory !== null
    );
  }

  /**
   * Ejecuta el intento contra el provider con rotación del pool (T21):
   * ante 429/rate-limit castiga la key activa y reintenta con la siguiente
   * del MISMO proveedor (acotado a `getPoolSize` intentos).
   *
   * EGO-FIND-37: entre rotaciones se aplica un backoff exponencial con
   * jitter, y NUNCA se reintenta una credencial ya intentada (el pool puede
   * devolver la misma key si está atascado: repetirla sólo reproduce el 429).
   * Agotado el pool (`null`), sin credencial nueva o ante error no-429,
   * propaga al fallback mock del llamador.
   */
  private async attemptWithRotation(
    descriptor: ModelDescriptor,
    provider: EgoModelInterface,
    attempt: (active: EgoModelInterface) => Promise<ModelGenerateResult>
  ): Promise<ModelGenerateResult> {
    const rotatable = this.isRotatable(descriptor.provider);
    const pool = this.credentialPool;
    const factory = this.providerFactory;

    // Credenciales ya intentadas (por fingerprint opaco; nunca la key).
    const triedFingerprints = new Set<string>();
    if (rotatable && pool) {
      const initial = pool.getActiveFingerprint(descriptor.provider);
      if (initial) triedFingerprints.add(initial);
    }

    let active = provider;
    let attemptIndex = 0;

    for (;;) {
      try {
        return this.applyCost(await attempt(active), descriptor);
      } catch (err) {
        if (!rotatable || !isRateLimitError(err)) throw err;
        if (!pool || !factory) throw err;

        const maxAttempts = Math.max(pool.getPoolSize(descriptor.provider), 1);
        if (attemptIndex >= maxAttempts) throw err;

        // El pool penaliza la credencial activa y expone la siguiente.
        await pool.reportRateLimited(descriptor.provider);

        const nextKey = await pool.getActiveKey(descriptor.provider);
        if (!nextKey) throw err; // pool agotado: fail-closed hacia el mock

        const nextFingerprint = pool.getActiveFingerprint(descriptor.provider) ?? "";
        if (nextFingerprint && triedFingerprints.has(nextFingerprint)) {
          // La rotación no aportó una credencial nueva: repetir la misma
          // key sólo reproduce el 429.
          console.warn(
            `[ModelRouter] 429 en ${descriptor.provider}: el pool no entregó una credencial nueva; no se reintenta.`
          );
          throw err;
        }
        if (nextFingerprint) triedFingerprints.add(nextFingerprint);

        const delayMs = computeBackoffDelayMs(attemptIndex + 1, {
          baseDelayMs: this.config.backoffBaseDelayMs ?? 200,
          maxDelayMs: this.config.backoffMaxDelayMs ?? 5000,
          jitterRatio: this.config.backoffJitterRatio ?? 0.25,
        });
        if (delayMs > 0) await sleep(delayMs);

        console.warn(
          `[ModelRouter] 429 en ${descriptor.provider} (key ${nextFingerprint || "?"}): ` +
            `rotando a siguiente key (${attemptIndex + 1}/${maxAttempts}) tras ${delayMs}ms de backoff.`
        );
        active = factory(descriptor.provider, nextKey);
        this.registerProvider(active);
        attemptIndex++;
      }
    }
  }

  /**
   * CFG-04: lookup de un id (o alias) a descriptor disponible con las
   * capabilities exigidas. `null` = no usable (siguiente en la cadena).
   */
  private async lookupAvailable(
    idOrAlias: string,
    requiredCapabilities: ModelCapability[]
  ): Promise<{ descriptor: ModelDescriptor; provider: EgoModelInterface } | null> {
    const id = this.resolveModelIdOrAlias(idOrAlias);
    const descriptor = this.models.get(id);
    if (!descriptor) return null;
    const provider = this.providers.get(descriptor.provider);
    if (!provider) return null;
    if (!(await provider.isAvailable())) return null;
    if (!requiredCapabilities.every((cap) => descriptor.capabilities.has(cap))) return null;
    return { descriptor, provider };
  }

  /**
   * CFG-04: fallback en cascada `availableModels → fallbackModel → mock`.
   * Cada eslabón se intenta con rotación de pool; el que falla se salta
   * con warn (nunca se aborta la cadena por un eslabón caído).
   */
  private async runFallbackChain(
    failedId: string,
    options: ModelGenerateOptions,
    requiredCapabilities: ModelCapability[],
    stream: false,
    onChunk?: undefined
  ): Promise<ModelGenerateResult>;
  private async runFallbackChain(
    failedId: string,
    options: ModelGenerateOptions,
    requiredCapabilities: ModelCapability[],
    stream: true,
    onChunk: (chunk: ModelStreamChunk) => void
  ): Promise<ModelGenerateResult>;
  private async runFallbackChain(
    failedId: string,
    options: ModelGenerateOptions,
    requiredCapabilities: ModelCapability[],
    stream: boolean,
    onChunk?: (chunk: ModelStreamChunk) => void
  ): Promise<ModelGenerateResult> {
    // CFG-10: turno ya abortado → ni un eslabón ni el mock se desperdician.
    if (options.abortSignal?.aborted) {
      throw new DOMException("This operation was aborted", "AbortError");
    }
    const tried = new Set([this.resolveModelIdOrAlias(failedId)]);
    const chain = [
      ...this.availableModelIds,
      this.fallbackModelId,
    ];
    for (const rawId of chain) {
      const id = this.resolveModelIdOrAlias(rawId);
      if (tried.has(id)) continue;
      tried.add(id);
      const found = await this.lookupAvailable(id, requiredCapabilities);
      if (!found) continue;
      try {
        if (stream) {
          return await this.attemptWithRotation(found.descriptor, found.provider, (active) =>
            active.stream(found.descriptor.id, options, onChunk!)
          );
        }
        return await this.attemptWithRotation(found.descriptor, found.provider, (active) =>
          active.generate(found.descriptor.id, options)
        );
      } catch (err) {
        // CFG-10: abort durante la cadena → corta sin mock fantasma.
        if (options.abortSignal?.aborted || isAbortError(err)) throw err;
        console.warn(`[ModelRouter] Eslabón de fallback '${id}' falló, sigue la cadena:`, err);
      }
    }
    // CFG-10: abort durante la cadena → sin mock fantasma.
    if (options.abortSignal?.aborted) {
      throw new DOMException("This operation was aborted", "AbortError");
    }
    // Fallback absoluto a mock (conducta legacy).
    console.warn(`[ModelRouter] Cadena de fallback agotada tras '${failedId}', último recurso a mock.`);
    const mockProvider = this.providers.get("mock")!;
    return stream
      ? mockProvider.stream("mock-core", options, onChunk!)
      : mockProvider.generate("mock-core", options);
  }

  /**
   * Generación de texto estructurada con fallback en cascada.
   */
  async generateText(
    role: ModelRole,
    options: ModelGenerateOptions,
    requiredCapabilities?: ModelCapability[],
    preferredModel?: PreferredModel
  ): Promise<ModelGenerateResult> {
    const caps = requiredCapabilities ?? ["text"];
    const effective = this.applyEffort(this.applyPreferredTuning(options, preferredModel));
    const resolved = await this.resolveModel(role, caps, preferredModel, options.profile);
    // EGO-FIND-39: el presupuesto de coste se hace cumplir ANTES de llamar.
    const descriptor = await this.enforceCostBudget(resolved, effective, caps);
    const provider = this.providers.get(descriptor.provider)!;

    try {
      return await this.attemptWithRotation(descriptor, provider, (active) =>
        active.generate(descriptor.id, effective)
      );
    } catch (err) {
      // CFG-10: abort mid-token → re-throw inmediato, sin cadena fallback→mock.
      if (effective.abortSignal?.aborted || isAbortError(err)) throw err;
      // El presupuesto de coste es una decisión explícita del owner: no se
      // degrada silenciosamente al mock saltándose la política.
      if (err instanceof ModelCostBudgetExceededError) throw err;
      // Fallback a la cadena CFG-04 (availableModels → fallbackModel → mock).
      console.warn(`[ModelRouter] Fallo en ${descriptor.id}, intentando cadena de fallback:`, err);
      return this.runFallbackChain(descriptor.id, effective, caps, false);
    }
  }

  /**
   * Streaming de texto con despacho de chunks y fallback resiliente.
   */
  async streamText(
    role: ModelRole,
    options: ModelGenerateOptions,
    onChunk: (chunk: ModelStreamChunk) => void,
    requiredCapabilities?: ModelCapability[],
    preferredModel?: PreferredModel
  ): Promise<ModelGenerateResult> {
    const caps = requiredCapabilities ?? ["text"];
    const effective = this.applyEffort(this.applyPreferredTuning(options, preferredModel));
    const resolved = await this.resolveModel(role, caps, preferredModel, options.profile);
    const descriptor = await this.enforceCostBudget(resolved, effective, caps);
    const provider = this.providers.get(descriptor.provider)!;

    try {
      return await this.attemptWithRotation(descriptor, provider, (active) =>
        active.stream(descriptor.id, effective, onChunk)
      );
    } catch (err) {
      // CFG-10: abort mid-token → re-throw inmediato, sin cadena fallback→mock.
      if (effective.abortSignal?.aborted || isAbortError(err)) throw err;
      if (err instanceof ModelCostBudgetExceededError) throw err;
      console.warn(`[ModelRouter] Fallo en streaming de ${descriptor.id}, activando cadena de fallback:`, err);
      return this.runFallbackChain(descriptor.id, effective, caps, true, onChunk);
    }
  }

  private registerDefaultModels(): void {
    // 1. Modelo Mock Base
    this.registerModel({
      id: "mock-core",
      provider: "mock",
      displayName: "Ego Mock Engine (Offline/Test)",
      contextWindow: 32000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text", "streaming", "tool_calling", "structured_output"]),
      isLocal: true,
    });

    // 2. Claude 3.5 Sonnet (Cloud)
    this.registerModel({
      id: "claude-3-5-sonnet-20241022",
      provider: "anthropic",
      displayName: "Claude 3.5 Sonnet",
      contextWindow: 200000,
      costPerInputTokenUsd: 0.000003,
      costPerOutputTokenUsd: 0.000015,
      capabilities: new Set(["text", "vision", "tool_calling", "structured_output", "reasoning.high", "coding.high", "streaming"]),
      isLocal: false,
    });

    // 3. GPT-4o (Cloud)
    this.registerModel({
      id: "gpt-4o",
      provider: "openai",
      displayName: "OpenAI GPT-4o",
      contextWindow: 128000,
      costPerInputTokenUsd: 0.0000025,
      costPerOutputTokenUsd: 0.00001,
      capabilities: new Set(["text", "vision", "tool_calling", "structured_output", "coding.high", "streaming"]),
      isLocal: false,
    });

    // 4. Llama 3.2 3B (Local Offline via Ollama)
    this.registerModel({
      id: "llama3.2:3b",
      provider: "ollama",
      displayName: "Llama 3.2 3B (Local)",
      contextWindow: 128000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text", "tool_calling", "streaming", "classification.low"]),
      isLocal: true,
    });

    // 5. Gemini 3.8 Flash (Cloud via AI SDK @ai-sdk/google).
    // 2026-10-14: gemini-2.0-flash retirado por Google (404 NOT_FOUND; sugiere
    // gemini-3.8-flash, estable). Coste 0 pendiente de confirmación.
    this.registerModel({
      id: "gemini-3.8-flash",
      provider: "google",
      displayName: "Gemini 3.8 Flash",
      contextWindow: 1048576,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text", "vision", "tool_calling", "streaming"]),
      isLocal: false,
    });

    // 6. DeepSeek Chat (Cloud OpenAI-compatible, Task 8)
    // Coste 0 pendiente de confirmación contra registry (ver Task 4 notes).
    this.registerModel({
      id: "deepseek-chat",
      provider: "deepseek",
      displayName: "DeepSeek Chat",
      contextWindow: 64000,
      costPerInputTokenUsd: 0,
      costPerOutputTokenUsd: 0,
      capabilities: new Set(["text", "tool_calling", "streaming", "coding.high"]),
      isLocal: false,
    });

    // Asignación de candidatos prioritarios por rol.
    // gemini/deepseek van en los roles que sus capabilities cubren: sin key
    // registrada el router los salta igual que al resto (sin cambio de conducta).
    this.bindRole("fast-classifier", ["llama3.2:3b", "gpt-4o", "mock-core"]);
    this.bindRole("reasoning-heavy", ["claude-3-5-sonnet-20241022", "gpt-4o", "gemini-3.8-flash", "mock-core"]);
    this.bindRole("coder", ["claude-3-5-sonnet-20241022", "gpt-4o", "gemini-3.8-flash", "deepseek-chat", "mock-core"]);
    this.bindRole("general-chat", ["gpt-4o", "claude-3-5-sonnet-20241022", "gemini-3.8-flash", "deepseek-chat", "llama3.2:3b", "mock-core"]);
  }
}
