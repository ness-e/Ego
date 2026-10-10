import { z } from 'zod';

export const CronTriggerConfigSchema = z.object({
  id: z.string(),
  subEgoId: z.string(),
  cronExpression: z.string(), // "minuto hora dia_mes mes dia_semana" ej. "*/5 * * * *" o "0 9 * * 1-5"
  taskTitle: z.string(),
  payload: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export type CronTriggerConfig = z.infer<typeof CronTriggerConfigSchema>;

export const FileWatchTriggerConfigSchema = z.object({
  id: z.string(),
  subEgoId: z.string(),
  pattern: z.string(), // Ej. "*.test.ts" o "docs/**/*.md"
  debounceMs: z.number().default(500),
  enabled: z.boolean().default(true),
});

export type FileWatchTriggerConfig = z.infer<typeof FileWatchTriggerConfigSchema>;

export class ProactivityEngine {
  private cronTriggers = new Map<string, { config: CronTriggerConfig; handler: (config: CronTriggerConfig) => Promise<void> | void }>();
  private watchTriggers = new Map<string, { config: FileWatchTriggerConfig; handler: (filePath: string) => Promise<void> | void }>();
  private watchDebounceTimers = new Map<string, NodeJS.Timeout>();

  public registerCronTrigger(
    config: CronTriggerConfig,
    handler: (config: CronTriggerConfig) => Promise<void> | void
  ): void {
    CronTriggerConfigSchema.parse(config);
    this.cronTriggers.set(config.id, { config, handler });
  }

  public registerWatchTrigger(
    config: FileWatchTriggerConfig,
    handler: (filePath: string) => Promise<void> | void
  ): void {
    FileWatchTriggerConfigSchema.parse(config);
    this.watchTriggers.set(config.id, { config, handler });
  }

  public unregisterCronTrigger(id: string): boolean {
    return this.cronTriggers.delete(id);
  }

  public unregisterWatchTrigger(id: string): boolean {
    const timer = this.watchDebounceTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.watchDebounceTimers.delete(id);
    }
    return this.watchTriggers.delete(id);
  }

  public triggerFileChange(filePath: string): void {
    for (const [id, { config, handler }] of this.watchTriggers.entries()) {
      if (!config.enabled) continue;

      if (this.matchesPattern(filePath, config.pattern)) {
        const existingTimer = this.watchDebounceTimers.get(id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          this.watchDebounceTimers.delete(id);
          try {
            void handler(filePath);
          } catch {
            // Defensive
          }
        }, config.debounceMs);

        this.watchDebounceTimers.set(id, timer);
      }
    }
  }

  public evaluateCronTick(now: Date = new Date()): number {
    let triggeredCount = 0;
    const minute = now.getMinutes();
    const hour = now.getHours();
    const dayOfMonth = now.getDate();
    const month = now.getMonth() + 1; // 1-12
    const dayOfWeek = now.getDay(); // 0-6 (0 = Domingo)

    for (const { config, handler } of this.cronTriggers.values()) {
      if (!config.enabled) continue;

      if (this.matchesCron(config.cronExpression, minute, hour, dayOfMonth, month, dayOfWeek)) {
        triggeredCount++;
        try {
          void handler(config);
        } catch {
          // Defensive
        }
      }
    }

    return triggeredCount;
  }

  public matchesCron(
    expr: string,
    minute: number,
    hour: number,
    dayOfMonth: number,
    month: number,
    dayOfWeek: number
  ): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [minPart, hourPart, domPart, monthPart, dowPart] = parts;

    return (
      this.matchesField(minPart, minute, 0, 59) &&
      this.matchesField(hourPart, hour, 0, 23) &&
      this.matchesField(domPart, dayOfMonth, 1, 31) &&
      this.matchesField(monthPart, month, 1, 12) &&
      this.matchesField(dowPart, dayOfWeek, 0, 6)
    );
  }

  private matchesField(field: string, val: number, min: number, max: number): boolean {
    if (field === '*') return true;

    // */step
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      if (isNaN(step) || step <= 0) return false;
      return (val - min) % step === 0;
    }

    // lista: 1,2,3
    if (field.includes(',')) {
      return field.split(',').some((sub) => this.matchesField(sub.trim(), val, min, max));
    }

    // rango: 1-5
    if (field.includes('-')) {
      const [startStr, endStr] = field.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) return false;
      return val >= start && val <= end;
    }

    // número exacto
    const target = parseInt(field, 10);
    return !isNaN(target) && val === target;
  }

  public matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern === '*' || pattern === '**/*') return true;

    // Extensión simple: ej. "*.test.ts"
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      return filePath.endsWith(ext);
    }

    // Regex aproximada para globs simples
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(filePath) || filePath.includes(pattern.replace(/\*/g, ''));
  }

  public stopAll(): void {
    for (const timer of this.watchDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.watchDebounceTimers.clear();
    this.cronTriggers.clear();
    this.watchTriggers.clear();
  }
}
