import { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";
import { computeAuditDigest } from "./EgoMemoryAdapter.js";
import { getQuarantineAware, listQuarantineAware } from "./QuarantineAwareReads.js";
import { generateOpaqueId } from "./OpaqueId.js";

export interface SessionCheckpointPolicyOptions {
  checkpointIntervalTurns?: number;
  failClosedOnToolFlushError?: boolean;
}

export interface ToolDispatchAuditOptions {
  subEgoId?: string;
  args?: unknown;
}

export interface CheckpointDecision {
  proceed: boolean;
  checkpointId?: string;
  error?: string;
}

/**
 * Checkpoint de sesión leído (FIX-01 SEC-09): el contenido más la marca
 * explícita de procedencia. `quarantined=true` = el snapshot vive en
 * `quarantine/pending` porque el enforcement lo enrutó allí.
 */
export interface SessionCheckpointRead {
  checkpointId: string;
  sessionId: string;
  turnId: string;
  turnCount: number;
  timestamp: number;
  summary: Record<string, unknown>;
  quarantined: boolean;
  quarantineReason?: string;
}

/**
 * Política de checkpoints semánticos y durabilidad fail-closed (DSEK session-checkpoint-policy).
 * Garantiza que el prefijo del historial y las llamadas a herramientas queden
 * persistidos de forma durable en VantaDB antes de que ocurran efectos secundarios.
 */
export class SessionCheckpointPolicy {
  private readonly checkpointIntervalTurns: number;
  private readonly failClosedOnToolFlushError: boolean;
  private turnCounters: Map<string, number> = new Map();

  constructor(
    private readonly adapter: EgoMemoryAdapter,
    options?: SessionCheckpointPolicyOptions
  ) {
    this.checkpointIntervalTurns = options?.checkpointIntervalTurns ?? 5;
    this.failClosedOnToolFlushError = options?.failClosedOnToolFlushError ?? true;
  }

  /**
   * Asegura que todo el historial acumulado en la sesión quede persistido
   * antes de iniciar un nuevo stream de inferencia con el modelo (LLM).
   * F2T6/M08: fail-closed coherente con `beforeToolDispatch` — el fallo de
   * flush NUNCA es silencioso: se propaga como `CheckpointDecision`
   * (`proceed:false` salvo fail-open explícito, que conserva el error).
   */
  public async beforeModelStream(sessionId: string): Promise<CheckpointDecision> {
    try {
      await this.adapter.flush();
      return { proceed: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMsg = `[SessionCheckpointPolicy] Fallo al asegurar durabilidad previa a model stream para ${sessionId}: ${message}`;
      console.error(errorMsg);
      if (this.failClosedOnToolFlushError) {
        return { proceed: false, error: errorMsg };
      }
      return { proceed: true, error: errorMsg };
    }
  }

  /**
   * Barrera de despacho de herramientas: persiste el estado antes de invocar
   * el cuerpo de la herramienta. Si falla el flush y failClosed es true, aborta el despacho.
   * SEC-06: la entrada `tool_dispatch` en gov/audit porta `sha256` (digest
   * canónico de sesión+herramienta+args+subEgo) + `subEgoId` verificables.
   */
  public async beforeToolDispatch(
    sessionId: string,
    toolName: string,
    toolCallId: string,
    options?: ToolDispatchAuditOptions
  ): Promise<CheckpointDecision> {
    try {
      const subEgoId = options?.subEgoId ?? "ego.nucleus";
      const dispatchedAt = Date.now();
      // Digest sobre el cuerpo auditable (sin dispatchedAt: recomputable).
      const sha256 = computeAuditDigest({
        action: "tool_dispatch",
        actor: subEgoId,
        target: toolCallId,
        subEgoId,
        details: {
          sessionId,
          toolName,
          toolCallId,
          args: options?.args ?? null,
        },
      });
      // Registrar llamada pendiente en namespace audit antes de la ejecución
      await this.adapter.put({
        namespace: "gov/audit",
        key: `tool_dispatch:${toolCallId}`,
        payload: {
          sessionId,
          toolName,
          toolCallId,
          subEgoId,
          dispatchedAt,
          status: "pending_dispatch",
          sha256,
        },
        metadata: {
          sub_ego: subEgoId,
          sha256,
        },
      });

      await this.adapter.flush();
      return { proceed: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMsg = `[SessionCheckpointPolicy] Fallo al asegurar durabilidad previa a tool ${toolName}: ${message}`;
      console.error(errorMsg);

      if (this.failClosedOnToolFlushError) {
        return {
          proceed: false,
          error: errorMsg,
        };
      }
      return { proceed: true };
    }
  }

  /**
   * Evalúa y registra un turno de sesión. Si el contador de turnos alcanza el umbral,
   * crea un checkpoint formal en system/snapshots para recuperación rápida.
   */
  public async recordTurn(
    sessionId: string,
    turnId: string,
    turnSummary?: Record<string, unknown>
  ): Promise<{ checkpointCreated: boolean; checkpointId?: string }> {
    const currentCount = (this.turnCounters.get(sessionId) ?? 0) + 1;
    this.turnCounters.set(sessionId, currentCount);

    if (currentCount % this.checkpointIntervalTurns === 0) {
      const checkpointId = generateOpaqueId("snap");
      const timestamp = Date.now();

      await this.adapter.put({
        namespace: "system/snapshots",
        key: `checkpoint:${sessionId}:${checkpointId}`,
        payload: {
          checkpointId,
          sessionId,
          turnId,
          turnCount: currentCount,
          timestamp,
          summary: turnSummary || {},
        },
        metadata: {
          session_id: sessionId,
          checkpoint_id: checkpointId,
          ts: timestamp,
          kind: "session_turn_checkpoint",
        },
      });

      await this.adapter.flush();

      return {
        checkpointCreated: true,
        checkpointId,
      };
    }

    return { checkpointCreated: false };
  }

  /**
   * Obtiene el conteo actual de turnos para una sesión.
   */
  public getTurnCount(sessionId: string): number {
    return this.turnCounters.get(sessionId) ?? 0;
  }

  /**
   * Lectura quarantine-aware de un checkpoint de sesión (FIX-01 SEC-09).
   * Resuelve live primero y `quarantine/pending` después, con marca
   * explícita. Degrada a `adapter.get` cuando el gateway es un mock sin
   * `getWithQuarantine`. Retorna `null` si no existe o el payload es
   * ilegible (nunca lanza por datos corruptos).
   */
  public async loadCheckpoint(sessionId: string, checkpointId: string): Promise<SessionCheckpointRead | null> {
    const key = `checkpoint:${sessionId}:${checkpointId}`;
    let hit: { payload?: unknown; quarantined?: boolean; quarantineReason?: string } | null;
    try {
      hit = await getQuarantineAware(this.adapter, "system/snapshots", key);
    } catch {
      return null;
    }
    if (!hit) return null;
    const quarantined = hit.quarantined === true;
    return SessionCheckpointPolicy.parseCheckpointPayload(
      hit.payload,
      quarantined,
      quarantined ? hit.quarantineReason : undefined
    );
  }

  /**
   * Lista checkpoints quarantine-aware de una sesión (o todas si se omite
   * el filtro), ordenados por `turnCount` descendente.
   */
  public async listCheckpoints(sessionId?: string, limit: number = 50): Promise<SessionCheckpointRead[]> {
    const rows = await listQuarantineAware(this.adapter, "system/snapshots", limit, (err) => {
      console.warn(`[SessionCheckpointPolicy] listCheckpoints: barrido de cuarentena falló:`, err);
    });
    const out: SessionCheckpointRead[] = [];
    for (const row of rows) {
      if (sessionId && !row.key.includes(sessionId)) continue;
      const parsed = SessionCheckpointPolicy.parseCheckpointPayload(
        row.payload,
        row.quarantined,
        row.quarantined ? row.quarantineReason : undefined
      );
      if (parsed) out.push(parsed);
    }
    return out.sort((a, b) => b.turnCount - a.turnCount).slice(0, limit);
  }

  private static parseCheckpointPayload(
    payload: unknown,
    quarantined: boolean,
    quarantineReason?: string
  ): SessionCheckpointRead | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    if (
      typeof p["checkpointId"] !== "string" ||
      typeof p["sessionId"] !== "string" ||
      typeof p["turnId"] !== "string" ||
      typeof p["turnCount"] !== "number" ||
      typeof p["timestamp"] !== "number"
    ) {
      return null;
    }
    const summary =
      p["summary"] && typeof p["summary"] === "object"
        ? (p["summary"] as Record<string, unknown>)
        : {};
    return {
      checkpointId: p["checkpointId"] as string,
      sessionId: p["sessionId"] as string,
      turnId: p["turnId"] as string,
      turnCount: p["turnCount"] as number,
      timestamp: p["timestamp"] as number,
      summary,
      quarantined,
      ...(quarantineReason ? { quarantineReason } : {}),
    };
  }

  /**
   * Resetea el contador de turnos de una sesión.
   */
  public resetSession(sessionId: string): void {
    this.turnCounters.delete(sessionId);
  }
}
