import { z } from 'zod';

export type NotificationSeverity = 'info' | 'warning' | 'action_required' | 'critical';

export const TaskNotificationSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  subEgoId: z.string().optional(),
  title: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'action_required', 'critical']),
  timestamp: z.number(),
  actionRequired: z
    .object({
      actionId: z.string(),
      label: z.string(),
      options: z.array(z.string()),
    })
    .optional(),
  dismissed: z.boolean().default(false),
});

export type TaskNotification = z.infer<typeof TaskNotificationSchema>;

export interface TaskNotificationOptions {
  maxBufferSize?: number;
  rateLimitCooldownMs?: number;
  onNotification?: (notification: TaskNotification) => void;
}

export class TaskNotificationManager {
  private notifications: TaskNotification[] = [];
  private lastNotificationTimeByTask = new Map<string, number>();
  private maxBufferSize: number;
  private rateLimitCooldownMs: number;
  private onNotification?: (notification: TaskNotification) => void;

  constructor(options: TaskNotificationOptions = {}) {
    this.maxBufferSize = options.maxBufferSize ?? 50;
    this.rateLimitCooldownMs = options.rateLimitCooldownMs ?? 2000; // 2s entre notificaciones no críticas
    this.onNotification = options.onNotification;
  }

  public notify(
    params: Omit<TaskNotification, 'id' | 'timestamp' | 'dismissed'>
  ): TaskNotification | null {
    const now = Date.now();

    // Rate limiting para severidades no críticas
    if (params.severity !== 'critical' && params.severity !== 'action_required') {
      const last = this.lastNotificationTimeByTask.get(params.taskId) ?? 0;
      if (now - last < this.rateLimitCooldownMs) {
        return null; // Atenuado / throttled
      }
    }

    this.lastNotificationTimeByTask.set(params.taskId, now);

    const notification: TaskNotification = {
      ...params,
      id: `notif_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      dismissed: false,
    };

    this.notifications.unshift(notification);
    if (this.notifications.length > this.maxBufferSize) {
      this.notifications.pop();
    }

    if (this.onNotification) {
      try {
        this.onNotification(notification);
      } catch {
        // Defensive
      }
    }

    return notification;
  }

  public dismiss(notificationId: string): boolean {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (!notif) return false;
    notif.dismissed = true;
    return true;
  }

  public dismissAll(): void {
    for (const notif of this.notifications) {
      notif.dismissed = true;
    }
  }

  public getActiveNotifications(): TaskNotification[] {
    return this.notifications.filter((n) => !n.dismissed);
  }

  public getAllNotifications(): TaskNotification[] {
    return [...this.notifications];
  }
}
