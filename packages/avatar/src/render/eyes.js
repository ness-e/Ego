// eyes.js — rig ocular del robot (agent-robot-avatar core.js:270-285).
// Cada ojo = elipse BLANCA + barra de cursor (modo input) + párpados
// superior/inferior (rects del color de la cabeza que se deslizan y rotan)
// dentro de una máscara de clip local. Las expresiones son NÚMEROS de pose
// (poses.js, tabla literal de core.js:8-57): aquí no hay modos, trazos ni
// formas — solo geometría que el runtime muta por frame.
// Adapted from agent-robot-avatar (MIT), vendor/agent-robot-avatar/core.js

import { el, group } from './builder.js';
import { BODY } from './body.js';
import { clamp } from '../core/morph.js';
import { Ease } from '../core/anim.js';

/**
 * Geometría canónica del rig (ARA core.js:270-285, literal):
 * ojos en (86,126)/(154,126), elipse rx27/ry29, máscara local
 * x −40…40 / y −54…54, lids de 140×60/90, barra de 12×78.
 */
export const ARA_EYE = Object.freeze({
  leftX: 86,
  rightX: 154,
  y: 126,
  baseRX: 27,
  baseRY: 29,
  mask: Object.freeze({ x: -40, y: -54, w: 80, h: 108 }),
  lidW: 140,
  lidTopH: 90,
  lidBottomH: 90,
});

/** Posiciones y tamaños de los dos ojos según el genoma. */
export function eyeGeometry(genome) {
  const s = Number(genome?.eyes?.scale) || 1;
  const spacing = Number(genome?.eyes?.spacing) || 0.34;
  const yBias = Number(genome?.eyes?.yBias) || 0;
  // 86 = 120 − 34 ⇒ spacing 0.34 reproduce la plantilla exacta
  const half = spacing * 100;
  return {
    left: BODY.cx - half,
    right: BODY.cx + half,
    y: ARA_EYE.y + yBias * 100,
    rx: ARA_EYE.baseRX * s,
    ry: ARA_EYE.baseRY * s,
  };
}

/**
 * Compresión de borde cerca de la sien (ARA `setEye`:1060-1066, literal):
 * el ojo se estrecha (22 % ancho, 8 % alto) y se desplaza hacia dentro.
 */
export function edgeSqueeze(side, cx, lookX, baseW, baseH) {
  const projectedX = cx + lookX;
  const edgeDistance = side === 'L' ? projectedX - 32 : 208 - projectedX;
  const edgeFactor = clamp(1 - edgeDistance / 58, 0, 1);
  const w = baseW * (1 - 0.22 * edgeFactor * edgeFactor);
  const h = baseH * (1 - 0.08 * edgeFactor * edgeFactor);
  const inwardShift = (baseW - w) * 0.58 * (side === 'L' ? 1 : -1);
  return { w, h, inwardShift };
}

/**
 * Apertura de sorpresa (ARA `_draw`:1099, literal): los ojos se separan
 * ±3.4 px según el progreso del morph hacia la pose surprise (w 34→68).
 */
export function surpriseSpread(poseW) {
  const k = clamp((poseW - 34) / (68 - 34), 0, 1);
  return 3.4 * Ease.out(k);
}

/** <defs> de la máscara local de párpados (una por avatar). */
export function eyesDefs(uid) {
  const m = ARA_EYE.mask;
  return el('clipPath', { id: `eyemask-${uid}` }, [
    el('rect', { x: m.x, y: m.y, width: m.w, height: m.h }),
  ]);
}

/** Capa completa de ojos (dos grupos listos para animar). */
export function eyesLayer(uid, genome, palette) {
  const geo = eyeGeometry(genome);
  const ink = palette.ink;
  const mk = (side, x) =>
    group(
      { class: `eye eye-${side}`, 'data-side': side, transform: `translate(${x} ${geo.y})` },
      [
        el('ellipse', {
          class: 'eye-base',
          cx: 0,
          cy: 0,
          rx: geo.rx,
          ry: geo.ry,
          fill: '#fff',
        }),
        el('rect', {
          class: 'eye-input',
          x: -6,
          y: -39,
          width: 12,
          height: 78,
          rx: 3,
          fill: '#fff',
          opacity: '0',
        }),
        group({ 'clip-path': `url(#eyemask-${uid})` }, [
          el('rect', {
            class: 'eye-top',
            x: -70,
            y: -126,
            width: ARA_EYE.lidW,
            height: ARA_EYE.lidTopH,
            fill: ink,
          }),
          el('rect', {
            class: 'eye-bottom',
            x: -70,
            y: 36,
            width: ARA_EYE.lidW,
            height: ARA_EYE.lidBottomH,
            fill: ink,
          }),
        ]),
      ].join('')
    );
  return group({ class: 'eyes' }, [mk('L', geo.left), mk('R', geo.right)]);
}
