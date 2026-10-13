import { describe, it, expect, vi } from 'vitest';
import { BackgroundEngine } from '../src/BackgroundEngine.js';

async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('BackgroundEngine pause/resume real (F4T8 H13)', () => {
  it('pausa una tarea en vuelo sin cancelarla y resume hasta completar', async () => {
    const eventTypes: string[] = [];
    const engine = new BackgroundEngine({
      maxConcurrent: 2,
      defaultTimeoutMs: 5000,
      onTaskEvent: (ev) => eventTypes.push(ev.type),
    });
    let attempts = 0;

    engine.submit({
      id: 'pausable',
      title: 'Pausable',
      execute: async ({ signal }) => {
        attempts++;
        if (attempts === 1) {
          await new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason ?? new Error('aborted')));
          });
        }
        return 'done';
      },
    });

    await waitFor(() => engine.getTask('pausable')?.status === 'running');
    expect(engine.pause('pausable')).toBe(true);
    // Dejar que el runTask en vuelo procese el abort: en el código con H13
    // sin corregir, aquí el estado cae a 'cancelled' y se emite 'task:cancelled'.
    await new Promise((r) => setTimeout(r, 50));
    expect(engine.getTask('pausable')?.status).toBe('paused');
    expect(eventTypes).not.toContain('task:cancelled');
    // La pausa no es terminal: no hay completedAt ni error de cancelación.
    expect(engine.getTask('pausable')?.completedAt).toBeUndefined();

    expect(engine.resume('pausable')).toBe(true);
    await waitFor(() => engine.getTask('pausable')?.status === 'completed');
    expect(engine.getTask('pausable')?.result).toBe('done');
    expect(attempts).toBe(2);
  });

  it('pausa una tarea encolada y solo corre tras resume explícito', async () => {
    const engine = new BackgroundEngine({ maxConcurrent: 1, defaultTimeoutMs: 5000 });
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    engine.submit({
      id: 'blocker',
      title: 'Bloqueador',
      execute: async () => {
        await gate;
        return 'b';
      },
    });
    engine.submit({ id: 'q', title: 'Encolada', execute: async () => 'q' });

    await waitFor(() => engine.getTask('blocker')?.status === 'running');
    expect(engine.pause('q')).toBe(true);
    expect(engine.getTask('q')?.status).toBe('paused');

    release();
    await waitFor(() => engine.getTask('blocker')?.status === 'completed');
    // Sigue pausada: la pausa encolada no se auto-reanuda.
    expect(engine.getTask('q')?.status).toBe('paused');

    expect(engine.resume('q')).toBe(true);
    await waitFor(() => engine.getTask('q')?.status === 'completed');
  });
});

describe('BackgroundEngine approval gate (F4T8 H22)', () => {
  it('no ejecuta tareas que requieren aprobación hasta ser aprobadas', async () => {
    let needsApproval = true;
    const handler = vi.fn(async () => 'ok');
    const onApprovalRequired = vi.fn();

    const engine = new BackgroundEngine({
      maxConcurrent: 2,
      defaultTimeoutMs: 5000,
      approvalPolicy: {
        requiresApproval: () => needsApproval,
        onApprovalRequired,
      },
    });

    engine.submit({ id: 'gated', title: 'Gated', execute: handler });

    await waitFor(() => engine.getTask('gated')?.status === 'paused');
    expect(handler).not.toHaveBeenCalled();
    expect(onApprovalRequired).toHaveBeenCalledTimes(1);
    expect(engine.getTask('gated')?.progressMessage).toMatch(/approv|aprob/i);

    needsApproval = false;
    expect(engine.resume('gated')).toBe(true);
    await waitFor(() => engine.getTask('gated')?.status === 'completed');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
