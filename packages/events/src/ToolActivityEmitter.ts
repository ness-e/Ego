import { EventBus } from "./EventBus.js";

export interface ToolActivityOptions {
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolStartParams {
  callId: string;
  toolName: string;
  input: unknown;
  riskLevel?: string;
}

export interface ToolProgressParams {
  callId: string;
  toolName: string;
  deltaOutput?: string;
  percent?: number;
  status?: string;
}

export interface ToolCompletedParams {
  callId: string;
  toolName: string;
  result: unknown;
  durationMs: number;
}

export interface ToolFailedParams {
  callId: string;
  toolName: string;
  error: string;
  durationMs: number;
}

export interface ToolPatchSummaryParams {
  callId: string;
  toolName: string;
  added: string[];
  modified: string[];
  deleted: string[];
  summary: string;
}

/**
 * Despachador tipado de eventos de actividad de herramientas (OCLW-14).
 *
 * **Implementación propia de Ego** (patrón asimilado de OpenClaw · OCLW-14):
 * el patrón de eventos de actividad se estudió allí, pero **este código no
 * es un port** — el upstream no expone un fichero equivalente y el bus de
 * eventos, los niveles de riesgo y las métricas son de Ego. Sin atribución de
 * código derivado.
 *
 * Alimenta la bandeja de Background Activity y la telemetría del Workspace.
 */
export class ToolActivityEmitter {
  constructor(
    private readonly eventBus: EventBus,
    private readonly defaultSource: string = "ToolActivityEmitter"
  ) {}

  public emitStart(params: ToolStartParams, options: ToolActivityOptions = {}): void {
    this.eventBus.emit(
      "tool.started",
      {
        callId: params.callId,
        toolName: params.toolName,
        input: params.input,
        riskLevel: params.riskLevel,
      },
      {
        source: this.defaultSource,
        sessionId: options.sessionId,
        traceId: options.traceId,
        metadata: options.metadata,
        severity: "info",
      }
    );
  }

  public emitProgress(params: ToolProgressParams, options: ToolActivityOptions = {}): void {
    this.eventBus.emit(
      "tool.progress",
      {
        callId: params.callId,
        toolName: params.toolName,
        deltaOutput: params.deltaOutput,
        percent: params.percent,
        status: params.status,
      },
      {
        source: this.defaultSource,
        sessionId: options.sessionId,
        traceId: options.traceId,
        metadata: options.metadata,
        severity: "debug",
      }
    );
  }

  public emitCompleted(params: ToolCompletedParams, options: ToolActivityOptions = {}): void {
    this.eventBus.emit(
      "tool.executed",
      {
        callId: params.callId,
        toolName: params.toolName,
        result: params.result,
        durationMs: params.durationMs,
      },
      {
        source: this.defaultSource,
        sessionId: options.sessionId,
        traceId: options.traceId,
        metadata: options.metadata,
        severity: "info",
      }
    );
  }

  public emitFailed(params: ToolFailedParams, options: ToolActivityOptions = {}): void {
    this.eventBus.emit(
      "tool.failed",
      {
        callId: params.callId,
        toolName: params.toolName,
        error: params.error,
        durationMs: params.durationMs,
      },
      {
        source: this.defaultSource,
        sessionId: options.sessionId,
        traceId: options.traceId,
        metadata: options.metadata,
        severity: "error",
      }
    );
  }

  public emitPatchSummary(params: ToolPatchSummaryParams, options: ToolActivityOptions = {}): void {
    this.eventBus.emit(
      "tool.patch_summary",
      {
        callId: params.callId,
        toolName: params.toolName,
        added: params.added,
        modified: params.modified,
        deleted: params.deleted,
        summary: params.summary,
      },
      {
        source: this.defaultSource,
        sessionId: options.sessionId,
        traceId: options.traceId,
        metadata: options.metadata,
        severity: "info",
      }
    );
  }
}
