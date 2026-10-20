/**
 * Circuit breaker por herramienta + cuota de llamadas por Sub-Ego (R5).
 *
 * PROBLEMA (EGO-FIND-43/44, R5)
 * ------------------------------
 * `ExecutionManager` tenía concurrencia, timeout, abort y truncado, pero
 * **ni circuit breaker ni quota**:
 * - Un tool MCP colgado consumía un slot cada 30 s **indefinidamente**
 *   (múltiples slots si se colgaba en paralelo), degradando el host.
 * - Un Sub-Ego podía llamar en bucle sin límite.
 *
 * DISEÑO
 * ------
 * - **Circuit breaker por tool** (closed → open → half-open):
 *   `failureThreshold` fallos **consecutivos** abren el circuito; mientras
 *   está abierto, las llamadas se **vetan al instante** (sin ocupar slot ni
 *   esperar el timeout). Tras `resetTimeoutMs` el circuito pasa a
 *   *half-open* y admite **una** llamada de prueba: si funciona, se cierra;
 *   si falla, se vuelve a abrir.
 * - **Quota por Sub-Ego**: contador por `subEgoId` con tope configurable
 *   (y overrides por Sub-Ego). Al superarlo, la llamada se veta con error
 *   tipado, sin ocupar slot.
 *
 * Los dos vetos son **fail-fast**: devuelven un resultado de error con el
 * mensaje del error tipado, sin lanzar (el runtime trata los errores de
 * herramienta como datos, no como excepciones).
 */

export type CircuitState = "closed" | "open" | "half-open";

/** Error tipado: el circuito de la herramienta está abierto. */
export class ToolCircuitOpenError extends Error {
  public readonly toolName: string;
  public readonly failureCount: number;
  public readonly state: CircuitState;

  constructor(toolName: string, failureCount: number, state: CircuitState = "open") {
    super(
      `[ExecutionManager] Circuito abierto para la herramienta '${toolName}' ` +
        `(${failureCount} fallos consecutivos). La llamada se veta sin ejecutarse.`
    );
    this.name = "ToolCircuitOpenError";
    this.toolName = toolName;
    this.failureCount = failureCount;
    this.state = state;
  }
}

/** Error tipado: el Sub-Ego agotó su cuota de llamadas. */
export class SubEgoQuotaExceededError extends Error {
  public readonly subEgoId: string;
  public readonly limit: number;

  constructor(subEgoId: string, limit: number) {
    super(
      `[ExecutionManager] Cuota de llamadas agotada por el Sub-Ego '${subEgoId}' ` +
        `(límite ${limit}). La llamada se veta sin ejecutarse.`
    );
    this.name = "SubEgoQuotaExceededError";
    this.subEgoId = subEgoId;
    this.limit = limit;
  }
}

export interface CircuitBreakerConfig {
  /**
   * Fallos **consecutivos** por tool que abren el circuito (por defecto: 5).
   */
  failureThreshold: number;
  /**
   * Ventana de reintento: tras este tiempo el circuito pasa a *half-open*
   * y admite una llamada de prueba (por defecto: 30,000 ms).
   */
  resetTimeoutMs: number;
}

export interface SubEgoQuotaConfig {
  /**
   * Tope de llamadas por Sub-Ego en la ventana del proceso (por defecto: 1000).
   */
  maxCalls: number;
  /**
   * Overrides por Sub-Ego (`{ "ego.privilegiado": 50 }`).
   */
  overrides?: Record<string, number>;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
};

export const DEFAULT_SUB_EGO_QUOTA_CONFIG: SubEgoQuotaConfig = {
  maxCalls: 1000,
};

interface ToolCircuitState {
  consecutiveFailures: number;
  openedAt: number | null;
  state: CircuitState;
  probeInFlight: boolean;
}

/**
 * Circuit breaker por herramienta.
 *
 * Estado por tool: `closed` (operativo) → `open` (vetado) → `half-open`
 * (una llamada de prueba) → `closed`/`open`.
 */
export class ToolCircuitBreaker {
  private readonly states = new Map<string, ToolCircuitState>();
  private readonly config: CircuitBreakerConfig;
  private readonly now: () => number;

