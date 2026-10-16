// morph.js — geometría procedural de la silueta.
// Superelipse: |x/a|^n + |y/b|^n = 1  (n=2 círculo … n→∞ rectángulo).
// Patrón extraído de AMBOS repos: coucou usa n=2.7 para el cuerpo; el robot
// usa superelipses para el trait "roundness" (head-roundness.js).

/** Punto de superelipse para un ángulo paramétrico. */
export function superellipsePoint(theta, cx, cy, rx, ry, n) {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const e = 2 / n;
  const x = Math.sign(cos) * Math.pow(Math.abs(cos), e) * rx;
  const y = Math.sign(sin) * Math.pow(Math.abs(sin), e) * ry;
  return { x: cx + x, y: cy + y };
}

/**
 * Genera el path de una superelipse orgánica (con wobble determinista del genoma).
 * @param {object} opts
 *   cx, cy       centro
 *   rx, ry       radios
 *   n            exponente (shape language)
 *   steps        nº de muestras (72-96 va bien)
 *   wobble       amplitud 0..0.06
 *   wobblePhase  fase (del genoma)
 * @returns {string} atributo `d` de SVG cerrado
 */
export function superellipsePath({
  cx = 120,
  cy = 126,
  rx = 72,
  ry = 72,
  n = 2.7,
  steps = 96,
  wobble = 0,
  wobblePhase = 0,
}) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    let k = 1;
    if (wobble > 0) {
      // dos armónicos → contorno orgánico asimétrico sin ruido aleatorio
      k = 1 + wobble * Math.sin(3 * theta + wobblePhase) + (wobble / 2) * Math.sin(5 * theta);
    }
    const p = superellipsePoint(theta, cx, cy, rx * k, ry * k, n);
    pts.push(p);
  }
  return pointsToPath(pts);
}

/** Array de puntos → path SVG cerrado ("M … L … Z"). */
export function pointsToPath(pts) {
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
  return d + ' Z';
}

/** Elipse SVG como path (para poder deformar/uniforme con el mismo pipeline). */
export function ellipsePath(cx, cy, rx, ry) {
  return (
    `M ${fmt(cx - rx)} ${fmt(cy)} ` +
    `A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)} ` +
    `A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)} Z`
  );
}

// — utilidades de interpolación usadas por todo el runtime —
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const smooth = (t) => t * t * (3 - 2 * t); // smoothstep
/** lerp + clamp */
export const mix = (a, b, t) => lerp(a, b, clamp(t, 0, 1));
/** Progresión segmentada: valor entre a..b de from..to con smoothstep. */
export const seg = (t, a, b, from, to) => {
  if (t <= a) return from;
  if (t >= b) return to;
  return lerp(from, to, smooth((t - a) / (b - a)));
};

function fmt(v) {
  return Math.round(v * 100) / 100;
}
