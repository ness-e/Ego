// fx-eyes.test.js — matemática ocular unificada (fusión de action-fx.test.js +
// expressions.test.js). Todo viene de agent-robot-avatar (MIT © CX ArtLab):
// barrido de error, cascada del warning, nod/angry/bob/shake, órbita de
// espera, inspección, amor y caída de fallo. Envoltorio estándar:
// { dx, dy, sx, sy, lid, done } (ver runtime/fx-eyes.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  errorEyeSweep,
  WARNING_TIMING,
  WARNING_PHASES,
  warningLids,
  warningEyeTransform,
  warningLidFactor,
  NOD_DURATION,
  nodModifier,
  ANGRY_DROP,
  angryDropModifier,
  EYE_BOB,
  eyeBobModifier,
  SURPRISE_SHAKE,
  surpriseShakeModifier,
  WAITING_ORBIT,
  waitingOrbit,
  INSPECT_DEFAULTS,
  INSPECT_KEYS,
  inspectPhases,
  INSPECT_DURATION,
  inspectLidBlend,
  inspectVerticalShift,
  inspectEye,
  LOVE_DEFAULTS,
  loveDuration,
  loveHeart,
  loveHeartGeometry,
  FAILURE_TIMING,
  FAILURE_DROP_START,
  FAILURE_TOTAL,
  failureHeadOffset,
} from '../src/runtime/fx-eyes.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/** Todo sample respeta el envoltorio { dx, dy, sx, sy, lid, done }. */
function assertEnvelope(r, where) {
  for (const k of ['dx', 'dy', 'sx', 'sy', 'done']) {
    assert.ok(r[k] !== undefined, `${where}: falta ${k}`);
  }
  assert.ok(Number.isFinite(r.dx) && Number.isFinite(r.dy), `${where}: dx/dy finitos`);
  assert.ok(Number.isFinite(r.sx) && Number.isFinite(r.sy), `${where}: sx/sy finitos`);
  assert.ok(r.lid === null || Number.isFinite(r.lid), `${where}: lid nulo o finito`);
  assert.equal(typeof r.done, 'boolean', `${where}: done booleano`);
}

test('errorEyeSweep: recorre −1 → 1 → −0.88 → 0.58 → 0 (literal ARA)', () => {
  assert.equal(errorEyeSweep(0), 0);
  assert.ok(errorEyeSweep(0.16) <= -0.999, 'pisa el extremo izquierdo');
  assert.ok(errorEyeSweep(0.4) >= 0.999, 'pasa por el extremo derecho');
  assert.ok(Math.abs(errorEyeSweep(0.64) - -0.88) < 0.01);
  assert.ok(Math.abs(errorEyeSweep(0.84) - 0.58) < 0.01);
  assert.equal(errorEyeSweep(1), 0);
  for (let t = 0; t <= 1.0001; t += 0.01) assert.ok(Number.isFinite(errorEyeSweep(t)));
});

test('WARNING_PHASES: la suma de tiempos = duration y las fases son monotónicas', () => {
  const sum = Object.values(WARNING_TIMING).reduce((a, b) => a + b, 0);
  const fxSum = sum - WARNING_TIMING.W1;
  assert.equal(WARNING_PHASES.duration, fxSum);
  assert.equal(WARNING_PHASES.w2Start, 0);
  assert.ok(WARNING_PHASES.w5End <= WARNING_PHASES.w6Start);
  assert.ok(WARNING_PHASES.w8End < WARNING_PHASES.duration);
});

test('warningLids: ramps a full proximity y release vuelve a 0', () => {
  const late = warningLids(WARNING_PHASES.duration - 1);
  assert.ok(late.proximity < 0.1, `release al final: ${late.proximity}`);
  const mid = warningLids(WARNING_PHASES.w5pStart + 10);
  assert.equal(mid.lidShift, 20.5);
  assert.equal(mid.farLowOffset, 2.4);
  assert.equal(mid.farDeepLidDrop, 3.5);
});

