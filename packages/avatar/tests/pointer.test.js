// pointer.test.js — muestreo de puntero, wander de mirada y springs de cabeza.
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/pointer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POINTER_DEFAULTS,
  LOOK_SPEED,
  HEAD_FOLLOW,
  samplePointer,
  emptyPointer,
  isPointerFresh,
  pointerInRange,
  nextWander,
  smoothLook,
  createHeadFollow,
  stepHeadFollow,
  BORED_STEPS,
} from '../src/runtime/pointer.js';

/* ── rect de prueba común: centro (200, 100), radio 2.55·200 = 510 ─────────── */
const RECT = { left: 100, top: 50, width: 200, height: 100 };
const CX = 200;
const CY = 100;

/* ── samplePointer ────────────────────────────────────────────────────────── */
test('samplePointer: centro exacto → influence 1 y x/y 0', () => {
  const s = samplePointer(RECT, { x: CX, y: CY }, 1000);
  assert.equal(s.influence, 1);
  assert.equal(s.x, 0);
  assert.equal(s.y, 0);
  assert.equal(s.active, true);
  assert.equal(s.lastMove, 1000);
});

test('samplePointer: fuera del radio (2.55·max(w,h)) → influence 0 y active false', () => {
  const near = Math.max(RECT.width, RECT.height) * POINTER_DEFAULTS.radiusFactor; // 510
  const s = samplePointer(RECT, { x: CX + near + 90, y: CY }, 0);
  assert.equal(s.influence, 0);
  assert.equal(s.active, false);
});

test('samplePointer: punto justo al borde del radio → influence ≈ 0', () => {
  const near = Math.max(RECT.width, RECT.height) * POINTER_DEFAULTS.radiusFactor;
  const s = samplePointer(RECT, { x: CX + near, y: CY }, 0);
  assert.ok(Math.abs(s.influence) < 1e-9, `influence=${s.influence}`);
  assert.equal(s.active, false, 'en el borde no hay influencia activa');
});

test('samplePointer: clamps a ±48 (x) y ±34 (y) con punteros muy lejanos', () => {
  const right = samplePointer(RECT, { x: CX + 100000, y: CY }, 0);
  assert.equal(right.x, 48, 'derecha ≤ 48');
  const down = samplePointer(RECT, { x: CX, y: CY + 100000 }, 0);
  assert.equal(down.y, 34, 'abajo ≤ 34');
  const left = samplePointer(RECT, { x: CX - 100000, y: CY }, 0);
  assert.equal(left.x, -48, 'izquierda ≥ −48');
  const up = samplePointer(RECT, { x: CX, y: CY - 100000 }, 0);
  assert.equal(up.y, -34, 'arriba ≥ −34');
});

test('samplePointer: lastMove = now y active cuando influence > 0.001', () => {
  const s = samplePointer(RECT, { x: CX + 10, y: CY + 5 }, 4242);
  assert.equal(s.lastMove, 4242);
  assert.ok(s.influence > 0.001, `influence=${s.influence}`);
  assert.equal(s.active, true);
});

/* ── estado vacío / frescura / rango ──────────────────────────────────────── */
test('emptyPointer: active false, influence 0 y lastMove antiguo', () => {
  const p = emptyPointer(5000);
  assert.equal(p.active, false);
  assert.equal(p.influence, 0);
  assert.equal(p.x, 0);
  assert.equal(p.y, 0);
  assert.equal(isPointerFresh(p, 5000), false, 'nunca es fresco');
});

test('isPointerFresh: 899 ms → true; 901 ms → false', () => {
  const p = { x: 0, y: 0, active: true, influence: 1, lastMove: 1000 };
  assert.equal(isPointerFresh(p, 1899), true, '899 ms < 900 ms');
  assert.equal(isPointerFresh(p, 1901), false, '901 ms ≥ 900 ms');
  assert.equal(isPointerFresh(null, 1000), false, 'sin puntero');
});

test('pointerInRange: exige fresco + activo + influence > 0.03', () => {
  const now = 10000;
  const base = { x: 5, y: 3, active: true, influence: 0.5, lastMove: now };
  assert.equal(pointerInRange(base, now), true, 'cumple las tres condiciones');
  assert.equal(pointerInRange({ ...base, influence: 0.03 }, now), false, 'influence = 0.03 no supera el mínimo');
  assert.equal(pointerInRange({ ...base, influence: 0.02 }, now), false, 'influence ≤ 0.03');
  assert.equal(pointerInRange({ ...base, lastMove: now - 901 }, now), false, 'no fresco');
  assert.equal(pointerInRange({ ...base, active: false }, now), false, 'inactivo');
  assert.equal(pointerInRange(null, now), false, 'sin puntero');
});

/* ── nextWander ───────────────────────────────────────────────────────────── */
test('nextWander: rand = 0 → ampX 12, ampY 5, x −12, y −5, nextAt now+1150', () => {
  const now = 5000;
  const w = nextWander(() => 0, now);
  assert.equal(w.x, -12, '(0·2−1)·12');
  assert.equal(w.y, -5, '(0·2−1)·5');
  assert.equal(w.nextAt, now + 1150);
});

