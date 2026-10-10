import { z } from 'zod';

export type TaskStatus =
  | 'submitted'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export const TaskPriorityOrder: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export const TaskRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  subEgoId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  status: z.enum([
    'submitted',
    'queued',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled',
  ]),
  progress: z.number().min(0).max(100).default(0),
  progressMessage: z.string().optional(),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  error: z.string().optional(),
  result: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TaskRecord = z.infer<typeof TaskRecordSchema>;

export interface TaskExecutionContext {
  taskId: string;
  signal: AbortSignal;
  reportProgress: (progress: number, message?: string) => void;
  saveCheckpoint: (state: Record<string, unknown>) => Promise<void>;
  loadCheckpoint: () => Promise<Record<string, unknown> | null>;
}

export interface TaskDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  title: string;
  description?: string;
  subEgoId?: string;
  priority?: TaskPriority;
  input?: TInput;
  execute: (context: TaskExecutionContext) => Promise<TOutput>;
  maxRetries?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskFilter {
  status?: TaskStatus[];
  subEgoId?: string;
  priority?: TaskPriority[];
  limit?: number;
}