test('warningEyeTransform: identidad en reposo y deltas positivos con presión', () => {
  const rest = warningEyeTransform(0, 'near');
  assert.equal(rest.dx, 0);
  assert.equal(rest.sx, 1);
  const pressed = warningEyeTransform(WARNING_PHASES.w4End - 1, 'near');
  assert.ok(pressed.dx > 5, 'el ojo cercano se acerca');
  assert.ok(pressed.sx > 1.2, 'se agranda');
  const far = warningEyeTransform(WARNING_PHASES.w4End - 1, 'far');
  assert.ok(far.sx < 0.8, 'el ojo lejano comprime');
  assert.ok(far.dy > 0, 'el lejano baja');
});

test('warningLidFactor: aprieta (↓) y en release vuelve a 1', () => {
  const pressed = warningLidFactor(WARNING_PHASES.w5pStart + 10, 'near');
  assert.ok(pressed < 0.3, `párpado cerrado: ${pressed}`);
  const released = warningLidFactor(WARNING_PHASES.duration - 1, 'near');
  assert.ok(released > 0.9, `release: ${released}`);
});

test('nodModifier: 4 segmentos 0 → 31 → 0 → 31 → 0 con sy mínimo 0.7 (literal ARA)', () => {
  assert.equal(NOD_DURATION, 760);
  assert.equal(nodModifier(0).dy, 0);
  assert.equal(nodModifier(150).dy, 31);
  assert.equal(nodModifier(300).dy, 0);
  assert.equal(nodModifier(450).dy, 31);
  const end = nodModifier(760);
  assert.equal(end.dy, 0);
  assert.equal(end.done, true);
  assert.ok(near(nodModifier(150).sy, 0.7, 1e-12), 'sy en el fondo = 1 − 0.3');
  assert.equal(nodModifier(0).done, false);
  assertEnvelope(nodModifier(100), 'nod');
  for (let e = 0; e <= 800; e += 10) {
    const r = nodModifier(e);
    assert.ok(Number.isFinite(r.dy) && Number.isFinite(r.sy), `NaN a ${e} ms`);
  }
});

test('angryDropModifier: settle arranca en 0, converge a amount y done al final', () => {
  assert.equal(ANGRY_DROP.amount, 4.8);
  const start = angryDropModifier(0);
  assert.equal(start.dy, 0, 'settle = 1 − 1·cos0 = 0');
  const end = angryDropModifier(ANGRY_DROP.duration);
  assert.equal(end.dy, ANGRY_DROP.amount, 'en duration devuelve exactamente 4.8');
  assert.equal(end.done, true);
  const mid = angryDropModifier(400);
  assert.ok(mid.dy > 4.5 && mid.dy < 4.9, `convergencia a 400 ms: ${mid.dy}`);
  assert.equal(angryDropModifier(0).done, false);
  assertEnvelope(angryDropModifier(100), 'angry');
  for (let e = 0; e <= 900; e += 10) assert.ok(Number.isFinite(angryDropModifier(e).dy), `NaN a ${e} ms`);
});

test('eyeBobModifier: arranca en 0, done al final; sad usa amp 7 y 700 ms', () => {
  assert.equal(eyeBobModifier(0, EYE_BOB.happy).dy, 0);
  assert.equal(eyeBobModifier(EYE_BOB.happy.duration, EYE_BOB.happy).done, true);
  assert.equal(EYE_BOB.sad.amp, 7);
  assert.equal(EYE_BOB.sad.duration, 700);
  assert.equal(EYE_BOB.cycles, 2);
  assert.equal(eyeBobModifier(0, EYE_BOB.sad).dy, 0);
  assert.equal(eyeBobModifier(EYE_BOB.sad.duration, EYE_BOB.sad).done, true);
  assertEnvelope(eyeBobModifier(100, EYE_BOB.happy), 'bob');
  for (let e = 0; e <= 800; e += 10) {
    assert.ok(Number.isFinite(eyeBobModifier(e, EYE_BOB.happy).dy));
    assert.ok(Number.isFinite(eyeBobModifier(e, EYE_BOB.sad).dy));
  }
});

