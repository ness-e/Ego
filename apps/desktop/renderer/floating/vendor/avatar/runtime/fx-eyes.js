// fx-eyes.js — TODOS los efectos oculares en un solo módulo.
// Fusión de `runtime/expressions.js` + la parte ocular de `runtime/action-fx.js`
// (ambos eran matemática del rig de agent-robot-avatar, MIT © CX ArtLab — ver
// LICENSE.md). Las tablas de keys de cabeza viven en `runtime/micro.js` y la
// rutina de aburrimiento en `runtime/pointer.js`: aquí solo queda el espacio
// de los OJOS.
//
// ── Envoltorio estándar ─────────────────────────────────────────────────
// Cada `sample` devuelve un DELTA con la misma forma:
//
//   { dx, dy, sx, sy, lid, done }
//
//   dx/dy  desplazamiento en px (se SUMAN entre efectos)
//   sx/sy  escala (se MULTIPLICAN entre efectos)
//   lid    null = no toca párpados · 0…1 = apertura (1 abierto, se combina
//          tomando el MÍNIMO — el efecto que más cierra manda)
//   done   el efecto terminó (el conductor lo retira)
//
// Excepciones documentadas (estructuras más ricas, no deltas):
//   errorEyeSweep(t01) → escalar unitario (el conductor lo escala)
//   waitingOrbit(elapsed) → { leftX, rightX, foreshorten, leftDepth, rightDepth }
//   loveHeart(elapsed) → { morph, pulse, scale, holdEnd, done } (override total)
//   warningLids/warningEyeTransform/warningLidFactor → structs ARA del warning

import { lerp, clamp, smooth } from '../core/morph.js';
import { segment, buildPhases } from '../core/timeline.js';

/* ── error: barrido de mirada (actions.js:52-58, literal) ─────────────────── */
export function errorEyeSweep(t) {
  if (t < 0.16) return segment(t, 0, 0.16, 0, -1);
  if (t < 0.4) return segment(t, 0.16, 0.4, -1, 1);
  if (t < 0.64) return segment(t, 0.4, 0.64, 1, -0.88);
  if (t < 0.84) return segment(t, 0.64, 0.84, -0.88, 0.58);
  return segment(t, 0.84, 1, 0.58, 0);
}

/* ── warning: tabla de tiempos + fases (actions.js:19-44, literal) ───────── */
export const WARNING_TIMING = Object.freeze({
  W1: 480, // pre-pausa: NO forma parte de las fases (ARA actions.js:35)
  W2: 400,
  W4: 600,
  W5: 200,
  W5P: 300,
  W6: 200,
  W6P: 500,
  W7: 100,
  W8: 800,
  W9: 227,
});
// Lista literal de claves de fase de ARA (actions.js:35) — W1 queda fuera.
export const WARNING_PHASES = buildPhases(WARNING_TIMING, [
  'W2', 'W4', 'W5', 'W5P', 'W6', 'W6P', 'W7', 'W8', 'W9',
]);

/**
 * Cascada de párpados/encuentro de ojos del warning (actions.js:295-346,
 * cifras literales). Devuelve los moduladores para un frame dado.
 */
