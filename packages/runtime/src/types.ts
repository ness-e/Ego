import type { ModelMessage, ModelRole, PreferredModel, ReasoningEffort, ToolCall } from "@ego/models";
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
  /**
   * EGO-FIND-74: span de correlación derivado de la tool call
   * (`childCorrelationId(correlationId del turno, "tool:<nombre>")`).
   */
  correlationId?: string;
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
import type { TrustPolicyOptions } from "./TrustBoundary.js";

/**
 * Configuración para instanciar el ToolExecutionLoop.
 */
export interface ToolExecutionLoopConfig {
  maxSteps?: number;
  defaultRole?: ModelRole;
  systemPrompt?: string;
  /**
   * E1 (EGO-FIND-43): ejecutar las tool calls de un turno de forma
   * **concurrente** (la emisión de resultados mantiene el orden de los
   * `tool_use`, requisito del contrato del proveedor).
   *
   * `false` ⇒ comportamiento estrictamente en serie (el anterior).
   * Por defecto `true`.
   */
  parallelToolCalls?: boolean;
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
  /**
   * Gates de gobernanza STAB-12 (Spec D4, opt-in).
   * Sin configurar = sin cambio de comportamiento (compat con callers y
   * tests existentes). Con configurado: `permissionCheck` veta (deny) o
   * fuerza aprobación (requireApproval) antes de ejecutar; `preToolUse`
   * bloquea fail-closed; `postToolUse` solo observa. Todo veredicto con
   * match se emite como `hook.decided` (main lo persiste a `gov/audit`).
   * Inyección por callbacks: evita aristas runtime→security/events-valor.
   */
  governance?: LoopGovernanceGates;
  /**
   * Política de detección de inyección de prompt (Ola 9 · hueco de capacidad
   * de `UntrustedContentSanitizer`).
   *
   * Sin configurar = **sin cambio de comportamiento** (compatibilidad).
   * Con configurar: la **salida de cada herramienta** se detecta en el punto
   * de ingesta; si es sospechosa, el mensaje queda **marcado como no
   * confiable** ⇒ viaja por el canal sin privilegios (ADR-0019) y se
   * registra. **No bloquea** el turno por defecto (la política es
   * configurable: `onSuspicious: "block"` lo activa).
   *
   * Inyección por callback (DIP): `packages/runtime` **no** importa
   * `@ego/security`; la implementación real (`PromptInjectionDetector`) la
   * inyecta quien cablea el bucle.
   */
  injectionPolicy?: TrustPolicyOptions;
  onStep?: (event: LoopStepEvent) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolExecutionResult) => void;
}

/**
 * Entrada del gate de permisos (espejo estructural del `ToolCallRequest`
 * de `@ego/security`; el main la traduce a `evaluateToolCall`).
 */
export interface LoopPermissionInput {
  toolName: string;
  category: string;
  riskLevel?: string;
  origin?: string;
  mcpServerId?: string;
  args: unknown;
}

/** Veredicto de permiso (espejo estructural de `ToolDecisionResult`). */
export interface LoopPermissionVerdict {
  decision: "allow" | "deny" | "requireApproval";
  rule: string;
  reason: string;
}

/** Veredicto de hook (espejo estructural de `HookDecision`). */
export interface LoopHookVerdict {
  allow: boolean;
  reason: string;
  matchedHookId?: string;
}

/** Gates de gobernanza inyectables al loop (STAB-12, Spec D4). */
export interface LoopGovernanceGates {
  permissionCheck?: (input: LoopPermissionInput) => LoopPermissionVerdict;
  preToolUse?: (toolName: string, sessionId?: string) => LoopHookVerdict;
  postToolUse?: (toolName: string, sessionId?: string) => LoopHookVerdict;
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
  /**
   * STAB-06: tuning per-call del turno. Gana sobre `preferredModel`
   * (el router aplica lo preferido por debajo de lo explícito).
   */
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
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
  /**
   * EGO-FIND-74: id de correlación del turno. Se propaga a los eventos de
   * tool (`metadata.correlationId`) y a los spans hijos derivados
   * (`childCorrelationId(parent, "tool:<nombre>")`).
   */
  correlationId?: string;
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
  /**
   * Ola 9 (A4 → A2-bis): la tool **existe** pero pertenece a **otro**
   * Sub-Ego ⇒ no es visible para quien la pide. Distinguido de
   * `TOOL_NOT_FOUND` a propósito: el modelo debe entender que no la invoque
   * (y no buscar otro nombre).
   */
  | "TOOL_NOT_VISIBLE"
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