test('nextWander: rand = 1 → ampX 25, ampY 14, x +25, y +14, nextAt now+3050', () => {
  const now = 0;
  const w = nextWander(() => 1, now);
  assert.equal(w.x, 25, '(1·2−1)·25');
  assert.equal(w.y, 14, '(1·2−1)·14');
  assert.equal(w.nextAt, now + 3050);
});

test('nextWander: secuencia rand fija → rangos ARA y valores calculados a mano', () => {
  const seq = [0, 0.5, 1, 0.25, 0.75, 0.5];
  let i = 0;
  const rand = () => seq[i++ % seq.length];
  const now = 7000;
  const w = nextWander(rand, now);
  // rangos ARA: x ∈ [−25, 25], y ∈ [−14, 14], retarget ∈ [1150, 3050] ms
  assert.ok(w.x >= -25 && w.x <= 25, `x=${w.x}`);
  assert.ok(w.y >= -14 && w.y <= 14, `y=${w.y}`);
  assert.ok(w.nextAt >= now + 1150 && w.nextAt <= now + 3050, `nextAt=${w.nextAt}`);
  // a mano: ampX = 12, ampY = 9.5, x = (1·2−1)·12, y = (0.25·2−1)·9.5, retarget 0.75
  assert.equal(w.x, 12);
  assert.equal(w.y, -4.75);
  assert.equal(w.nextAt, now + 1150 + 0.75 * 1900);
});

test('nextWander: es determinista con el mismo rand', () => {
  const makeRand = () => {
    const s = [0.1, 0.2, 0.3, 0.4, 0.5];
    let i = 0;
    return () => s[i++ % s.length];
  };
  const a = nextWander(makeRand(), 100);
  const b = nextWander(makeRand(), 100);
  assert.deepEqual(a, b, 'mismo rand y mismo now → mismo target');
});

/* ── smoothLook ───────────────────────────────────────────────────────────── */
test('smoothLook: con dt = 16.67 el avance es exactamente speed', () => {
  // k = 1 − (1−s)^(16.67/16.67) = 1 − (1−s) = s  →  from + (to−from)·s
  assert.ok(Math.abs(smoothLook(0, 10, 0.16, 16.67) - 1.6) < 1e-9, '0.16 → 1.6');
  assert.ok(Math.abs(smoothLook(0, 10, 0.28, 16.67) - 2.8) < 1e-9, '0.28 → 2.8');
  assert.ok(Math.abs(smoothLook(0, 10, LOOK_SPEED.default, 16.67) - 1.6) < 1e-9, 'LOOK_SPEED.default → 1.6');
  assert.ok(Math.abs(smoothLook(0, 10, LOOK_SPEED.locked, 16.67) - 4.0) < 1e-9, 'LOOK_SPEED.locked → 4.0');
});

test('smoothLook: 30 iteraciones crecen sin oscilar y convergen a `to`', () => {
  let v = 0;
  let prev = -Infinity;
  for (let i = 0; i < 30; i++) {
    const nv = smoothLook(v, 10, 0.16, 16.67);
    assert.ok(nv >= prev, `monótono en i=${i}: ${nv} < ${prev}`);
    assert.ok(nv <= 10 + 1e-9, `nunca supera to en i=${i}: ${nv}`);
    prev = nv;
    v = nv;
  }
  assert.ok(v > 9.9, `converge a to=10: ${v}`);
  assert.ok(v < 10, 'sin sobrepasar el objetivo');
});

test('smoothLook: speed fuera de rango no produce NaN ni inf', () => {
  for (const speed of [0, 1, -5, 2]) {
    for (const dt of [0, 16.67, 500, 5000]) {
      const r = smoothLook(0, 10, speed, dt);
      assert.ok(Number.isFinite(r), `speed=${speed} dt=${dt} → ${r}`);
      assert.ok(r >= -1e-9 && r <= 10 + 1e-9, `dentro del rango [0,10]: ${r}`);
    }
  }
  assert.ok(Number.isFinite(smoothLook(10, 0, 1, 16.67)), 'incluso hacia atrás');
});

/* ── createHeadFollow / stepHeadFollow ────────────────────────────────────── */
test('createHeadFollow: estado inicial todo en 0', () => {
  const st = createHeadFollow();
  assert.deepEqual(st, { x: 0, y: 0, rot: 0, vx: 0, vy: 0, vrot: 0 });
});

test('stepHeadFollow: con canFollowPointer converge cerca de maxTranslate en x', () => {
  const st = createHeadFollow();
  for (let i = 0; i < 60; i++) stepHeadFollow(st, { x: 48, y: 34 }, true, 16);
  assert.ok(st.x > 3.9, `x=${st.x}`);
  assert.ok(st.x <= 4.25, `x=${st.x}`);
  // ny = 34/34 = 1 ⇒ targetY = maxTranslate = 4.2 (mismo destino que x)
  assert.ok(st.y > 3.9, `y=${st.y}`);
  assert.ok(st.y <= 4.25, `y=${st.y}`);
});

