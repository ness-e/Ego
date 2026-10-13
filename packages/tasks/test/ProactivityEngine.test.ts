import { describe, it, expect, vi } from 'vitest';
import { ProactivityEngine } from '../src/ProactivityEngine.js';

describe('ProactivityEngine (TASK-07 / COUC-06)', () => {
  it('registra y evalúa expresiones cron simples y con paso (* / step)', () => {
    const engine = new ProactivityEngine();
    const tickSpy = vi.fn();

    engine.registerCronTrigger(
      {
        id: 'cron-every-5-min',
        subEgoId: 'ego.nucleus',
        cronExpression: '*/5 * * * *',
        taskTitle: 'Heartbeat de sistema',
        payload: {},
        enabled: true,
      },
      tickSpy
    );

    // Minuto 10 (múltiplo de 5): debe disparar
    const matchDate = new Date(2026, 9, 10, 14, 10, 0);
    const triggered = engine.evaluateCronTick(matchDate);
    expect(triggered).toBe(1);
    expect(tickSpy).toHaveBeenCalled();

    // Minuto 11: no debe disparar
    const noMatchDate = new Date(2026, 9, 10, 14, 11, 0);
    const noTrigger = engine.evaluateCronTick(noMatchDate);
    expect(noTrigger).toBe(0);
  });

  it('respeta triggers deshabilitados', () => {
    const engine = new ProactivityEngine();
    const tickSpy = vi.fn();

    engine.registerCronTrigger(
      {
        id: 'cron-disabled',
        subEgoId: 'ego.nucleus',
        cronExpression: '* * * * *',
        taskTitle: 'Deshabilitada',
        payload: {},
        enabled: false,
      },
      tickSpy
    );

    const triggered = engine.evaluateCronTick(new Date());
    expect(triggered).toBe(0);
    expect(tickSpy).not.toHaveBeenCalled();
  });

  it('aplica debounce al observar cambios de archivos', async () => {
    const engine = new ProactivityEngine();
    const watchSpy = vi.fn();

    engine.registerWatchTrigger(
      {
        id: 'watch-tests',
        subEgoId: 'ego.developer',
        pattern: '*.test.ts',
        debounceMs: 50,
        enabled: true,
      },
      watchSpy
    );

    // Ráfaga de 3 cambios en el mismo archivo
    engine.triggerFileChange('/src/components/button.test.ts');
    engine.triggerFileChange('/src/components/button.test.ts');
    engine.triggerFileChange('/src/components/button.test.ts');

    expect(watchSpy).not.toHaveBeenCalled();

    // Esperar al debounce
    await new Promise((r) => setTimeout(r, 80));
    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(watchSpy).toHaveBeenCalledWith('/src/components/button.test.ts');
  });

  it('ignora archivos que no coinciden con el patrón', async () => {
    const engine = new ProactivityEngine();
    const watchSpy = vi.fn();

    engine.registerWatchTrigger(
      {
        id: 'watch-tests',
        subEgoId: 'ego.developer',
        pattern: '*.test.ts',
        debounceMs: 20,
        enabled: true,
      },
      watchSpy
    );

    engine.triggerFileChange('/src/components/button.css');
    await new Promise((r) => setTimeout(r, 40));
    expect(watchSpy).not.toHaveBeenCalled();
  });

  it('globs estrictos sin fallback includes (F4T8 M20)', () => {
    const engine = new ProactivityEngine();
    expect(engine.matchesPattern('docs/a/b.md', 'docs/**/*.md')).toBe(true);
    expect(engine.matchesPattern('docs/a.md', 'docs/**/*.md')).toBe(true);
    // Sin fallback: 'docs' plano no casa por substring.
    expect(engine.matchesPattern('my-docs/file.txt', 'docs')).toBe(false);
    expect(engine.matchesPattern('docs/file.txt', 'docs')).toBe(false);
    expect(engine.matchesPattern('/src/components/button.test.ts', '*.test.ts')).toBe(true);
    expect(engine.matchesPattern('/src/components/button.css', '*.test.ts')).toBe(false);
  });

  it('cron */step canónico sobre el valor absoluto (F4T8 M21)', () => {
    const engine = new ProactivityEngine();
    // Minutos: igual en ambas semánticas.
    expect(engine.matchesCron('*/5 * * * *', 10, 0, 1, 1, 1)).toBe(true);
    expect(engine.matchesCron('*/5 * * * *', 11, 0, 1, 1, 1)).toBe(false);
    // Día del mes (min=1): canónico val%step===0 → 2,4,6...
    expect(engine.matchesCron('* * */2 * *', 0, 0, 2, 1, 1)).toBe(true);
    expect(engine.matchesCron('* * */2 * *', 0, 0, 3, 1, 1)).toBe(false);
    // Mes (min=1): */2 → 2,4,6...
    expect(engine.matchesCron('* * * */2 *', 0, 0, 1, 2, 1)).toBe(true);
    expect(engine.matchesCron('* * * */2 *', 0, 0, 1, 3, 1)).toBe(false);
  });

  it('consulta el policy hook de aprobación antes de disparar handlers (F4T8 H22)', async () => {
    const engine = new ProactivityEngine();
    const handler = vi.fn();
    const gated = vi.fn();
    engine.setApprovalPolicy({
      requiresApproval: () => true,
      onApprovalRequired: gated,
    });

    engine.registerCronTrigger(
      {
        id: 'c-gated',
        subEgoId: 'ego.nucleus',
        cronExpression: '* * * * *',
        taskTitle: 'Gated',
        payload: {},
        enabled: true,
      },
      handler
    );
    engine.evaluateCronTick(new Date());
    expect(handler).not.toHaveBeenCalled();
    expect(gated).toHaveBeenCalledTimes(1);

    engine.registerWatchTrigger(
      {
        id: 'w-gated',
        subEgoId: 'ego.developer',
        pattern: '*.test.ts',
        debounceMs: 10,
        enabled: true,
      },
      handler
    );
    engine.triggerFileChange('/a/b.test.ts');
    await new Promise((r) => setTimeout(r, 40));
    expect(handler).not.toHaveBeenCalled();
    expect(gated).toHaveBeenCalledTimes(2);
  });
});
