// poses.js — poses del rig ocular (P4: plantilla SVG + morfometría).
// Una pose = 10 NÚMEROS (tabla literal de agent-robot-avatar core.js:8-57):
// w/h/rx (tamaño del ojo), topY/bottomY (párpados), topAL/topAR/bottomAL/
// bottomAR (rotación de párpados por ojo), scale. Al ser todo numérico, las
// poses interpolan limpiamente — sin conmutaciones de modo.
// Aliases propios para los estados de Ego (wide/flat/closed/tired/spiral) y
// `thinking` (idle + mirada forzada): mismo esquema, cero casos especiales.

import { lerp, clamp, smooth } from '../core/morph.js';

/** Tabla base verbatim (core.js:8-57): idle/happy/sad/angry/sleepy/input/sleep/surprise. */
const ARA_POSES = Object.freeze({
  idle: {
    w: 54, h: 58, rx: 27,
    topY: -36, bottomY: 36,
    topAL: 0, topAR: 0, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  happy: {
    w: 58, h: 58, rx: 29,
    topY: -36, bottomY: 0,
    topAL: 0, topAR: 0, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  sad: {
    w: 58, h: 58, rx: 29,
    topY: -5, bottomY: 36,
    topAL: -16, topAR: 16, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  angry: {
    w: 58, h: 58, rx: 29,
    topY: -5, bottomY: 36,
    topAL: 16, topAR: -16, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  sleepy: {
    w: 58, h: 56, rx: 28,
    topY: 0, bottomY: 36,
    topAL: 0, topAR: 0, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  input: {
    w: 12, h: 78, rx: 2,
    topY: -44, bottomY: 44,
    topAL: 0, topAR: 0, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  sleep: {
    w: 62, h: 10, rx: 2,
    topY: -20, bottomY: 20,
    topAL: 0, topAR: 0, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
  surprise: {
    w: 68, h: 68, rx: 34,
    topY: -40, bottomY: 40,
    topAL: 0, topAR: 0, bottomAL: 0, bottomAR: 0,
    scale: 1,
  },
});

export const POSES = Object.freeze({
  ...ARA_POSES,
  // thinking = idle con mirada forzada arriba-derecha (comportamiento propio)
  thinking: { ...ARA_POSES.idle, gaze: [0.45, -0.5] },
  // aliases de Ego sobre números ARA (los estados nombran intenciones)
  wide: { ...ARA_POSES.surprise },
  flat: { ...ARA_POSES.angry },
  closed: { ...ARA_POSES.sleep },
  tired: { ...ARA_POSES.sleepy },
  spiral: { ...ARA_POSES.sleepy },
});

/** Claves numéricas interpolables de una pose. */
export const POSE_KEYS = Object.freeze([
  'w', 'h', 'rx', 'topY', 'bottomY',
  'topAL', 'topAR', 'bottomAL', 'bottomAR', 'scale',
]);

export const POSE_NAMES = Object.freeze(Object.keys(POSES));

/** Estado interpolado de pose (valores numéricos actuales + clave + mirada). */
export function createPoseState(name = 'idle') {
  const p = POSES[name] || POSES.idle;
  return { key: POSES[name] ? name : 'idle', ...p, gaze: p.gaze || null };
}

/**
 * Interpola entre dos poses: como TODO es numérico, el morph es continuo
 * (smoothstep) sin conmutaciones — la mejora central frente al esquema
 * anterior de modos (elipse ↔ trazo con corte en el punto medio).
 */
export function lerpPose(from, to, t) {
  const k = smooth(clamp(t, 0, 1));
  const out = { key: t >= 0.5 ? to.key : from.key, gaze: to.gaze || null };
  for (const key of POSE_KEYS) out[key] = lerp(from[key], to[key], k);
  return out;
}

/** Duración de morph por defecto según transición. */
export function morphDuration(fromName, toName) {
  if (fromName === 'idle' && toName === 'idle') return 180;
  if (toName === 'closed' || toName === 'sleep' || toName === 'sleeping') return 320;
  return 260;
}