test('stepHeadFollow: sin puntero el estado vuelve a 0 en menos de 200 pasos', () => {
  const st = { x: 4.2, y: 0, rot: 0, vx: 0, vy: 0, vrot: 0 };
  let steps = 0;
  for (let i = 0; i < 200; i++) {
    stepHeadFollow(st, { x: 0, y: 0 }, false, 16);
    steps = i + 1;
    if (st.x === 0 && st.y === 0 && st.vx === 0 && st.vy === 0) break;
  }
  assert.ok(steps < 200, `steps=${steps}`);
  assert.equal(st.x, 0, 'snap a 0');
  assert.equal(st.y, 0, 'snap a 0');
  assert.equal(st.vx, 0);
  assert.equal(st.vy, 0);
});

test('stepHeadFollow: rot converge a +8 con source (48, 34) — diag = 1·1', () => {
  const st = createHeadFollow();
  for (let i = 0; i < 100; i++) stepHeadFollow(st, { x: 48, y: 34 }, true, 16);
  assert.ok(st.rot > 7.5, `rot=${st.rot}`);
  assert.ok(st.rot <= 8.1, `sin sobrepasar maxRotate: ${st.rot}`);
});

test('stepHeadFollow: rot converge a −8 con source (48, −34) — diag = 1·(−1)', () => {
  const st = createHeadFollow();
  for (let i = 0; i < 100; i++) stepHeadFollow(st, { x: 48, y: -34 }, true, 16);
  assert.ok(st.rot < -7.5, `rot=${st.rot}`);
  assert.ok(st.rot >= -8.1, `sin sobrepasar maxRotate: ${st.rot}`);
});

test('stepHeadFollow: nunca hay NaN tras 200 pasos con entradas arbitrarias', () => {
  // LCG determinista (sin Math.random en el test)
  let seed = 123456789;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const st = createHeadFollow();
  const campos = ['x', 'y', 'rot', 'vx', 'vy', 'vrot'];
  for (let i = 0; i < 200; i++) {
    const src = { x: (rand() * 2 - 1) * 500, y: (rand() * 2 - 1) * 500 };
    stepHeadFollow(st, src, rand() > 0.5, 1 + rand() * 100);
    for (const k of campos) {
      assert.ok(Number.isFinite(st[k]), `paso ${i}: ${k}=${st[k]}`);
    }
  }
});

test('stepHeadFollow: dtCapMs protege — un paso con dt=5000 no desborda', () => {
  const st = createHeadFollow();
  stepHeadFollow(st, { x: 48, y: 34 }, true, 5000);
  for (const k of ['x', 'y', 'rot', 'vx', 'vy', 'vrot']) {
    assert.ok(Number.isFinite(st[k]), `${k} finito`);
    assert.ok(Math.abs(st[k]) <= 100, `${k}=${st[k]} ≤ 100 gracias al cap de 34 ms`);
  }
  // el cap es efectivo: sin él, vx = 4.2·95·5 = 1995 y x ≈ 9975
  assert.ok(Math.abs(st.vx) < 100, `vx=${st.vx}`);
});

/* ── tablas congeladas (convención del repo) ──────────────────────────────── */
test('tablas exportadas congeladas y con los literales de ARA', () => {
  for (const t of [POINTER_DEFAULTS, LOOK_SPEED, HEAD_FOLLOW]) {
    assert.ok(Object.isFrozen(t), 'Object.freeze aplicado');
  }
  assert.equal(POINTER_DEFAULTS.radiusFactor, 2.55);
  assert.equal(POINTER_DEFAULTS.gainX, 0.42);
  assert.equal(POINTER_DEFAULTS.gainY, 0.38);
  assert.equal(POINTER_DEFAULTS.clampX, 48);
  assert.equal(POINTER_DEFAULTS.clampY, 34);
  assert.equal(POINTER_DEFAULTS.freshnessMs, 900);
  assert.equal(POINTER_DEFAULTS.followMinInfluence, 0.03);
  assert.equal(LOOK_SPEED.default, 0.16);
  assert.equal(LOOK_SPEED.pointer, 0.28);
  assert.equal(HEAD_FOLLOW.maxTranslate, 4.2);
  assert.equal(HEAD_FOLLOW.maxRotate, 8);
  assert.equal(HEAD_FOLLOW.dtCapMs, 34);
  assert.equal(HEAD_FOLLOW.track.stiffness, 95);
  assert.equal(HEAD_FOLLOW.settle.damping, 14);
  assert.equal(HEAD_FOLLOW.rotTrack.stiffness, 70);
  assert.equal(HEAD_FOLLOW.rotSettle.damping, 13);
});

test('BORED_STEPS: 3 pasos con hold y retorno al centro (literal ARA)', () => {
  assert.equal(BORED_STEPS.length, 3);
  assert.equal(BORED_STEPS[0].x, -18);
  assert.equal(BORED_STEPS[1].x, 18);
  assert.equal(BORED_STEPS[2].x, 0);
  assert.equal(BORED_STEPS[2].y, 0);
  for (const s of BORED_STEPS) assert.ok(s.hold > 0 && s.lookSpeed > 0);
});
