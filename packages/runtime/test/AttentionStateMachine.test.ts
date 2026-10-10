import { describe, it, expect, vi } from 'vitest';
import { AttentionStateMachine } from '../src/AttentionStateMachine.js';

describe('AttentionStateMachine (WIDG-03 / COUC-06)', () => {
  it('inicia en estado hidden sin solicitudes activas', () => {
    const fsm = new AttentionStateMachine();
    expect(fsm.getState()).toBe('hidden');
    expect(fsm.getActiveRequest()).toBeNull();
  });

  it('transiciona a estado compact o expanded al recibir solicitudes', () => {
    const transitions: any[] = [];
    const fsm = new AttentionStateMachine({
      onTransition: (ev) => transitions.push(ev),
    });

    fsm.requestAttention({
      id: 'task-1',
      priority: 50,
      state: 'compact',
      title: 'Indexando archivos',
    });

    expect(fsm.getState()).toBe('compact');
    expect(fsm.getActiveRequest()?.title).toBe('Indexando archivos');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].currentState).toBe('compact');
  });

  it('prioriza solicitudes de mayor prioridad (ej. HITL sobre notificaciones)', () => {
    const fsm = new AttentionStateMachine();

    fsm.requestAttention({
      id: 'task-bg',
      priority: 30,
      state: 'compact',
      title: 'Compilando en segundo plano',
    });

    expect(fsm.getState()).toBe('compact');

    // Llega solicitud de aprobación sensible con alta prioridad
    fsm.requestAttention({
      id: 'hitl-sec',
      priority: 100,
      state: 'hitl_approval',
      title: '¿Autorizar mutación de package.json?',
      hitlActionId: 'action-99',
    });

    expect(fsm.getState()).toBe('hitl_approval');
    expect(fsm.getActiveRequest()?.id).toBe('hitl-sec');

    // Al resolver la solicitud HITL, debe restaurar la de segundo plano
    fsm.releaseAttention('hitl-sec');
    expect(fsm.getState()).toBe('compact');
    expect(fsm.getActiveRequest()?.id).toBe('task-bg');
  });

  it('colapsa automáticamente a hidden tras expirar el temporizador de inactividad', () => {
    const fsm = new AttentionStateMachine({ defaultCollapseMs: 1000 });

    fsm.requestAttention({
      id: 'alert-1',
      priority: 40,
      state: 'alert',
      title: 'Alerta temporal',
      timeoutMs: 500,
    });

    expect(fsm.getState()).toBe('alert');

    // Avanzar tiempo 300ms: sigue activa
    fsm.tick(300);
    expect(fsm.getState()).toBe('alert');

    // Avanzar otros 300ms (total 600ms > 500ms): colapsa a hidden
    fsm.tick(300);
    expect(fsm.getState()).toBe('hidden');
    expect(fsm.getActiveRequest()).toBeNull();
  });

  it('no colapsa solicitudes fijadas (pinned)', () => {
    const fsm = new AttentionStateMachine();

    fsm.requestAttention({
      id: 'pinned-task',
      priority: 50,
      state: 'compact',
      title: 'Tarea persistente',
      pinned: true,
    });

    fsm.tick(10000);
    expect(fsm.getState()).toBe('compact');
  });
});
