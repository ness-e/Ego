// anim.test.js — easings y springs (regresión: colisión campo/método `curveTo`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ease, Spring, Tracked, cubicBezier, closeCurve, lerp, clamp } from '../src/core/anim.js';

test('Tracked expone curveTo/springTo como MÉTODOS (no como campo)', () => {
  const t = new Tracked(0);
  // regresión: `this.curveTo = 0` en el constructor sombreaba el método
  assert.equal(typeof t.curveTo, 'function');
  assert.equal(typeof t.springTo, 'function');
  assert.ok(!Object.keys(t).includes('curveTo'), 'no debe haber campo propio curveTo');
  assert.ok(Object.keys(t).includes('curveTarget'), 'el valor va en curveTarget');
});

test('Tracked: springTo crece con muelle hasta el objetivo', () => {
  const t = new Tracked(0);
  t.springTo(1, 0.4, 0.7);
  for (let i = 0; i < 120; i++) t.update(i * 16.7);
  assert.ok(Math.abs(t.value - 1) < 0.05, `value=${t.value}`);
});

test('Tracked: curveTo encoge con curva finita sin rebote', () => {
  const t = new Tracked(1);
  t.curveTo(0, 0.05); // 50 ms de curva
  // reloj determinista: update() acepta `now`, así el test no depende de la
  // carga de la máquina (el busy-loop anterior era flaky en paralelo)
  const start = t.curveStart;
  let last = t.value;
  for (let ms = 0; ms <= 120; ms += 4) {
    t.update(start + ms);
    assert.ok(t.value <= 1.001, 'no debe rebotar por encima del inicio');
    last = t.value;
  }
  assert.ok(last < 0.05, `debe llegar a ~0, quedó en ${last}`);
  assert.equal(t.animating, false);
});

test('Spring converge al objetivo y reporta settled', () => {
  const s = new Spring(0, 0.5, 0.7);
  s.target = 10;
  for (let i = 0; i < 600; i++) s.step(1 / 60);
  assert.ok(Math.abs(s.value - 10) < 0.1, `value=${s.value}`);
  assert.ok(s.settled);
});

test('Spring.set anula velocidad (sin inercia residual)', () => {
  const s = new Spring(0);
  s.target = 5;
  s.step(1 / 60);
  s.set(2);
  assert.equal(s.value, 2);
  assert.equal(s.target, 2);
  assert.equal(s.velocity, 0);
});

test('Ease: extremos correctos y acotado en [0,1] para out/inOut', () => {
  for (const fn of [Ease.out, Ease.inOut, Ease.lin, Ease.outQuint]) {
    assert.equal(fn(0), 0);
    assert.equal(fn(1), 1);
    for (let x = 0; x <= 1.0001; x += 0.1) {
      const v = fn(Math.min(1, x));
      assert.ok(v >= -0.001 && v <= 1.001, `fuera de rango en ${x}: ${v}`);
    }
  }
  // back pasa de 1 (rebote sutil) — solo comprobar que es finito
  assert.ok(Number.isFinite(Ease.back(0.7)));
});

test('cubicBezier: aproximación de identidad y closeCurve monótona', () => {
  const id = cubicBezier(0, 0, 1, 1);
  assert.ok(Math.abs(id(0.5) - 0.5) < 0.01);
  let prev = -1;
  for (let x = 0; x <= 1.0001; x += 0.05) {
    const v = closeCurve(Math.min(1, x));
    assert.ok(v >= prev - 1e-6, 'closeCurve debe ser monótona creciente');
    prev = v;
  }
  assert.equal(closeCurve(0), 0);
  assert.ok(Math.abs(closeCurve(1) - 1) < 1e-6);
});

test('lerp/clamp locales exportados', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-5, 0, 10), 0);
});
