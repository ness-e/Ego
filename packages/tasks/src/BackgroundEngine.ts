import {
  TaskDefinition,
  TaskRecord,
  TaskFilter,
  TaskPriorityOrder,
  TaskPriority,
} from './types.js';

export interface BackgroundEngineOptions {
  maxConcurrent?: number;
  defaultTimeoutMs?: number;
  approvalPolicy?: TaskApprovalPolicy;
  onTaskEvent?: (event: {
    type: 'task:created' | 'task:started' | 'task:progress' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'task:paused';
    task: TaskRecord;
  }) => void;
  checkpointProvider?: {
    saveCheckpoint: (taskId: string, state: Record<string, unknown>) => Promise<void>;
    loadLatestCheckpoint: (taskId: string) => Promise<Record<string, unknown> | null>;
  };
}

/**
 * Policy hook de aprobación para ejecución de tareas (F4T8 H22, gap Fase 11).
 *
 * Gobernanza sin UI: antes de ejecutar el handler, el engine consulta
 * `requiresApproval`. Si exige aprobación, la tarea queda `paused` con
 * `progressMessage` explícito y NO se ejecuta el handler hasta un `resume()`
 * posterior (p. ej. tras aprobación humana externa). Sin policy configurada
 * el comportamiento es el histórico (ejecución directa).
 *
 * Fail-closed: si el hook lanza, la tarea también queda en espera.
 */
export interface TaskApprovalPolicy {
  requiresApproval: (def: TaskDefinition) => boolean | Promise<boolean>;
  onApprovalRequired?: (taskId: string, def: TaskDefinition) => void;
}

export class BackgroundEngine {
  private tasks = new Map<string, TaskRecord>();
  private definitions = new Map<string, TaskDefinition>();
  private abortControllers = new Map<string, AbortController>();
  /** Tareas cuya pausa cooperativa fue solicitada (F4T8 H13). */
  private pauseRequested = new Set<string>();
  private activeCount = 0;
  private queue: string[] = [];
  private maxConcurrent: number;
  private defaultTimeoutMs: number;
  private approvalPolicy?: TaskApprovalPolicy;
  private onTaskEvent?: BackgroundEngineOptions['onTaskEvent'];
  private checkpointProvider?: BackgroundEngineOptions['checkpointProvider'];
  private isProcessing = false;

  constructor(options: BackgroundEngineOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60000;
    this.approvalPolicy = options.approvalPolicy;
    this.onTaskEvent = options.onTaskEvent;
    this.checkpointProvider = options.checkpointProvider;
  }

  public setCheckpointProvider(provider: BackgroundEngineOptions['checkpointProvider']): void {
    this.checkpointProvider = provider;
  }

  public setApprovalPolicy(policy: TaskApprovalPolicy | undefined): void {
    this.approvalPolicy = policy;
  }

  public submit<TInput = unknown, TOutput = unknown>(
    def: TaskDefinition<TInput, TOutput>
  ): TaskRecord {
    if (this.tasks.has(def.id)) {
      throw new Error(`Task with ID ${def.id} already exists`);
    }

    const priority: TaskPriority = def.priority ?? 'normal';
    const record: TaskRecord = {
      id: def.id,
      title: def.title,
      description: def.description,
      subEgoId: def.subEgoId,
      priority,
      status: 'submitted',
      progress: 0,
      createdAt: Date.now(),
      metadata: def.metadata,
    };

    this.tasks.set(def.id, record);
    this.definitions.set(def.id, def as TaskDefinition);
    this.emitEvent('task:created', record);

    this.enqueue(def.id);
    return record;
  }

  private enqueue(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'queued';
    this.queue.push(taskId);
    this.sortQueue();
    this.processNext();
  }

