// accessories.js — el accesorio superior de la cabeza.
//
// IMPLEMENTACIÓN PROPIA DE EGO — patrón asimilado del Avatar Studio
// (single-file HTML; su licencia no está declarada en el origen), sin
// traducción de código. La idea asimilada es "el accesorio se ancla al casco,
// gira con él y reacciona al estado"; el catálogo, las piezas y sus medidas
// son de Ego.
//
// ARQUITECTURA: dos capas.
//   · una capa de PRIMITIVAS (abajo): el vocabulario mínimo de dibujo —
//     disco, óvalo, polígono, barrido, degradado— usado por todas las piezas;
//   · un CATÁLOGO de accesorios: una ficha por accesorio que dice qué pieza
//     lo pinta y con qué parámetros.
//
// El catálogo es dato (se revisa de un vistazo) y las piezas son geometría
// reutilizable.
//
// Contrato: drawTopAccessory(ctx, S, rx, ry, turnShiftX = 0, sinYaw = 0).

import { getStateAccentColor, hexToRgba, roundRectPath, shadeColor } from './helpers.js';

/* ── primitivas de dibujo ───────────────────────────────────────────────── */

/**
 * Fija el estilo de una pasada de pintado.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{fill?: string | CanvasGradient, stroke?: string, width?: number, cap?: CanvasLineCap}} [opts]
 */
function paint(ctx, opts) {
  const { fill, stroke, width = 1, cap = 'butt' } = opts ?? {};
  if (fill !== undefined) ctx.fillStyle = fill;
  if (stroke !== undefined) ctx.strokeStyle = stroke;
  if (width !== 1) ctx.lineWidth = width;
  ctx.lineCap = cap;
}

