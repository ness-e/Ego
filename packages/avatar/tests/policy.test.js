// policy.test.js — política del runtime: action records + auto-sleep (ARA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requestedMotion,
  beginAction,
  finishAction,
  cancelActiveAction,
  createAutoSleep,
} from '../src/runtime/policy.js';

function fakeTarget() {
  return {
    _activeActionState: null,
    _actionStateSequence: 0,
    events: [],
    dispatchEvent(e) {
      this.events.push({ type: e.type, ...e.detail });
    },
    getAttribute(name) {
      return this._attrs?.[name] ?? null;
    },
    _attrs: {},
  };
}

function fakeTimers() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    setTimeout(fn, ms) {
      const i = ++id;
      tasks.set(i, { fn, at: now + ms });
      return i;
    },
    clearTimeout(i) {
      tasks.delete(i);
    },
    advance(ms) {
      const target = now + ms;
      // fire en orden cronológico las tareas vencidas
      for (;;) {
        let next = null;
        for (const [i, t] of tasks) {
          if (t.at <= target && (!next || t.at < next.at)) next = { i, t };
        }
        if (!next) break;
        now = next.t.at;
        tasks.delete(next.i);
        next.t.fn();
      }
      now = target;
    },
    get pending() {
      return tasks.size;
    },
  };
}

test('requestedMotion: atributo auto|reduce|full con fallback', () => {
  const inst = { _attrs: {}, getAttribute(n) { return this._attrs[n] ?? null; } };
  assert.equal(requestedMotion(inst), 'auto');
  inst._attrs.motion = 'reduce';
  assert.equal(requestedMotion(inst), 'reduce');
  inst._attrs.motion = 'FULL';
  assert.equal(requestedMotion(inst), 'full');
  inst._attrs.motion = 'garbage';
  assert.equal(requestedMotion(inst), 'auto');
});

test('action records: start → end, fase terminal única', () => {
  const t = fakeTarget();
  const rec = beginAction(t, 'success', 'hook');
  assert.equal(t.events.length, 1);
  assert.deepEqual(t.events[0], { type: 'action-state', action: 'success', phase: 'start', source: 'hook' });

  finishAction(t, rec, 'end');
  finishAction(t, rec, 'end'); // no-op: terminal ya emitido
  assert.equal(t.events.length, 2);
  assert.equal(t.events[1].phase, 'end');
  assert.equal(t._activeActionState, null);
});

test('begin cancela la acción anterior con fase cancel', () => {
  const t = fakeTarget();
  beginAction(t, 'waiting', 'api');
  beginAction(t, 'error', 'api');
  const phases = t.events.map((e) => e.phase);
  assert.deepEqual(phases, ['start', 'cancel', 'start']);
  assert.equal(t.events[1].action, 'waiting');
});

test('cancelActiveAction limpia y emite cancel', () => {
  const t = fakeTarget();
  const rec = beginAction(t, 'error', 'api');
  cancelActiveAction(t);
  assert.equal(t._activeActionState, null);
  assert.equal(t.events.at(-1).phase, 'cancel');
  cancelActiveAction(t); // no-op
  assert.equal(t.events.length, 2);
  void rec;
});

test('auto-sleep: duerme tras el delay y se limpia al programar de nuevo', () => {
  const timers = fakeTimers();
  let slept = 0;
  const policy = createAutoSleep({
    getDelayMs: () => 1000,
    isBlocked: () => false,
    onSleep: () => slept++,
    timers,
  });
  policy.schedule();
  assert.equal(policy.active, true);
  timers.advance(999);
  assert.equal(slept, 0);
  timers.advance(1);
  assert.equal(slept, 1);
  assert.equal(policy.active, false);
});

test('auto-sleep bloqueado no duerme y limpia el timer', () => {
  const timers = fakeTimers();
  let slept = 0;
  let blocked = true;
  const policy = createAutoSleep({
    getDelayMs: () => 500,
    isBlocked: () => blocked,
    onSleep: () => slept++,
    timers,
  });
  policy.schedule();
  assert.equal(policy.active, false, 'bloqueado → sin timer');
  blocked = false;
  policy.schedule();
  timers.advance(500);
  assert.equal(slept, 1);
});

test('auto-sleep: reprograma si el delay cambia durante la espera', () => {
  const timers = fakeTimers();
  let slept = 0;
  let delay = 1000;
  const policy = createAutoSleep({
    getDelayMs: () => delay,
    isBlocked: () => false,
    onSleep: () => slept++,
    timers,
  });
  policy.schedule();
  delay = 2000; // cambia antes de que venza el timer de1000 ms
  timers.advance(1500); // el timer viejo vence en 1000 y reprograma con el nuevo delay
  assert.equal(slept, 0, 'no duerme con el delay viejo');
  timers.advance(1499); // aún dentro de la espera reprogramada (vence en 3000)
  assert.equal(slept, 0, 'reprograma desde ahora con el nuevo delay');
  timers.advance(1);
  assert.equal(slept, 1);
});

test('auto-sleep: delay 0 o NaN desactiva', () => {
  const timers = fakeTimers();
  const mk = (getDelayMs) =>
    createAutoSleep({ getDelayMs, isBlocked: () => false, onSleep: () => {}, timers });
  mk(() => 0).schedule();
  mk(() => Number.NaN).schedule();
  assert.equal(timers.pending, 0);
});
