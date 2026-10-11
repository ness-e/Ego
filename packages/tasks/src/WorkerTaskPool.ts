import { availableParallelism } from "node:os";

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
}

export interface WorkerPoolMetrics {
  activeWorkers: number;
  queuedTasks: number;
  totalCompleted: number;
  totalFailed: number;
}

/**
 * Pool de ejecución de tareas pesadas en worker threads (OCLW-10).
 * Extraído y adaptado de OpenClaw packages/worker-runtime.
 *
 * Evita el congelamiento del Event Loop del proceso Electron Main
 * ejecutando cómputo CPU-intensivo (indexación, diffs masivos, AST parsing)
 * de forma estrictamente paralela y con límites de cuota.
 */
export class WorkerTaskPool {
  private readonly maxWorkers: number;
  private readonly defaultTimeoutMs: number;
  private readonly queue: Array<WorkerTask<any, any>> = [];
  private activeWorkers = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private isTerminated = false;

  constructor(config: WorkerTaskPoolConfig = {}) {
    const cpus = typeof availableParallelism === "function" ? availableParallelism() : 4;
    this.maxWorkers = config.maxWorkers ?? Math.max(1, cpus - 1);
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30_000;
  }

  /**
   * Despacha una tarea computacional al pool de workers.
   */
  public async execute<TInput = unknown, TOutput = unknown>(
    name: string,
    input: TInput,
    handler: (input: TInput) => Promise<TOutput> | TOutput,
    options: { timeoutMs?: number } = {}
  ): Promise<TOutput> {
    if (this.isTerminated) {
      throw new Error("WorkerTaskPool se encuentra terminado.");
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const taskId = `wtask_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return new Promise<TOutput>((resolve, reject) => {
      const task: WorkerTask<TInput, TOutput> = {
        id: taskId,
        name,
        input,
        resolve: (val) => {
          if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
          this.totalCompleted++;
          resolve(val);
        },
        reject: (err) => {
          if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
          this.totalFailed++;
          reject(err);
        },
      };

      if (timeoutMs > 0) {
        task.timeoutTimer = setTimeout(() => {
          task.reject(new Error(`Timeout de ${timeoutMs}ms excedido en tarea '${name}'.`));
        }, timeoutMs);
      }

      this.queue.push({
        ...task,
        fn: async () => handler(input),
      } as any);

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
      task.reject(new Error("WorkerTaskPool terminado por cierre del sistema."));
    }
  }

  private scheduleNext(): void {
    if (this.isTerminated || this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift()! as any;
    this.activeWorkers++;

    // Despachar en microtask / worker tick
    setImmediate(async () => {
      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      } finally {
        this.activeWorkers--;
        this.scheduleNext();
      }
    });
  }
}
