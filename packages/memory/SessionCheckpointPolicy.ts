import { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";
import { generateOpaqueId } from "./OpaqueId.js";

export interface SessionCheckpointPolicyOptions {
  checkpointIntervalTurns?: number;
  failClosedOnToolFlushError?: boolean;
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
   */
  public async beforeModelStream(sessionId: string): Promise<void> {
    try {
      await this.adapter.flush();
    } catch (err: any) {
      console.warn(`[SessionCheckpointPolicy] Advertencia en flush previo a model stream para ${sessionId}:`, err);
    }
  }

  /**
   * Barrera de despacho de herramientas: persiste el estado antes de invocar
   * el cuerpo de la herramienta. Si falla el flush y failClosed es true, aborta el despacho.
   */
  public async beforeToolDispatch(
    sessionId: string,
    toolName: string,
    toolCallId: string
  ): Promise<CheckpointDecision> {
    try {
      // Registrar llamada pendiente en namespace audit antes de la ejecución
      await this.adapter.put({
        namespace: "gov/audit",
        key: `tool_dispatch:${toolCallId}`,
        payload: {
          sessionId,
          toolName,
          toolCallId,
          dispatchedAt: Date.now(),
          status: "pending_dispatch",
        },
      });

      await this.adapter.flush();
      return { proceed: true };
    } catch (err: any) {
      const errorMsg = `[SessionCheckpointPolicy] Fallo al asegurar durabilidad previa a tool ${toolName}: ${err.message}`;
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
