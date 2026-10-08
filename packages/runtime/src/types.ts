import type { ModelMessage, ModelRole, ToolCall } from "@ego/models";
import type { ToolCategory, ToolExecutionContext, ToolRiskLevel } from "@ego/tools";

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
 * Decisión emitida por el usuario o motor de gobernanza.
 */
export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
  modifiedArguments?: Record<string, unknown>;
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

/**
 * Configuración para instanciar el ToolExecutionLoop.
 */
export interface ToolExecutionLoopConfig {
  maxSteps?: number;
  defaultRole?: ModelRole;
  systemPrompt?: string;
  approvalHandler?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
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
  role?: ModelRole;
  systemPrompt?: string;
  maxSteps?: number;
  approvalHandler?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  abortSignal?: AbortSignal;
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
