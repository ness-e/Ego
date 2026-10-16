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

export type ProactiveTriggerKind = 'cron' | 'file';

export interface ProactiveApprovalInfo {
  kind: ProactiveTriggerKind;
  triggerId: string;
  subEgoId: string;
  filePath?: string;
  taskTitle?: string;
}

/**
 * Policy hook de aprobación para triggers proactivos (F4T8 H22, gap Fase 11).
 *
 * Gobernanza sin UI: antes de invocar el handler de un trigger (cron o
 * file-watch), el engine consulta `requiresApproval`. Si exige aprobación, el
 * handler NO se ejecuta y se notifica vía `onApprovalRequired` para que un
 * flujo externo (humano u otra policy) decida. Sin policy, el comportamiento
 * es el histórico (disparo directo). Fail-closed ante errores del hook.
 */
export interface ProactiveApprovalPolicy {
  requiresApproval: (info: ProactiveApprovalInfo) => boolean | Promise<boolean>;
  onApprovalRequired?: (info: ProactiveApprovalInfo) => void;
}

export interface ProactivityEngineOptions {
  approvalPolicy?: ProactiveApprovalPolicy;
}

/** Tokens internos (no imprimibles) para traducir `**` sin colisiones. */
const GLOBSTAR_TOKEN = '\u0000';
const GLOBSTAR_SLASH_TOKEN = '\u0001';

export class ProactivityEngine {
  private cronTriggers = new Map<string, { config: CronTriggerConfig; handler: (config: CronTriggerConfig) => Promise<void> | void }>();
  private watchTriggers = new Map<string, { config: FileWatchTriggerConfig; handler: (filePath: string) => Promise<void> | void }>();
  private watchDebounceTimers = new Map<string, NodeJS.Timeout>();
  private approvalPolicy?: ProactiveApprovalPolicy;

  constructor(options: ProactivityEngineOptions = {}) {
    this.approvalPolicy = options.approvalPolicy;
  }

