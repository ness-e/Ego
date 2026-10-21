// timeline.test.js — runner de tweens por campo (coucou anim()) + fases (ARA).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/timeline.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimeline, buildPhases, piecewise } from '../src/core/timeline.js';
import { Ease } from '../src/core/anim.js';

function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test('anim: el track lleva el valor al objetivo con la ease dada', () => {
  const clock = fakeClock();
  const tl = createTimeline({ now: clock.now });
  tl.anim('hx', [[10, 100, Ease.lin]], undefined, 0);
  assert.ok(tl.locked('hx'), 'campo bloqueado durante el tween');
  assert.equal(tl.busy, true);

  clock.advance(50);
  tl.update();
  assert.ok(Math.abs(tl.get('hx') - 5) < 1e-9, `mitad lineal = 5, got ${tl.get('hx')}`);

  clock.advance(50);
  tl.update();
  assert.equal(tl.get('hx'), 10);
  assert.equal(tl.locked('hx'), false, 'campo liberado al terminar');
  assert.equal(tl.busy, false);
});

test('varias keys encadenadas y onComplete', () => {
  const clock = fakeClock();
  const tl = createTimeline({ now: clock.now });
  let done = 0;
  tl.anim('hy', [[5, 100, Ease.lin], [0, 100, Ease.lin]], () => done++, 0);
  clock.advance(100); tl.update();
  assert.equal(tl.get('hy'), 5);
  clock.advance(100); tl.update();
  assert.equal(tl.get('hy'), 0);
  assert.equal(done, 1, 'onComplete una sola vez');
  assert.equal(tl.locked('hy'), false);
});

test('set no pisa campos bloqueados (locks de coucou)', () => {
  const clock = fakeClock();
  const tl = createTimeline({ now: clock.now });
  tl.anim('ox', [[8, 200, Ease.lin]], undefined, 0);
  tl.set('ox', 99); // ignorado: bloqueado
  clock.advance(100); tl.update();
  assert.ok(Math.abs(tl.get('ox') - 4) < 1e-9);
  tl.clear('ox');
  tl.set('ox', 99); // ahora sí
  assert.equal(tl.get('ox'), 99);
});

test('clearAll cancela todo (reset)', () => {
  const clock = fakeClock();
  const tl = createTimeline({ now: clock.now });
  tl.anim('a', [[1, 100, Ease.lin]], undefined, 0);
  tl.anim('b', [[1, 100, Ease.lin]], undefined, 0);
  tl.clearAll();
  assert.equal(tl.busy, false);
  assert.equal(tl.locked('a'), false);
});

test('buildPhases: cursor acumulado (port literal ARA)', () => {
  const phases = buildPhases({ A: 100, B: 250, C: 50 });
  assert.equal(phases.aStart, 0);
  assert.equal(phases.aEnd, 100);
  assert.equal(phases.bStart, 100);
  assert.equal(phases.bEnd, 350);
  assert.equal(phases.cStart, 350);
  assert.equal(phases.cEnd, 400);
  assert.equal(phases.duration, 400);
  assert.ok(Object.isFrozen(phases));
});

test('piecewise: tramos con smoothstep y valor final sostenido', () => {
  const stops = [[0, 0.5, 0, 10], [0.5, 1, 10, 4]];
  assert.equal(piecewise(0, stops), 0);
  assert.ok(Math.abs(piecewise(0.25, stops) - 5) < 1.5); // smooth no lineal pero en rango
  assert.equal(piecewise(1.5, stops), 4, 'sostiene el último valor');
});
