/**
 * Categorías y tipos canónicos de eventos en Ego Cognitive Operating System.
 * Derivado de docs/architecture/vision-general.md §Bus de eventos: EgoEvent.
 */
export type EgoEventType =
  // Ciclo de vida de tareas y ejecución
  | "task.created"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.checkpoint"

  // Coordinación y delegación inter-Sub-Ego
  | "subego.invoked"
  | "subego.message"
  | "subego.delegated"
  | "subego.completed"

  // Ejecución de herramientas locales y MCP
  | "tool.started"
  | "tool.executed"
  | "tool.failed"

  // Gobernanza y Aprobación Humana (HITL)
  | "approval.required"
  | "approval.resolved"

  // Memoria y persistencia VantaDB
  | "memory.updated"
  | "memory.recalled"
  | "memory.quarantined"

  // Workspace Dinámico y Canvas
  | "workspace.updated"
  | "artifact.created"
  | "artifact.modified"

  // Proyecto Vivo y Operaciones
  | "project.changed"
  | "system.alert"

  // Eventos de telemetría de bajo nivel (Nivel A)
  | "fs.write_attempted"
  | "terminal.output_chunk";

/**
 * Severidad o nivel de impacto del evento.
 */
export type EventSeverity = "debug" | "info" | "warn" | "error" | "critical";

/**
 * Estructura formal e inmutable de un evento del sistema Ego (`EgoEvent`).
 */
export interface EgoEvent<TPayload = unknown> {
  /** Identificador único UUID del evento */
  readonly id: string;
  /** Tipo canónico del evento */
  readonly type: EgoEventType;
  /** Timestamp Unix en milisegundos */
  readonly timestamp: number;
  /** Origen del evento (componente, sub-ego, runtime, herramienta) */
  readonly source: string;
  /** Carga útil tipada del evento */
  readonly payload: TPayload;
  /** Nivel de severidad para logging y atención */
  readonly severity?: EventSeverity;
  /** ID de sesión asociada si aplica */
  readonly sessionId?: string;
  /** ID de traza causal distribuida */
  readonly traceId?: string;
  /** Metadatos adicionales de contexto */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Payloads canónicos tipados para cada evento del sistema.
 */
export interface CanonicalEventPayloadMap {
  "task.created": { taskId: string; goal: string; priority?: string; subEgoId?: string };
  "task.started": { taskId: string; startedAt: number };
  "task.completed": { taskId: string; durationMs: number; result?: unknown };
  "task.failed": { taskId: string; error: string; code?: string };
  "task.checkpoint": { taskId: string; stepIndex: number; stateSnapshot: unknown };

  "subego.invoked": { subEgoId: string; role: string; input: unknown };
  "subego.message": { fromSubEgo: string; toSubEgo: string; message: string };
  "subego.delegated": { delegatorId: string; delegateeId: string; taskId: string; instructions: string };
  "subego.completed": { subEgoId: string; outcome: unknown };

  "tool.started": { callId: string; toolName: string; input: unknown; riskLevel?: string };
  "tool.executed": { callId: string; toolName: string; durationMs: number; result: unknown };
  "tool.failed": { callId: string; toolName: string; error: string; durationMs: number };

  "approval.required": { approvalId: string; action: string; riskLevel: string; details: unknown; timeoutMs?: number };
  "approval.resolved": { approvalId: string; approved: boolean; resolvedBy: string; reason?: string };

  "memory.updated": { namespace: string; key: string; operation: "put" | "supersede" | "delete"; isLatest?: boolean };
  "memory.recalled": { query: string; matchedKeys: string[]; topScore: number };
  "memory.quarantined": { itemKey: string; reason: string; ttlDays: number };

  "workspace.updated": { projectId: string; layoutId?: string; activeView?: string };
  "artifact.created": { artifactId: string; name: string; kind: string; sizeBytes?: number };
  "artifact.modified": { artifactId: string; changeType: "edit" | "append" | "revert" };

  "project.changed": { projectId: string; path: string; name: string };
  "system.alert": { code: string; message: string; details?: unknown };

  "fs.write_attempted": { path: string; sizeBytes: number; isAtomic: boolean; backupCreated: boolean };
  "terminal.output_chunk": { pid: number; chunkLength: number; isThrottled: boolean };
}

/**
 * Función manejadora de eventos.
 */
export type EventHandler<T = any> = (event: EgoEvent<T>) => void | Promise<void>;

/**
 * Suscripción descartable retornada al escuchar un evento.
 */
export interface EventSubscription {
  unsubscribe: () => void;
}
