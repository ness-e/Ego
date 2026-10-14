import type {
  EgoModelInterface,
  ModelCapability,
  ModelDescriptor,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelRole,
  ModelStreamChunk,
  PreferredModel,
} from "./types.js";
import { MockProvider } from "./providers/MockProvider.js";

export interface ModelRouterConfig {
  preferLocal?: boolean;
  maxCostPerCallUsd?: number;
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

  constructor(config: ModelRouterConfig = {}) {
    this.config = {
      preferLocal: false,
      maxCostPerCallUsd: 1.0,
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
   * Resuelve el mejor modelo disponible según el rol solicitado o capacidades.
   */
  public async resolveModel(
    role: ModelRole,
    requiredCapabilities: ModelCapability[] = ["text"],
    preferred?: PreferredModel
  ): Promise<ModelDescriptor> {
    // Preferencia explícita del usuario (2026-10-14: el picker/Ajustes elige
    // modelo real, no decorativo). Gana al binding por rol si resuelve.
    if (preferred?.modelId) {
      const wanted = preferred.modelId.trim();
      if (wanted.length > 0) {
        const registered = this.models.get(wanted);
        if (registered) {
          const provider = this.providers.get(registered.provider);
          if (
            provider &&
            (await provider.isAvailable()) &&
            requiredCapabilities.every((cap) => registered.capabilities.has(cap))
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
    const candidates = this.roleBindings.get(role) || [];

    for (const modelId of candidates) {
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
      const hasCaps = requiredCapabilities.every((cap) => desc.capabilities.has(cap));
      if (!hasCaps) continue;

      return desc;
    }

    // Fallback a cualquier modelo real disponible; mock solo como último recurso.
    // (Antes el mock ganaba por orden de registro aunque hubiera BYOK real.)
    for (const desc of this.models.values()) {
      if (desc.provider === "mock") continue;
      const provider = this.providers.get(desc.provider);
      if (provider && (await provider.isAvailable())) {
        return desc;
      }
    }
    for (const desc of this.models.values()) {
      const provider = this.providers.get(desc.provider);
      if (provider && (await provider.isAvailable())) {
        return desc;
      }
    }

    // Fallback absoluto a mock
    return this.models.get("mock-core")!;
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
   * del MISMO proveedor (acotado a `getPoolSize` intentos). Agotado el pool
   * (`null`) o ante error no-429, propaga al fallback mock del llamador.
   */
  private async attemptWithRotation(
    descriptor: ModelDescriptor,
    provider: EgoModelInterface,
    attempt: (active: EgoModelInterface) => Promise<ModelGenerateResult>
  ): Promise<ModelGenerateResult> {
    try {
      return this.applyCost(await attempt(provider), descriptor);
    } catch (err) {
      if (!this.isRotatable(descriptor.provider) || !isRateLimitError(err)) throw err;
      const pool = this.credentialPool as CredentialPoolReader;
      const factory = this.providerFactory as ModelProviderFactory;
      await pool.reportRateLimited(descriptor.provider);
      const maxAttempts = Math.max(pool.getPoolSize(descriptor.provider), 1);
      for (let i = 0; i < maxAttempts; i++) {
        const nextKey = await pool.getActiveKey(descriptor.provider);
        if (!nextKey) break; // pool agotado: fail-closed hacia el mock
        const fingerprint = pool.getActiveFingerprint(descriptor.provider) ?? "?";
        console.warn(
          `[ModelRouter] 429 en ${descriptor.provider} (key ${fingerprint}): rotando a siguiente key (${i + 1}/${maxAttempts}).`
        );
        const rotated = factory(descriptor.provider, nextKey);
        this.registerProvider(rotated);
        try {
          return this.applyCost(await attempt(rotated), descriptor);
        } catch (retryErr) {
          if (!isRateLimitError(retryErr)) throw retryErr;
          await pool.reportRateLimited(descriptor.provider);
        }
      }
      throw err;
    }
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
    const descriptor = await this.resolveModel(role, requiredCapabilities, preferredModel);
    const provider = this.providers.get(descriptor.provider)!;

    try {
      return await this.attemptWithRotation(descriptor, provider, (active) =>
        active.generate(descriptor.id, options)
      );
    } catch (err) {
      // Fallback a proveedor alternativo o mock si falla la llamada
      console.warn(`[ModelRouter] Fallo en ${descriptor.id}, intentando fallback a mock:`, err);
      const mockProvider = this.providers.get("mock")!;
      return mockProvider.generate("mock-core", options);
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
    const descriptor = await this.resolveModel(role, requiredCapabilities, preferredModel);
    const provider = this.providers.get(descriptor.provider)!;

    try {
      return await this.attemptWithRotation(descriptor, provider, (active) =>
        active.stream(descriptor.id, options, onChunk)
      );
    } catch (err) {
      console.warn(`[ModelRouter] Fallo en streaming de ${descriptor.id}, activando fallback:`, err);
      const mockProvider = this.providers.get("mock")!;
      return mockProvider.stream("mock-core", options, onChunk);
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
