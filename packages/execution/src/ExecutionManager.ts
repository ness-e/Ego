import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import type {
  ExecutionEvent,
  ExecutionManagerConfig,
  ExecutionOptions,
  ExecutionResult,
  ExecutionStatus
} from "./types.js";

interface ActiveExecution {
  callId: string;
  toolName: string;
  startTime: number;
  abortController: AbortController;
}

/**
 * Execution Manager supervisor de Ego (ACT-03).
 *
 * Responsabilidades:
 * 1. Supervisión de procesos y herramientas aisladas del Cognitive Runtime.
 * 2. Control estricto de timeouts por llamada y timeouts configurables por herramienta.
 * 3. Cancelación cooperativa forzada mediante AbortController.
 * 4. Control de concurrencia máxima y mitigación de sobrecarga en el host.
 * 5. Protección de memoria contra desbordamiento truncando buffers y outputs gigantes.
 * 6. Registro de métricas de rendimiento y emisión de eventos de observabilidad.
 */
export class ExecutionManager {
  private readonly config: Required<ExecutionManagerConfig>;
  private readonly activeExecutions = new Map<string, ActiveExecution>();
  private currentRunningCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(config: ExecutionManagerConfig = {}) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      maxConcurrentExecutions: config.maxConcurrentExecutions ?? 5,
      maxOutputSizeBytes: config.maxOutputSizeBytes ?? 5 * 1024 * 1024, // 5MB
      onEvent: config.onEvent ?? (() => {})
    };
  }

  /**
   * Retorna el número de ejecuciones actualmente en curso.
   */
  public get runningCount(): number {
    return this.currentRunningCount;
  }

  /**
   * Retorna el número de ejecuciones en cola esperando slot de concurrencia.
   */
  public get queuedCount(): number {
    return this.queue.length;
  }

  /**
   * Lista las ejecuciones activas en curso.
   */
  public getActiveExecutions(): Array<{ callId: string; toolName: string; elapsedMs: number }> {
    const now = Date.now();
    return Array.from(this.activeExecutions.values()).map((e) => ({
      callId: e.callId,
      toolName: e.toolName,
      elapsedMs: now - e.startTime
    }));
  }

  /**
   * Aborta una ejecución activa por su callId.
   */
  public abortExecution(callId: string, reason = "Cancelado por usuario"): boolean {
    const active = this.activeExecutions.get(callId);
    if (active) {
      active.abortController.abort(new Error(reason));
      return true;
    }
    return false;
  }

  /**
   * Aborta todas las ejecuciones activas inmediatamente.
   */
  public abortAll(reason = "Cancelación global del runtime"): void {
    for (const active of this.activeExecutions.values()) {
      active.abortController.abort(new Error(reason));
    }
  }

  /**
   * Ejecuta una herramienta con supervisión estricta de timeouts, cuotas y cancelación.
   */
  public async execute<TInput = any, TOutput = any>(
    tool: ToolDefinition<TInput, TOutput>,
    input: TInput,
    context: ToolExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult<TOutput>> {
    const callId = context.callId;
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const maxOutputBytes = options.maxOutputSizeBytes ?? this.config.maxOutputSizeBytes;

    // Adquirir slot de concurrencia
    await this.acquireSlot();

    const startTime = Date.now();
    const abortController = new AbortController();
    let isTimeout = false;

    // Vincular con señales padre (context.abortSignal u options.abortSignal)
    const parentSignal = options.abortSignal ?? context.abortSignal;
    if (parentSignal) {
      if (parentSignal.aborted) {
        this.releaseSlot();
        return this.createResult<TOutput>(callId, tool.name, "aborted", undefined, "Señal cancelada previamente.", 0, false);
      }
      parentSignal.addEventListener(
        "abort",
        () => {
          abortController.abort(parentSignal.reason);
        },
        { once: true }
      );
    }

    // Configurar temporizador de timeout
    const timer = setTimeout(() => {
      isTimeout = true;
      abortController.abort(new Error(`Timeout de ${timeoutMs}ms excedido al ejecutar "${tool.name}".`));
      this.emitEvent({
        callId,
        toolName: tool.name,
        type: "timeout",
        durationMs: timeoutMs,
        timestamp: Date.now()
      });
    }, timeoutMs);

    // Registrar ejecución activa
    this.activeExecutions.set(callId, {
      callId,
      toolName: tool.name,
      startTime,
      abortController
    });

    this.emitEvent({
      callId,
      toolName: tool.name,
      type: "started",
      timestamp: startTime
    });

    // Inyectar abortSignal supervisado en el contexto
    const supervisedContext: ToolExecutionContext = {
      ...context,
      abortSignal: abortController.signal
    };

    try {
      const rawOutput = await tool.execute(input, supervisedContext);
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      // Truncamiento y sanitización de salida si excede maxOutputBytes
      const { output, truncated } = this.enforceOutputLimit(rawOutput, maxOutputBytes);

      this.emitEvent({
        callId,
        toolName: tool.name,
        type: "completed",
        durationMs,
        timestamp: Date.now()
      });

      return this.createResult(callId, tool.name, "success", output, undefined, durationMs, truncated);
    } catch (err: any) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      let status: ExecutionStatus = "error";
      let errorMsg: string;

      if (isTimeout) {
        status = "timeout";
        errorMsg = `Timeout de ${timeoutMs}ms excedido al ejecutar "${tool.name}".`;
      } else if (abortController.signal.aborted || parentSignal?.aborted) {
        status = "aborted";
        const reason = abortController.signal.reason || parentSignal?.reason;
        errorMsg =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
            ? reason
            : "Operación abortada";
      } else {
        errorMsg = err instanceof Error ? err.message : String(err);
      }

      this.emitEvent({
        callId,
        toolName: tool.name,
        type: status === "timeout" ? "timeout" : status === "aborted" ? "aborted" : "failed",
        durationMs,
        details: { error: errorMsg },
        timestamp: Date.now()
      });

      return this.createResult<TOutput>(callId, tool.name, status, undefined, errorMsg, durationMs, false);
    } finally {
      this.activeExecutions.delete(callId);
      this.releaseSlot();
    }
  }

  /**
   * Adquiere un slot de concurrencia o encola la petición.
   */
  private acquireSlot(): Promise<void> {
    if (this.currentRunningCount < this.config.maxConcurrentExecutions) {
      this.currentRunningCount++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.currentRunningCount++;
        resolve();
      });
    });
  }

  /**
   * Libera un slot y atiende a la siguiente ejecución encolada.
   */
  private releaseSlot(): void {
    this.currentRunningCount--;
    if (this.queue.length > 0 && this.currentRunningCount < this.config.maxConcurrentExecutions) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Trunca salidas excesivas que excedan la cuota en bytes para no saturar memoria.
   */
  private enforceOutputLimit<T>(rawOutput: T, maxBytes: number): { output: T; truncated: boolean } {
    if (typeof rawOutput === "string") {
      const byteLength = Buffer.byteLength(rawOutput, "utf-8");
      if (byteLength > maxBytes) {
        const truncatedString =
          rawOutput.slice(0, Math.floor(maxBytes * 0.95)) +
          `\n\n[... Truncado por ExecutionManager: la salida excedió la cuota de ${Math.round(
            maxBytes / 1024
          )} KB ...]`;
        return { output: truncatedString as unknown as T, truncated: true };
      }
    }
    return { output: rawOutput, truncated: false };
  }

  private createResult<T>(
    callId: string,
    toolName: string,
    status: ExecutionStatus,
    output: T | undefined,
    error: string | undefined,
    durationMs: number,
    truncated: boolean
  ): ExecutionResult<T> {
    return {
      callId,
      toolName,
      status,
      output,
      error,
      durationMs,
      truncated,
      timestamp: Date.now()
    };
  }

  private emitEvent(event: ExecutionEvent): void {
    try {
      this.config.onEvent(event);
    } catch {
      // Ignorar fallos en listeners de telemetría para no comprometer el runtime
    }
  }
}
