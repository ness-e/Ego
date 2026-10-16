import { availableParallelism } from "node:os";
import { WorkerPolicy } from "./WorkerPolicy.js";

export interface WorkerTask<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  input: TInput;
  resolve: (value: TOutput) => void;
  reject: (reason?: unknown) => void;
  timeoutTimer?: NodeJS.Timeout;
}

export interface WorkerTaskPoolConfig {
  maxWorkers?: number;
  defaultTimeoutMs?: number;
  policy?: WorkerPolicy;
}

export interface PolicyAdmission {
  admitted: boolean;
  reason?: string;
}

export type TaskSubmitInput<T = unknown> =
  | (() => Promise<T> | T)
  | {
      id?: string;
      name?: string;
      run?: () => Promise<T> | T;
      execute?: () => Promise<T> | T;
      handler?: () => Promise<T> | T;
    };

/** Alias honesto de {@link LocalTaskPoolConfig} (retrocompatibilidad). */
export type LocalTaskPoolConfig = WorkerTaskPoolConfig;

export interface WorkerPoolMetrics {
  activeWorkers: number;
  queuedTasks: number;
  totalCompleted: number;
  totalFailed: number;
}

/** Alias honesto de {@link WorkerPoolMetrics} (retrocompatibilidad). */
export type LocalPoolMetrics = WorkerPoolMetrics;

interface PooledTask {
  id: string;
  name: string;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeoutTimer?: NodeJS.Timeout;
  /** true cuando la promesa externa ya se asentó (éxito, fallo o timeout). */
  settled: boolean;
  /** true mientras la tarea retiene un slot de ejecución. */
  slotHeld: boolean;
}

/**
 * Pool local de ejecución cooperativa (antes `WorkerTaskPool`, OCLW-10).
 *
 * ACLARACIÓN DE ALCANCE (F4T8 H11): esta clase NO usa `node:worker_threads`
 * ni provee paralelismo real. Los handlers se despachan con `setImmediate`
 * en el hilo principal del proceso y cooperan con el event loop: mientras un
 * handler espera (I/O, timers) otros turnos avanzan, pero cómputo CPU-intensivo
 * síncrono sigue bloqueando el hilo igual que sin pool.
 *
 * Se mantiene el nombre histórico `WorkerTaskPool` como alias por
 * compatibilidad, pero el nombre canónico es `LocalTaskPool`.
 *
 * Migrar a `worker_threads` reales exigiría descriptores de trabajo
 * serializables (los handlers actuales son clausuras arbitrarias, no
 * transferibles entre hilos) y rompería la API; queda fuera del alcance de
 * esta task por costo/evidencia. Para CPU-bound real, usar `worker_threads`
 * con payloads serializables fuera de este pool.
 */
export class LocalTaskPool {
  private readonly maxWorkers: number;
  private readonly defaultTimeoutMs: number;
  private readonly queue: PooledTask[] = [];
  private readonly policy: WorkerPolicy;
  private activeWorkers = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private isTerminated = false;

  constructor(
    configOrMaxConcurrency: WorkerTaskPoolConfig | number = 4,
    policy?: WorkerPolicy
  ) {
    const cpus = typeof availableParallelism === "function" ? availableParallelism() : 4;
    let maxConcurrency: number;
    if (typeof configOrMaxConcurrency === "number") {
      maxConcurrency = configOrMaxConcurrency;
      this.maxWorkers = Math.max(1, maxConcurrency);
      this.defaultTimeoutMs = 30_000;
      this.policy = policy ?? new WorkerPolicy({ maxConcurrent: Math.max(1, maxConcurrency) });
    } else {
      maxConcurrency = configOrMaxConcurrency.maxWorkers ?? Math.max(1, cpus - 1);
      this.maxWorkers = maxConcurrency;
      this.defaultTimeoutMs = configOrMaxConcurrency.defaultTimeoutMs ?? 30_000;
      this.policy =
        policy ??
        configOrMaxConcurrency.policy ??
        new WorkerPolicy({ maxConcurrent: Math.max(1, maxConcurrency) });
    }
  }

  public get activeCount(): number {
    return this.activeWorkers;
  }

  public getPolicy(): WorkerPolicy {
    return this.policy;
  }

