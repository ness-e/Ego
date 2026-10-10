import { describe, it, expect, vi } from 'vitest';
import { BackgroundEngine, TaskCheckpointManager } from '@ego/tasks';

describe('TASK-10 / OCLW-15: Prueba de Resiliencia ante Crash y Reanudación Post-Interrupción', () => {
  it('simula interrupción abrupta en el paso 6, reinicia el motor y completa exitosamente desde el checkpoint', async () => {
    // Almacén persistente simulado de VantaDB que sobrevive al "crash" del proceso
    const vantaDbStorage = new Map<string, Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>>();

    const mockAdapter: any = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) => {
        const items = vantaDbStorage.get(item.namespace) ?? [];
        const idx = items.findIndex((i) => i.key === item.key);
        if (idx >= 0) {
          items[idx] = { key: item.key, payload: item.payload, metadata: item.metadata };
        } else {
          items.push({ key: item.key, payload: item.payload, metadata: item.metadata });
        }
        vantaDbStorage.set(item.namespace, items);
      }),
      list: vi.fn(async (namespace: string) => {
        return vantaDbStorage.get(namespace) ?? [];
      }),
    };

    // 1. Primera Instancia de Ego (Proceso Electron Vivo)
    const checkpointManager1 = new TaskCheckpointManager(mockAdapter);
    let crashTriggered = false;

    const engine1 = new BackgroundEngine({
      checkpointProvider: {
        saveCheckpoint: async (taskId, state) => {
          await checkpointManager1.saveCheckpoint(taskId, state.step as number, `step_${state.step}`, state);
        },
        loadLatestCheckpoint: async (taskId) => {
          const cp = await checkpointManager1.loadLatestCheckpoint(taskId);
          return cp ? cp.state : null;
        },
      },
    });

    const stepsExecutedEngine1: number[] = [];

    // Tarea de 10 pasos que simula crash en el paso 6
    engine1.submit({
      id: 'heavy-indexing-task',
      title: 'Indexación Masiva con Checkpoints',
      execute: async ({ saveCheckpoint }) => {
        for (let i = 1; i <= 10; i++) {
          stepsExecutedEngine1.push(i);

          // Guardar checkpoint en pasos pares
          if (i % 2 === 0) {
            await saveCheckpoint({ step: i, progress: i * 10 });
          }

          // Simular fallo catastrófico en el paso 6
          if (i === 6) {
            crashTriggered = true;
            throw new Error('CRASH_SIMULATED: Proceso Electron muerto abruptamente');
          }
        }
      },
    });

    // Esperar a que ocurra el crash
    await vi.waitFor(() => {
      expect(crashTriggered).toBe(true);
    });

    expect(stepsExecutedEngine1).toEqual([1, 2, 3, 4, 5, 6]);

    // Verificar que el checkpoint del paso 6 existe intacto en la base de datos
    const savedCp = await checkpointManager1.loadLatestCheckpoint('heavy-indexing-task');
    expect(savedCp).not.toBeNull();
    expect(savedCp?.stepIndex).toBe(6);
    expect(savedCp?.state).toEqual({ step: 6, progress: 60 });

    // 2. Segunda Instancia de Ego ("Reapertura de la Aplicación tras Reinicio")
    // Se crea una instancia limpia del motor y del manager contra la misma base de datos
    const checkpointManager2 = new TaskCheckpointManager(mockAdapter);
    const resumedSteps: number[] = [];

    const engine2 = new BackgroundEngine({
      checkpointProvider: {
        saveCheckpoint: async (taskId, state) => {
          await checkpointManager2.saveCheckpoint(taskId, state.step as number, `step_${state.step}`, state);
        },
        loadLatestCheckpoint: async (taskId) => {
          const cp = await checkpointManager2.loadLatestCheckpoint(taskId);
          return cp ? cp.state : null;
        },
      },
    });

    // Cargar checkpoint previo y reanudar la tarea
    const latestState = await checkpointManager2.loadLatestCheckpoint('heavy-indexing-task');
    expect(latestState).not.toBeNull();
    const resumeStep = (latestState?.state.step as number) + 1; // Comenzar en paso 7

    engine2.submit({
      id: 'heavy-indexing-task-resumed',
      title: 'Indexación Masiva (Reanudada)',
      execute: async ({ saveCheckpoint }) => {
        for (let i = resumeStep; i <= 10; i++) {
          resumedSteps.push(i);
          if (i % 2 === 0) {
            await saveCheckpoint({ step: i, progress: i * 10 });
          }
        }
        return { completed: true, totalSteps: 10 };
      },
    });

    await vi.waitFor(() => {
      const task = engine2.getTask('heavy-indexing-task-resumed');
      expect(task?.status).toBe('completed');
    });

    // Certificar que los pasos ejecutados post-crash fueron exactamente 7, 8, 9, 10
    expect(resumedSteps).toEqual([7, 8, 9, 10]);

    const finalCp = await checkpointManager2.loadLatestCheckpoint('heavy-indexing-task-resumed');
    expect(finalCp?.stepIndex).toBe(10);
    expect(finalCp?.state).toEqual({ step: 10, progress: 100 });
  });
});