test('surpriseShakeModifier: sx/sy en 1 al inicio, done a 420 ms y acotada en [0.97, 1.03]', () => {
  assert.equal(SURPRISE_SHAKE.duration, 420);
  assert.equal(surpriseShakeModifier(0).sx, 1);
  assert.equal(surpriseShakeModifier(0).sy, 1);
  assert.equal(surpriseShakeModifier(420).done, true);
  assert.equal(surpriseShakeModifier(0).done, false);
  assertEnvelope(surpriseShakeModifier(100), 'shake');
  let min = Infinity;
  let max = -Infinity;
  for (let e = 0; e <= 420; e += 1) {
    const r = surpriseShakeModifier(e);
    assert.ok(Number.isFinite(r.sx) && Number.isFinite(r.sy), `NaN a ${e} ms`);
    assert.equal(r.sx, r.sy, 'escala uniforme');
    min = Math.min(min, r.sx);
    max = Math.max(max, r.sx);
  }
  assert.ok(max > 1, 'la escala oscila por encima de 1');
  assert.ok(min >= 0.97 && max <= 1.03, `rango [${min}, ${max}]`);
});

test('waitingOrbit: periódica cada 3200 ms, reposo en 86/154 y foreshorten acotado', () => {
  for (const e of [500, 1750, 3300]) {
    const a = waitingOrbit(e);
    const b = waitingOrbit(e + WAITING_ORBIT.cycle);
    assert.deepEqual(a, b, `periodicidad a ${e} ms`);
  }
  const rest = waitingOrbit(0);
  assert.equal(rest.leftX, 86);
  assert.equal(rest.rightX, 154);
  assert.equal(rest.foreshorten, 1);
  assert.equal(rest.leftDepth, 1);
  assert.equal(rest.rightDepth, 1);
  const side = waitingOrbit(400);
  assert.ok(near(side.foreshorten, 0.72, 1e-12), `foreshorten mínimo: ${side.foreshorten}`);
  assert.ok(near(side.leftX, 120, 1e-12) && near(side.rightX, 120, 1e-12), 'ambos ojos en el centro');
  assert.ok(near(side.leftDepth, 1.08, 1e-12) && near(side.rightDepth, 0.92, 1e-12), 'profundidad ±8 %');
  const cross = waitingOrbit(800);
  assert.equal(cross.leftX, 154);
  assert.equal(cross.rightX, 86);
  assert.equal(cross.foreshorten, 1);
  for (let e = 0; e <= WAITING_ORBIT.cycle; e += 10) {
    const o = waitingOrbit(e);
    for (const v of Object.values(o)) assert.ok(Number.isFinite(v), `NaN a ${e} ms`);
    assert.ok(o.foreshorten >= 0.72 && o.foreshorten <= 1.0, `foreshorten ${o.foreshorten}`);
    assert.ok(o.leftDepth >= 0.92 && o.leftDepth <= 1.08, `leftDepth ${o.leftDepth}`);
    assert.ok(o.rightDepth >= 0.92 && o.rightDepth <= 1.08, `rightDepth ${o.rightDepth}`);
  }
});

test('inspectPhases: duration 6560 y fases monotónicas de cierre a apertura', () => {
  const p = inspectPhases();
  assert.equal(p.duration, 6560);
  assert.equal(INSPECT_DURATION, 6560);
  assert.equal(INSPECT_KEYS.length, 15);
  assert.equal(p.closeStart, 0);
  assert.ok(p.closeEnd <= p.holdClosedEnd && p.holdClosedEnd <= p.down1Start);
  assert.ok(p.down1Start <= p.down1End && p.down1End <= p.holdDown1End);
  assert.ok(p.holdDown1End <= p.up1Start && p.up1End <= p.holdUp1End);
  assert.ok(p.holdUp1End <= p.center1Start && p.center1End <= p.holdCenterEnd);
  assert.ok(p.holdCenterEnd <= p.down2Start && p.down2End <= p.holdDown2End);
  assert.ok(p.holdDown2End <= p.up2Start && p.up2End <= p.holdUp2End);
  assert.ok(p.holdUp2End <= p.center2Start && p.center2End <= p.holdAfterEnd);
  assert.ok(p.holdAfterEnd <= p.openStart);
  assert.ok(p.openStart <= p.openEnd);
  assert.equal(p.openEnd, p.duration);
});

