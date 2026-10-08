export type ModelCapability =
  | "text"
  | "vision"
  | "audio"
  | "tool_calling"
  | "structured_output"
  | "reasoning.high"
  | "coding.high"
  | "classification.low"
  | "streaming";

export type ModelProviderId = "anthropic" | "openai" | "google" | "ollama" | "mock";

export type ModelRole =
  | "fast-classifier"  // Triage rápido y bajo coste (<300ms)
  | "reasoning-heavy"  // Planificación compleja, auditoría y síntesis profunda
  | "coder"            // Generación y refactorización de código
  | "general-chat";    // Interacción general fluida con el usuario

export interface ModelDescriptor {
  id: string;                      // ej. "claude-3-5-sonnet-20241022", "gpt-4o", "llama3.2:3b"
  provider: ModelProviderId;
  displayName: string;
  contextWindow: number;           // Ventana máxima en tokens
  costPerInputTokenUsd: number;    // Coste por token de entrada
  costPerOutputTokenUsd: number;   // Coste por token de salida
  capabilities: Set<ModelCapability>;
  isLocal: boolean;                // true si corre local (Ollama / offline)
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ModelGenerateOptions {
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: "text" | "json";
  abortSignal?: AbortSignal;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  toolChoice?: "auto" | "none" | "required" | { name: string };
}

export interface ModelStreamChunk {
  type: "text-delta" | "reasoning-delta" | "error" | "finish";
  delta?: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelGenerateResult {
  text: string;
  finishReason: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

/**
 * Contrato canónico EgoModelInterface (CORE-03).
 * Abstracción propia que desacopla la arquitectura cognitiva de proveedores específicos.
 */
export interface EgoModelInterface {
  readonly providerId: ModelProviderId;
  isAvailable(): Promise<boolean>;
  generate(modelId: string, options: ModelGenerateOptions): Promise<ModelGenerateResult>;
  stream(
    modelId: string,
    options: ModelGenerateOptions,
    onChunk: (chunk: ModelStreamChunk) => void
  ): Promise<ModelGenerateResult>;
}
