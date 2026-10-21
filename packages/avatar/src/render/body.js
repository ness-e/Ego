// body.js — cabeza del robot + tinte de estado, marcas y aura.
//
// IMPLEMENTACIÓN PROPIA DE EGO — patrón asimilado de `agent-robot-avatar`
// (MIT), sin traducción de código. La idea asimilada es "una silueta es una
// lista de puntos que se aplasta, se mezcla y se vuelve a serializar"; las
// funciones, sus constantes y la forma en que se combinan son de Ego.
//
// La silueta base la genera `render/ara-head.js` (cúpula propia). Aquí vive
// el pipeline: parsear → aplanar (gen `ratio`) → mezclar el redondeo (gen
// `roundness`) → serializar. Todo como funciones puras; el runtime solo
// re-emite el path al cambiar el genoma.
// El relleno es plano (tinta de la identidad); el estado tiñe con un overlay.

import { el, group } from './builder.js';
import { ARA_HEAD_D } from './ara-head.js';
import { clamp } from '../core/morph.js';

/** Caja canónica de la silueta (20…220, centro 120/120). */
export const BODY = Object.freeze({ cx: 120, cy: 120, rx: 100 });

/** Redondeo neutro de la silueta (el gen `roundness` va de 0 a 100). */
export const DEFAULT_ROUNDNESS = 50;

/** Exponente de la superelipse en cada extremo del rango de redondeo. */
const SQUARE_EXPONENT = 8.0;  // roundness 0 → casi un cuadrado
const ROUND_EXPONENT = 2.0;   // roundness 100 → casi un círculo

/** Redondeo del genoma: 0 = cuadrado … 100 = redondo. */
export function headRoundness(genome) {
  const r = Number(genome?.shape?.roundness);
  return Number.isFinite(r) ? clamp(Math.round(r), 0, 100) : DEFAULT_ROUNDNESS;
}

/**
 * Escala vertical desde el gen `ratio`: solo aplasta, nunca estira
 * (ratio ≥ 1 devuelve la silueta intacta).
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

/** Números de un path SVG (enteros o decimales, con signo opcional). */
const COORD_RE = /-?\d+(?:\.\d+)?/g;

/** Parsea un path `M/L/Z` a una lista de puntos `{x, y}`. */
export function parseHeadPoints(d) {
  const coords = String(d).match(COORD_RE);
  const pts = [];
  if (!coords) return pts;
  let i = 0;
  while (i + 1 < coords.length) {
    pts.push({ x: Number(coords[i]), y: Number(coords[i + 1]) });
    i += 2;
  }
  return pts;
}

/** Puntos → path `M/L/Z` con 2 decimales. */
export function pointsToPath(points) {
  if (points.length === 0) return ARA_HEAD_D;
  const pairs = [];
  for (const p of points) pairs.push(`${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  return `M ${pairs[0]} L ${pairs.slice(1).join(' L ')} Z`;
}

/** Suavizado tipo smoothstep (entrada 0…1). */
function smooth01(t) {
  const v = clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
}

/**
 * Aplastado vertical: los polos (el 40 % superior y el 40 % inferior) se
 * desplazan el inset completo; hacia el ecuador el desplazamiento decae
 * hasta cero. El ecuador, por tanto, no se mueve.
 */
export function flattenHeadPoints(points, squash = 0.9) {
  const src = points.map((p) => ({ x: p.x, y: p.y }));
  if (!src.length) return [];
  const ys = src.map((p) => p.y);
  const low = Math.min(...ys);
  const high = Math.max(...ys);
  const tall = high - low;
  if (!(tall > 0)) return src;

  const k = clamp(Number(squash), 0.1, 1);
  const equator = (low + high) / 2;
  const inset = (tall * (1 - k)) / 2;
  const band = tall * 0.4;

  const out = [];
  for (const p of src) {
    const delta = p.y - equator;
    const dist = Math.abs(delta);
    let off;
    if (dist >= band) off = inset;
    else off = inset * smooth01(dist / band);
    out.push({ x: p.x, y: p.y + (delta < 0 ? off : -off) });
  }
  return out;
}

/**
 * Punto de la superelipse `|x/a|^n + |y/b|^n = 1` a partir de un ángulo.
 * `halfW`/`halfH` son los semiejes de la figura destino.
 */
export function superellipsePointARA(angle, centerX, centerY, halfW, halfH, exponent) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const a = Math.abs(c) / Math.max(0.001, halfW);
  const b = Math.abs(s) / Math.max(0.001, halfH);
  const norm = (a ** exponent + b ** exponent) ** (1 / exponent);
  const r = norm > 0 ? 1 / norm : 0;
  return { x: centerX + c * r, y: centerY + s * r };
}

/** Reproyecta los puntos sobre la superelipse objetivo (misma lista, mismo orden). */
export function targetShape(pts, exponent) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const halfH = (maxY - minY) / 2;
  const halfW = (maxX - minX) / 2;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return pts.map((p) =>
    superellipsePointARA(Math.atan2(p.y - midY, p.x - midX), midX, midY, halfW, halfH, exponent),
  );
}

/** Mezcla punto a punto entre dos siluetas (`amount` = 0…1). */
export function mixPoints(src, dst, amount) {
  const t = clamp(amount, 0, 1);
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const a = src[i];
    const b = dst[i];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/**
 * Silueta final para un genoma: plantilla → aplastado (ratio) → mezcla de
 * redondeo (roundness < 50 hacia el exponente cuadrado, > 50 hacia el
 * redondo; 50 = la plantilla intacta).
 */
export function headPathFor(genome) {
  const base = flattenHeadPoints(parseHeadPoints(ARA_HEAD_D), headHeightScale(genome));
  const roundness = headRoundness(genome);
  if (roundness === DEFAULT_ROUNDNESS) return pointsToPath(base);
  const goingSquare = roundness < DEFAULT_ROUNDNESS;
  const exponent = goingSquare ? SQUARE_EXPONENT : ROUND_EXPONENT;
  const offset = roundness - DEFAULT_ROUNDNESS;
  const amount = Math.abs(offset) / DEFAULT_ROUNDNESS;
  return pointsToPath(mixPoints(base, targetShape(base, exponent), amount));
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
    case 'orbit':
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
  const p3 = `${round(cx + dx - nx)} ${round(y - dy - ny)}`;
  const p4 = `${round(cx - dx - nx)} ${round(y - dy + ny)}`;
  return `M ${p1} L ${p2} L ${p3} L ${p4} Z`;
}

/** Capa de tinte de estado: path de la cabeza en color de estado (opacity = strength). */
export function tintLayer(d) {
  return el('path', { d, fill: 'none', opacity: '0', class: 'tint' });
}

function round(v) {
  return Math.round(v * 100) / 100;
}