test('inspectLidBlend: rampa 0 → 1 en close, 1 en el escaneo y 0 al final', () => {
  const p = inspectPhases();
  assert.equal(inspectLidBlend(0, p), 0);
  assert.equal(inspectLidBlend(p.closeEnd, p), 1);
  assert.equal(inspectLidBlend(p.closeEnd + 1, p), 1);
  assert.ok(inspectLidBlend(INSPECT_DEFAULTS.close / 2, p) > 0 && inspectLidBlend(INSPECT_DEFAULTS.close / 2, p) < 1);
  assert.equal(inspectLidBlend(p.holdCenterEnd, p), 1);
  assert.ok(inspectLidBlend(p.duration - 1, p) < 0.01);
  for (let e = 0; e <= p.duration; e += 10) assert.ok(Number.isFinite(inspectLidBlend(e, p)));
});

test('inspectVerticalShift: recorre 0 → +16 → −16 → 0 → +16 → 0 acotado en ±16', () => {
  const p = inspectPhases();
  assert.equal(inspectVerticalShift(0, p), 0);
  assert.ok(near(inspectVerticalShift(p.holdDown1End - 1, p), 16, 1e-12), 'primer fondo +16');
  assert.ok(near(inspectVerticalShift(p.holdUp1End - 1, p), -16, 1e-12), 'primer pico −16');
  assert.ok(near(inspectVerticalShift(p.holdCenterEnd - 1, p), 0, 1e-12), 'regreso al centro');
  assert.ok(near(inspectVerticalShift(p.holdDown2End - 1, p), 16, 1e-12), 'segundo fondo +16');
  assert.ok(near(inspectVerticalShift(p.duration - 1, p), 0, 1e-12), 'termina centrado');
  assert.equal(inspectVerticalShift(p.duration, p), 0);
  for (let e = 0; e <= p.duration; e += 5) {
    const v = inspectVerticalShift(e, p);
    assert.ok(Number.isFinite(v), `NaN a ${e} ms`);
    assert.ok(v >= -16 && v <= 16, `fuera de rango a ${e} ms: ${v}`);
  }
});

test('inspectEye: envoltorio estándar con lid = apertura y done al final', () => {
  const p = inspectPhases();
  const start = inspectEye(0, p);
  assertEnvelope(start, 'inspect');
  assert.equal(start.lid, 0, 'arranca entrecerrado (rampa close)');
  assert.equal(start.done, false);
  const mid = inspectEye(p.holdCenterEnd, p);
  assert.equal(mid.lid, 1, 'párpados en reposo durante el escaneo');
  assert.ok(Number.isFinite(mid.dy));
  const end = inspectEye(INSPECT_DURATION, p);
  assert.equal(end.done, true);
  assert.equal(end.lid, 1);
});

test('loveDuration = 2880 ms y loveHeart: morph in/hold/out con latido vivo', () => {
  assert.equal(loveDuration(), 2880);
  const holdEnd = LOVE_DEFAULTS.morphIn + LOVE_DEFAULTS.beat * LOVE_DEFAULTS.beats;
  const inEnd = loveHeart(LOVE_DEFAULTS.morphIn - 1);
  assert.ok(inEnd.morph < 1, 'morph incompleto justo antes del hold');
  assert.equal(loveHeart(LOVE_DEFAULTS.morphIn + LOVE_DEFAULTS.beat * LOVE_DEFAULTS.beats / 2).morph, 1);
  const outEnd = loveHeart(holdEnd + LOVE_DEFAULTS.morphOut);
  assert.ok(near(outEnd.morph, 0, 1e-9), 'morph disuelto al final');
  assert.ok(outEnd.done === false, 'el cierre estricto es en holdEnd + morphOut + 1');
  assert.equal(loveHeart(holdEnd + LOVE_DEFAULTS.morphOut + 1).done, true);
  assert.equal(loveHeart(0).done, false);
  let maxPulse = 0;
  for (let e = LOVE_DEFAULTS.morphIn; e <= holdEnd; e += 1) maxPulse = Math.max(maxPulse, loveHeart(e).pulse);
  assert.ok(maxPulse > 0.9, `pulso máximo ${maxPulse}`);
  for (let e = 0; e <= 3000; e += 1) {
    const h = loveHeart(e);
    assert.ok(Number.isFinite(h.morph) && Number.isFinite(h.pulse) && Number.isFinite(h.scale));
    assert.ok(h.scale >= 1 && h.scale <= 1.155 + 1e-12, `scale ${h.scale} a ${e} ms`);
  }
});