  constructor(
    config: Partial<CircuitBreakerConfig> = {},
    now: () => number = Date.now
  ) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.now = now;
  }

  private stateOf(toolName: string): ToolCircuitState {
    let state = this.states.get(toolName);
    if (!state) {
      state = {
        consecutiveFailures: 0,
        openedAt: null,
        state: "closed",
        probeInFlight: false,
      };
      this.states.set(toolName, state);
    }
    return state;
  }

  /** Estado actual del circuito de la herramienta (para observabilidad). */
  public getState(toolName: string): CircuitState {
    const state = this.stateOf(toolName);
    this.refresh(state);
    return state.state;
  }

  /** Refresca la transición open → half-open por tiempo transcurrido. */
  private refresh(state: ToolCircuitState): void {
    if (state.state !== "open" || state.openedAt === null) return;
    if (this.now() - state.openedAt >= this.config.resetTimeoutMs) {
      state.state = "half-open";
      state.probeInFlight = false;
    }
  }

  /**
   * ¿Puede ejecutarse la llamada? Lanza {@link ToolCircuitOpenError} si el
   * circuito está abierto (o ya hay una sonda *half-open* en vuelo).
   */
  public assertCanExecute(toolName: string): void {
    const state = this.stateOf(toolName);
    this.refresh(state);
    if (state.state === "open") {
      throw new ToolCircuitOpenError(toolName, state.consecutiveFailures, "open");
    }
    if (state.state === "half-open") {
      if (state.probeInFlight) {
        throw new ToolCircuitOpenError(toolName, state.consecutiveFailures, "half-open");
      }
      state.probeInFlight = true;
    }
  }

  /** Registra un fallo de la herramienta (abre el circuito si alcanza el umbral). */
  public recordFailure(toolName: string): void {
    const state = this.stateOf(toolName);
    state.consecutiveFailures += 1;
    if (state.state === "half-open" || state.consecutiveFailures >= this.config.failureThreshold) {
      state.state = "open";
      state.openedAt = this.now();
      state.probeInFlight = false;
    }
  }

  /** Registra un éxito: el circuito se cierra y el contador se reinicia. */
  public recordSuccess(toolName: string): void {
    const state = this.stateOf(toolName);
    state.consecutiveFailures = 0;
    state.openedAt = null;
    state.state = "closed";
    state.probeInFlight = false;
  }

  /** Reinicia el circuito de una herramienta (o de todas). */
  public reset(toolName?: string): void {
    if (toolName === undefined) {
      this.states.clear();
      return;
    }
    this.states.delete(toolName);
  }
}

/**
 * Contador de llamadas por Sub-Ego con tope configurable.
 */
export class SubEgoCallQuota {
  private readonly counts = new Map<string, number>();
  private readonly config: SubEgoQuotaConfig;

  constructor(config: Partial<SubEgoQuotaConfig> = {}) {
    this.config = { ...DEFAULT_SUB_EGO_QUOTA_CONFIG, ...config };
  }

  /** Tope aplicable a un Sub-Ego concreto. */
  public limitFor(subEgoId: string): number {
    const override = this.config.overrides?.[subEgoId];
    return typeof override === "number" && override >= 0 ? override : this.config.maxCalls;
  }

  /** Llamadas consumidas por un Sub-Ego. */
  public used(subEgoId: string): number {
    return this.counts.get(subEgoId) ?? 0;
  }

  /**
   * Consume una llamada de la cuota. Lanza {@link SubEgoQuotaExceededError}
   * si el Sub-Ego agotó su tope.
   */
  public consume(subEgoId: string): void {
    const limit = this.limitFor(subEgoId);
    const used = this.used(subEgoId);
    if (used >= limit) {
      throw new SubEgoQuotaExceededError(subEgoId, limit);
    }
    this.counts.set(subEgoId, used + 1);
  }

  /** Reinicia el contador de un Sub-Ego (o de todos). */
  public reset(subEgoId?: string): void {
    if (subEgoId === undefined) {
      this.counts.clear();
      return;
    }
    this.counts.delete(subEgoId);
  }
}
