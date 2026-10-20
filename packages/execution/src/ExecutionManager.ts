import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { getErrorParts } from "@ego/tools";
import { randomUUID } from "node:crypto";
import type {
  ExecutionEvent,
  ExecutionManagerConfig,
  ExecutionOptions,
  ExecutionResult,
  ExecutionStatus
} from "./types.js";
import {
  SubEgoCallQuota,
  ToolCircuitBreaker,
  type CircuitState
} from "./CircuitBreaker.js";

interface ActiveExecution {
  callId: string;
  toolName: string;
  startTime: number;
  abortController: AbortController;
}

/** Ejecución en espera de slot de concurrencia (EGO-FIND-44). */
interface QueuedExecution {
  callId: string;
  resolve: () => void;
  reject: (reason: Error) => void;
  onAbort: (() => void) | null;
  signal?: AbortSignal;
}

/**
 * Trunca un texto sin partir un carácter UTF-8 multibyte.
 * La cuota del manager es en BYTES, no en caracteres (EGO-FIND-44).
 */
function truncateUtf8(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const buf = Buffer.from(text, "utf-8");
  if (buf.length <= maxBytes) return text;
  let end = maxBytes;
  // Si el byte en `end` es de continuación, el carácter quedaría partido.
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString("utf-8");
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
  private readonly queue: QueuedExecution[] = [];
  /** CallIds en espera de slot (para detectar colisiones antes de ejecutar). */
  private readonly queuedCallIds = new Set<string>();
  /** CallIds reservados durante toda la vida de la ejecución (L03). */
  private readonly claimedCallIds = new Set<string>();
  /** R5: circuit breaker por herramienta. */
  private readonly circuitBreaker: ToolCircuitBreaker;
  /** R5: cuota de llamadas por Sub-Ego. */
  private readonly subEgoQuota: SubEgoCallQuota;

  constructor(config: ExecutionManagerConfig = {}) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      maxConcurrentExecutions: config.maxConcurrentExecutions ?? 5,
      maxOutputSizeBytes: config.maxOutputSizeBytes ?? 5 * 1024 * 1024, // 5MB
      circuitBreaker: config.circuitBreaker ?? {},
      subEgoQuota: config.subEgoQuota ?? {},
      onEvent: config.onEvent ?? (() => {})
    };
    this.circuitBreaker = new ToolCircuitBreaker(this.config.circuitBreaker);
    this.subEgoQuota = new SubEgoCallQuota(this.config.subEgoQuota);
  }

  /**
   * Estado del circuito de una herramienta (R5): `closed` | `open` | `half-open`.
   */
  public getCircuitState(toolName: string): CircuitState {
    return this.circuitBreaker.getState(toolName);
  }

  /**
   * Llamadas consumidas por un Sub-Ego en la cuota vigente (R5).
   */
  public getSubEgoQuotaUsage(subEgoId: string): { used: number; limit: number } {
    return {
      used: this.subEgoQuota.used(subEgoId),
      limit: this.subEgoQuota.limitFor(subEgoId),
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
   * L10 — Justificación de los defaults `any`: el manager despacha herramientas
   * heterogéneas (`ToolDefinition` bare); tipar aquí rompería el catálogo.
   */
  public async execute<TInput = any, TOutput = any>(
    tool: ToolDefinition<TInput, TOutput>,
    input: TInput,
    context: ToolExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult<TOutput>> {
    // L03: el `callId` lo provee el llamante sin garantía de unicidad.
    // Vacío → id interno (aquí); colisión → sufijo `#n` al registrar
    // (allí, porque dos `execute` concurrentes resuelven antes de registrar).
    const requestedCallId = this.resolveCallId(context.callId);
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const maxOutputBytes = options.maxOutputSizeBytes ?? this.config.maxOutputSizeBytes;

    // L03: reclamar clave única contra el mapa real y la cola de espera.
    const callId = this.claimCallId(requestedCallId);

    const startTime = Date.now();
    const abortController = new AbortController();
    let isTimeout = false;

    // Vincular con señales padre (context.abortSignal u options.abortSignal)
    const parentSignal = options.abortSignal ?? context.abortSignal;

    // R5: vetos PRE-FLIGHT (fail-fast). Se aplican ANTES de adquirir slot:
    // una llamada vetada no debe ocupar concurrencia ni esperar al timeout.
    //   1. Circuit breaker: la herramienta está caída (tool MCP colgado).
    //   2. Cuota por Sub-Ego: el Sub-Ego agotó su presupuesto de llamadas.
    try {
      this.circuitBreaker.assertCanExecute(tool.name);
    } catch (err) {
      return this.createResult<TOutput>(
        callId,
        tool.name,
        "error",
        undefined,
        err instanceof Error ? err.message : String(err),
        0,
        false
      );
    }

    const subEgoId = context.subEgoId;
    if (subEgoId) {
      try {
        this.subEgoQuota.consume(subEgoId);
      } catch (err) {
        return this.createResult<TOutput>(
          callId,
          tool.name,
          "error",
          undefined,
          err instanceof Error ? err.message : String(err),
          0,
          false
        );
      }
    }

    // Adquirir slot de concurrencia (la espera en cola es cancelable).
    try {
      await this.acquireSlot(callId, parentSignal);
    } catch {
      this.claimedCallIds.delete(callId);
      return this.createResult<TOutput>(
        callId,
        tool.name,
        "aborted",
        undefined,
        "Cancelada antes de obtener un slot de ejecución.",
        Date.now() - startTime,
        false
      );
    }

    if (parentSignal) {
      if (parentSignal.aborted) {
        this.releaseSlot();
        this.claimedCallIds.delete(callId);
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
        timestamp: Date.now(),
        admittedRunContext: options.admittedRunContext
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
      timestamp: startTime,
      admittedRunContext: options.admittedRunContext
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
        timestamp: Date.now(),
        admittedRunContext: options.admittedRunContext
      });

      // R5: el éxito cierra el circuito de la herramienta.
      this.circuitBreaker.recordSuccess(tool.name);

      return this.createResult(callId, tool.name, "success", output, undefined, durationMs, truncated);
    } catch (err: unknown) {
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
        errorMsg = getErrorParts(err).message;
      }

      this.emitEvent({
        callId,
        toolName: tool.name,
        type: status === "timeout" ? "timeout" : status === "aborted" ? "aborted" : "failed",
        durationMs,
        details: { error: errorMsg },
        timestamp: Date.now(),
        admittedRunContext: options.admittedRunContext
      });

      // R5: un fallo (error o timeout) cuenta como fallo del circuito; una
      // cancelación del usuario NO (no es culpa de la herramienta).
      if (status === "error" || status === "timeout") {
        this.circuitBreaker.recordFailure(tool.name);
      }

      return this.createResult<TOutput>(callId, tool.name, status, undefined, errorMsg, durationMs, false);
    } finally {
      this.activeExecutions.delete(callId);
      this.claimedCallIds.delete(callId);
      this.releaseSlot();
    }
  }

  /**
   * L03: normaliza el `callId` del llamante (vacío → id interno único).
   */
  private resolveCallId(rawCallId: string): string {
    const trimmed = typeof rawCallId === "string" ? rawCallId.trim() : "";
    if (trimmed.length === 0) {
      console.warn(
        "[ExecutionManager] callId vacío del llamante: generando id interno para preservar unicidad."
      );
      return `call_internal_${randomUUID()}`;
    }
    return trimmed;
  }

  /**
   * L03: reclama una clave única en `activeExecutions`, sufijando `#n` ante
   * colisión para que `abortExecution` nunca mate a la ejecución equivocada.
   */
  /**
   * L03: reclama una clave única en `activeExecutions`, sufijando `#n` ante
   * colisión para que `abortExecution` nunca mate a la ejecución equivocada.
   * `claimedCallIds` cubre también las ejecuciones en cola de slot y las que
   * aún se están registrando (la clave se reserva al inicio de la llamada).
   */
  private claimCallId(requested: string): string {
    let candidate = requested;
    let suffix = 1;
    while (
      this.activeExecutions.has(candidate) ||
      this.queuedCallIds.has(candidate) ||
      this.claimedCallIds.has(candidate)
    ) {
      suffix += 1;
      candidate = `${requested}#${suffix}`;
    }
    this.claimedCallIds.add(candidate);
    if (candidate !== requested) {
      console.warn(
        `[ExecutionManager] Colisión de callId '${requested}': registrada como '${candidate}'.`
      );
    }
    return candidate;
  }

  /**
   * Adquiere un slot de concurrencia o encola la petición.
   *
   * EGO-FIND-44: la espera en cola es CANCELABLE. Si la señal padre se
   * aborta mientras la ejecución espera slot, se retira de la cola y se
   * rechaza de inmediato (antes seguía esperando el turno y ocupaba un slot
   * que ya no iba a usar).
   */
  private acquireSlot(callId: string, signal?: AbortSignal): Promise<void> {
    if (this.currentRunningCount < this.config.maxConcurrentExecutions) {
      this.currentRunningCount++;
      this.queuedCallIds.delete(callId);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueuedExecution = { callId, resolve, reject, onAbort: null, signal };
      this.queue.push(entry);
      this.queuedCallIds.add(callId);

      if (signal) {
        if (signal.aborted) {
          this.removeQueued(entry);
          reject(new Error("Cancelada antes de obtener slot de ejecución."));
          return;
        }
        const onAbort = () => {
          this.removeQueued(entry);
          reject(new Error("Cancelada antes de obtener slot de ejecución."));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        entry.onAbort = onAbort;
      }
    });
  }

  /** Retira una entrada de la cola (cancelación). */
  private removeQueued(entry: QueuedExecution): void {
    const idx = this.queue.indexOf(entry);
    if (idx >= 0) this.queue.splice(idx, 1);
    this.queuedCallIds.delete(entry.callId);
    if (entry.onAbort && entry.signal) {
      entry.signal.removeEventListener("abort", entry.onAbort);
      entry.onAbort = null;
    }
  }

  /**
   * Libera un slot y atiende a la siguiente ejecución encolada.
   */
  private releaseSlot(): void {
    this.currentRunningCount--;
    if (this.queue.length > 0 && this.currentRunningCount < this.config.maxConcurrentExecutions) {
      const next = this.queue.shift();
      if (next) {
        // El slot pasa de la ejecución que termina a la siguiente en cola.
        this.currentRunningCount++;
        this.queuedCallIds.delete(next.callId);
        if (next.onAbort && next.signal) {
          next.signal.removeEventListener("abort", next.onAbort);
          next.onAbort = null;
        }
        next.resolve();
      }
    }
  }

  /**
   * Trunca salidas excesivas que excedan la cuota en BYTES para no saturar memoria.
   *
   * EGO-FIND-44:
   * - La cuota se mide en bytes (no en caracteres): el texto UTF-8 multibyte
   *   ya no puede exceder el límite, y el corte nunca parte un carácter.
   * - La cuota también aplica a salidas NO-string (objetos/arrays), que antes
   *   pasaban sin límite.
   * - El tipo degradado es explícito: una string truncada conserva su tipo;
   *   un objeto truncado se sustituye por un envoltorio `{ truncated, preview }`.
   */
  private enforceOutputLimit<T>(rawOutput: T, maxBytes: number): { output: T; truncated: boolean } {
    if (typeof rawOutput === "string") {
      const byteLength = Buffer.byteLength(rawOutput, "utf-8");
      if (byteLength > maxBytes) {
        const budget = Math.max(0, maxBytes - 96);
        const truncatedString =
          truncateUtf8(rawOutput, budget) +
          `\n\n[... Truncado por ExecutionManager: la salida excedió la cuota de ${Math.round(
            maxBytes / 1024
          )} KB ...]`;
        return { output: truncatedString as unknown as T, truncated: true };
      }
      return { output: rawOutput, truncated: false };
    }

    if (rawOutput !== null && typeof rawOutput === "object") {
      let serialized: string | null = null;
      try {
        serialized = JSON.stringify(rawOutput);
      } catch {
        serialized = null;
      }
      if (serialized !== null && Buffer.byteLength(serialized, "utf-8") > maxBytes) {
        const budget = Math.max(0, maxBytes - 96);
        const preview = truncateUtf8(serialized, budget);
        // Tipo degradado explícito: el llamante recibe un envoltorio, no un
        // objeto pretendido ser el original.
        const degraded = {
          truncated: true,
          originalBytes: Buffer.byteLength(serialized, "utf-8"),
          preview,
        };
        return { output: degraded as unknown as T, truncated: true };
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
