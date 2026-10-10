import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskCheckpointManager } from '../src/TaskCheckpoint.js';

describe('TaskCheckpointManager (TASK-03 / MEMG-20 / OCLW-15)', () => {
  let mockAdapter: any;
  let checkpointManager: TaskCheckpointManager;
  const storage: { namespace: string; key: string; payload: unknown }[] = [];

  beforeEach(() => {
    storage.length = 0;
    mockAdapter = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        storage.push({ namespace: item.namespace, key: item.key, payload: item.payload });
      }),
      list: vi.fn(async (namespace: string) => {
        return storage
          .filter((item) => item.namespace === namespace)
          .map((item) => ({ key: item.key, payload: item.payload }));
      }),
    };
    checkpointManager = new TaskCheckpointManager(mockAdapter);
  });

  it('guarda checkpoints atómicos con hash criptográfico SHA-256', async () => {
    const cp = await checkpointManager.saveCheckpoint('task-500', 3, 'analizar-ast', {
      filesScanned: 15,
      currentOffset: 1024,
    });

    expect(cp.taskId).toBe('task-500');
    expect(cp.stepIndex).toBe(3);
    expect(cp.checksum).toBeDefined();
    expect(cp.checksum).toHaveLength(64); // SHA-256 hex string

    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'tasks/task-500/checkpoints',
        metadata: expect.objectContaining({ type: 'task_checkpoint', checksum: cp.checksum }),
      })
    );
  });

  it('recupera el checkpoint más reciente válido', async () => {
    await checkpointManager.saveCheckpoint('task-500', 1, 'paso-1', { progress: 10 });
    await new Promise((r) => setTimeout(r, 10));
    await checkpointManager.saveCheckpoint('task-500', 2, 'paso-2', { progress: 50 });
    await new Promise((r) => setTimeout(r, 10));
    await checkpointManager.saveCheckpoint('task-500', 3, 'paso-3', { progress: 90 });

    const latest = await checkpointManager.loadLatestCheckpoint('task-500');
    expect(latest).not.toBeNull();
    expect(latest?.stepIndex).toBe(3);
    expect(latest?.stepName).toBe('paso-3');
    expect(latest?.state).toEqual({ progress: 90 });
  });

  it('descarta automáticamente snapshots con checksum alterado o corrupto', async () => {
    const valid = await checkpointManager.saveCheckpoint('task-corrupt', 1, 'bueno', { val: 'ok' });

    const corruptPayload = {
      taskId: 'task-corrupt',
      stepIndex: 2,
      stepName: 'falso',
      state: { val: 'manipulado' },
      timestamp: valid.timestamp + 500,
      checksum: 'hash-falso-invalido',
    };
    storage.push({
      namespace: 'tasks/task-corrupt/checkpoints',
      key: 'step_2_corrupt',
      payload: corruptPayload,
    });

    const loaded = await checkpointManager.loadLatestCheckpoint('task-corrupt');
    expect(loaded).not.toBeNull();
    expect(loaded?.stepIndex).toBe(1);
    expect(loaded?.stepName).toBe('bueno');
    expect(loaded?.state).toEqual({ val: 'ok' });
  });

  it('retorna null si no existen checkpoints previos', async () => {
    const loaded = await checkpointManager.loadLatestCheckpoint('task-vacia');
    expect(loaded).toBeNull();
  });
});