  public setApprovalPolicy(policy: ProactiveApprovalPolicy | undefined): void {
    this.approvalPolicy = policy;
  }

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
          // El handler puede ser asíncrono: los rechazos deben observarse
          // (el try/catch síncrono anterior los perdía).
          void this.fireWatchHandler(id, config, handler, filePath).catch(() => {
            // Defensive: nunca romper el loop de debounce.
          });
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
        if (this.fireCronHandler(config, handler)) {
          triggeredCount++;
        }
      }
    }

    return triggeredCount;
  }

  /**
   * Dispara un handler cron con gate de aprobación. Retorna true si el
   * handler fue invocado (o quedó diferido por policy asíncrona que luego lo
   * permite); false si la policy lo bloqueó de forma síncrona. Sin policy, el
   * disparo es síncrono como históricamente (los handlers síncronos de los
   * tests existentes siguen corriendo en el mismo tick).
   */
  private fireCronHandler(
    config: CronTriggerConfig,
    handler: (config: CronTriggerConfig) => Promise<void> | void
  ): boolean {
    if (this.approvalPolicy) {
      let needsApproval: boolean | Promise<boolean> = false;
      try {
        needsApproval = this.approvalPolicy.requiresApproval({
          kind: 'cron',
          triggerId: config.id,
          subEgoId: config.subEgoId,
          taskTitle: config.taskTitle,
        });
      } catch {
        needsApproval = true;
      }
      if (needsApproval instanceof Promise) {
        void needsApproval
          .then((needed) => {
            if (needed) {
              this.notifyApprovalRequired({
                kind: 'cron',
                triggerId: config.id,
                subEgoId: config.subEgoId,
                taskTitle: config.taskTitle,
              });
            } else {
              this.invokeCronHandler(config, handler);
            }
          })
          .catch(() => {
            // Defensive: fallo del hook = no disparar.
          });
        return false;
      }
      if (needsApproval) {
        this.notifyApprovalRequired({
          kind: 'cron',
          triggerId: config.id,
          subEgoId: config.subEgoId,
          taskTitle: config.taskTitle,
        });
        return false;
      }
    }
    this.invokeCronHandler(config, handler);
    return true;
  }

  /**
   * Invocación síncrona con captura de rechazos asíncronos. El `try/catch`
   * solo cubre el throw síncrono; si el handler retorna promesa se le
   * adjunta `.catch` para no dejar rechazos no observados.
   */
  private invokeCronHandler(
    config: CronTriggerConfig,
    handler: (config: CronTriggerConfig) => Promise<void> | void
  ): void {
    try {
      const result = handler(config);
      if (result instanceof Promise) {
        void result.catch(() => {
          // Defensive: un trigger que falla no debe tumbar el tick.
        });
      }
    } catch {
      // Defensive
    }
  }

  private async fireWatchHandler(
    triggerId: string,
    config: FileWatchTriggerConfig,
    handler: (filePath: string) => Promise<void> | void,
    filePath: string
  ): Promise<void> {
    try {
      if (this.approvalPolicy) {
        let needsApproval = false;
        try {
          needsApproval = await this.approvalPolicy.requiresApproval({
            kind: 'file',
            triggerId,
            subEgoId: config.subEgoId,
            filePath,
          });
        } catch {
          needsApproval = true;
        }
        if (needsApproval) {
          this.notifyApprovalRequired({
            kind: 'file',
            triggerId,
            subEgoId: config.subEgoId,
            filePath,
          });
          return;
        }
      }
      await handler(filePath);
    } catch {
      // Defensive: nunca romper el loop de debounce.
    }
  }

  private notifyApprovalRequired(info: ProactiveApprovalInfo): void {
    try {
      this.approvalPolicy?.onApprovalRequired?.(info);
    } catch {
      // Defensive: la notificación no debe romper el tick/debounce.
    }
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

    const [minPart = '', hourPart = '', domPart = '', monthPart = '', dowPart = ''] = parts;

    return (
      this.matchesField(minPart, minute, 0, 59) &&
      this.matchesField(hourPart, hour, 0, 23) &&
      this.matchesField(domPart, dayOfMonth, 1, 31) &&
      this.matchesField(monthPart, month, 1, 12) &&
      this.matchesField(dowPart, dayOfWeek, 0, 6)
    );
  }

  private matchesField(field: string, val: number, min: number, max: number): boolean {
    if (val < min || val > max) return false;
    if (field === '*') return true;

    // */step canónico (F4T8 M21): múltiplos del valor absoluto, no del
    // desplazamiento al mínimo del rango (cron canónico: */2 en dom = 2,4,6...).
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      if (isNaN(step) || step <= 0) return false;
      return val % step === 0;
    }

    // lista: 1,2,3
    if (field.includes(',')) {
      return field.split(',').some((sub) => this.matchesField(sub.trim(), val, min, max));
    }

    // rango: 1-5
    if (field.includes('-')) {
      const [startStr = '', endStr = ''] = field.split('-');
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

    // Extensión simple (semántica basename): ej. "*.test.ts"
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      return filePath.endsWith(ext);
    }

    // F4T8 M20: regex estricta anclada, SIN fallback `includes` (producía
    // falsos positivos por substring, ej. patrón 'docs' casaba 'my-docs/…').
    return this.globToRegExp(pattern).test(filePath);
  }

  /**
   * Traduce un glob simple a RegExp anclada: `*` no cruza `/`, `**` cruza
   * cualquier nivel (incluido cero segmentos de directorio intermedios).
   * Sin dependencias externas.
   */
  private globToRegExp(pattern: string): RegExp {
    const withTokens = pattern.split('**').join(GLOBSTAR_TOKEN);
    const escaped = withTokens.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const collapsed = escaped
      .split(`${GLOBSTAR_TOKEN}/`)
      .join(GLOBSTAR_SLASH_TOKEN)
      .split(GLOBSTAR_TOKEN)
      .join('.*');
    const starred = collapsed.split('*').join('[^/]*').split(GLOBSTAR_SLASH_TOKEN).join('(?:.*/)?');
    return new RegExp(`^${starred}$`);
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
