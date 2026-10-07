import type {
  EgoModelInterface,
  ModelCapability,
  ModelDescriptor,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelRole,
  ModelStreamChunk,
} from "./types.js";
import { MockProvider } from "./providers/MockProvider.js";

export interface ModelRouterConfig {
  preferLocal?: boolean;
  maxCostPerCallUsd?: number;
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
   * Resuelve el mejor modelo disponible según el rol solicitado o capacidades.
   */
  public async resolveModel(
    role: ModelRole,
    requiredCapabilities: ModelCapability[] = ["text"]
  ): Promise<ModelDescriptor> {
    const candidates = this.roleBindings.get(role) || [];

    for (const modelId of candidates) {
      const desc = this.models.get(modelId);
      if (!desc) continue;

      const provider = this.providers.get(desc.provider);
      if (!provider) continue;

      // Verificar si el proveedor está listo (ej. API key configurada o servidor local activo)
      const available = await provider.isAvailable();
      if (!available) continue;

      // Verificar que cumple con todas las capacidades requeridas
      const hasCaps = requiredCapabilities.every((cap) => desc.capabilities.has(cap));
      if (!hasCaps) continue;

      return desc;
    }

    // Fallback a cualquier modelo mock o local disponible
    for (const desc of this.models.values()) {
      const provider = this.providers.get(desc.provider);
      if (provider && (await provider.isAvailable())) {
        return desc;
      }
    }

    // Fallback absoluto a mock
    return this.models.get("mock-core")!;
  }

  /**
   * Generación de texto estructurada con fallback en cascada.
   */
  async generateText(
    role: ModelRole,
    options: ModelGenerateOptions,
    requiredCapabilities?: ModelCapability[]
  ): Promise<ModelGenerateResult> {
    const descriptor = await this.resolveModel(role, requiredCapabilities);
    const provider = this.providers.get(descriptor.provider)!;

    try {
      const res = await provider.generate(descriptor.id, options);
      // Calcular coste real estimado según tarifas del descriptor
      res.usage.estimatedCostUsd =
        res.usage.promptTokens * descriptor.costPerInputTokenUsd +
        res.usage.completionTokens * descriptor.costPerOutputTokenUsd;
      return res;
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
    requiredCapabilities?: ModelCapability[]
  ): Promise<ModelGenerateResult> {
    const descriptor = await this.resolveModel(role, requiredCapabilities);
    const provider = this.providers.get(descriptor.provider)!;

    try {
      const res = await provider.stream(descriptor.id, options, onChunk);
      res.usage.estimatedCostUsd =
        res.usage.promptTokens * descriptor.costPerInputTokenUsd +
        res.usage.completionTokens * descriptor.costPerOutputTokenUsd;
      return res;
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

    // Asignación de candidatos prioritarios por rol
    this.bindRole("fast-classifier", ["llama3.2:3b", "gpt-4o", "mock-core"]);
    this.bindRole("reasoning-heavy", ["claude-3-5-sonnet-20241022", "gpt-4o", "mock-core"]);
    this.bindRole("coder", ["claude-3-5-sonnet-20241022", "gpt-4o", "mock-core"]);
    this.bindRole("general-chat", ["gpt-4o", "claude-3-5-sonnet-20241022", "llama3.2:3b", "mock-core"]);
  }
}
