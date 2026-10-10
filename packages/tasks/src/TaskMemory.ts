import { EgoMemoryAdapter } from '@ego/memory';
import { z } from 'zod';

export const TaskMemoryDataSchema = z.object({
  taskId: z.string(),
  goal: z.string(),
  subEgoId: z.string().optional(),
  context: z.record(z.unknown()).default({}),
  intermediateFindings: z.array(z.string()).default([]),
  generatedArtifacts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        uri: z.string(),
      })
    )
    .default([]),
  outcomeSummary: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type TaskMemoryData = z.infer<typeof TaskMemoryDataSchema>;

export class TaskMemory {
  constructor(private memoryAdapter: EgoMemoryAdapter) {}

  private getNamespace(taskId: string): string {
    return `tasks/${taskId}`;
  }

  public async initialize(
    taskId: string,
    goal: string,
    context: Record<string, unknown> = {},
    subEgoId?: string
  ): Promise<TaskMemoryData> {
    const now = Date.now();
    const data: TaskMemoryData = {
      taskId,
      goal,
      subEgoId,
      context,
      intermediateFindings: [],
      generatedArtifacts: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.save(data);
    return data;
  }

  public async appendFinding(taskId: string, finding: string): Promise<void> {
    const data = await this.getSnapshot(taskId);
    if (!data) {
      throw new Error(`Task memory for ${taskId} not initialized`);
    }

    data.intermediateFindings.push(finding);
    data.updatedAt = Date.now();
    await this.save(data);
  }

  public async recordArtifact(
    taskId: string,
    artifact: { id: string; name: string; uri: string }
  ): Promise<void> {
    const data = await this.getSnapshot(taskId);
    if (!data) {
      throw new Error(`Task memory for ${taskId} not initialized`);
    }

    data.generatedArtifacts.push(artifact);
    data.updatedAt = Date.now();
    await this.save(data);
  }

  public async finalizeOutcome(taskId: string, outcomeSummary: string): Promise<void> {
    const data = await this.getSnapshot(taskId);
    if (!data) {
      throw new Error(`Task memory for ${taskId} not initialized`);
    }

    data.outcomeSummary = outcomeSummary;
    data.updatedAt = Date.now();
    await this.save(data);
  }

  public async getSnapshot(taskId: string): Promise<TaskMemoryData | null> {
    const ns = this.getNamespace(taskId);
    const result = await this.memoryAdapter.get(ns, 'state');
    if (!result) {
      return null;
    }

    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return TaskMemoryDataSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  private async save(data: TaskMemoryData): Promise<void> {
    const ns = this.getNamespace(data.taskId);
    await this.memoryAdapter.put({
      namespace: ns,
      key: 'state',
      payload: data,
      metadata: {
        type: 'task_memory_snapshot',
        taskId: data.taskId,
        updatedAt: data.updatedAt,
      },
    });
  }
}
