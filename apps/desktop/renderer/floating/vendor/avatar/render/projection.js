// projection.js — proyección de los ojos sobre la silueta (mirada 3D-ish).
// PORTADO de vendor/coucou/mochi/engine.ts drawEyes() (líneas 749-784, MIT):
//  · eyeYaw = sd·EYE_SP + yaw — cada ojo se desplaza/foreshortenece según el
//    giro de cabeza, no solo con un translate plano.
//  · visibilidad: cos(eyeYaw)·cos(eyePitch) > 0.04 (ojo trasero en el limbo).
//  · fx/fy = lerp(max(0.18, cos·), 1, morph·0.7) — compresión acotada al 18 %.
// Adaptado a SVG: devuelve deltas sobre la posición base del ojo (nuestro
// espaciamiento lo aporta el genoma; EYE_SP solo gobierna la sensación 3D).
// Adapted from coucou (MIT), vendor/coucou/mochi/engine.ts

import { lerp } from '../core/morph.js';

/** Separación angular de los ojos y pitch base (coucou MochiConst, engine.ts:65-66). */
export const EYE_SP = 0.37;
export const EYE_P = -0.12;
/** Umbral de visibilidad (engine.ts:767). */
export const VIS_THRESHOLD = 0.04;
/** Piso de compresión (engine.ts:771-772). */
export const FX_FLOOR = 0.18;

const norm2pi = (a) => (((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

/**
 * Proyecta un ojo para un giro de cabeza dado.
 * @param {{side: 'L'|'R', yaw: number, pitch: number, morph?: number,
 *          spacing: number, ry: number}} p
 *   yaw/pitch en radianes (escala natural de la mirada), spacing = distancia
 *   del ojo al eje central, ry = radio vertical del ojo base.
 * @returns {{dx: number, dy: number, fx: number, fy: number, visible: boolean}}
 */
export function projectEye({ side, yaw, pitch, morph = 0, spacing, ry }) {
  const sd = side === 'L' ? -1 : 1;
  const eyeYaw = sd * EYE_SP + yaw;
  const eyePitch = norm2pi(EYE_P + pitch);
  const cp = Math.cos(eyePitch);
  const visible = Math.cos(eyeYaw) * cp > VIS_THRESHOLD;

  // desplazamiento relativo al reposo (yaw=pitch=0 → dx=dy=0)
  const restX = Math.sin(sd * EYE_SP) * Math.cos(EYE_P) * spacing;
  const restY = -Math.sin(EYE_P) * ry;
  const dx = Math.sin(eyeYaw) * cp * spacing - restX;
  const dy = -Math.sin(eyePitch) * ry - restY;

  // foreshortening normalizado al reposo (en reposo fx=fy=1; la compresión
  // solo aparece al girar — el divisor es el cos en reposo)
  const fx = lerp(Math.max(FX_FLOOR, Math.cos(eyeYaw)), 1, morph * 0.7) / Math.cos(EYE_SP);
  const fy = lerp(Math.max(FX_FLOOR, cp), 1, morph * 0.7) / Math.cos(EYE_P);
  return { dx, dy, fx, fy, visible };
}

/**
 * Mapea una mirada normalizada (−1..1 por eje, como la salida del runtime)
 * a yaw/pitch en radianes con la escala de coucou: tgYaw = lookX·0.62,
 * tgPitch = lookY·0.5 (engine.ts:507-508, 534-535).
 */
export function gazeToYawPitch(nx, ny) {
  return { yaw: nx * 0.62, pitch: ny * 0.5 };
}