export function warningLids(elapsed) {
  const fx = { proximity: 1, lids: 1, lidShift: 0, farLowOffset: 0, farDeepLidDrop: 0 };

  let proximity = elapsed < WARNING_PHASES.w2End ? segment(elapsed, 0, WARNING_PHASES.w2End, 0, 1) : 1;
  let lids = elapsed < WARNING_PHASES.w2End ? segment(elapsed, 0, WARNING_PHASES.w2End, 0, 1) : 1;

  const release = elapsed > WARNING_PHASES.w8End ? 1 - segment(elapsed, WARNING_PHASES.w8End, WARNING_PHASES.duration, 0, 1) : 1;
  proximity *= release;
  lids *= release;

  const lightPress = 4.2;
  const w4PressEnd = Math.min(WARNING_PHASES.w4Start + 120, WARNING_PHASES.w4End);
  if (elapsed >= WARNING_PHASES.w4Start && elapsed < WARNING_PHASES.w4End) {
    fx.lidShift = elapsed < w4PressEnd ? segment(elapsed, WARNING_PHASES.w4Start, w4PressEnd, 0, lightPress) : lightPress;
  } else if (elapsed >= WARNING_PHASES.w5Start && elapsed < WARNING_PHASES.w5End) {
    fx.lidShift = segment(elapsed, WARNING_PHASES.w5Start, WARNING_PHASES.w5End, lightPress, 20.5);
  } else if (elapsed >= WARNING_PHASES.w5pStart && elapsed < WARNING_PHASES.w5pEnd) {
    fx.lidShift = 20.5;
  } else if (elapsed >= WARNING_PHASES.w6Start && elapsed < WARNING_PHASES.w6End) {
    fx.lidShift = segment(elapsed, WARNING_PHASES.w6Start, WARNING_PHASES.w6End, 20.5, -6.5);
  } else if (elapsed >= WARNING_PHASES.w6pStart && elapsed < WARNING_PHASES.w6pEnd) {
    fx.lidShift = -6.5;
  } else if (elapsed >= WARNING_PHASES.w7Start && elapsed < WARNING_PHASES.w7End) {
    fx.lidShift = segment(elapsed, WARNING_PHASES.w7Start, WARNING_PHASES.w7End, -6.5, lightPress);
  } else if (elapsed >= WARNING_PHASES.w8Start && elapsed < WARNING_PHASES.w8End) {
    fx.lidShift = lightPress;
  }

  if (elapsed >= WARNING_PHASES.w5Start && elapsed < WARNING_PHASES.w5End) {
    fx.farLowOffset = segment(elapsed, WARNING_PHASES.w5Start, WARNING_PHASES.w5End, 0, 2.4);
    fx.farDeepLidDrop = segment(elapsed, WARNING_PHASES.w5Start, WARNING_PHASES.w5End, 0, 3.5);
  } else if (elapsed >= WARNING_PHASES.w5pStart && elapsed < WARNING_PHASES.w5pEnd) {
    fx.farLowOffset = 2.4;
    fx.farDeepLidDrop = 3.5;
  } else if (elapsed >= WARNING_PHASES.w6Start && elapsed < WARNING_PHASES.w6End) {
    fx.farLowOffset = segment(elapsed, WARNING_PHASES.w6Start, WARNING_PHASES.w6End, 2.4, 0);
    fx.farDeepLidDrop = segment(elapsed, WARNING_PHASES.w6Start, WARNING_PHASES.w6End, 3.5, 0);
  }

  fx.proximity = proximity;
  fx.lids = lids;
  return fx;
}

/**
 * Transform por ojo del warning (actions.js:348-359) — cifras originales
 * convertidas a deltas sobre la base del ojo (86/154 → +16/+20.5).
 * @param {number} elapsed ms desde el inicio del fx
 * @param {'near'|'far'} side  near = ojo izquierdo (86), far = derecho (154)
 */
export function warningEyeTransform(elapsed, side) {
  const { proximity, farLowOffset } = warningLids(elapsed);
  const near = side === 'near';
  return {
    dx: near ? lerp(0, 16.0, proximity) : lerp(0, 20.5, proximity),
    dy: near ? lerp(0, -0.5, proximity) : lerp(0, 7.5, proximity) + farLowOffset,
    rot: near ? lerp(0, -6.5, proximity) : lerp(0, 7.5, proximity),
    sx: near ? lerp(1, 1.37, proximity) : lerp(1, 0.68, proximity),
    sy: near ? lerp(1, 1.4, proximity) : lerp(1, 0.99, proximity),
  };
}

/** Factor de altura de ojo por "párpado" (lidShift 0..20.5 → 1..0.18). */
export function warningLidFactor(elapsed, side) {
  const fx = warningLids(elapsed);
  const shift = fx.lidShift + (side === 'far' ? fx.farDeepLidDrop * 0.3 : 0);
  return clamp(1 - shift / 26, 0.18, 1.35);
}

/* ── nodo de asentimiento (ARA CORE:999-1037) ─────────────────────────────── */
export const NOD_DURATION = 760;

/**
 * Ojos del "nodo": 4 segmentos — baja 0-150, sube 150-300, baja 300-450,
 * suelta 450-760. Caída 31 px + squash 30 %.
 */
