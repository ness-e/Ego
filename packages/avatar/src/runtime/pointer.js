// pointer.js — muestreo de puntero, wander de mirada y springs de seguimiento de cabeza.
// ADAPTADO de agent-robot-avatar (ARA CORE:368-383, CORE:922-948, CORE:955-997, MIT)
// — ver LICENSE.md. Constantes literales del original.

import { clamp } from '../core/morph.js';

/* ── tablas de configuración (literales ARA) ──────────────────────────────── */
export const POINTER_DEFAULTS = Object.freeze({
  radiusFactor: 2.55,
  gainX: 0.42,
  gainY: 0.38,
  clampX: 48,
  clampY: 34,
  freshnessMs: 900,
  cancelBoredAt: 0.65,
  followMinInfluence: 0.03,
});

export const LOOK_SPEED = Object.freeze({
  default: 0.16,
  pointer: 0.28,
  locked: 0.40,
  jelly: 0.42,
  antenna: 0.42,
  bored: 0.5,
});

export const HEAD_FOLLOW = Object.freeze({
  track: { stiffness: 95, damping: 16 },
  settle: { stiffness: 80, damping: 14 },
  rotTrack: { stiffness: 70, damping: 15 },
  rotSettle: { stiffness: 56, damping: 13 },
  maxTranslate: 4.2,
  maxRotate: 8,
  dtCapMs: 34,
});

/* ── muestreo del puntero ─────────────────────────────────────────────────── */
/**
 * Muestrea el puntero respecto al rectángulo del elemento (ARA CORE:368-383, literal).
 * @param {{left:number,top:number,width:number,height:number}} rect
 * @param {{x:number,y:number}} pointer coords de cliente (clientX/clientY)
 * @param {number} now performance.now()
 * @param {object} [cfg] POINTER_DEFAULTS
 */
export function samplePointer(rect, pointer, now, cfg = POINTER_DEFAULTS) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  const near = Math.max(rect.width, rect.height) * cfg.radiusFactor;
  const dist = Math.hypot(dx, dy);
  const influence = clamp(1 - dist / near, 0, 1);
  return {
    x: clamp(dx * cfg.gainX, -cfg.clampX, cfg.clampX),
    y: clamp(dy * cfg.gainY, -cfg.clampY, cfg.clampY),
    active: influence > 0.001,
    influence,
    lastMove: now,
  };
}

/** Estado vacío (sin puntero). */
export function emptyPointer(now = 0) {
  return { x: 0, y: 0, active: false, influence: 0, lastMove: now - 100000 };
}

export function isPointerFresh(pointer, now, freshnessMs = POINTER_DEFAULTS.freshnessMs) {
  return !!pointer && now - pointer.lastMove < freshnessMs;
}

export function pointerInRange(pointer, now, freshnessMs = POINTER_DEFAULTS.freshnessMs) {
  return isPointerFresh(pointer, now, freshnessMs) && pointer.active && pointer.influence > POINTER_DEFAULTS.followMinInfluence;
}

/* ── wander de mirada (ARA CORE:922-948) ──────────────────────────────────── */
/**
 * Nuevo target de wander (ARA: ampX 12-25, ampY 5-14, retarget 1150-3050 ms).
 * @param {() => number} rand
 * @param {number} now
 * @returns {{x:number,y:number,nextAt:number}}
 */
export function nextWander(rand, now) {
  const ampX = 12 + rand() * 13;
  const ampY = 5 + rand() * 9;
  return {
    x: (rand() * 2 - 1) * ampX,
    y: (rand() * 2 - 1) * ampY,
    nextAt: now + 1150 + rand() * 1900,
  };
}

/* ── suavizado de mirada (ARA CORE:930-948) ───────────────────────────────── */
/**
 * Suavizado invariante al framerate de ARA: kL = 1-(1-speed)^(dt/16.67).
 * @param {number} from @param {number} to @param {number} speed @param {number} dt ms
 */
export function smoothLook(from, to, speed, dt) {
  const s = clamp(speed, 0.02, 0.9);
  const k = 1 - Math.pow(1 - s, dt / 16.67);
  return from + (to - from) * k;
}

/* ── spring de seguimiento de cabeza (ARA CORE:955-1043) ──────────────────── */
/** @returns {{x:number,y:number,rot:number,vx:number,vy:number,vrot:number}} */
export function createHeadFollow() {
  return { x: 0, y: 0, rot: 0, vx: 0, vy: 0, vrot: 0 };
}

/**
 * Un paso del spring de cabeza (ARA CORE:1009-1043).
 * @param {object} state mutado in-place
 * @param {{x:number,y:number}} source fuente en px (puntero o look)
 * @param {boolean} canFollowPointer
 * @param {number} dtMs
 */
export function stepHeadFollow(state, source, canFollowPointer, dtMs, cfg = HEAD_FOLLOW) {
  const nx = clamp(source.x / 48, -1, 1);
  const ny = clamp(source.y / 34, -1, 1);
  const diag = clamp(nx * ny, -1, 1);
  const targetRot = diag * cfg.maxRotate;
  const targetX = canFollowPointer ? nx * cfg.maxTranslate : 0;
  const targetY = canFollowPointer ? ny * cfg.maxTranslate : 0;

  const dtS = Math.min(dtMs, cfg.dtCapMs) / 1000;
  const rotK = canFollowPointer ? cfg.rotTrack : cfg.rotSettle;
  const aRot = (targetRot - state.rot) * rotK.stiffness - state.vrot * rotK.damping;
  state.vrot += aRot * dtS;
  state.rot += state.vrot * dtS;

  const k = canFollowPointer ? cfg.track : cfg.settle;
  const ax = (targetX - state.x) * k.stiffness - state.vx * k.damping;
  const ay = (targetY - state.y) * k.stiffness - state.vy * k.damping;
  state.vx += ax * dtS;
  state.vy += ay * dtS;
  state.x += state.vx * dtS;
  state.y += state.vy * dtS;

  if (!canFollowPointer) {
    if (Math.abs(state.x) < 0.01 && Math.abs(state.vx) < 0.01) { state.x = 0; state.vx = 0; }
    if (Math.abs(state.y) < 0.01 && Math.abs(state.vy) < 0.01) { state.y = 0; state.vy = 0; }
    if (Math.abs(state.rot) < 0.01 && Math.abs(state.vrot) < 0.01) { state.rot = 0; state.vrot = 0; }
  }
  return state;
}

/* ── rutina de aburrimiento (actions.js:268-275, literal) ────────────────────
 * Movida desde runtime/action-fx.js (eliminado en la reunificación): es una
 * rutina de MIRADA, así que pertenece a este módulo. */

/** Secuencia de targets cuando nadie interactúa: izq → der → centro. */
export const BORED_STEPS = Object.freeze([
  Object.freeze({ x: -18, y: -16, hold: 1400, lookSpeed: 0.5 }),
  Object.freeze({ x: 18, y: -16, hold: 1400, lookSpeed: 0.5 }),
  Object.freeze({ x: 0, y: 0, hold: 320, lookSpeed: 0.5 }),
]);
