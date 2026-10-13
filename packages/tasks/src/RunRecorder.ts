import { createHash } from "node:crypto";
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
 * Serialización canónica determinista para digests de corrida (SEC-06 H6).
 * Mismo algoritmo que `canonicalAuditJson` de `@ego/memory`: claves ordenadas.
 */
function canonicalRunJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val !== "object") return JSON.stringify(val) ?? "null";
  if (Array.isArray(val)) return `[${val.map(canonicalRunJson).join(",")}]`;
  const obj = val as Record<string, unknown>;
  const pairs: string[] = [];
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v === undefined || typeof v === "function" || typeof v === "symbol") continue;
    pairs.push(`${JSON.stringify(k)}:${canonicalRunJson(v)}`);
  }
  return `{${pairs.join(",")}}`;
}

/**
 * Digest SHA-256 recomputable de un RunSnapshot finalizado (SEC-06 H6).
 * El espejo en `gov/audit` lo referencia como `snapshotSha256`, ligando la
 * entrada auditable al contenido exacto persistido en `projects/<id>/runs`.
 */
export function computeRunSnapshotDigest(snapshot: RunSnapshot): string {
  return createHash("sha256").update(canonicalRunJson(snapshot), "utf8").digest("hex");
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
  /** Historial acotado de corridas finalizadas (F4T8 H14). */
  private readonly recentRuns = new Map<string, RunSnapshot>();
  private readonly maxRecentRuns = 100;
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
    let persisted = true;
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
      // para permitir reintento posterior.
      persisted = false;
    }

    // SEC-06 H6: espejo auditable best-effort en gov/audit con digest del
    // snapshot + subEgoId. Nunca revierte ni bloquea el resultado principal.
    try {
      const subEgoId = run.subEgoId ?? "ego.nucleus";
      const snapshotSha256 = computeRunSnapshotDigest(run);
      const envelope = {
        action: "run_finished",
        actor: subEgoId,
        target: run.runId,
        subEgoId,
        details: {
          runId: run.runId,
          projectId: run.projectId,
          status: run.status,
          actionCount: run.actions.length,
          startedAt: run.startedAt,
          endedAt: run.endedAt ?? null,
          snapshotSha256,
        },
      };
      const sha256 = createHash("sha256")
        .update(canonicalRunJson(envelope), "utf8")
        .digest("hex");
      await this.memoryAdapter.put({
        namespace: "gov/audit",
        key: `run:${run.runId}`,
        payload: { ...envelope, timestamp: now, sha256 },
        metadata: {
          audit_action: "run_finished",
          sub_ego: subEgoId,
          sha256,
          ts: now,
        },
      });
    } catch {
      // Best-effort: la auditoría no compromete la corrida finalizada.
    }

    if (persisted) {
      // Fuga corregida (F4T8 H14): el snapshot finalizado sale de activeRuns
      // (getSnapshot() ya no miente devolviendo finalizados como activos) y
      // pasa a un historial acotado con evicción FIFO.
      this.activeRuns.delete(runId);
      this.recentRuns.set(runId, run);
      while (this.recentRuns.size > this.maxRecentRuns) {
        const oldest = this.recentRuns.keys().next();
        if (oldest.done) break;
        this.recentRuns.delete(oldest.value);
      }
    }

    return run;
  }

  /**
   * Obtiene el snapshot de una corrida activa (solo no finalizadas).
   */
  public getActiveRun(runId: string): RunSnapshot | undefined {
    return this.activeRuns.get(runId);
  }

  /**
   * Cantidad de corridas activas retenidas (para detectar fugas, F4T8 H14).
   */
  public activeRunCount(): number {
    return this.activeRuns.size;
  }

  /**
   * Obtiene el snapshot de una corrida, activa o finalizada recientemente.
   * Las finalizadas provienen del historial acotado, no de activeRuns.
   */
  public getSnapshot(runId: string): RunSnapshot | undefined {
    return this.activeRuns.get(runId) ?? this.recentRuns.get(runId);
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
      const payload = event.payload as Record<string, unknown> | null | undefined;
      if (!payload) return;

      const rawRunId = payload["runId"] ?? payload["taskId"] ?? event.sessionId;
      if (typeof rawRunId !== "string" || rawRunId.length === 0) return;
      const runId: string = rawRunId;

      const asString = (value: unknown): string | undefined =>
        typeof value === "string" ? value : undefined;

      switch (event.type) {
        case "task.started":
          if (!this.activeRuns.has(runId)) {
            this.startRun({
              runId,
              projectId: asString(payload["projectId"]) ?? "default",
              sessionId: event.sessionId,
              goal: asString(payload["goal"]),
            });
          }
          break;

        case "tool.started":
          if (asString(payload["toolName"]) && asString(payload["callId"])) {
            this.recordToolStart(
              runId,
              payload["toolName"] as string,
              payload["callId"] as string,
              payload["input"]
            );
          }
          break;

        case "tool.executed":
          if (asString(payload["callId"])) {
            this.recordToolSuccess(
              runId,
              payload["callId"] as string,
              payload["result"],
              typeof payload["durationMs"] === "number" ? payload["durationMs"] : undefined
            );
          }
          break;

        case "tool.failed":
          if (asString(payload["callId"])) {
            this.recordToolFailure(
              runId,
              payload["callId"] as string,
              asString(payload["error"]) ?? "unknown tool error",
              typeof payload["durationMs"] === "number" ? payload["durationMs"] : undefined
            );
          }
          break;

        case "task.completed":
          void this.finishRun(runId, {
            status: "completed",
            finalMessage: asString(payload["result"]),
          }).catch(() => {
            // Defensive: finishRun no rechaza por diseño, pero el bus nunca
            // debe observar un rechazo no manejado.
          });
          break;

        case "task.failed":
          void this.finishRun(runId, {
            status: "failed",
            error: asString(payload["error"]),
          }).catch(() => {
            // Defensive: ver rama anterior.
          });
          break;
      }
    });

    this.busUnsubscribe = () => sub.unsubscribe();
  }
}
