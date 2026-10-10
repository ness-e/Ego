import { describe, it, expect } from 'vitest';
import { ResourceScheduler } from '../src/ResourceScheduler.js';
import { TaskRecord } from '../src/types.js';

describe('ResourceScheduler (TASK-04)', () => {
  it('limita la programación según el máximo de tareas concurrentes', () => {
    const scheduler = new ResourceScheduler({ maxConcurrentTasks: 2 });
    expect(scheduler.canScheduleNext(0)).toBe(true);
    expect(scheduler.canScheduleNext(1)).toBe(true);
    expect(scheduler.canScheduleNext(2)).toBe(false);
    expect(scheduler.getAvailableSlots(1)).toBe(1);
    expect(scheduler.getAvailableSlots(2)).toBe(0);
  });

  it('bloquea la programación si el EventLoop supera el umbral de lag', () => {
    const scheduler = new ResourceScheduler({
      maxConcurrentTasks: 4,
      eventLoopLagThresholdMs: 50,
    });

    scheduler.recordEventLoopLag(80);
    scheduler.recordEventLoopLag(90);

    expect(scheduler.getAverageEventLoopLag()).toBe(85);
    expect(scheduler.canScheduleNext(1)).toBe(false);
  });

  it('ordena la cola respetando prioridades y envejecimiento (aging)', () => {
    const scheduler = new ResourceScheduler({
      maxConcurrentTasks: 3,
      agingThresholdMs: 5000,
    });

    const now = 10000;
    const taskNormal: TaskRecord = {
      id: 'task-normal',
      title: 'Normal',
      priority: 'normal',
      status: 'queued',
      progress: 0,
      createdAt: now - 100, // Creada hace 100ms
    };

    const taskLowOld: TaskRecord = {
      id: 'task-low-old',
      title: 'Baja Envejecida',
      priority: 'low',
      status: 'queued',
      progress: 0,
      createdAt: now - 6000, // Creada hace 6000ms (> 5000ms threshold)
    };

    const taskHigh: TaskRecord = {
      id: 'task-high',
      title: 'Alta',
      priority: 'high',
      status: 'queued',
      progress: 0,
      createdAt: now - 50,
    };

    // Low envejecida sube de 1 a 2 (empatando con normal), pero es mucho más antigua (FIFO)
    const sorted = scheduler.sortQueue([taskNormal, taskLowOld, taskHigh], now);

    expect(sorted[0].id).toBe('task-high');
    expect(sorted[1].id).toBe('task-low-old'); // Prioridad 2 por envejecimiento y FIFO
    expect(sorted[2].id).toBe('task-normal');
  });

  it('emite métricas completas de telemetría', () => {
    const scheduler = new ResourceScheduler({ maxConcurrentTasks: 3 });
    scheduler.recordEventLoopLag(12);

    const metrics = scheduler.getMetrics(2);
    expect(metrics.activeSlots).toBe(2);
    expect(metrics.eventLoopLagMs).toBe(12);
    expect(metrics.heapUsageRatio).toBeGreaterThan(0);
    expect(metrics.canSchedule).toBe(true);
  });
});
