/**
 * WorkerPolicy — política de admisión, prioridad, backoff y salud (STAB-14).
 *
 * **Implementación propia de Ego** (patrón asimilado de helmor/openclaw ·
 * `worker-pool`): los handlers del `LocalTaskPool` son clausuras no
 * transferibles entre hilos, de modo que esta policy es pura (sin I/O) y se
 * aplica ANTES de despachar: admisión por presupuesto, orden por prioridad y
 * backoff determinista con health tracking. Reimplementación TS del patrón,
 * no copia de referencia: sin atribución de código derivado.
 */
export interface PrioritizableTask {
  id: string;
  priority: number;
  createdAt: number;
}

export interface WorkerPolicyOptions {
  /** Máximo de tareas encoladas admitidas (budget). */
  maxQueue?: number;
  /** Máximo de workers concurrentes admitidos (budget). */
  maxConcurrent?: number;
  /** Base del backoff exponencial en ms. */
  backoffBaseMs?: number;
  /** Techo del backoff en ms. */
  backoffCapMs?: number;
  /** Fallos consecutivos antes de marcar degradado. */
  maxConsecutiveFailures?: number;
}

export class WorkerPolicy {
  private readonly maxQueue: number;
  private readonly maxConcurrent: number;
  private readonly backoffBaseMs: number;
  private readonly backoffCapMs: number;
  private readonly maxConsecutiveFailures: number;
  private consecutiveFailures = 0;

  constructor(options: WorkerPolicyOptions = {}) {
    this.maxQueue = options.maxQueue ?? 100;
    this.maxConcurrent = options.maxConcurrent ?? 4;
    this.backoffBaseMs = options.backoffBaseMs ?? 100;
    this.backoffCapMs = options.backoffCapMs ?? 5_000;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 5;
  }

  /** Budget: admite solo si hay hueco en cola y en concurrencia. */
  public shouldAdmit(queued: number, active: number): boolean {
    if (queued < 0 || active < 0) return false;
    return queued < this.maxQueue && active < this.maxConcurrent;
  }

  /** Prioridad: mayor primero; desempate por antigüedad (createdAt asc). */
  public sortByPriority<T extends PrioritizableTask>(tasks: T[]): T[] {
    return [...tasks].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });
  }

  /** Backoff exponencial determinista: min(base * 2^attempt, cap). */
  public nextDelay(attempt: number): number {
    const n = Math.max(0, Math.floor(attempt));
    return Math.min(this.backoffBaseMs * 2 ** n, this.backoffCapMs);
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
  }

  public consecutiveFailureCount(): number {
    return this.consecutiveFailures;
  }

  /** Salud: degradado tras N fallos consecutivos; 1 éxito recupera. */
  public isHealthy(): boolean {
    return this.consecutiveFailures < this.maxConsecutiveFailures;
  }
}
