// morph.test.js — geometría de la silueta y helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  superellipsePath,
  superellipsePoint,
  pointsToPath,
  seg,
  mix,
  smooth,
} from '../src/core/morph.js';

test('superellipsePath es determinista', () => {
  const opts = { n: 2.7, rx: 70, ry: 62, wobble: 0.04, wobblePhase: 1.2 };
  assert.equal(superellipsePath(opts), superellipsePath(opts));
});

test('path cerrado válido: empieza en M y termina en Z, sin NaN', () => {
  const d = superellipsePath({ n: 3.1, wobble: 0.06 });
  assert.ok(d.startsWith('M '));
  assert.ok(d.endsWith('Z'));
  assert.ok(!d.includes('NaN'));
  assert.ok(!d.includes('Infinity'));
});

test('exponente distinto ⇒ forma distinta (shape language)', () => {
  const circle = superellipsePath({ n: 2.05, wobble: 0 });
  const squareish = superellipsePath({ n: 3.35, wobble: 0 });
  assert.notEqual(circle, squareish);
});

test('wobble modifica el contorno pero mantiene el cierre', () => {
  const plain = superellipsePath({ n: 2.7, wobble: 0 });
  const wob = superellipsePath({ n: 2.7, wobble: 0.06, wobblePhase: 0.5 });
  assert.notEqual(plain, wob);
  assert.ok(wob.endsWith('Z'));
});

test('superellipsePoint: n=2 es una elipse (punto en45° sobre la circunferencia)', () => {
  const p = superellipsePoint(Math.PI / 4, 0, 0, 10, 10, 2);
  const r = Math.hypot(p.x, p.y);
  assert.ok(Math.abs(r - 10) < 1e-9);
  // y satisface |x/a|²+|y/b|²=1
  assert.ok(Math.abs((p.x / 10) ** 2 + (p.y / 10) ** 2 - 1) < 1e-9);
});

test('pointsToPath: M + (n-1) L + Z', () => {
  const d = pointsToPath([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
  ]);
  assert.equal(d, 'M 0 0 L 1 1 L 2 0 Z');
});

test('seg/mix/smooth: acotados y monótonos', () => {
  assert.equal(smooth(0), 0);
  assert.equal(smooth(1), 1);
  assert.equal(mix(10, 20, -5), 10);
  assert.equal(mix(10, 20, 5), 20);
  assert.equal(seg(0.5, 0.2, 0.8, 0, 10) > 0, true);
  assert.equal(seg(0.1, 0.2, 0.8, 0, 10), 0);
});
