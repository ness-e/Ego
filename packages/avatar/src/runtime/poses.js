// poses.js — poses del rig ocular (P4: plantilla SVG + morfometría).
//
// IMPLEMENTACIÓN PROPIA DE EGO — patrón asimilado de `agent-robot-avatar`
// (MIT), sin traducción de código. La idea asimilada es "una pose = un
// conjunto de números interpolables"; las cifras y la regla que las produce
// son de Ego.
//
// Una pose se declara con INTENCIONES (abrir, cerrar por debajo, inclinar,
// estirar, achatar) y las cifras del rig se DERIVAN de ellas con una regla
// propia: eso es lo que hace que la tabla sea un sistema y no un calco.
//
// La pose = 10 NÚMEROS: w/h/rx (tamaño del ojo), topY/bottomY (párpados),
// topAL/topAR/bottomAL/bottomAR (rotación de párpados por ojo) y scale. Al ser
// todo numérico, las poses interpolan limpiamente — sin conmutaciones de modo.
//
// Aliases propios para los estados de Ego (wide/flat/closed/tired/spiral) y
// `thinking` (idle + mirada forzada): mismo esquema, cero casos especiales.

import { lerp, clamp, smooth } from '../core/morph.js';

/**
 * Medidas base del rig ocular de Ego.
 *
 * `lidRatio` es cuánto se separa el párpado del centro del ojo cuando está
 * abierto: 1.22 × el semialto deja el párpado justo fuera de la elipse (el
 * ojo se ve entero) y cualquier valor menor lo recorta.
 */
const RIG = Object.freeze({
  width: 54,
  height: 58,
  lidRatio: 1.22,
});

/**
 * Intenciones de cada pose (propias de Ego).
 *
 *  - `lid`     : cuánto baja el párpado SUPERIOR (1 = totalmente arriba).
 *  - `under`   : cuánto sube el párpado INFERIOR (1 = totalmente abajo).
 *  - `tilt`    : inclinación del párpado superior en grados (+ = ceño).
 *  - `stretch` : multiplicador del ancho del ojo.
 *  - `squash`  : multiplicador del alto del ojo.
 */
const INTENTS = Object.freeze({
  idle: { lid: 1.00, under: 1.00, tilt: 0, stretch: 1.00, squash: 1.00 },
  happy: { lid: 1.00, under: 0.06, tilt: 0, stretch: 1.06, squash: 1.00 },
  sad: { lid: 0.18, under: 1.00, tilt: -13, stretch: 1.06, squash: 1.00 },
  angry: { lid: 0.18, under: 1.00, tilt: 13, stretch: 1.06, squash: 1.00 },
  sleepy: { lid: 0.02, under: 1.00, tilt: 0, stretch: 1.00, squash: 0.92 },
  input: { lid: 1.00, under: 1.00, tilt: 0, stretch: 0.22, squash: 1.36 },
  sleep: { lid: 4.00, under: 4.00, tilt: 0, stretch: 1.16, squash: 0.16 },
  surprise: { lid: 1.00, under: 1.00, tilt: 0, stretch: 1.22, squash: 1.14 },
  // `warn` = atención contenida: párpados bajos pero NEUTRALES. Sin
  // inclinación (nada de enfado → no es `angry`/`flat`, que son de `error`)
  // y sin decaimiento (nada de agotamiento → no es `sleepy`/`tired`, que es
  // de `ratelimit`).
  warn: { lid: 0.52, under: 0.86, tilt: 0, stretch: 0.92, squash: 0.88 },
});

/** Convierte unas intensiones en los 10 números del rig. */
function buildPose(intent) {
  const w = Math.round(RIG.width * intent.stretch);
  const h = Math.round(RIG.height * intent.squash);
  const ry = h / 2;
  const reach = ry * RIG.lidRatio;
  return {
    w,
    h,
    rx: Math.round(w / 2),
    topY: -Math.round(reach * intent.lid),
    bottomY: Math.round(reach * intent.under),
    topAL: -intent.tilt,
    topAR: intent.tilt,
    bottomAL: 0,
    bottomAR: 0,
    scale: 1,
  };
}

/**
 * Una pose del rig: los 10 numeros que el runtime interpola.
 * @typedef {object} Pose
 * @property {number} w ancho del ojo
 * @property {number} h alto del ojo
 * @property {number} rx radio horizontal
 * @property {number} topY posicion del parpado superior
 * @property {number} bottomY posicion del parpado inferior
 * @property {number} topAL inclinacion del parpado superior (izquierda)
 * @property {number} topAR inclinacion del parpado superior (derecha)
 * @property {number} bottomAL inclinacion del parpado inferior (izquierda)
 * @property {number} bottomAR inclinacion del parpado inferior (derecha)
 * @property {number} scale
 * @property {number[]} [gaze] mirada forzada (arriba-derecha)
 */

/** Tabla de poses de Ego, derivada de las intenciones. */
/** @type {Readonly<Record<string, Pose>>} */
const OWN_POSES = Object.freeze(
  Object.fromEntries(Object.entries(INTENTS).map(([name, intent]) => [name, Object.freeze(buildPose(intent))])),
);

/** @type {Readonly<Record<string, Pose>>} */
export const POSES = Object.freeze({
  ...OWN_POSES,
  // thinking = idle con mirada forzada arriba-derecha (comportamiento propio)
  thinking: { ...OWN_POSES.idle, gaze: [0.45, -0.5] },
  // aliases de Ego sobre las propias poses (los estados nombran intenciones)
  wide: { ...OWN_POSES.surprise },
  flat: { ...OWN_POSES.angry },
  closed: { ...OWN_POSES.sleep },
  tired: { ...OWN_POSES.sleepy },
  spiral: { ...OWN_POSES.sleepy },
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
