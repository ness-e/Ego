// projection.test.js — proyección de ojos sobre la silueta (coucou drawEyes).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/projection.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectEye, gazeToYawPitch, EYE_SP, VIS_THRESHOLD, FX_FLOOR } from '../src/render/projection.js';

const P = { spacing: 34, ry: 25 };

test('reposo: sin desplazamiento y foreshortening normalizado a 1', () => {
  for (const side of ['L', 'R']) {
    const r = projectEye({ side, yaw: 0, pitch: 0, ...P });
    assert.ok(Math.abs(r.dx) < 1e-9, `${side}: dx en reposo = 0`);
    assert.ok(Math.abs(r.dy) < 1e-9, `${side}: dy en reposo = 0`);
    assert.ok(Math.abs(r.fx - 1) < 1e-9, `${side}: fx en reposo = 1`);
    assert.ok(Math.abs(r.fy - 1) < 1e-9, `${side}: fy en reposo = 1`);
    assert.equal(r.visible, true);
  }
});

test('yaw positivo: ambos ojos se desplazan a la derecha y el derecho comprime más', () => {
  const yaw = 0.5;
  const L = projectEye({ side: 'L', yaw, pitch: 0, ...P });
  const R = projectEye({ side: 'R', yaw, pitch: 0, ...P });
  assert.ok(L.dx > 0 && R.dx > 0, 'ambos se mueven hacia el giro');
  assert.ok(R.fx < L.fx, `parallax: el ojo del giro comprime más (R=${R.fx.toFixed(3)} < L=${L.fx.toFixed(3)})`);
  assert.ok(R.fx >= FX_FLOOR / Math.cos(EYE_SP), 'compresión acotada al piso');
});

test('pitch: mirar hacia abajo (pitch<0 en nuestro mapping) baja los ojos', () => {
  // el elemento pasa pitch invertido (−pitch) para que la mirada baje en SVG
  const down = projectEye({ side: 'L', yaw: 0, pitch: -0.5, ...P });
  const up = projectEye({ side: 'L', yaw: 0, pitch: 0.5, ...P });
  assert.ok(down.dy > 0, 'mirada abajo → ojos bajan (dy>0 en SVG)');
  assert.ok(up.dy < 0, 'mirada arriba → ojos suben');
});

test('visibilidad: umbral cos·cos > 0.04', () => {
  const extreme = projectEye({ side: 'L', yaw: 2.2, pitch: 0, ...P });
  // cos(−0.37 + 2.2) = cos(1.83) < 0 → invisible
  assert.equal(extreme.visible, false);
  const normal = projectEye({ side: 'L', yaw: 0.6, pitch: 0, ...P });
  assert.equal(normal.visible, true, VIS_THRESHOLD > 0 ? 'dentro del umbral' : '');
});

test('gazeToYawPitch: escala coucou (0.62 / 0.5)', () => {
  const { yaw, pitch } = gazeToYawPitch(1, 1);
  assert.ok(Math.abs(yaw - 0.62) < 1e-9);
  assert.ok(Math.abs(pitch - 0.5) < 1e-9);
  const z = gazeToYawPitch(0, 0);
  assert.equal(z.yaw, 0);
  assert.equal(z.pitch, 0);
});

test('sin NaN con entradas extremas', () => {
  for (const v of [-10, -1, 0, 1, 10]) {
    const r = projectEye({ side: v < 0 ? 'L' : 'R', yaw: v, pitch: v, morph: Math.abs(v), ...P });
    for (const n of [r.dx, r.dy, r.fx, r.fy]) assert.ok(Number.isFinite(n), `finite con v=${v}`);
  }
});