  private sortQueue(): void {
    this.queue.sort((aId, bId) => {
      const a = this.tasks.get(aId);
      const b = this.tasks.get(bId);
      if (!a || !b) return 0;
      const prioDiff = TaskPriorityOrder[b.priority] - TaskPriorityOrder[a.priority];
      if (prioDiff !== 0) return prioDiff;
      return a.createdAt - b.createdAt; // FIFO within same priority
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
        const nextId = this.queue.shift();
        if (!nextId) break;

        const task = this.tasks.get(nextId);
        if (!task || task.status !== 'queued') continue;

        this.activeCount++;
        // F4T8 M23: runTask es fire-and-forget intencional; el .catch defensivo
        // evita rechazos no observados si runTask llegara a lanzar ante un refactor.
        void this.runTask(nextId).catch((err: unknown) => {
          const pending = this.tasks.get(nextId);
          if (pending && (pending.status === 'running' || pending.status === 'queued')) {
            pending.status = 'failed';
            pending.completedAt = Date.now();
            pending.error = err instanceof Error ? err.message : String(err);
            this.emitEvent('task:failed', pending);
          }
          this.activeCount = Math.max(0, this.activeCount - 1);
          void this.processNext();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    const def = this.definitions.get(taskId);
    if (!task || !def) {
      this.activeCount = Math.max(0, this.activeCount - 1);
      return;
    }

    // Puerta de aprobación (F4T8 H22): el handler NO se ejecuta hasta que la
    // policy lo permita. La tarea espera en 'paused' y un resume() posterior
    // re-evalúa la policy (p. ej. tras aprobación externa).
    if (this.approvalPolicy) {
      let needsApproval = false;
      try {
        needsApproval = await this.approvalPolicy.requiresApproval(def);
      } catch {
        needsApproval = true;
      }
      if (needsApproval) {
        task.status = 'paused';
        task.progressMessage = 'Paused awaiting approval (policy hook)';
        this.emitEvent('task:paused', task);
        try {
          this.approvalPolicy.onApprovalRequired?.(taskId, def);
        } catch {
          // Defensive: el callback de notificación no debe romper el loop.
        }
        this.activeCount = Math.max(0, this.activeCount - 1);
        void this.processNext();
        return;
      }
    }

    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);

    task.status = 'running';
    task.startedAt = Date.now();
    this.emitEvent('task:started', task);

    const timeoutMs = def.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutHandle = setTimeout(() => {
      abortController.abort(new Error(`Task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const context = {
      taskId,
      signal: abortController.signal,
      reportProgress: (progress: number, message?: string) => {
        if (task.status !== 'running') return;
        task.progress = Math.min(100, Math.max(0, progress));
        task.progressMessage = message;
        this.emitEvent('task:progress', task);
      },
      saveCheckpoint: async (state: Record<string, unknown>) => {
        if (this.checkpointProvider) {
          await this.checkpointProvider.saveCheckpoint(taskId, state);
        }
      },
      loadCheckpoint: async () => {
        if (this.checkpointProvider) {
          return await this.checkpointProvider.loadLatestCheckpoint(taskId);
        }
        return null;
      },
    };

    // F4T8 M23: variable local en vez de `def.maxRetries!` (frágil a refactor).
    const maxRetries = def.maxRetries ?? 0;
    let retriesLeft = maxRetries;
    let success = false;

    while (!success) {
      try {
        const result = await def.execute(context);
        clearTimeout(timeoutHandle);
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = Date.now();
        task.result = result;
        this.emitEvent('task:completed', task);
        success = true;
      } catch (err: unknown) {
        if (abortController.signal.aborted) {
          clearTimeout(timeoutHandle);
          // Pausa cooperativa (F4T8 H13): si el abort proviene de pause(),
          // el estado permanece 'paused' — NUNCA se sobrescribe a 'cancelled'.
          // pause() ya emitió 'task:paused'; aquí solo se preserva el estado
          // para que resume() pueda reanudar la tarea.
          if (this.pauseRequested.delete(taskId)) {
            task.status = 'paused';
            break;
          }
          task.status = 'cancelled';
          task.completedAt = Date.now();
          task.error = abortController.signal.reason?.message || 'Task was cancelled';
          this.emitEvent('task:cancelled', task);
          break;
        }

        if (retriesLeft > 0) {
          retriesLeft--;
          task.progressMessage = `Reintentando tarea (${maxRetries - retriesLeft}/${maxRetries})...`;
          continue;
        }

        clearTimeout(timeoutHandle);
        task.status = 'failed';
        task.completedAt = Date.now();
        task.error = err instanceof Error ? err.message : String(err);
        this.emitEvent('task:failed', task);
        break;
      }
    }

    this.abortControllers.delete(taskId);
    this.pauseRequested.delete(taskId);
    this.activeCount = Math.max(0, this.activeCount - 1);
    void this.processNext();
  }

  public cancel(taskId: string, reason = 'Cancelled by user'): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'queued') {
      task.status = 'cancelled';
      task.completedAt = Date.now();
      task.error = reason;
      this.queue = this.queue.filter((id) => id !== taskId);
      this.emitEvent('task:cancelled', task);
      return true;
    }

    if (task.status === 'running') {
      const controller = this.abortControllers.get(taskId);
      if (controller) {
        controller.abort(new Error(reason));
        return true;
      }
    }

    return false;
  }

  public pause(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'queued') {
      task.status = 'paused';
      this.queue = this.queue.filter((id) => id !== taskId);
      this.emitEvent('task:paused', task);
      return true;
    }

    if (task.status === 'running') {
      // Pausa cooperativa (F4T8 H13): se aborta para desbloquear al handler,
      // pero runTask distingue este abort del de cancel/timeout mediante
      // pauseRequested y preserva 'paused' (nunca 'cancelled').
      // El handler DEBE observar `signal` y abortar su trabajo; si lo ignora
      // y retorna, la tarea completará normalmente (limitación documentada).
      // El reintento tras resume() puede usar save/loadCheckpoint.
      const controller = this.abortControllers.get(taskId);
      if (controller) {
        this.pauseRequested.add(taskId);
        task.status = 'paused';
        controller.abort(new Error('Task paused'));
        this.emitEvent('task:paused', task);
        return true;
      }
    }

    return false;
  }

  public resume(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    this.enqueue(taskId);
    return true;
  }

  public getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  public listTasks(filter?: TaskFilter): TaskRecord[] {
    let list = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status && filter.status.length > 0) {
        list = list.filter((t) => filter.status!.includes(t.status));
      }
      if (filter.subEgoId) {
        list = list.filter((t) => t.subEgoId === filter.subEgoId);
      }
      if (filter.priority && filter.priority.length > 0) {
        list = list.filter((t) => filter.priority!.includes(t.priority));
      }
      if (filter.limit && filter.limit > 0) {
        list = list.slice(0, filter.limit);
      }
    }

    return list;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  private emitEvent(
    type: 'task:created' | 'task:started' | 'task:progress' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'task:paused',
    task: TaskRecord
  ): void {
    if (this.onTaskEvent) {
      try {
        this.onTaskEvent({ type, task: { ...task } });
      } catch {
        // Defensive: do not break execution loop if listener throws
      }
    }
  }
}