test('loveHeartGeometry: reposo 86/154 con rx 27 y óvalos plenos 28/43 inclinados ±42', () => {
  const rest = loveHeartGeometry(0);
  assert.equal(rest.left.x, 86);
  assert.equal(rest.right.x, 154);
  assert.equal(rest.rx, 27);
  assert.equal(rest.ry, 29);
  assert.equal(rest.cy, 0);
  assert.ok(near(rest.left.tilt, 0), 'sin inclinación en reposo');
  const full = loveHeartGeometry(1);
  assert.equal(full.rx, LOVE_DEFAULTS.rx);
  assert.equal(full.ry, LOVE_DEFAULTS.ry);
  assert.equal(full.cy, -40);
  assert.equal(full.left.tilt, -42);
  assert.equal(full.right.tilt, 42);
  assert.ok(full.baseY > LOVE_DEFAULTS.centerY, `baseY ${full.baseY} > 126`);
  assert.equal(full.left.x, 133);
  assert.equal(full.right.x, 107);
  for (let m = 0; m <= 1.0001; m += 0.05) {
    const g = loveHeartGeometry(m);
    assert.ok(Number.isFinite(g.baseY) && Number.isFinite(g.rx) && Number.isFinite(g.ry) && Number.isFinite(g.cy));
    assert.ok(Number.isFinite(g.left.x) && Number.isFinite(g.left.y) && Number.isFinite(g.left.tilt));
    assert.ok(Number.isFinite(g.right.x) && Number.isFinite(g.right.y) && Number.isFinite(g.right.tilt));
  }
});

test('FAILURE_TOTAL = 2720 y failureHeadOffset: baja a 5.5, aguanta y sube', () => {
  const sum = Object.values(FAILURE_TIMING).reduce((a, b) => a + b, 0);
  assert.equal(sum, FAILURE_TOTAL);
  assert.equal(FAILURE_TOTAL, 2720);
  assert.equal(FAILURE_DROP_START, 440);
  assert.equal(failureHeadOffset(439).dy, 0);
  assert.equal(failureHeadOffset(1160).dy, 5.5);
  assert.equal(failureHeadOffset(1880).dy, 5.5);
  const rise = failureHeadOffset(2400);
  assert.equal(rise.dy, 0);
  assert.equal(rise.done, true);
  const end = failureHeadOffset(2720);
  assert.equal(end.dy, 0);
  assert.equal(end.done, true);
  let prev = -Infinity;
  for (let e = FAILURE_DROP_START; e <= 1160; e += 20) {
    const { dy } = failureHeadOffset(e);
    assert.ok(dy >= prev, `no monótono a ${e} ms`);
    prev = dy;
  }
  prev = Infinity;
  for (let e = 1880; e <= 2400; e += 20) {
    const { dy } = failureHeadOffset(e);
    assert.ok(dy <= prev, `no monótono a ${e} ms`);
    prev = dy;
  }
});

test('sin NaN: 0..3000 ms en pasos de 50 para todas las funciones', () => {
  const phases = inspectPhases();
  for (let e = 0; e <= 3000; e += 50) {
    const nod = nodModifier(e);
    const angry = angryDropModifier(e);
    const bobH = eyeBobModifier(e, EYE_BOB.happy);
    const bobS = eyeBobModifier(e, EYE_BOB.sad);
    const shake = surpriseShakeModifier(e);
    const orbit = waitingOrbit(e);
    const eye = inspectEye(e, phases);
    const love = loveHeart(e);
    const head = failureHeadOffset(e);
    for (const v of [
      nod.dx, nod.dy, nod.sx, nod.sy, angry.dy, bobH.dy, bobS.dy,
      shake.sx, shake.sy, eye.dy, eye.lid,
      orbit.leftX, orbit.rightX, orbit.foreshorten, orbit.leftDepth, orbit.rightDepth,
      love.morph, love.pulse, love.scale, head.dy,
    ]) {
      assert.ok(Number.isFinite(v), `valor no finito a ${e} ms: ${v}`);
    }
  }
  for (let m = 0; m <= 1; m += 0.1) {
    const g = loveHeartGeometry(m);
    for (const v of [g.baseY, g.rx, g.ry, g.cy, g.left.x, g.left.y, g.left.tilt, g.right.x, g.right.y, g.right.tilt]) {
      assert.ok(Number.isFinite(v), `geometría no finita a morph ${m}`);
    }
  }
});
