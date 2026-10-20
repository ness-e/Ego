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

export type ModelProviderId = "anthropic" | "openai" | "deepseek" | "google" | "ollama" | "mock";

/**
 * Esfuerzo de razonamiento portable (STAB-06): subconjunto de `EffortLevel`
 * con mapeo 1:1 al parámetro `reasoning` de AI SDK v7
 * (`'low'|'medium'|'high'` — ver `ai` docs `26-reasoning.mdx`).
 */
export type ReasoningEffort = "low" | "medium" | "high";

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

/**
 * Modelo elegido explícitamente por el usuario (ModelPicker / Ajustes).
 * Si el id está registrado y disponible, gana al binding por rol; si no,
 * pero el proveedor está disponible, se construye un descriptor dinámico
 * (los providers AI SDK aceptan cualquier id válido de la API).
 */
export interface PreferredModel {
  modelId: string;
  providerId?: ModelProviderId;
  /** Temperatura por defecto del turno (0-2); las opciones explícitas ganan. */
  temperature?: number;
  /** Esfuerzo de razonamiento por defecto del turno. */
  reasoningEffort?: ReasoningEffort;
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
  /**
   * Procedencia del mensaje (EGO-FIND-60 / taint tracking).
   * `untrusted` marca contenido externo ya saneado: el prompt assembly debe
   * tratarlo como *data channel*, nunca como *control channel*.
   */
  trust?: MessageTrust;
}

/**
 * Nivel de confianza en la procedencia de un mensaje.
 * - `trusted`: generado por Ego (sistema, assistant, tool propia).
 * - `untrusted`: proviene de una fuente externa (documento, web, RAG de
 *   terceros). Puede haber pasado por `UntrustedContentSanitizer`, pero su
 *   contenido sigue sin ser capaz de alterar instrucciones.
 */
export type MessageTrust = "trusted" | "untrusted";

/**
 * Perfil de complejidad de una petición. Lo rellena el caller que conoce el
 * contexto real (tokens estimados, nº de ficheros, contenido multimodal) y
 * lo usa el router para elegir alias `fast`/`smart` y para inferir la
 * capability `vision` (EGO-FIND-39).
 */
export interface ModelRequestProfile {
  /** Tokens estimados de entrada. */
  estimatedInputTokens?: number;
  /** Número de ficheros/artefactos implica refactor amplio. */
  fileCount?: number;
  /** El request incluye contenido no textual (imagen/audio). */
  multimodal?: boolean;
}

export interface ModelGenerateOptions {
  messages: ModelMessage[];
  temperature?: number;
  /** Esfuerzo de razonamiento portable (AI SDK `reasoning` / `reasoning_effort`). */
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: "text" | "json";
  abortSignal?: AbortSignal;
  /** Perfil de complejidad para routing por coste/complejidad (EGO-FIND-39). */
  profile?: ModelRequestProfile;
  /**
   * Opciones específicas de proveedor, con la misma forma que el AI SDK:
   * `{ anthropic: { cacheControl: { type: "ephemeral" } } }` habilita el
   * prompt caching en Anthropic (EGO-FIND-40).
   */
  providerOptions?: Record<string, Record<string, unknown>>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  toolChoice?: "auto" | "none" | "required" | { name: string };
}

export interface ModelStreamChunk {
  type: "text-delta" | "reasoning-delta" | "tool-call-delta" | "error" | "finish";
  delta?: string;
  finishReason?: string;
  toolCallId?: string;
  toolName?: string;
  argsDelta?: string;
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
