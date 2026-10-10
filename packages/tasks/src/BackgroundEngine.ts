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
  onTaskEvent?: (event: {
    type: 'task:created' | 'task:started' | 'task:progress' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'task:paused';
    task: TaskRecord;
  }) => void;
  checkpointProvider?: {
    saveCheckpoint: (taskId: string, state: Record<string, unknown>) => Promise<void>;
    loadLatestCheckpoint: (taskId: string) => Promise<Record<string, unknown> | null>;
  };
}

export class BackgroundEngine {
  private tasks = new Map<string, TaskRecord>();
  private definitions = new Map<string, TaskDefinition>();
  private abortControllers = new Map<string, AbortController>();
  private activeCount = 0;
  private queue: string[] = [];
  private maxConcurrent: number;
  private defaultTimeoutMs: number;
  private onTaskEvent?: BackgroundEngineOptions['onTaskEvent'];
  private checkpointProvider?: BackgroundEngineOptions['checkpointProvider'];
  private isProcessing = false;

  constructor(options: BackgroundEngineOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60000;
    this.onTaskEvent = options.onTaskEvent;
    this.checkpointProvider = options.checkpointProvider;
  }

  public setCheckpointProvider(provider: BackgroundEngineOptions['checkpointProvider']): void {
    this.checkpointProvider = provider;
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
        this.runTask(nextId);
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

    let retriesLeft = def.maxRetries ?? 0;
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
          task.status = 'cancelled';
          task.completedAt = Date.now();
          task.error = abortController.signal.reason?.message || 'Task was cancelled';
          this.emitEvent('task:cancelled', task);
          break;
        }

        if (retriesLeft > 0) {
          retriesLeft--;
          task.progressMessage = `Reintentando tarea (${def.maxRetries! - retriesLeft}/${def.maxRetries})...`;
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
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.processNext();
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
      // Pause in-flight cooperatively by cancelling and keeping checkpoint
      const controller = this.abortControllers.get(taskId);
      if (controller) {
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
