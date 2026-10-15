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

  // Ciclo de vida de Sub-Egos (canonizado HIG-03-F1)
  | "subego.registered"
  | "subego.state_changed"

  // Ejecución de herramientas locales y MCP
  | "tool.started"
  | "tool.progress"
  | "tool.executed"
  | "tool.failed"
  | "tool.patch_summary"

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
  | "project.switched"
  | "system.alert"

  // Configuración del escritorio (canonizado HIG-03-F1)
  | "settings.model_updated"

  // Daily State y Sesión Diaria (Fase 08)
  | "daily.state.synthesized"
  | "daily.decision.recorded"
  | "daily.snapshot.saved"
  | "daily.snapshot.restored"

  // Eventos de telemetría de bajo nivel (Nivel A)
  | "fs.write_attempted"
  | "terminal.output_chunk"

  // Telemetría de ciclo de decisión (DEC-08, F3T6/H03)
  | "metrics.turn";

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

  "subego.registered": { subEgoId: string; name: string; role: string; createdAt: number };
  "subego.state_changed": { subEgoId: string; state: "active" | "paused"; timestamp: number };

  "tool.started": { callId: string; toolName: string; input: unknown; riskLevel?: string };
  "tool.progress": { callId: string; toolName: string; deltaOutput?: string; percent?: number; status?: string };
  "tool.executed": { callId: string; toolName: string; durationMs: number; result: unknown };
  "tool.failed": { callId: string; toolName: string; error: string; durationMs: number };
  "tool.patch_summary": { callId: string; toolName: string; added: string[]; modified: string[]; deleted: string[]; summary: string };

  "approval.required": { approvalId: string; action: string; riskLevel: string; details: unknown; timeoutMs?: number };
  "approval.resolved": { approvalId: string; approved: boolean; resolvedBy: string; reason?: string };

  "memory.updated": { namespace: string; key: string; operation: "put" | "supersede" | "delete"; isLatest?: boolean };
  "memory.recalled": { query: string; matchedKeys: string[]; topScore: number };
  "memory.quarantined": { itemKey: string; reason: string; ttlDays: number };

  "workspace.updated": { projectId: string; layoutId?: string; activeView?: string };
  "artifact.created": { artifactId: string; name: string; kind: string; sizeBytes?: number };
  "artifact.modified": { artifactId: string; changeType: "edit" | "append" | "revert" };

  "project.changed": { projectId: string; path: string; name: string };
  "project.switched": { projectId: string; timestamp: number };
  "system.alert": { code: string; message: string; details?: unknown };

  "settings.model_updated": { activeProvider: string; timestamp: number };

  "daily.state.synthesized": unknown;
  "daily.decision.recorded": { id: string; title: string; timestamp: number; subEgoId: string };
  "daily.snapshot.saved": unknown;
  "daily.snapshot.restored": unknown;

  "fs.write_attempted": { path: string; sizeBytes: number; isAtomic: boolean; backupCreated: boolean };
  "terminal.output_chunk": { pid: number; chunkLength: number; isThrottled: boolean };

  "metrics.turn": { runId: string; latencyMs: number; stage: string; withinBudget: boolean };
}

/**
 * Función manejadora de eventos.
 * L10 — Justificación del default `any`: es el alias no genérico del bus
 * (`EventHandler` bare = cualquier payload); el mapa canónico
 * `CanonicalEventPayloadMap` + `on<K>` proveen la vía tipada. Cambiar el
 * default a `unknown` rompería la contravarianza de todos los suscriptores existentes.
 */
export type EventHandler<T = any> = (event: EgoEvent<T>) => void | Promise<void>;

/**
 * Suscripción descartable retornada al escuchar un evento.
 */
export interface EventSubscription {
  unsubscribe: () => void;
}

// ── Hooks de ciclo de vida Pre/PostToolUse (CFG-09) ─────────────────────
// Gate fail-closed en `EventBus`: un hook PreToolUse que matchea intercepta
// la herramienta (bloquea hasta aprobación/ejecución externa del comando);
// PostToolUse es solo observación. `disableAllHooks` es el kill switch.

/** Momento del ciclo de vida que intercepta el hook. */
export type HookKind = "PreToolUse" | "PostToolUse";

/** Entrada configurable de hook: matcher de herramienta + comando validado. */
export interface HookCommandConfig {
  /** Identificador único del hook (`^[A-Za-z0-9_-]+$`, ≤64). */
  id: string;
  kind: HookKind;
  /**
   * Matcher de herramienta: nombre exacto (`fs_write_file`), prefijo
   * (`terminal*`) o global (`*`). Caracteres: `[A-Za-z0-9_.*:-]`, ≤128.
   */
  toolPattern: string;
  /**
   * Comando del hook (NO se ejecuta en este paquete; lo ejecuta main).
   * Validado: no vacío, ≤512, sin operadores shell (`;|&$`()\<>`).
   */
  command: string;
  /** Timeout de ejecución sugerido en ms (0–30000, default 5000). */
  timeoutMs?: number;
}

/** Configuración de hooks aplicada al bus. */
export interface HooksConfig {
  /** Kill switch: con `true` ningún hook intercepta (todo permite). */
  disableAllHooks?: boolean;
  /** Entradas de hook (validadas fail-closed al configurar). */
  hooks?: HookCommandConfig[];
  /**
   * Comando de estado estilo `statusLine` (NO se ejecuta aquí; lo ejecuta
   * main y expone su salida). Validado con las mismas reglas de comando.
   */
  statusCommand?: string;
}

/** Veredicto sincrónico de evaluación de un hook. */
export interface HookDecision {
  /** `false` = herramienta bloqueada (fail-closed). */
  allow: boolean;
  /** Motivo legible para auditoría (`blocked-by-hook:<id>`, etc.). */
  reason: string;
  /** Id del hook que decidió, si hubo match. */
  matchedHookId?: string;
}

/** Snapshot de estado de hooks para UI/diagnóstico. */
export interface HooksStatus {
  disabled: boolean;
  preToolUse: number;
  postToolUse: number;
  sessionsWithEnv: number;
  commandsValid: boolean;
  invalidCommands: string[];
  statusCommand: string | null;
}
