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
});
