// body.js — cabeza del robot + tinte de estado, marcas y aura.
// La silueta ES la de agent-robot-avatar (el otro repositorio de referencia):
// plantilla verbatim de 160 puntos (render/ara-head.js, MIT © CX ArtLab) +
// aplastado vertical (geometry.js `flattenHeadPoints`) + mezcla de redondeo
// 0–100 (head-roundness.js: exponente 10 ↔ 2.2, default 50). Todo como funciones
// puras; el runtime solo re-emite el path al cambiar el genoma.
// El relleno es plano (tinta de la identidad); el estado tiñe con un overlay.

import { el, group } from './builder.js';
import { ARA_HEAD_D } from './ara-head.js';
import { clamp } from '../core/morph.js';

/** Caja canónica de la plantilla (20…220, centro 120/120). */
export const BODY = Object.freeze({ cx: 120, cy: 120, rx: 100 });

/** Redondeo neutro de la plantilla (head-roundness.js DEFAULT_ROUNDNESS). */
export const DEFAULT_ROUNDNESS = 50;

/** Redondeo del genoma: 0 = cuadrado … 100 = redondo. */
export function headRoundness(genome) {
  const r = Number(genome?.shape?.roundness);
  return Number.isFinite(r) ? clamp(Math.round(r), 0, 100) : DEFAULT_ROUNDNESS;
}

/**
 * Escala vertical desde el gen `ratio` (geometry.js `heightScale`, siempre
 * ≤ 1: solo aplasta, nunca estira — ratio ≥ 1 devuelve la plantilla intacta).
 */
export function headHeightScale(genome) {
  const ratio = Number(genome?.shape?.ratio);
  if (!Number.isFinite(ratio)) return 1;
  return clamp(ratio, 0.1, 1);
}

/** Semiejes efectivos (marking/appendage trabajan en fracciones de rx/ry). */
export function bodyRadii(genome) {
  return { rx: BODY.rx, ry: BODY.rx * headHeightScale(genome) };
}

