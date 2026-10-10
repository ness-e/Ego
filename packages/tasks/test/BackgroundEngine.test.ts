import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundEngine } from '../src/BackgroundEngine.js';
import { TaskDefinition } from '../src/types.js';

describe('BackgroundEngine (TASK-01 / OCLW-13)', () => {
  let engine: BackgroundEngine;
  const events: any[] = [];

  beforeEach(() => {
    events.length = 0;
    engine = new BackgroundEngine({
      maxConcurrent: 2,
      defaultTimeoutMs: 1000,
      onTaskEvent: (ev) => events.push(ev),
    });
  });

  it('ejecuta una tarea exitosa y reporta ciclo de vida', async () => {
    const taskDef: TaskDefinition = {
      id: 'task-1',
      title: 'Procesamiento de texto',
      execute: async ({ reportProgress }) => {
        reportProgress(25, 'Iniciando');
        reportProgress(75, 'Procesando');
        return { count: 42 };
      },
    };

    const record = engine.submit(taskDef);
    expect(['queued', 'running']).toContain(record.status);

    // Esperar a que complete
    await vi.waitFor(() => {
      const current = engine.getTask('task-1');
      expect(current?.status).toBe('completed');
    });

    const completed = engine.getTask('task-1');
    expect(completed?.progress).toBe(100);
    expect(completed?.result).toEqual({ count: 42 });

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('task:created');
    expect(eventTypes).toContain('task:started');
    expect(eventTypes).toContain('task:progress');
    expect(eventTypes).toContain('task:completed');
  });

  it('respeta la prioridad encolando tareas críticas antes que tareas normales', async () => {
    const engineSingle = new BackgroundEngine({ maxConcurrent: 1 });
    let releaseGate: () => void = () => {};
    const blockerPromise = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    // 1. Tarea que bloquea el worker único
    engineSingle.submit({
      id: 'blocker',
      title: 'Bloqueador',
      execute: async () => {
        await blockerPromise;
        return 'ok';
      },
    });

    // 2. Tarea de baja prioridad
    engineSingle.submit({
      id: 'low-prio',
      title: 'Baja',
      priority: 'low',
      execute: async () => 'low done',
    });

    // 3. Tarea crítica añadida después
    engineSingle.submit({
      id: 'crit-prio',
      title: 'Crítica',
      priority: 'critical',
      execute: async () => 'crit done',
    });

    // Desbloquear
    releaseGate();

    await vi.waitFor(() => {
      expect(engineSingle.getTask('low-prio')?.status).toBe('completed');
      expect(engineSingle.getTask('crit-prio')?.status).toBe('completed');
    });

    const critTask = engineSingle.getTask('crit-prio');
    const lowTask = engineSingle.getTask('low-prio');
    // La tarea crítica debe haber comenzado antes que la de baja prioridad
    expect(critTask!.startedAt!).toBeLessThanOrEqual(lowTask!.startedAt!);
  });

  it('soporta reintentos ante excepciones transitorias', async () => {
    let attempts = 0;
    const taskDef: TaskDefinition = {
      id: 'task-retry',
      title: 'Con reintentos',
      maxRetries: 2,
      execute: async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Fallo transitorio');
        }
        return 'recuperado';
      },
    };

    engine.submit(taskDef);

    await vi.waitFor(() => {
      expect(engine.getTask('task-retry')?.status).toBe('completed');
    });

    expect(attempts).toBe(2);
    expect(engine.getTask('task-retry')?.result).toBe('recuperado');
  });

  it('aborta por timeout si excede el tiempo asignado', async () => {
    const taskDef: TaskDefinition = {
      id: 'task-timeout',
      title: 'Larga duración',
      timeoutMs: 50,
      execute: async ({ signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (signal.aborted) throw signal.reason;
        return 'no debe llegar';
      },
    };

    engine.submit(taskDef);

    await vi.waitFor(() => {
      const task = engine.getTask('task-timeout');
      expect(task?.status).toBe('cancelled');
    });

    const task = engine.getTask('task-timeout');
    expect(task?.error).toContain('timed out');
  });

  it('permite cancelar una tarea en vuelo cooperativamente', async () => {
    const taskDef: TaskDefinition = {
      id: 'task-cancel',
      title: 'A cancelar',
      execute: async ({ signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (signal.aborted) throw signal.reason;
        return 'no debe llegar';
      },
    };

    engine.submit(taskDef);

    await vi.waitFor(() => {
      expect(engine.getTask('task-cancel')?.status).toBe('running');
    });

    const cancelled = engine.cancel('task-cancel', 'Detenido por usuario');
    expect(cancelled).toBe(true);

    await vi.waitFor(() => {
      expect(engine.getTask('task-cancel')?.status).toBe('cancelled');
    });

    expect(engine.getTask('task-cancel')?.error).toBe('Detenido por usuario');
  });
});
