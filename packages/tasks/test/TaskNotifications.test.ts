import { describe, it, expect, vi } from 'vitest';
import { TaskNotificationManager } from '../src/TaskNotifications.js';

describe('TaskNotificationManager (TASK-06 / COUC-06)', () => {
  it('registra y almacena notificaciones en memoria', () => {
    const manager = new TaskNotificationManager();
    const notif = manager.notify({
      taskId: 'task-1',
      title: 'Indexación terminada',
      message: 'Se indexaron 120 fragmentos',
      severity: 'info',
    });

    expect(notif).not.toBeNull();
    expect(notif?.title).toBe('Indexación terminada');
    expect(notif?.dismissed).toBe(false);

    const active = manager.getActiveNotifications();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(notif?.id);
  });

  it('aplica rate limiting para notificaciones repetitivas de severidad normal', () => {
    const manager = new TaskNotificationManager({ rateLimitCooldownMs: 5000 });

    const first = manager.notify({
      taskId: 'task-loop',
      title: 'Progreso',
      message: 'Paso 1',
      severity: 'info',
    });
    expect(first).not.toBeNull();

    // Inmediatamente después: debe atenuarse (retorna null)
    const second = manager.notify({
      taskId: 'task-loop',
      title: 'Progreso',
      message: 'Paso 2',
      severity: 'info',
    });
    expect(second).toBeNull();
  });

  it('no aplica rate limiting a notificaciones críticas o de acción requerida', () => {
    const manager = new TaskNotificationManager({ rateLimitCooldownMs: 5000 });

    const first = manager.notify({
      taskId: 'task-crit',
      title: 'Alerta crítica 1',
      message: 'Error en escritura',
      severity: 'critical',
    });
    const second = manager.notify({
      taskId: 'task-crit',
      title: 'Acción requerida',
      message: 'Confirmar sobreescritura',
      severity: 'action_required',
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(manager.getActiveNotifications()).toHaveLength(2);
  });

  it('permite descartar notificaciones individuales y todas juntas', () => {
    const manager = new TaskNotificationManager();
    const n1 = manager.notify({
      taskId: 'task-a',
      title: 'A',
      message: 'msg',
      severity: 'info',
    });
    const n2 = manager.notify({
      taskId: 'task-b',
      title: 'B',
      message: 'msg',
      severity: 'info',
    });

    expect(manager.getActiveNotifications()).toHaveLength(2);

    manager.dismiss(n1!.id);
    expect(manager.getActiveNotifications()).toHaveLength(1);
    expect(manager.getActiveNotifications()[0].id).toBe(n2!.id);

    manager.dismissAll();
    expect(manager.getActiveNotifications()).toHaveLength(0);
  });
});
