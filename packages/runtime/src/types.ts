import type { ModelMessage, ModelRole, PreferredModel, ToolCall } from "@ego/models";
import type { ToolCategory, ToolExecutionContext, ToolRiskLevel } from "@ego/tools";
import type { ApprovalDecision } from "@ego/execution";

/**
 * Decisión de aprobación (HITL).
 * Fuente única: `@ego/execution` (F3T6/M01). Se re-exporta para
 * compatibilidad de importadores de `@ego/runtime`.
 */
export type { ApprovalDecision };

/**
 * Estado terminal o de suspensión del loop cognitivo de ejecución.
 */
export type LoopStatus =
  | "completed"          // El modelo emitió respuesta textual final (finishReason === 'stop')
  | "approval_required"  // Suspendido esperando resolución de aprobación humana (HITL)
  | "max_steps_exceeded" // Límite de pasos multi-turno alcanzado (evita bucles infinitos)
  | "aborted"            // Abortado cooperativamente mediante AbortSignal
  | "error";             // Error crítico no recuperable durante el ciclo

/**
 * Solicitud de aprobación humana (HITL) para herramientas sensibles o destructivas.
 */
export interface ApprovalRequest {
  approvalId: string;
  toolName: string;
  toolCategory: ToolCategory;
  riskLevel: ToolRiskLevel;
  arguments: Record<string, unknown>;
  callId: string;
  sessionId: string;
  subEgoId?: string;
  timestamp: number;
}

/**
 * Resultado de ejecución de una herramienta individual.
 */
export interface ToolExecutionResult {
  callId: string;
  toolName: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Evento emitido en cada transición de paso del loop para observabilidad y streaming.
 */
export interface LoopStepEvent {
  step: number;
  action:
    | "model_called"
    | "tools_requested"
    | "tool_executing"
    | "tool_executed"
    | "approval_requested"
    | "approval_resolved"
    | "completed";
  details?: Record<string, unknown>;
}

import type { ExecutionManager, ApprovalEngine } from "@ego/execution";
import type { EventBus } from "@ego/events";
import type { ErrorHandler } from "./ErrorHandler.js";

/**
 * Configuración para instanciar el ToolExecutionLoop.
 */
export interface ToolExecutionLoopConfig {
  maxSteps?: number;
  defaultRole?: ModelRole;
  systemPrompt?: string;
  /**
   * Overlay efímero API-call-time (estilo Hermes `ephemeral_system_prompt`).
   * Vive DESPUÉS de la frontera EPHEMERAL, nunca persiste ni contamina el
   * prefijo cacheado. Para contenido mid-turn; el system cacheado no se toca.
   */
  ephemeralSystemPrompt?: string;
  /**
   * Huella del system prompt cacheado a inicio de sesión (ver
   * `fingerprintSystemPrompt()` en `@ego/subegos`). Si se fija, el loop
   * debe rechazar mutaciones mid-turn salvo rebuild por compresión.
   */
  cachedSystemPromptFingerprint?: string;
  executionManager?: ExecutionManager;
  approvalEngine?: ApprovalEngine;
  errorHandler?: ErrorHandler;
  errorHandlerConfig?: ErrorHandlerConfig;
  approvalHandler?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  eventBus?: EventBus;
  onStep?: (event: LoopStepEvent) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolExecutionResult) => void;
}

/**
 * Opciones dinámicas para una invocación individual de run().
 */
export interface LoopRunOptions {
  messages: ModelMessage[];
  context: ToolExecutionContext;
  executionManager?: ExecutionManager;
  approvalEngine?: ApprovalEngine;
  errorHandler?: ErrorHandler;
  role?: ModelRole;
  /** Modelo elegido por el usuario (Ajustes/ModelPicker); gana al rol si resuelve. */
  preferredModel?: PreferredModel;
  systemPrompt?: string;
  /**
   * Overlay efímero para ESTA llamada (no cacheable, no persistido).
   * El caller lo concatena tras la frontera EPHEMERAL via
   * `applyEphemeralOverlay()`; nunca muta el system cacheado.
   */
  ephemeralSystemPrompt?: string;
  /**
   * `true` solo en rebuild por compresión de contexto: único cache-break
   * sancionado (Hermes). Cualquier otra mutación mid-turn del system está
   * prohibida y debe viajar como user message o tool result.
   */
  isCompressionRebuild?: boolean;
  /**
   * Parte ESTABLE del system (sin overlay efímero) para el check de
   * estabilidad. Si se omite, el check hashea `systemPrompt` exacto.
   * El overlay efímero API-call-time cambia cada turno por diseño y nunca
   * debe incluirse en el fingerprint estable (STAB-03/STAB-05).
   */
  stableSystemPrompt?: string;
  /**
   * Huella del system prompt cacheado a inicio de sesión para ESTA llamada
   * (gana a la del config). Si difiere del `systemPrompt` efectivo, el loop
   * rechaza el turno salvo `isCompressionRebuild: true` (STAB-05).
   */
  cachedSystemPromptFingerprint?: string;
  maxSteps?: number;
  approvalHandler?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  abortSignal?: AbortSignal;
  eventBus?: EventBus;
  traceId?: string;
}

/**
 * Resultado integral del ciclo de ejecución.
 */
export interface LoopExecutionResult {
  status: LoopStatus;
  messages: ModelMessage[];
  steps: number;
  finalText?: string;
  pendingApproval?: ApprovalRequest;
  error?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

/**
 * Taxonomía de causas raíz de error para autocorrección guiada por el modelo (ACT-08).
 */
export type CausalErrorCategory =
  | "TOOL_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "REPAIRABLE_SYNTAX_ERROR"
  | "FILE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "EXECUTION_TIMEOUT"
  | "PROCESS_FAILED"
  | "LOOP_DETECTED"
  | "UNKNOWN_ERROR";

/**
 * Contrato de error causal enriquecido inyectado al modelo para autocorrección guiada.
 */
export interface EnrichedCausalError {
  status: "error";
  category: CausalErrorCategory;
  toolName: string;
  callId: string;
  message: string;
  remedyHint: string;
  validationDetails?: Array<{
    path: string;
    message: string;
    expected?: string;
    received?: string;
  }>;
  suggestedTools?: string[];
  isLoopRisk?: boolean;
  rawError?: string;
}

/**
 * Opciones de configuración para el ErrorHandler de runtime (ACT-08).
 */
export interface ErrorHandlerConfig {
  maxConsecutiveToolErrors?: number;
  enableArgumentRepair?: boolean;
  enableLoopGuard?: boolean;
}

/**
 * Razón legítima de (re)construcción del system prompt cacheado.
 * `session_start`: ensamblaje 3-tiers estable→contexto→volátil.
 * `compression`: ÚNICO cache-break sancionado mid-conversación (Hermes).
 * Cualquier otro motivo mid-turn está prohibido: el contenido viaja como
 * user message o tool result, nunca mutando el system.
 */
export type SystemPromptRebuildReason = "session_start" | "compression";

/**
 * Estado del system prompt cacheado por conversación (prefijo estable para
 * prompt caching del proveedor). El overlay `EPHEMERAL_*` nunca forma parte
 * de este texto.
 */
export interface CachedSystemPromptState {
  text: string;
  fingerprint: string;
  createdAtMs: number;
}
