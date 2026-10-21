// head.test.js — cabeza del robot: plantilla ARA + aplastado + redondeo.
// Todo viene de agent-robot-avatar (MIT © CX ArtLab): core.js (plantilla y
// parseo), geometry.js (flatten) y head-roundness.js (mezcla 0–100).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/head.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARA_HEAD_D, ARA_HEAD } from '../src/render/ara-head.js';
import {
  BODY,
  DEFAULT_ROUNDNESS,
  headRoundness,
  headHeightScale,
  bodyRadii,
  parseHeadPoints,
  pointsToPath,
  flattenHeadPoints,
  superellipsePointARA,
  targetShape,
  mixPoints,
  headPathFor,
  bodyPath,
} from '../src/render/body.js';
import { generateGenome } from '../src/core/genome.js';

test('plantilla verbatim: 160 puntos en la caja 20…220', () => {
  const pts = parseHeadPoints(ARA_HEAD_D);
  assert.equal(pts.length, 160);
  assert.equal(pts[0].x, 120);
  assert.equal(pts[0].y, 20);
  assert.equal(ARA_HEAD.cx, 120);
  assert.equal(ARA_HEAD.cy, 120);
  assert.equal(BODY.cx, 120);
  assert.equal(BODY.cy, 120);
});

test('pointsToPath: roundtrip M/L/Z con 2 decimales', () => {
  const pts = parseHeadPoints(ARA_HEAD_D);
  const d = pointsToPath(pts);
  assert.ok(d.startsWith('M 120.00 20.00'));
  assert.ok(d.endsWith('Z'));
  assert.deepEqual(parseHeadPoints(d), pts.map((p) => ({ x: round2(p.x), y: round2(p.y) })));
  function round2(v) { return Math.round(v * 100) / 100; }
});

test('flatten con heightScale 1 es identidad; con 0.9 aplasta los polos', () => {
  const pts = parseHeadPoints(ARA_HEAD_D);
  const same = flattenHeadPoints(pts, 1);
  assert.deepEqual(same, pts);
  // La PROPIEDAD del aplastamiento, con puntos sonda (no dependen de la
  // silueta concreta): los polos se mueven el inset completo y el ecuador no
  // se mueve nada.
  const probe = [{ x: 0, y: 20 }, { x: 0, y: 120 }, { x: 0, y: 220 }];
  const flatProbe = flattenHeadPoints(probe, 0.9);
  assert.equal(flatProbe[0].y, 30, 'la corona baja el inset completo (10)');
  assert.equal(flatProbe[1].y, 120, 'el ecuador no se mueve');
  assert.equal(flatProbe[2].y, 210, 'el menton sube el inset completo (10)');
  // Y sobre la silueta real: la corona baja el inset completo y el alto total
  // se reduce en 2x inset.
  const flat = flattenHeadPoints(pts, 0.9);
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const inset = ((maxY - minY) * (1 - 0.9)) / 2;
  const shift = pts.map((p, i) => Math.abs(flat[i].y - p.y));
  assert.ok(Math.abs(shift[0] - inset) < 1e-6, `corona: ${shift[0]} (inset ${inset})`);
  const flatMin = Math.min(...flat.map((p) => p.y));
  const flatMax = Math.max(...flat.map((p) => p.y));
  assert.ok(Math.abs((flatMax - flatMin) - ((maxY - minY) - 2 * inset)) < 1e-6, 'el alto se reduce 2x inset');
  assert.equal(flat.length, pts.length);
});

test('roundness 50 = plantilla (aplastada); 0 cuadra, 100 redondea', () => {
  const g50 = { shape: { roundness: 50, ratio: 1 } };
  assert.equal(headPathFor(g50), pointsToPath(flattenHeadPoints(parseHeadPoints(ARA_HEAD_D), 1)));
  const d0 = headPathFor({ shape: { roundness: 0, ratio: 1 } });
  const d100 = headPathFor({ shape: { roundness: 100, ratio: 1 } });
  assert.notEqual(d0, headPathFor(g50));
  assert.notEqual(d100, headPathFor(g50));
  // cuadrado: las esquinas se acercan al borde de la caja (|x-120| grande arriba)
  const pts0 = parseHeadPoints(d0);
  const top0 = pts0.filter((p) => p.y < 60);
  assert.ok(Math.max(...top0.map((p) => Math.abs(p.x - 120))) > 90, 'cuadrado llena arriba');
});

test('headRoundness/headHeightScale recortan y usan defaults', () => {
  assert.equal(DEFAULT_ROUNDNESS, 50);
  assert.equal(headRoundness({ shape: { roundness: 30 } }), 30);
  assert.equal(headRoundness({ shape: { roundness: -5 } }), 0);
  assert.equal(headRoundness({ shape: { roundness: 500 } }), 100);
  assert.equal(headRoundness({}), 50);
  assert.equal(headHeightScale({ shape: { ratio: 0.9 } }), 0.9);
  assert.equal(headHeightScale({ shape: { ratio: 5 } }), 1, 'nunca estira');
  assert.equal(headHeightScale({}), 1);
  const { rx, ry } = bodyRadii({ shape: { roundness: 50, ratio: 0.9 } });
  assert.equal(rx, 100);
  assert.equal(ry, 90);
});

test('bodyPath sin NaN en 200 genomas (toda la gama de roundness)', () => {
  for (let i = 0; i < 200; i++) {
    const g = generateGenome(`head-${i}`);
    const d = bodyPath(g);
    assert.ok(!d.includes('NaN'), `NaN en head-${i}`);
    assert.ok(d.startsWith('M ') && d.endsWith('Z'));
  }
  // extremos explícitos
  for (const roundness of [0, 25, 50, 75, 100]) {
    const d = bodyPath({ shape: { roundness, ratio: 1 } });
    assert.ok(!d.includes('NaN') && d.endsWith('Z'), `roundness ${roundness}`);
  }
});

test('mixPoints/targetShape: mezcla acotada y superelipse conocida', () => {
  const a = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
  const b = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
  assert.deepEqual(mixPoints(a, b, 0), a);
  assert.deepEqual(mixPoints(a, b, 1), b);
  assert.deepEqual(mixPoints(a, b, 0.5), [{ x: 5, y: 5 }, { x: 15, y: 15 }]);
  // superelipse n=2 sobre caja 100×100 centrada: el punto a 0° está en (100, 0)
  const p = superellipsePointARA(0, 0, 0, 100, 100, 2);
  assert.ok(Math.abs(p.x - 100) < 1e-9 && Math.abs(p.y) < 1e-9);
  const pts = parseHeadPoints(ARA_HEAD_D);
  const sq = targetShape(pts, 10);
  assert.equal(sq.length, pts.length);
  for (const q of sq) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y));
});
