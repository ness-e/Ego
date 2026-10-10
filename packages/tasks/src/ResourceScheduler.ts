import * as os from 'node:os';
import { TaskRecord, TaskPriorityOrder } from './types.js';

export interface SchedulerPolicy {
  maxConcurrentTasks: number;
  maxHeapUsedRatio: number; // Ej. 0.80 (80%)
  eventLoopLagThresholdMs: number; // Ej. 100 ms
  agingThresholdMs?: number; // Tiempo tras el cual una tarea sube prioridad para evitar inanición
}

export interface SchedulerMetrics {
  heapUsageRatio: number;
  eventLoopLagMs: number;
  activeSlots: number;
  cpuLoadAvg: number[];
  canSchedule: boolean;
}

export class ResourceScheduler {
  private policy: Required<SchedulerPolicy>;
  private recentLags: number[] = [];

  constructor(policy: Partial<SchedulerPolicy> = {}) {
    this.policy = {
      maxConcurrentTasks: policy.maxConcurrentTasks ?? 3,
      maxHeapUsedRatio: policy.maxHeapUsedRatio ?? 0.8,
      eventLoopLagThresholdMs: policy.eventLoopLagThresholdMs ?? 100,
      agingThresholdMs: policy.agingThresholdMs ?? 60000, // 60 segundos
    };
  }

  public recordEventLoopLag(lagMs: number): void {
    this.recentLags.push(lagMs);
    if (this.recentLags.length > 5) {
      this.recentLags.shift();
    }
  }

  public getAverageEventLoopLag(): number {
    if (this.recentLags.length === 0) return 0;
    const sum = this.recentLags.reduce((acc, v) => acc + v, 0);
    return sum / this.recentLags.length;
  }

  public getHeapUsageRatio(): number {
    const mem = process.memoryUsage();
    return mem.heapUsed / mem.heapTotal;
  }

  public canScheduleNext(activeCount: number): boolean {
    if (activeCount >= this.policy.maxConcurrentTasks) {
      return false;
    }

    const heapRatio = this.getHeapUsageRatio();
    if (heapRatio > this.policy.maxHeapUsedRatio) {
      return false;
    }

    const lag = this.getAverageEventLoopLag();
    if (lag > this.policy.eventLoopLagThresholdMs) {
      return false;
    }

    return true;
  }

  public getAvailableSlots(activeCount: number): number {
    if (!this.canScheduleNext(activeCount)) {
      return 0;
    }
    return Math.max(0, this.policy.maxConcurrentTasks - activeCount);
  }

  public sortQueue(queue: TaskRecord[], now = Date.now()): TaskRecord[] {
    return [...queue].sort((a, b) => {
      // 1. Calcular prioridad efectiva con envejecimiento (aging)
      const aAge = now - a.createdAt;
      const bAge = now - b.createdAt;

      let aPrio = TaskPriorityOrder[a.priority];
      let bPrio = TaskPriorityOrder[b.priority];

      if (aAge > this.policy.agingThresholdMs && aPrio < TaskPriorityOrder.critical) {
        aPrio += 1; // Envejecimiento: incrementa 1 nivel
      }
      if (bAge > this.policy.agingThresholdMs && bPrio < TaskPriorityOrder.critical) {
        bPrio += 1;
      }

      if (bPrio !== aPrio) {
        return bPrio - aPrio;
      }

      // 2. FIFO dentro de la misma prioridad
      return a.createdAt - b.createdAt;
    });
  }

  public getMetrics(activeCount = 0): SchedulerMetrics {
    const heapUsageRatio = this.getHeapUsageRatio();
    const eventLoopLagMs = this.getAverageEventLoopLag();
    const canSchedule = this.canScheduleNext(activeCount);
    let cpuLoadAvg: number[] = [0, 0, 0];
    try {
      cpuLoadAvg = os.loadavg();
    } catch {
      // No-op en entornos donde loadavg no está disponible
    }

    return {
      heapUsageRatio,
      eventLoopLagMs,
      activeSlots: activeCount,
      cpuLoadAvg,
      canSchedule,
    };
  }
}