export function nodModifier(elapsed) {
  let depth = 0;
  let done = false;
  if (elapsed < 150) depth = elapsed / 150;
  else if (elapsed < 300) depth = 1 - (elapsed - 150) / 150;
  else if (elapsed < 450) depth = (elapsed - 300) / 150;
  else if (elapsed < NOD_DURATION) depth = 1 - (elapsed - 450) / 310;
  else { depth = 0; done = true; }
  depth = clamp(depth, 0, 1);
  return { dx: 0, dy: 31 * depth, sx: 1, sy: 1 - 0.3 * depth, lid: null, done };
}

/* ── caída de ojos enfadados (ARA CORE:990-995) ───────────────────────────── */
export const ANGRY_DROP = Object.freeze({ duration: 680, amount: 4.8 });

/** Damped settle `1 - e^(-5.2t)·cos(8.6t)`. */
export function angryDropModifier(elapsed, cfg = ANGRY_DROP) {
  const t = clamp(elapsed / cfg.duration, 0, 1);
  const settle = 1 - Math.exp(-5.2 * t) * Math.cos(8.6 * t);
  let dy = cfg.amount * settle;
  if (t >= 1) dy = cfg.amount;
  return { dx: 0, dy, sx: 1, sy: 1, lid: null, done: t >= 1 };
}

/* ── bob emocional (ARA CORE:997-1002) ────────────────────────────────────── */
/**
 * @typedef {{ duration: number, amp: number, cycles?: number }} EyeBobCfg
 */

/** @type {Readonly<{ happy: EyeBobCfg, sad: EyeBobCfg, cycles: number }>} */
export const EYE_BOB = Object.freeze({
  happy: Object.freeze({ duration: 620, amp: 8 }),
  sad: Object.freeze({ duration: 700, amp: 7 }),
  cycles: 2,
});

/**
 * `sin(t·π·cycles·2)·amp·(1-0.38t)`.
 * @param {number} elapsed
 * @param {EyeBobCfg} [cfg]
 */
export function eyeBobModifier(elapsed, cfg = EYE_BOB.happy) {
  const t = clamp(elapsed / cfg.duration, 0, 1);
  const cycles = cfg.cycles ?? EYE_BOB.cycles;
  const dy = Math.sin(t * Math.PI * cycles * 2) * cfg.amp * (1 - 0.38 * t);
  return { dx: 0, dy, sx: 1, sy: 1, lid: null, done: t >= 1 };
}

/* ── sacudida de sorpresa (ARA CORE:1005-1009) ────────────────────────────── */
export const SURPRISE_SHAKE = Object.freeze({ duration: 420 });

/** `1 + 0.022·sin(8πt)·(1-0.18t)` sobre 420 ms. */
export function surpriseShakeModifier(elapsed, cfg = SURPRISE_SHAKE) {
  const t = clamp(elapsed / cfg.duration, 0, 1);
  const scale = 1 + 0.022 * Math.sin(t * Math.PI * 8) * (1 - 0.18 * t);
  return { dx: 0, dy: 0, sx: scale, sy: scale, lid: null, done: t >= 1 };
}

/* ── órbita de espera (ARA waiting.js:79-108) ─────────────────────────────── */
export const WAITING_ORBIT = Object.freeze({
  cycle: 3200,
  amplitude: 34,
  centerX: 120,
  foreshortenMin: 0.72,
  depthAmp: 0.08,
  orbits: 2,
});

/**
 * Órbita horizontal: 2 órbitas por ciclo de 3200 ms, ±34 px, foreshorten
 * 0.72-1.0 y profundidad ±8 %. Estructura por ojo (no delta estándar).
 */
export function waitingOrbit(elapsed, centerX = WAITING_ORBIT.centerX) {
  const t = clamp((elapsed % WAITING_ORBIT.cycle) / WAITING_ORBIT.cycle, 0, 1);
  const angle = t * Math.PI * 2 * WAITING_ORBIT.orbits;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    leftX: centerX - WAITING_ORBIT.amplitude * cosA,
    rightX: centerX + WAITING_ORBIT.amplitude * cosA,
    foreshorten: WAITING_ORBIT.foreshortenMin + (1 - WAITING_ORBIT.foreshortenMin) * Math.abs(cosA),
    leftDepth: 1 + WAITING_ORBIT.depthAmp * sinA,
    rightDepth: 1 - WAITING_ORBIT.depthAmp * sinA,
  };
}

