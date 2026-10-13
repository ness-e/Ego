import { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";
import { computeAuditDigest } from "./EgoMemoryAdapter.js";
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
   * Resetea el contador de turnos de una sesión.
   */
  public resetSession(sessionId: string): void {
    this.turnCounters.delete(sessionId);
  }
}
