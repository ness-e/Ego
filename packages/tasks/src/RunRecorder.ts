import { EgoMemoryAdapter } from "@ego/memory";
import { EventBus, EgoEvent } from "@ego/events";

export interface RunAction {
  callId: string;
  toolName: string;
  summary: string;
  status: "pending" | "success" | "failed";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface RunSnapshot {
  runId: string;
  projectId: string;
  sessionId?: string;
  subEgoId?: string;
  goal: string;
  actions: RunAction[];
  finalMessage?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: "running" | "completed" | "failed" | "aborted";
  error?: string;
}

/**
 * RunRecorder - Grabador y ensamblador de snapshots de ejecución (Patrón Coucou COUC-09 / TurnRecorder).
 *
 * Reconstruye el ciclo de vida completo de una ejecución (acciones, llamadas a herramientas,
 * duraciones, errores y mensaje final) a partir de los eventos canónicos del sistema,
 * y persiste el RunSnapshot estructurado en VantaDB bajo `projects/<projectId>/runs/<runId>`.
 */
export class RunRecorder {
  private readonly memoryAdapter: EgoMemoryAdapter;
  private readonly eventBus?: EventBus;
  private readonly activeRuns = new Map<string, RunSnapshot>();
  private readonly maxActionsPerRun: number;
  private busUnsubscribe?: () => void;

  constructor(
    memoryAdapter: EgoMemoryAdapter,
    eventBus?: EventBus,
    maxActionsPerRun: number = 200
  ) {
    this.memoryAdapter = memoryAdapter;
    this.eventBus = eventBus;
    this.maxActionsPerRun = maxActionsPerRun;

    if (this.eventBus) {
      this.attachToBus();
    }
  }

  /**
   * Inicia la grabación de una nueva corrida/ejecución.
   */
  public startRun(options: {
    runId: string;
    projectId: string;
    sessionId?: string;
    subEgoId?: string;
    goal?: string;
  }): RunSnapshot {
    const snapshot: RunSnapshot = {
      runId: options.runId,
      projectId: options.projectId,
      sessionId: options.sessionId,
      subEgoId: options.subEgoId,
      goal: options.goal ?? "",
      actions: [],
      startedAt: Date.now(),
      status: "running",
    };

    this.activeRuns.set(options.runId, snapshot);
    return snapshot;
  }

  /**
   * Registra el inicio de una herramienta.
   */
  public recordToolStart(
    runId: string,
    toolName: string,
    callId: string,
    input?: unknown,
    summary?: string
  ): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    if (run.actions.length >= this.maxActionsPerRun) return;

    const action: RunAction = {
      callId,
      toolName,
      summary: summary ?? `Ejecución de ${toolName}`,
      status: "pending",
      startedAt: Date.now(),
      input,
    };

    run.actions.push(action);
  }

  /**
   * Registra el resultado exitoso de una herramienta.
   */
  public recordToolSuccess(
    runId: string,
    callId: string,
    result: unknown,
    durationMs?: number
  ): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    const action = run.actions.find((a) => a.callId === callId);
    if (action) {
      action.status = "success";
      action.endedAt = Date.now();
      action.durationMs = durationMs ?? (action.endedAt - action.startedAt);
      action.output = result;
    }
  }

  /**
   * Registra el fallo de una herramienta.
   */
  public recordToolFailure(
    runId: string,
    callId: string,
    error: string,
    durationMs?: number
  ): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    const action = run.actions.find((a) => a.callId === callId);
    if (action) {
      action.status = "failed";
      action.endedAt = Date.now();
      action.durationMs = durationMs ?? (action.endedAt - action.startedAt);
      action.error = error;
    }
  }

  /**
   * Finaliza la corrida y persiste el RunSnapshot en VantaDB.
   */
  public async finishRun(
    runId: string,
    outcome: {
      status: "completed" | "failed" | "aborted";
      finalMessage?: string;
      error?: string;
    }
  ): Promise<RunSnapshot | undefined> {
    const run = this.activeRuns.get(runId);
    if (!run) return undefined;

    const now = Date.now();
    run.endedAt = now;
    run.durationMs = now - run.startedAt;
    run.status = outcome.status;
    run.finalMessage = outcome.finalMessage;
    run.error = outcome.error;

    // Persistir en VantaDB bajo namespace de proyecto
    const namespace = `projects/${run.projectId}/runs`;
    try {
      await this.memoryAdapter.put({
        namespace,
        key: run.runId,
        payload: run,
        metadata: {
          type: "run_snapshot",
          runId: run.runId,
          projectId: run.projectId,
          status: run.status,
        },
      });
    } catch {
      // Si la persistencia falla, conservamos el snapshot en activeRuns
    }

    return run;
  }

  /**
   * Obtiene el snapshot en memoria de una corrida activa.
   */
  public getSnapshot(runId: string): RunSnapshot | undefined {
    return this.activeRuns.get(runId);
  }

  /**
   * Recupera un snapshot previamente persistido en VantaDB.
   */
  public async loadPersistedRun(
    projectId: string,
    runId: string
  ): Promise<RunSnapshot | null> {
    const namespace = `projects/${projectId}/runs`;
    const item = (await this.memoryAdapter.get(namespace, runId)) as { payload?: unknown } | null;
    if (!item) return null;
    return typeof item.payload === "string"
      ? (JSON.parse(item.payload) as RunSnapshot)
      : ((item.payload ?? item) as RunSnapshot);
  }

  public dispose(): void {
    if (this.busUnsubscribe) {
      this.busUnsubscribe();
      this.busUnsubscribe = undefined;
    }
  }

  private attachToBus(): void {
    if (!this.eventBus) return;

    const sub = this.eventBus.onAny((event: EgoEvent) => {
      const payload = event.payload as any;
      if (!payload) return;

      const runId = (payload.runId || payload.taskId || event.sessionId) as string;
      if (!runId) return;

      switch (event.type) {
        case "task.started":
          if (!this.activeRuns.has(runId)) {
            this.startRun({
              runId,
              projectId: (payload.projectId as string) ?? "default",
              sessionId: event.sessionId,
              goal: payload.goal,
            });
          }
          break;

        case "tool.started":
          this.recordToolStart(runId, payload.toolName, payload.callId, payload.input);
          break;

        case "tool.executed":
          this.recordToolSuccess(runId, payload.callId, payload.result, payload.durationMs);
          break;

        case "tool.failed":
          this.recordToolFailure(runId, payload.callId, payload.error, payload.durationMs);
          break;

        case "task.completed":
          void this.finishRun(runId, {
            status: "completed",
            finalMessage: typeof payload.result === "string" ? payload.result : undefined,
          });
          break;

        case "task.failed":
          void this.finishRun(runId, {
            status: "failed",
            error: payload.error,
          });
          break;
      }
    });

    this.busUnsubscribe = () => sub.unsubscribe();
  }
}
