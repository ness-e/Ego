import { describe, it, expect, vi } from 'vitest';
import { TaskCancellationManager } from '../src/TaskCancellation.js';

describe('TaskCancellationManager (TASK-09 / TASK-11 / DIST-20)', () => {
  it('crea y aborta AbortSignal de forma reactiva', () => {
    const manager = new TaskCancellationManager();
    const signal = manager.createSignal('task-1');

    expect(signal.aborted).toBe(false);
    expect(manager.isCancelled('task-1')).toBe(false);

    const cancelled = manager.cancel('task-1', 'Usuario canceló');
    expect(cancelled).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(manager.isCancelled('task-1')).toBe(true);
  });

  it('es idempotente si la tarea ya fue cancelada', () => {
    const manager = new TaskCancellationManager();
    manager.createSignal('task-1');
    manager.cancel('task-1');

    const secondCancel = manager.cancel('task-1');
    expect(secondCancel).toBe(false);
  });

  it('propaga la cancelación hacia operaciones nativas registradas (DIST-20 / TASK-11)', () => {
    const manager = new TaskCancellationManager();
    manager.createSignal('task-native');

    const cancelNativeSpy = vi.fn();
    manager.registerNativeOperation('task-native', {
      id: 'native-query-1',
      cancel: cancelNativeSpy,
    });

    manager.cancel('task-native', 'Abortar consulta pesada VantaDB');

    expect(cancelNativeSpy).toHaveBeenCalledWith('Abortar consulta pesada VantaDB');
    expect(manager.isCancelled('task-native')).toBe(true);
  });

  it('permite desregistrar operaciones nativas completadas', () => {
    const manager = new TaskCancellationManager();
    manager.createSignal('task-2');

    const cancelNativeSpy = vi.fn();
    manager.registerNativeOperation('task-2', {
      id: 'op-finished',
      cancel: cancelNativeSpy,
    });

    manager.unregisterNativeOperation('task-2', 'op-finished');
    manager.cancel('task-2', 'Cancelación posterior');

    expect(cancelNativeSpy).not.toHaveBeenCalled();
  });

  it('cancela todas las tareas activas con cancelAll', () => {
    const manager = new TaskCancellationManager();
    const sig1 = manager.createSignal('task-a');
    const sig2 = manager.createSignal('task-b');

    manager.cancelAll('Cierre de aplicación');

    expect(sig1.aborted).toBe(true);
    expect(sig2.aborted).toBe(true);
  });
});