  /**
   * Envía una tarea al pool verificando la política de admisión de WorkerPolicy.
   */
  public async submit<T = unknown>(task: TaskSubmitInput<T>): Promise<T> {
    if (this.isTerminated) {
      throw new Error("LocalTaskPool se encuentra terminado.");
    }

    const rawAdmission = (this.policy as unknown as { shouldAdmit: (...args: any[]) => boolean | PolicyAdmission }).shouldAdmit(
      this.activeCount,
      this.queue.length
    );
    const admission: PolicyAdmission =
      typeof rawAdmission === "boolean"
        ? { admitted: rawAdmission, reason: rawAdmission ? undefined : "capacity exceeded" }
        : rawAdmission;

    if (!admission.admitted) {
      throw new Error(`Task rejected by WorkerPolicy: ${admission.reason}`);
    }

    const runFn =
      typeof task === "function"
        ? task
        : typeof task.run === "function"
          ? () => task.run!()
          : typeof task.execute === "function"
            ? () => task.execute!()
            : typeof task.handler === "function"
              ? () => task.handler!()
              : () => Promise.reject(new Error("Invalid task: no run, execute, or handler method provided"));

    const name =
      typeof task === "object" && task && "name" in task && typeof task.name === "string"
        ? task.name
        : "submitted_task";

    return this.execute<void, T>(name, undefined, () => runFn());
  }

  /**
   * Despacha una tarea al pool local.
   */
  public async execute<TInput = unknown, TOutput = unknown>(
    name: string,
    input: TInput,
    handler: (input: TInput) => Promise<TOutput> | TOutput,
    options: { timeoutMs?: number } = {}
  ): Promise<TOutput> {
    if (this.isTerminated) {
      throw new Error("LocalTaskPool se encuentra terminado.");
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const taskId = `wtask_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return new Promise<TOutput>((resolve, reject) => {
      const task: PooledTask = {
        id: taskId,
        name,
        run: () => Promise.resolve().then(() => handler(input)),
        resolve: () => undefined,
        reject: () => undefined,
        settled: false,
        slotHeld: false,
      };

      task.resolve = (value: unknown) => {
        if (task.settled) return;
        task.settled = true;
        if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
        this.totalCompleted++;
        this.policy.recordSuccess();
        resolve(value as TOutput);
      };

      task.reject = (reason?: unknown) => {
        if (task.settled) return;
        task.settled = true;
        if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
        this.totalFailed++;
        this.policy.recordFailure();
        reject(reason);
      };

      if (timeoutMs > 0) {
        task.timeoutTimer = setTimeout(() => {
          this.handleTimeout(task, name, timeoutMs);
        }, timeoutMs);
      }

      this.queue.push(task);
      this.scheduleNext();
    });
  }

  /**
   * Obtiene métricas en tiempo real del pool.
   */
  public getMetrics(): WorkerPoolMetrics {
    return {
      activeWorkers: this.activeWorkers,
      queuedTasks: this.queue.length,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
    };
  }

  /**
   * Termina el pool y cancela tareas pendientes.
   */
  public terminate(): void {
    this.isTerminated = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      task.reject(new Error("LocalTaskPool terminado por cierre del sistema."));
    }
  }

  /**
   * Timeout (F4T8 H12): asienta la tarea una sola vez, libera el slot que
   * retenía (encolada o en ejecución) y deja que la resolución tardía del
   * handler se ignore vía `settled`, sin doble conteo.
   */
  private handleTimeout(task: PooledTask, name: string, timeoutMs: number): void {
    if (task.settled) return;

    const queuedIndex = this.queue.indexOf(task);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
    }
    if (task.slotHeld) {
      task.slotHeld = false;
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    }

    task.reject(new Error(`Timeout de ${timeoutMs}ms excedido en tarea '${name}'.`));
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.isTerminated || this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift()!;
    if (task.settled) {
      // Asentada mientras esperaba (p. ej. timeout encolado): saltar sin slot.
      this.scheduleNext();
      return;
    }
    this.activeWorkers++;
    task.slotHeld = true;

    // Despacho cooperativo en el hilo principal (NO es un worker thread).
    setImmediate(async () => {
      try {
        const result = await task.run();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      } finally {
        if (task.slotHeld) {
          task.slotHeld = false;
          this.activeWorkers = Math.max(0, this.activeWorkers - 1);
        }
        this.scheduleNext();
      }
    });
  }
}

/**
 * Nombre histórico del pool (OCLW-10).
 *
 * @deprecated Usar {@link LocalTaskPool}. El alias existe solo por
 * compatibilidad: la ejecución es cooperativa en el hilo principal, no en
 * worker threads (ver F4T8 H11).
 */
export class WorkerTaskPool extends LocalTaskPool {
  constructor(
    configOrMaxConcurrency: WorkerTaskPoolConfig | number = 4,
    policy?: WorkerPolicy
  ) {
    super(configOrMaxConcurrency, policy);
  }
}