/* ── mirada de inspección (ARA inspect.js) ────────────────────────────────── */
export const INSPECT_DEFAULTS = Object.freeze({
  aperture: 16, scanOffset: 16, prepPause: 120,
  close: 220, holdClosed: 880,
  down1: 400, holdDown1: 560, up1: 160, holdUp1: 580,
  center1: 140, holdCenter: 760,
  down2: 140, holdDown2: 620, up2: 180, holdUp2: 620,
  center2: 100, holdAfter: 940, open: 260,
});

/** Orden de consumo del cursor de fases (inspección: 6560 ms en total). */
export const INSPECT_KEYS = Object.freeze([
  'close', 'holdClosed', 'down1', 'holdDown1', 'up1', 'holdUp1', 'center1', 'holdCenter',
  'down2', 'holdDown2', 'up2', 'holdUp2', 'center2', 'holdAfter', 'open',
]);

/** Fases acumuladas (buildPhases). `duration` = 6560. */
export function inspectPhases(config = INSPECT_DEFAULTS) {
  const raw = buildPhases(config, INSPECT_KEYS);
  // buildPhases minusculiza las claves (`holdclosedEnd`); aquí se exponen
  // también con el camelCase original para legibilidad (mismo valor).
  const phases = { ...raw };
  for (const key of INSPECT_KEYS) {
    phases[`${key}Start`] = raw[`${key.toLowerCase()}Start`];
    phases[`${key}End`] = raw[`${key.toLowerCase()}End`];
  }
  return Object.freeze(phases);
}

export const INSPECT_DURATION = 6560;

function move01(elapsed, start, end, from, to) {
  if (elapsed <= start) return from;
  if (elapsed >= end) return to;
  const span = Math.max(1, end - start);
  return lerp(from, to, smooth(clamp((elapsed - start) / span, 0, 1)));
}

/** Mezcla de párpados: 0 = cerrados, 1 = abiertos. */
export function inspectLidBlend(elapsed, phases, config = INSPECT_DEFAULTS) {
  if (elapsed < phases.closeEnd) return smooth(clamp(elapsed / Math.max(1, config.close), 0, 1));
  if (elapsed >= phases.openStart) return 1 - smooth(clamp((elapsed - phases.openStart) / Math.max(1, config.open), 0, 1));
  return 1;
}

/** Trayecto vertical del escaneo: 0 → +16 → −16 → 0 → +16 → 0. */
export function inspectVerticalShift(elapsed, phases, offset = INSPECT_DEFAULTS.scanOffset) {
  if (elapsed < phases.down1End) return move01(elapsed, phases.down1Start, phases.down1End, 0, offset);
  if (elapsed < phases.holdDown1End) return offset;
  if (elapsed < phases.up1End) return move01(elapsed, phases.up1Start, phases.up1End, offset, -offset);
  if (elapsed < phases.holdUp1End) return -offset;
  if (elapsed < phases.center1End) return move01(elapsed, phases.center1Start, phases.center1End, -offset, 0);
  if (elapsed < phases.holdCenterEnd) return 0;
  if (elapsed < phases.down2End) return move01(elapsed, phases.down2Start, phases.down2End, 0, offset);
  if (elapsed < phases.holdDown2End) return offset;
  if (elapsed < phases.up2End) return move01(elapsed, phases.up2Start, phases.up2End, offset, 0);
  return 0;
}

/**
 * La inspección en envoltorio estándar: `lid` = apertura 0…1 (1 abierto),
 * `dy` = desplazamiento vertical del escaneo.
 */
export function inspectEye(elapsed, phases) {
  if (elapsed >= INSPECT_DURATION) return { dx: 0, dy: 0, sx: 1, sy: 1, lid: 1, done: true };
  return {
    dx: 0,
    dy: inspectVerticalShift(elapsed, phases),
    sx: 1,
    sy: 1,
    lid: inspectLidBlend(elapsed, phases),
    done: false,
  };
}