/** Parsea un path `M/L/Z` a puntos (core.js `_parseHeadPoints`, literal). */
export function parseHeadPoints(d) {
  const nums = (String(d).match(/-?\d*\.?\d+/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i < nums.length - 1; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

/** Puntos → path `M/L/Z` con 2 decimales (core.js `_pointsToPath`, literal). */
export function pointsToPath(points) {
  if (!points.length) return ARA_HEAD_D;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  return `${d} Z`;
}

/**
 * Aplastado vertical con bloqueo en los polos (geometry.js, literal):
 * los puntos sobre `upperLockY`/bajo `lowerLockY` se desplazan el inset
 * completo; el ecuador no se mueve; entre medias, smoothstep.
 */
export function flattenHeadPoints(points, heightScale = 0.9) {
  if (!points?.length) return [];
  const source = points.map((p) => ({ x: p.x, y: p.y }));
  const minY = Math.min(...source.map((p) => p.y));
  const maxY = Math.max(...source.map((p) => p.y));
  const height = maxY - minY;
  if (!(height > 0)) return source;

  const scale = clamp(Number(heightScale), 0.1, 1);
  const centerY = (minY + maxY) / 2;
  const inset = (height * (1 - scale)) / 2;
  const upperLockY = minY + height * 0.4;
  const lowerLockY = maxY - height * 0.4;
  const smooth01 = (v) => {
    const t = clamp(v, 0, 1);
    return t * t * (3 - 2 * t);
  };

  return source.map((point) => {
    let shiftY = 0;
    if (point.y <= upperLockY) {
      shiftY = inset;
    } else if (point.y < centerY) {
      const t = (centerY - point.y) / Math.max(0.001, centerY - upperLockY);
      shiftY = inset * smooth01(t);
    } else if (point.y >= lowerLockY) {
      shiftY = -inset;
    } else if (point.y > centerY) {
      const t = (point.y - centerY) / Math.max(0.001, lowerLockY - centerY);
      shiftY = -inset * smooth01(t);
    }
    return { x: point.x, y: point.y + shiftY };
  });
}

/** Punto de superelipse (head-roundness.js:31-39, literal). */
export function superellipsePointARA(angle, cx, cy, halfW, halfH, exponent) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const xTerm = Math.pow(Math.abs(cos) / Math.max(0.001, halfW), exponent);
  const yTerm = Math.pow(Math.abs(sin) / Math.max(0.001, halfH), exponent);
  const denom = Math.pow(xTerm + yTerm, 1 / exponent);
  const radius = denom > 0 ? 1 / denom : 0;
  return { x: cx + cos * radius, y: cy + sin * radius };
}

/** Reproyecta los puntos sobre la superelipse objetivo (head-roundness.js, literal). */
export function targetShape(points, exponent) {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const halfW = (maxX - minX) / 2;
  const halfH = (maxY - minY) / 2;
  return points.map((p) => {
    const angle = Math.atan2(p.y - cy, p.x - cx);
    return superellipsePointARA(angle, cx, cy, halfW, halfH, exponent);
  });
}

/** Mezcla punto a punto (head-roundness.js `mixPoints`, literal). */
export function mixPoints(from, to, amount) {
  const t = clamp(amount, 0, 1);
  return from.map((point, i) => ({
    x: point.x + (to[i].x - point.x) * t,
    y: point.y + (to[i].y - point.y) * t,
  }));
}

/**
 * Silueta final para un genoma: plantilla → aplastado (ratio) → mezcla de
 * redondeo (`setHeadRoundness`: <50 hacia exp 10 = cuadrado, >50 hacia
 * exp 2.2 = redondo, 50 = plantilla intacta).
 */
export function headPathFor(genome) {
  const baseline = flattenHeadPoints(parseHeadPoints(ARA_HEAD_D), headHeightScale(genome));
  const roundness = headRoundness(genome);
  let points = baseline;
  if (roundness < DEFAULT_ROUNDNESS) {
    points = mixPoints(baseline, targetShape(baseline, 10), (DEFAULT_ROUNDNESS - roundness) / DEFAULT_ROUNDNESS);
  } else if (roundness > DEFAULT_ROUNDNESS) {
    points = mixPoints(baseline, targetShape(baseline, 2.2), (roundness - DEFAULT_ROUNDNESS) / DEFAULT_ROUNDNESS);
  }
  return pointsToPath(points);
}

/** Path de la silueta completa (nombre estable para shell/tests). */
export function bodyPath(genome) {
  return headPathFor(genome);
}

/** <defs> con aura + clip de silueta — ids únicos por semilla (uid). */
export function bodyDefs(uid, genome, palette, d) {
  const p = genome.palette;
  return el(
    'defs',
    {},
    [
      // aura: glow que rodea la cabeza (el estado lo modula por opacity)
      el('radialGradient', { id: `aura-${uid}`, cx: '0.5', cy: '0.5', r: '0.5' }, [
        el('stop', { offset: '0.55', 'stop-color': `hsl(${p.hue} ${p.sat}% 66% / 0.55)` }),
        el('stop', { offset: '1', 'stop-color': `hsl(${p.hue} ${p.sat}% 66% / 0)` }),
      ]),
      el('clipPath', { id: `clip-${uid}` }, el('path', { d })),
    ].join('')
  );
}

/** Marca del genoma (rasgo distintivo propio, recortada a la silueta). */
export function markingPath(uid, genome) {
  const { rx, ry } = bodyRadii(genome);
  const { cx, cy } = BODY;
  const m = genome.markingDetail;
  switch (genome.marking) {
    case 'dots':
      if (!m) return '';
      return group({ 'clip-path': `url(#clip-${uid})` }, [
        ...m.spots.map((s) =>
          el('circle', {
            cx: round(cx + s.cx * rx),
            cy: round(cy + s.cy * ry),
            r: round(s.r * rx),
            fill: '#fff',
            opacity: '0.34',
          })
        ),
      ]);
    case 'stripe': {
      if (!m) return '';
      const y = cy + m.y * ry;
      const t = m.thickness * ry;
      return el('path', {
        d: stripePath(cx, y, rx * 1.4, t, m.tilt),
        fill: '#fff',
        opacity: '0.22',
        'clip-path': `url(#clip-${uid})`,
      });
    }
    case 'orbit': {
      if (!m) return '';
      return el('ellipse', {
        cx,
        cy,
        rx: round(rx * m.ratio * 0.62),
        ry: round(ry * m.ratio * 0.34),
        fill: 'none',
        stroke: '#fff',
        'stroke-width': round(m.thickness * rx),
        opacity: '0.3',
        transform: `rotate(${m.tilt} ${cx} ${cy})`,
        'clip-path': `url(#clip-${uid})`,
      });
    }
    default:
      return '';
  }
}

function stripePath(cx, y, w, t, tilt) {
  const rad = (tilt * Math.PI) / 180;
  const dx = Math.cos(rad) * w;
  const dy = Math.sin(rad) * w;
  const nx = -Math.sin(rad) * t;
  const ny = Math.cos(rad) * t;
  const p1 = `${round(cx - dx + nx)} ${round(y - dy + ny)}`;
  const p2 = `${round(cx + dx + nx)} ${round(y + dy + ny)}`;
  const p3 = `${round(cx + dx - nx)} ${round(y + dy - ny)}`;
  const p4 = `${round(cx - dx - nx)} ${round(y - dy - ny)}`;
  return `M ${p1} L ${p2} L ${p3} L ${p4} Z`;
}

/** Capa de tinte de estado: path de la cabeza en color de estado (opacity = strength). */
export function tintLayer(d) {
  return el('path', { d, fill: 'none', opacity: '0', class: 'tint' });
}

function round(v) {
  return Math.round(v * 100) / 100;
}
