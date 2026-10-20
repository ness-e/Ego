/**
 * Estado final de la ejecución de una herramienta a través del ExecutionManager.
 */
export type ExecutionStatus =
  | "success"       // Ejecución completada exitosamente dentro de los límites
  | "timeout"       // Excedió el tiempo límite máximo asignado
  | "aborted"       // Cancelado cooperativamente por el usuario o contexto
  | "error"         // Excepción arrojada durante la ejecución física
  | "rate_limited"; // Denegado o postergado por límite de cuotas o concurrencia

/**
 * Configuración global del ExecutionManager (ACT-03).
 */
export interface ExecutionManagerConfig {
  /**
   * Timeout predeterminado por herramienta en milisegundos (por defecto: 30,000 ms / 30s).
   */
  defaultTimeoutMs?: number;

  /**
   * Número máximo de herramientas o procesos ejecutándose simultáneamente en el host (por defecto: 5).
   */
  maxConcurrentExecutions?: number;

  /**
   * Tamaño máximo permitido para la salida de una herramienta en bytes (por defecto: 5MB).
   */
  maxOutputSizeBytes?: number;

  /**
   * Circuit breaker por herramienta (R5). Si se omite, el circuit breaker
   * queda **activo** con los valores por defecto (5 fallos consecutivos,
   * ventana de reintento de 30 s): un tool colgado no debe agotar los slots.
   */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /**
   * Cuota de llamadas por Sub-Ego (R5). Si se omite, la cuota queda **activa**
   * con el valor por defecto (1000 llamadas por Sub-Ego).
   */
  subEgoQuota?: Partial<SubEgoQuotaConfig>;

  /**
   * Listener opcional de telemetría y ciclo de vida de ejecuciones.
   */
  onEvent?: (event: ExecutionEvent) => void;
}

import type { AdmittedRunContext } from "./AdmittedRunContext.js";
import type { CircuitBreakerConfig, SubEgoQuotaConfig } from "./CircuitBreaker.js";

/**
 * Opciones específicas para una llamada individual de ejecución.
 */
export interface ExecutionOptions {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  maxOutputSizeBytes?: number;
  admittedRunContext?: AdmittedRunContext;
}

/**
 * Evento emitido durante el ciclo de vida de supervisión de un proceso o herramienta.
 */
export interface ExecutionEvent {
  callId: string;
  toolName: string;
  type: "started" | "completed" | "failed" | "timeout" | "aborted";
  durationMs?: number;
  details?: Record<string, unknown>;
  timestamp: number;
  admittedRunContext?: AdmittedRunContext;
}

/**
 * Resultado formal e inmutable emitido tras la supervisión de una ejecución.
 */
export interface ExecutionResult<T = unknown> {
  callId: string;
  toolName: string;
  status: ExecutionStatus;
  output?: T;
  error?: string;
  durationMs: number;
  truncated: boolean;
  timestamp: number;
}

import type { ToolCategory, ToolRiskLevel } from "@ego/tools";

/**
 * Identidad causal inmutable de una acción pendiente (COUC-03).
 * Hashea con SHA-256 la sesión, actor, herramienta y argumentos normalizados.
 */
export interface ActionIdentity {
  sessionId: string;
  subEgoId: string;
  toolName: string;
  callId: string;
  inputDigest: string;
  createdAt: number;
}

/**
 * Estado del ciclo de vida de una solicitud de aprobación humana.
 */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "timed_out"
  | "aborted";

/**
 * Decisión emitida por el operador humano o supervisor ante una solicitud HITL.
 */
export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
  modifiedArguments?: Record<string, unknown>;
  resolvedBy?: string;
  timestamp?: number;
}

/**
 * Solicitud de aprobación registrada y retenida en el ApprovalEngine.
 */
export interface PendingApproval {
  approvalId: string;
  action: ActionIdentity;
  toolName: string;
  toolCategory: ToolCategory;
  riskLevel: ToolRiskLevel;
  arguments: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Modo de gobernanza global de Ego.
 */
export type GovernanceMode = "strict" | "standard" | "permissive";

/**
 * Regla de política específica de aprobación.
 */
export interface ApprovalPolicyRule {
  toolName?: string;
  category?: ToolCategory;
  riskLevel?: ToolRiskLevel;
  requireApproval: boolean;
  reason?: string;
}

/**
 * Entrada de auditoría de una aprobación HITL (SEC-06). El engine no persiste
 * en VantaDB (sin dependencia a @ego/memory por AGENTS.md §4): el consumidor
 * vuelca estas entradas a `gov/audit` vía `EgoMemoryAdapter.recordAudit`.
 * `inputDigest` es el SHA-256 canónico de los argumentos (COUC-03).
 */
export interface ApprovalAuditEntry {
  approvalId: string;
  phase: "requested" | "resolved" | "timed_out" | "aborted";
  toolName: string;
  sessionId: string;
  subEgoId: string;
  callId: string;
  inputDigest: string;
  approved?: boolean;
  reason?: string;
  timestamp: number;
}

/**
 * Configuración de inicialización del ApprovalEngine (ACT-06).
 */
export interface ApprovalEngineConfig {
  mode?: GovernanceMode;
  defaultTimeoutMs?: number; // por defecto 120,000 ms (2 min)
  rules?: ApprovalPolicyRule[];
  onApprovalRequested?: (req: PendingApproval) => void;
  onApprovalResolved?: (req: PendingApproval, decision: ApprovalDecision) => void;
  /**
   * Sumidero de auditoría best-effort (SEC-06): invocado en cada fase
   * (requested/resolved/timed_out/aborted). Nunca lanza hacia el flujo.
   */
  auditSink?: (entry: ApprovalAuditEntry) => void | Promise<void>;
}
