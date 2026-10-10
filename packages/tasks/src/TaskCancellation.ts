export interface AbortableOperation {
  id: string;
  cancel: (reason: string) => void | Promise<void>;
}

export class TaskCancellationManager {
  private controllers = new Map<string, AbortController>();
  private nativeOperations = new Map<string, Set<AbortableOperation>>();

  public createSignal(taskId: string): AbortSignal {
    let controller = this.controllers.get(taskId);
    if (!controller || controller.signal.aborted) {
      controller = new AbortController();
      this.controllers.set(taskId, controller);
    }
    return controller.signal;
  }

  public getSignal(taskId: string): AbortSignal | undefined {
    return this.controllers.get(taskId)?.signal;
  }

  public registerNativeOperation(taskId: string, operation: AbortableOperation): void {
    let set = this.nativeOperations.get(taskId);
    if (!set) {
      set = new Set();
      this.nativeOperations.set(taskId, set);
    }
    set.add(operation);
  }

  public unregisterNativeOperation(taskId: string, operationId: string): void {
    const set = this.nativeOperations.get(taskId);
    if (!set) return;

    for (const op of set) {
      if (op.id === operationId) {
        set.delete(op);
        break;
      }
    }
    if (set.size === 0) {
      this.nativeOperations.delete(taskId);
    }
  }

  public cancel(taskId: string, reason = 'Cancelled by user'): boolean {
    const controller = this.controllers.get(taskId);
    let didCancel = false;

    if (controller && !controller.signal.aborted) {
      controller.abort(new Error(reason));
      didCancel = true;
    }

    // Propagar cancelación a operaciones nativas registradas (DIST-20)
    const nativeOps = this.nativeOperations.get(taskId);
    if (nativeOps && nativeOps.size > 0) {
      for (const op of nativeOps) {
        try {
          void op.cancel(reason);
        } catch {
          // Defensive: ignorar fallos en handlers individuales
        }
      }
      this.nativeOperations.delete(taskId);
      didCancel = true;
    }

    return didCancel;
  }

  public cancelAll(reason = 'Cancelled all tasks'): void {
    for (const taskId of Array.from(this.controllers.keys())) {
      this.cancel(taskId, reason);
    }
  }

  public isCancelled(taskId: string): boolean {
    const controller = this.controllers.get(taskId);
    return controller ? controller.signal.aborted : false;
  }

  public cleanup(taskId: string): void {
    this.controllers.delete(taskId);
    this.nativeOperations.delete(taskId);
  }
}