/** Disco relleno. */
function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Disco hueco. */
function hoop(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Óvalo relleno. */
function oval(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

/** Polígono cerrado relleno. */
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** Polígono cerrado con un flanco curvo (bezier cuadrática). */
function petal(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  ctx.quadraticCurveTo(pts[3][0], pts[3][1], pts[4][0], pts[4][1]);
  ctx.closePath();
  ctx.fill();
}

/** Barra redondeada. */
function bar(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Curva trazada (cuadrática). */
function sweep(ctx, x0, y0, cx, cy, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

/** Degradado lineal. */
function lgrad(ctx, x0, y0, x1, y1) {
  return ctx.createLinearGradient(x0, y0, x1, y1);
}

/** Degradado radial. */
function rgrad(ctx, x, y, r0, r1) {
  return ctx.createRadialGradient(x, y, r0, x, y, r1);
}

/** Enciende el halo de color de acento alrededor de lo que se pinte. */
function glow(ctx, accent, blur) {
  ctx.shadowColor = accent;
  ctx.shadowBlur = blur;
}

/* ── catálogo ───────────────────────────────────────────────────────────── */

/** Estados en los que el avatar está "vivo": el accesorio pulsa con ellos. */
const ALIVE = Object.freeze(['waiting', 'input', 'talk', 'listen', 'send', 'warning', 'error']);

/** Estados en los que el accesorio se ilumina. */
const BRIGHT = Object.freeze(['success', 'love', 'wake', 'wave']);

/**
 * Una ficha por accesorio:
 *   `piece` → qué pieza genérica lo pinta; el resto son sus parámetros.
 */
const CATALOG = Object.freeze({
  none: { piece: 'none' },
  'cx-antenna': { piece: 'mast', glow: true },
  'cx-full-kit': { piece: 'mast', glow: true, kit: true },
  headphones: { piece: 'band', glow: true, span: 1.06, cups: 20 },
  glasses: { piece: 'lenses', glow: false, lensW: 44, lensH: 24, gap: 16, frame: 2.2, drop: 10 },
  'aviator-glasses': { piece: 'lenses', glow: true, lensW: 46, lensH: 26, gap: 14, frame: 3, drop: 10, arms: true },
  'cyber-goggles': { piece: 'lenses', glow: true, lensW: 36, lensH: 36, gap: 26, frame: 3, drop: 8, mono: true },
  santa: { piece: 'brimmed', glow: false, brim: '#ef4444', trim: '#ffffff', lean: 22 },
  witch: { piece: 'brimmed', glow: false, brim: '#1E1B4B', trim: '#4338CA', lean: 25, band: true },
  'cat-ears': { piece: 'pair', glow: false, shape: 'leaf', size: 22, height: 40, spread: 44, drop: 6 },
  'bunny-ears': { piece: 'pair', glow: false, shape: 'oval', size: 14, height: 38, spread: 28, drop: 4 },
  'fox-ears': { piece: 'pair', glow: false, shape: 'leaf', size: 22, height: 44, spread: 44, drop: 6, warm: true },
  'bear-ears': { piece: 'pair', glow: false, shape: 'round', size: 20, height: 20, spread: 48, drop: 2 },
  crown: { piece: 'crest', glow: true, jewel: 4.5 },
  halo: { piece: 'ring', glow: true, rx: 44, ry: 11, lift: 20, float: 5 },
  sprout: { piece: 'sprig', glow: false, stem: 36, leafW: 16, leafH: 9 },
});

/* ── piezas ─────────────────────────────────────────────────────────────── */

/** Antena: placa base, vástago curvo y punta luminosa. */
function mast(ctx, S, spec, env) {
  const { accent, perk } = env;
  ctx.rotate(S.antennaAngle);

  paint(ctx, { fill: shadeColor(S.bodyColor, -20) });
  oval(ctx, 0, 0, 14, 5);

  const lean = S.antennaAngle * 34 - perk * 3;
  const top = -38 - perk * 5;
  paint(ctx, { stroke: '#94a3b8', width: 5, cap: 'round' });
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.bezierCurveTo(lean * 0.2, top * 0.45, lean * 0.7, top * 0.8, lean, top);
  ctx.stroke();

  const beating = ALIVE.includes(S.state);
  const swell = beating ? Math.sin(S.time * 16) * 2.5 : S.bodyHoverAmount * 1.5;
  glow(ctx, accent, 15);
  paint(ctx, { fill: accent });
  disc(ctx, lean, top - 4, Math.max(5, 9 + swell));
  ctx.shadowBlur = 0;

  if (beating || S.bodyHoverAmount > 0.2) {
    const grow = 10 + ((S.time * 38) % 22);
    paint(ctx, { stroke: hexToRgba(accent, Math.max(0, 1 - (grow - 10) / 22) * 0.75), width: 2 });
    hoop(ctx, lean, top - 4, grow);
  }

  if (spec.kit) {
    paint(ctx, { stroke: accent, width: 4 });
    ctx.beginPath();
    ctx.ellipse(0, 10, 62, 18, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

/** Auriculares: un arco sobre la cabeza y dos cascos. */
function band(ctx, S, spec, env) {
  const { accent, rx } = env;
  ctx.save();
  ctx.translate(0, rx * 0.9);
  paint(ctx, { stroke: accent, width: 8 });
  ctx.beginPath();
  ctx.arc(0, 0, rx * spec.span, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * (rx + 9), -6 + S.headLookY * 5);
    paint(ctx, { fill: '#0f172a', stroke: accent, width: 2.8 });
    bar(ctx, -spec.cups / 2, -24, spec.cups, 48, 9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Gafas: dos lentes unidas por un puente (y, si toca, patillas). */
function lenses(ctx, S, spec, env) {
  const { accent } = env;
  const drop = ['success', 'inspect', 'wave', 'bored'].includes(S.state) ? 72 : spec.drop;
  ctx.translate(S.eyeLookX * 10, drop);
  ctx.rotate(S.antennaAngle * 0.25);

  if (spec.mono) {
    paint(ctx, { fill: '#1e293b', stroke: 'rgba(255,255,255,0.2)', width: 2 });
    bar(ctx, -58, -8, 116, 14, 6);
    ctx.stroke();
  }

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * (spec.gap + spec.lensW / 2), 0);

    if (spec.mono) {
      paint(ctx, { fill: '#334155', stroke: '#94a3b8', width: 2.5 });
      disc(ctx, 0, 0, 18);
      glow(ctx, accent, 13);
      ctx.stroke();
      paint(ctx, { fill: '#090d16', stroke: accent, width: 3 });
      disc(ctx, 0, 0, 12.5);
      ctx.stroke();
      ctx.shadowBlur = 0;
      paint(ctx, { fill: 'rgba(255,255,255,0.7)' });
      disc(ctx, -4 + S.eyeLookX * 2, -4 + S.eyeLookY * 2, 3.5);
    } else {
      const tint = spec.glow && S.autoStateColors ? accent : '#0f172a';
      paint(ctx, { fill: tint, stroke: spec.glow ? '#fbbf24' : '#ffffff', width: spec.frame });
      bar(ctx, -spec.lensW / 2, -spec.lensH / 2, spec.lensW, spec.lensH, [8, 8, 16, 16]);
      ctx.stroke();
      paint(ctx, { fill: 'rgba(255, 255, 255, 0.55)' });
      poly(ctx, [
        [-spec.lensW / 2 + 9, -spec.lensH / 2 + 3],
        [-spec.lensW / 2 + 17, -spec.lensH / 2 + 3],
        [-spec.lensW / 2 + 9, spec.lensH / 2 - 5],
        [-spec.lensW / 2 + 2, spec.lensH / 2 - 5],
      ]);
    }
    ctx.restore();
  }

  if (!spec.mono) {
    paint(ctx, { stroke: spec.glow ? '#fbbf24' : '#ffffff', width: spec.frame });
    ctx.beginPath();
    ctx.moveTo(-spec.gap, -3);
    ctx.lineTo(spec.gap, -3);
    ctx.stroke();
  }

  if (spec.arms) {
    paint(ctx, { stroke: '#fbbf24', width: 3 });
    ctx.beginPath();
    ctx.moveTo(-56, -4);
    ctx.lineTo(-66, 11);
    ctx.moveTo(56, -4);
    ctx.lineTo(66, 11);
    ctx.stroke();
  }
}

/** Sombrero con ala: un gorro y una banda (de papa o de bruja). */
function brimmed(ctx, S, spec, env) {
  const { perk } = env;
  ctx.rotate(S.antennaAngle * 0.45);
  const tip = spec.lean + S.antennaAngle * 22;
  paint(ctx, { fill: spec.brim });
  petal(ctx, [
    [-38, 4],
    [-6, -52],
    [tip, -22 - perk * 5],
    [32, 4],
    [-38, 4],
  ]);
  paint(ctx, { fill: spec.trim });
  bar(ctx, -42, -3, 84, 14, 7);
  paint(ctx, { fill: spec.brim });
  disc(ctx, tip, -22 - perk * 5, 11);
  if (spec.band) {
    paint(ctx, { fill: '#F59E0B' });
    ctx.fillRect(-24, -5, 48, 8);
  }
}

/** Par de orejas: la misma pieza con silueta y tamaño distintos. */
function pair(ctx, S, spec, env) {
  const { accent, perk, sinYaw } = env;
  const twitchL = Math.sin(S.time * 5) > 0.92 ? -0.14 : S.antennaAngle * 0.45;
  const twitchR = Math.cos(S.time * 4.3) > 0.92 ? 0.14 : S.antennaAngle * 0.45;
  const fold = -perk * 0.24;

  for (const side of [-1, 1]) {
    const depth = 1 + sinYaw * 0.16 * side;
    ctx.save();
    ctx.translate(side * spec.spread - sinYaw * 6, spec.drop);
    ctx.scale(depth, 1);
    ctx.rotate(side * (0.2 + fold) + (side < 0 ? twitchL : twitchR));

    if (spec.shape === 'round') {
      const g = rgrad(ctx, -4, -5, 2, 22);
      g.addColorStop(0, shadeColor(S.bodyColor, 24));
      g.addColorStop(0.65, S.bodyColor);
      g.addColorStop(1, shadeColor(S.bodyColor, -26));
      paint(ctx, { fill: g, stroke: 'rgba(255,255,255,0.22)', width: 2 });
      disc(ctx, 0, 0, spec.size);
      ctx.stroke();
      paint(ctx, { fill: S.showVisor ? hexToRgba(accent, 0.68) : shadeColor(S.bodyColor, -18) });
      disc(ctx, 0, 1, spec.size * 0.55);
    } else if (spec.shape === 'oval') {
      const g = rgrad(ctx, -4, -36, 2, 42);
      g.addColorStop(0, shadeColor(S.bodyColor, 28));
      g.addColorStop(0.65, S.bodyColor);
      g.addColorStop(1, shadeColor(S.bodyColor, -24));
      paint(ctx, { fill: g, stroke: 'rgba(255,255,255,0.25)', width: 2 });
      oval(ctx, 0, -spec.height / 2, spec.size, spec.height / 2);
      ctx.stroke();
      paint(ctx, { fill: S.showVisor ? hexToRgba(accent, 0.78) : '#fda4af' });
      oval(ctx, 0, -(spec.height / 2) + 2, spec.size * 0.54, (spec.height / 2) * 0.68);
    } else {
      const g = lgrad(ctx, 0, -44, 0, 12);
      g.addColorStop(0, spec.warm ? '#c2410c' : shadeColor(S.bodyColor, 26));
      g.addColorStop(0.45, spec.warm ? '#ea580c' : S.bodyColor);
      g.addColorStop(1, spec.warm ? '#9a3412' : shadeColor(S.bodyColor, -24));
      paint(ctx, { fill: g, stroke: 'rgba(255,255,255,0.25)', width: 2 });
      petal(ctx, [
        [-spec.size, 12],
        [-6, -spec.height + 10],
        [0, -spec.height],
        [6, -spec.height + 10],
        [spec.size, 12],
      ]);
      ctx.stroke();
      paint(ctx, { fill: spec.warm ? '#fff7ed' : '#fb7185' });
      poly(ctx, [
        [-8, -22],
        [0, -spec.height],
        [8, -22],
      ]);
    }
    ctx.restore();
  }
}

/** Corona: puntas y una gema central. */
function crest(ctx, S, spec, env) {
  const { accent, perk } = env;
  ctx.translate(0, -4 * Math.max(0, perk));
  ctx.rotate(S.antennaAngle * 0.5);
  paint(ctx, { fill: '#FACC15', stroke: '#CA8A04', width: 2.5 });
  poly(ctx, [
    [-32, 4],
    [-38, -30],
    [-15, -12],
    [0, -36],
    [15, -12],
    [38, -30],
    [32, 4],
  ]);
  glow(ctx, accent, 10);
  ctx.stroke();
  paint(ctx, { fill: accent });
  disc(ctx, 0, -10, spec.jewel);
  ctx.shadowBlur = 0;
}

/** Halo: un aro flotante sobre la cabeza. */
function ring(ctx, S, spec, env) {
  const { accent } = env;
  const float = Math.sin(S.time * 4) * spec.float;
  ctx.translate(0, -spec.lift + float);
  glow(ctx, accent, 16);
  paint(ctx, { stroke: accent, width: 6 });
  ctx.beginPath();
  ctx.ellipse(0, 0, spec.rx, spec.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Brote: tallo, dos hojas y, si el avatar está feliz, una flor. */
function sprig(ctx, S, spec, env) {
  const { perk } = env;
  ctx.rotate(S.antennaAngle + -perk * 0.12);
  paint(ctx, { stroke: '#22C55E', width: 5, cap: 'round' });
  sweep(ctx, 0, 4, 6, -24, 0, -spec.stem);
  paint(ctx, { fill: '#4ADE80' });
  oval(ctx, 16, -(spec.stem - 2), spec.leafW, spec.leafH, -0.35 - perk * 0.15);
  oval(ctx, -14, -(spec.stem - 8), spec.leafW * 0.75, spec.leafH * 0.78, 0.4 + perk * 0.15);
  if (BRIGHT.includes(S.state)) {
    paint(ctx, { fill: '#fb7185' });
    disc(ctx, 0, -(spec.stem + 4), 6);
    paint(ctx, { fill: '#fef08a' });
    disc(ctx, 0, -(spec.stem + 4), 2.5);
  }
}

/** Piezas disponibles (el catálogo elige una). */
const PIECES = Object.freeze({ mast, band, lenses, brimmed, pair, crest, ring, sprig });

/**
 * Dibuja el accesorio superior del avatar.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} S estado del avatar
 * @param {number} rx semiancho del chasis
 * @param {number} ry semialto del chasis
 * @param {number} [turnShiftX] desplazamiento por el giro de cabeza
 * @param {number} [sinYaw] seno del balanceo (profundidad)
 */
export function drawTopAccessory(ctx, S, rx, ry, turnShiftX = 0, sinYaw = 0) {
  const spec = CATALOG[S.accessory];
  if (!spec || spec.piece === 'none') return;
  const paintIt = PIECES[spec.piece];
  if (!paintIt) return;

  ctx.save();
  const drift = S.headLookX * 9 + turnShiftX * 0.45;
  const lift = S.headLookY * 4 + S.accessoryOffsetY;

  ctx.translate(drift, -ry * 0.9 + lift);
  ctx.scale(S.accessoryScale, S.accessoryScale);

  paintIt(ctx, S, spec, { rx, ry, accent: getStateAccentColor(S), perk: S.earPerk, sinYaw });

  ctx.restore();
}