/* ── ojos de amor (ARA love.js) ───────────────────────────────────────────── */
// Los ojos se convierten en dos óvalos blancos verticales inclinados hacia
// dentro que se solapan abajo: juntos se leen como UN corazón (love.js:12-14).
// rx/ry/tilt/cross/centerY/pulse + lub-dub, cifras literales.
export const LOVE_DEFAULTS = Object.freeze({
  rx: 28, ry: 43, tilt: 42, cross: 13, centerY: 126, pulse: 0.155,
  prep: 120, morphIn: 240, beat: 760, beats: 3, morphOut: 360,
  swayAngle: 0, swayLift: 2,
  restLeft: 86, restRight: 154,
});

/** Duración total = morphIn + beat*beats + morphOut = 2880 ms. */
export function loveDuration(shape = LOVE_DEFAULTS) {
  return shape.morphIn + shape.beat * shape.beats + shape.morphOut;
}

export function loveHeart(elapsed, shape = LOVE_DEFAULTS) {
  const holdEnd = shape.morphIn + shape.beat * shape.beats;
  let morph;
  if (elapsed < shape.morphIn) morph = smooth(clamp(elapsed / shape.morphIn, 0, 1));
  else if (elapsed > holdEnd) morph = 1 - smooth(clamp((elapsed - holdEnd) / shape.morphOut, 0, 1));
  else morph = 1;

  let pulse = 0;
  if (elapsed >= shape.morphIn && elapsed <= holdEnd) {
    const phase = ((elapsed - shape.morphIn) % shape.beat) / shape.beat;
    const swell = (centre, width) => Math.max(0, 1 - Math.abs(phase - centre) / width);
    pulse = Math.max(smooth(swell(0.12, 0.12)), 0.6 * smooth(swell(0.36, 0.12)));
  }
  return {
    morph,
    pulse,
    scale: 1 + shape.pulse * pulse,
    holdEnd,
    done: elapsed > holdEnd + shape.morphOut,
  };
}

/** Geometría de los óvalos para un `morph` dado (ARA love.js:145-208). */
export function loveHeartGeometry(morph, shape = LOVE_DEFAULTS) {
  const tiltRad = (shape.tilt * Math.PI) / 180;
  const baseY = shape.centerY + (shape.ry - 3) * Math.cos(tiltRad);
  const eye = (side, restX) => ({
    x: lerp(restX, 120 - side * shape.cross, morph),
    y: lerp(126, baseY, morph),
    tilt: side * shape.tilt * morph,
  });
  return {
    baseY,
    left: eye(-1, shape.restLeft),
    right: eye(1, shape.restRight),
    cy: lerp(0, -(shape.ry - 3), morph),
    rx: lerp(27, shape.rx, morph),
    ry: lerp(29, shape.ry, morph),
  };
}

/* ── caída de cabeza del fallo (ARA failure.js:56-103) ────────────────────── */
export const FAILURE_TIMING = Object.freeze({ prep: 180, pause: 260, state: 320, drop: 720, hold: 720, rise: 520 });
export const FAILURE_DROP_START = FAILURE_TIMING.prep + FAILURE_TIMING.pause; // 440
export const FAILURE_TOTAL = 2720; // 180+260+320+720+720+520

/** Cabeza: 0 → 5.5 px en 720 ms, aguanta 720 ms, vuelve en 520 ms. */
export function failureHeadOffset(elapsed) {
  const dropStart = FAILURE_DROP_START;
  const dropEnd = dropStart + FAILURE_TIMING.drop; // 1160
  const holdEnd = dropEnd + FAILURE_TIMING.hold; // 1880
  const riseEnd = holdEnd + FAILURE_TIMING.rise; // 2400
  if (elapsed < dropStart) return { dy: 0, done: false };
  if (elapsed < dropEnd) return { dy: 5.5 * smooth((elapsed - dropStart) / FAILURE_TIMING.drop), done: false };
  if (elapsed < holdEnd) return { dy: 5.5, done: false };
  if (elapsed < riseEnd) return { dy: 5.5 * (1 - smooth((elapsed - holdEnd) / FAILURE_TIMING.rise)), done: false };
  return { dy: 0, done: true };
}
