// presence.test.js — FSM de presencia (port de coucou IslandStateMachine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresenceStateMachine, PRESENCE_MODES } from '../src/runtime/presence.js';

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
  };
}

test('reveal: hidden → compact y auto-ocultación a los 60 s', () => {
  const timers = fakeTimers();
  const fsm = new PresenceStateMachine({ timers });
  const seen = [];
  fsm.onTransition = (from, to) => seen.push(`${from}>${to}`);
  fsm.reveal();
  assert.equal(fsm.state, 'compact');
  timers.advance(59_000);
  assert.equal(fsm.state, 'compact');
  timers.advance(1_000);
  assert.equal(fsm.state, 'hidden');
  assert.deepEqual(seen, ['hidden>compact', 'compact>hidden']);
});

test('mouseEntered cancela la auto-ocultación (petit en coucou)', () => {
  const timers = fakeTimers();
  const fsm = new PresenceStateMachine({ timers });
  fsm.reveal();
  timers.advance(30_000);
  fsm.mouseEntered(); // el puntero sostiene el modo compact
  timers.advance(60_000);
  assert.equal(fsm.state, 'compact', 'no se oculta con hover');
});

test('click abre home; mouseLeft colapsa a los 15 s; pinned evita el colapso', () => {
  const timers = fakeTimers();
  const fsm = new PresenceStateMachine({ timers });
  fsm.reveal();
  fsm.click();
  assert.equal(fsm.state, 'home');
  fsm.mouseLeft(); // programa el colapso home → compact
  timers.advance(15_000);
  assert.equal(fsm.state, 'compact', 'home colapsa a los 15 s');

  fsm.click(); // home otra vez
  fsm.pinned = true;
  fsm.mouseLeft(); // pinned → sin timer
  timers.advance(60_000);
  assert.equal(fsm.state, 'home', 'pinned mantiene home');
  fsm.pinned = false;
  fsm.mouseLeft();
  timers.advance(15_000);
  assert.equal(fsm.state, 'compact');
});

test('launch → greet → greetComplete colapsa a los 0.6 s; hover usa 10 s', () => {
  const timers = fakeTimers();
  const fsm = new PresenceStateMachine({ timers });
  fsm.launch();
  assert.equal(fsm.state, 'greet');
  fsm.greetComplete();
  timers.advance(600);
  assert.equal(fsm.state, 'compact');

  const fsm2 = new PresenceStateMachine({ timers });
  fsm2.launch();
  fsm2.mouseEntered(); // hover durante el saludo → 10 s
  fsm2.greetComplete(); // no pisa el timer de hover
  timers.advance(600);
  assert.equal(fsm2.state, 'greet', 'hover retiene el saludo');
  timers.advance(9_400);
  assert.equal(fsm2.state, 'compact');
});

test('forceHome/forceCompact/forceHidden son inmediatos y cancelan timers', () => {
  const timers = fakeTimers();
  const fsm = new PresenceStateMachine({ timers });
  fsm.reveal();
  fsm.forceHome();
  assert.equal(fsm.state, 'home');
  fsm.forceCompact();
  assert.equal(fsm.state, 'compact');
  fsm.forceHidden();
  assert.equal(fsm.state, 'hidden');
  timers.advance(120_000);
  assert.equal(fsm.state, 'hidden', 'sin timers residuales');
});

test('modos válidos y transición repetida es no-op', () => {
  assert.deepEqual([...PRESENCE_MODES], ['hidden', 'compact', 'home', 'greet']);
  const fsm = new PresenceStateMachine({ timers: fakeTimers() });
  const seen = [];
  fsm.onTransition = (f, t) => seen.push(t);
  fsm.forceHidden();
  assert.equal(seen.length, 0, 'hidden → hidden no emite');
});
