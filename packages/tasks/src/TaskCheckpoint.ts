import { EgoMemoryAdapter } from '@ego/memory';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const TaskCheckpointRecordSchema = z.object({
  taskId: z.string(),
  stepIndex: z.number(),
  stepName: z.string(),
  state: z.record(z.unknown()),
  timestamp: z.number(),
  checksum: z.string(), // SHA-256
});

export type TaskCheckpointRecord = z.infer<typeof TaskCheckpointRecordSchema>;

export class TaskCheckpointManager {
  constructor(private memoryAdapter: EgoMemoryAdapter) {}

  private getNamespace(taskId: string): string {
    return `tasks/${taskId}/checkpoints`;
  }

  public calculateChecksum(payload: unknown): string {
    const json = JSON.stringify(payload);
    return createHash('sha256').update(json).digest('hex');
  }

  public async saveCheckpoint(
    taskId: string,
    stepIndex: number,
    stepName: string,
    state: Record<string, unknown>
  ): Promise<TaskCheckpointRecord> {
    const timestamp = Date.now();
    const stateChecksum = this.calculateChecksum({ taskId, stepIndex, stepName, state });

    const record: TaskCheckpointRecord = {
      taskId,
      stepIndex,
      stepName,
      state,
      timestamp,
      checksum: stateChecksum,
    };

    const ns = this.getNamespace(taskId);
    const key = `step_${stepIndex}_${timestamp}`;

    // Guardar en namespace de checkpoints
    await this.memoryAdapter.put({
      namespace: ns,
      key,
      payload: record,
      metadata: {
        type: 'task_checkpoint',
        taskId,
        stepIndex,
        stepName,
        checksum: stateChecksum,
        timestamp,
      },
    });

    return record;
  }

  public async loadLatestCheckpoint(
    taskId: string
  ): Promise<TaskCheckpointRecord | null> {
    const ns = this.getNamespace(taskId);
    const results = await this.memoryAdapter.list(ns, 50);
    if (!results || results.length === 0) {
      return null;
    }

    // Filtrar checkpoints válidos ordenando por timestamp descendente
    const validRecords: TaskCheckpointRecord[] = [];

    for (const item of results) {
      try {
        const payload =
          typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
        const record = TaskCheckpointRecordSchema.parse(payload);

        // Validar integridad criptográfica
        const expectedChecksum = this.calculateChecksum({
          taskId: record.taskId,
          stepIndex: record.stepIndex,
          stepName: record.stepName,
          state: record.state,
        });

        if (expectedChecksum === record.checksum) {
          validRecords.push(record);
        }
      } catch {
        // Ignorar registros corruptos
        continue;
      }
    }

    if (validRecords.length === 0) {
      return null;
    }

    validRecords.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.stepIndex - a.stepIndex;
    });
    return validRecords[0];
  }

  public async clearCheckpoints(taskId: string): Promise<void> {
    const ns = this.getNamespace(taskId);
    await this.memoryAdapter.put({
      namespace: ns,
      key: 'cleared',
      payload: { cleared: true, taskId, timestamp: Date.now() },
      metadata: {
        type: 'task_checkpoints_cleared',
        taskId,
      },
    });
  }
}
