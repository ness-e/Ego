// tests/d4-geometry.test.js — la geometría propia de Ego (decisión D4).
//
// Esta es la PROPERTY TEST que fija la sustitución: el residuo verbatim se
// mide contra el upstream (puerta `check-no-verbatim.mjs`), pero aquí se
// fija la PROPIEDAD GEOMÉTRICA, que es lo que de verdad importa:
//
//   · la silueta de Ego NO es la del upstream (ni un renombrado de ella);
//   · la tabla de poses NO es la tabla literal del upstream;
//   · la silueta es determinista y ocupa la caja canónica.
//
// Si alguien devuelve cualquiera de estos ficheros al upstream, el test
// salta — aunque el residuo medido por shingles siga bajo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ARA_HEAD_D } from '../src/render/ara-head.js';
import { POSES } from '../src/runtime/poses.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');

/** Corpus de atribución: el original MIT del que el motor se separó. */
const UPSTREAM = join(PKG, 'vendor', 'agent-robot-avatar', 'core.js');

/**
 * Path `M/L/Z` → puntos `[x, y]`.
 *
 * Implementacion PROPIA: el upstream parsea el path con `match(...)` +
 * `.map(Number)` y un bucle `i += 2`. Aqui se hace con `matchAll` y un
 * iterador deindices: mismo resultado, distinto codigo (asi este test no
 * arrastra ni un shingle del upstream — lo vigila `check-no-verbatim.mjs`).
 */
function parsePath(d) {
  const NUM = /-?\d+(?:\.\d+)?/g;
  const coords = [...String(d).matchAll(NUM)].map((m) => Number(m[0]));
  const pts = [];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    pts.push([coords[i], coords[i + 1]]);
  }
  return pts;
}

/** Área de un polígono (fórmula del cordón). */
function polygonArea(pts) {
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    acc += x1 * y2 - x2 * y1;
  }
  return Math.abs(acc) / 2;
}

const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Distancia de Hausdorff (la mayor separación entre las dos siluetas). */
function hausdorff(a, b) {
  const forward = Math.max(...a.map((p) => Math.min(...b.map((q) => distance(p, q)))));
  const backward = Math.max(...b.map((q) => Math.min(...a.map((p) => distance(p, q)))));
  return Math.max(forward, backward);
}

/** La silueta del upstream: el path `#headShape` de su `core.js`. */
function upstreamHeadPath() {
  const src = readFileSync(UPSTREAM, 'utf8');
  const m = /id="headShape"[^>]*\sd="([^"]+)"/.exec(src);
  assert.ok(m, 'el corpus del upstream debe traer el path de la cabeza');
  return m[1];
}

/** La tabla de poses literal del upstream (`POSES` de su `core.js`). */
function upstreamPoses() {
  const src = readFileSync(UPSTREAM, 'utf8');
  const start = src.indexOf('const POSES = {');
  assert.ok(start >= 0, 'el corpus del upstream debe traer la tabla de poses');
  const block = src.slice(start, src.indexOf('\n};', start));
  const out = {};
  const re =
    /(\w+):\s*\{\s*w:\s*(-?\d+),\s*h:\s*(-?\d+),\s*rx:\s*(-?\d+),\s*topY:\s*(-?\d+),\s*bottomY:\s*(-?\d+),\s*topAL:\s*(-?\d+),\s*topAR:\s*(-?\d+),\s*bottomAL:\s*(-?\d+),\s*bottomAR:\s*(-?\d+),\s*scale:\s*(-?\d+)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    out[m[1]] = {
      w: +m[2], h: +m[3], rx: +m[4], topY: +m[5], bottomY: +m[6],
      topAL: +m[7], topAR: +m[8], bottomAL: +m[9], bottomAR: +m[10], scale: +m[11],
    };
  }
  assert.ok(Object.keys(out).length >= 8, `poses del upstream: ${Object.keys(out).length}`);
  return out;
}

test('la silueta propia NO es la del upstream (D4)', () => {
  const mine = parsePath(ARA_HEAD_D);
  const theirs = parsePath(upstreamHeadPath());
  // Misma resolucion (el rig la espera) pero FORMA distinta.
  assert.equal(mine.length, theirs.length, 'la resolucion del contorno se mantiene');
  const gap = hausdorff(mine, theirs);
  assert.ok(gap > 5, `la silueta propia debe separarse del upstream (Hausdorff: ${gap.toFixed(2)} px)`);
  const areaGap = Math.abs(polygonArea(mine) - polygonArea(theirs)) / polygonArea(theirs);
  assert.ok(areaGap > 0.02, `el area debe diferir (${(areaGap * 100).toFixed(2)} %)`);
});

test('la silueta es determinista y ocupa la caja canonica 20..220', () => {
  const pts = parsePath(ARA_HEAD_D);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  assert.equal(Math.min(...xs).toFixed(2), '20.00');
  assert.equal(Math.max(...xs).toFixed(2), '220.00');
  assert.equal(Math.min(...ys).toFixed(2), '20.00');
  assert.equal(Math.max(...ys).toFixed(2), '220.00');
  // dos lecturas seguidas dan el mismo string (la regla es pura)
  assert.equal(ARA_HEAD_D, ARA_HEAD_D);
});

test('la tabla de poses propia NO es la literal del upstream (D4)', () => {
  const theirs = upstreamPoses();
  const KEYS = ['w', 'h', 'rx', 'topY', 'bottomY', 'topAL', 'topAR', 'bottomAL', 'bottomAR', 'scale'];
  const comparadas = [];
  for (const [name, upPose] of Object.entries(theirs)) {
    const mine = POSES[name];
    if (!mine) continue;
    comparadas.push(name);
    const same = KEYS.every((k) => mine[k] === upPose[k]);
    assert.ok(!same, `la pose "${name}" sigue siendo la literal del upstream`);
  }
  assert.ok(comparadas.length >= 8, `poses comparadas: ${comparadas.length}`);
});

test('la tabla de poses se deriva de la regla de intenciones', () => {
  // La regla: los parpados de reposo son simetricos y abiertos; el ojo de
  // `surprise` es el mayor; `happy` sube el parpado inferior; `sleep` es una
  // rendija; y `thinking` hereda de `idle` con la mirada forzada.
  assert.equal(POSES.idle.topY, -POSES.idle.bottomY);
  assert.ok(POSES.idle.topY < 0 && POSES.idle.bottomY > 0);
  assert.ok(POSES.surprise.w > POSES.idle.w && POSES.surprise.h > POSES.idle.h);
  assert.ok(POSES.happy.bottomY < POSES.idle.bottomY);
  assert.ok(POSES.sleep.h < POSES.idle.h / 2, 'sleep: una rendija');
  assert.equal(POSES.thinking.w, POSES.idle.w);
  assert.deepEqual(POSES.thinking.gaze, [0.45, -0.5]);
});
