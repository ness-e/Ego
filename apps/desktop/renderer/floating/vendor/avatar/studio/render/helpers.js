// helpers.js — ayudas de dibujo 2D del motor studio.
//
// GEOMETRÍA PROPIA DE EGO: este es el nivel de primitivas del renderer. Son
// cinco utilidades genéricas de Canvas 2D (rectángulo redondeado, conversión
// de color, superelipse y acento por estado), sin ninguna forma de robot
// dentro: las proporciones del avatar viven en ./geometry.js.
//
// Adapted from ego-avatar-studio (licencia no declarada en el origen), repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
// líneas 896-915, 4112-4117, 4119-4128, 2227-2240, 2069-2096: se adapta el
// patrón (utilidades de canvas sin dependencias); la implementación, la
// nomenclatura y el soporte de hsl/rgb son propios.
// Vanilla ESM, sin dependencias. `ctx` solo se toca dentro de las funciones.
// `S` es el objeto plano de estado del avatar (nunca se importa la clase).

/** Rectángulo redondeado compatible (usa ctx.roundRect si existe). */
export function roundRectPath(ctx, x, y, w, h, r) {
  const width = Math.max(0.5, w);
  const height = Math.max(0.5, h);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    const maxR = Math.min(width / 2, height / 2);
    const safeR = Array.isArray(r)
      ? r.map((val) => Math.max(0, Math.min(maxR, val)))
      : Math.max(0, Math.min(maxR, r));
    ctx.roundRect(x, y, width, height, safeR);
  } else {
    const rad = Math.max(0, Math.min(width / 2, height / 2, Array.isArray(r) ? r[0] : r));
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + width, y, x + width, y + height, rad);
    ctx.arcTo(x + width, y + height, x, y + height, rad);
    ctx.arcTo(x, y + height, x, y, rad);
    ctx.arcTo(x, y, x + width, y, rad);
    ctx.closePath();
  }
}

/**
 * Convierte cualquier formato de color CSS (hex 3/6/8 dígitos, hsl, hsla, rgb, rgba)
 * a un color hexadecimal canónico #rrggbb válido.
 */
export function toHexColor(input, fallback = '#1e222d') {
  if (!input || typeof input !== 'string') return fallback;
  const str = input.trim();
  if (str.startsWith('#')) {
    const raw = str.slice(1);
    if (raw.length === 3) {
      return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
    }
    if (raw.length === 4) {
      return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
    }
    if (raw.length === 6) {
      return `#${raw}`.toLowerCase();
    }
    if (raw.length >= 8) {
      return `#${raw.slice(0, 6)}`.toLowerCase();
    }
    return fallback;
  }

  // Soporta hsl / hsla: ej. "hsl(210 25% 15%)", "hsl(210, 25%, 15%)", "hsl(210deg 25% 15% / 0.8)"
  if (str.startsWith('hsl')) {
    const m = str.match(/hsla?\(\s*([0-9.]+)(?:deg)?[\s,]+([0-9.]+)%[\s,]+([0-9.]+)%/i);
    if (m) {
      let h = parseFloat(m[1]) % 360;
      if (h < 0) h += 360;
      const s = Math.max(0, Math.min(100, parseFloat(m[2]))) / 100;
      const l = Math.max(0, Math.min(100, parseFloat(m[3]))) / 100;
      const k = (n) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      const r = Math.round(255 * f(0));
      const g = Math.round(255 * f(8));
      const b = Math.round(255 * f(4));
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
  }

  // Soporta rgb / rgba: ej. "rgb(30, 34, 45)", "rgb(30 34 45 / 0.8)"
  if (str.startsWith('rgb')) {
    const m = str.match(/rgba?\(\s*([0-9.]+)[%,\s]+([0-9.]+)[%,\s]+([0-9.]+)/i);
    if (m) {
      const r = Math.max(0, Math.min(255, Math.round(parseFloat(m[1]))));
      const g = Math.max(0, Math.min(255, Math.round(parseFloat(m[2]))));
      const b = Math.max(0, Math.min(255, Math.round(parseFloat(m[3]))));
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
  }

  return fallback;
}

/** Hex → rgba con alfa dado. */
export function hexToRgba(hex, alpha) {
  const validHex = toHexColor(hex, '#dbf59d');
  const c = validHex.replace('#', '');
  const num = parseInt(c, 16) || 0;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** Aclara (percent > 0) u oscurece (percent < 0) un color hex. */
export function shadeColor(hex, percent) {
  const validHex = toHexColor(hex, '#1e222d');
  const c = validHex.replace('#', '');
  const num = parseInt(c, 16) || 0;
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/** Generador matemático puro de path de superelipse (cero distorsión). */
export function buildSquirclePath(ctx, rx, ry, n) {
  ctx.beginPath();
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const x = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n) * rx;
    const y = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n) * ry;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Color de acento según el estado (fuente única: ../config.js). */
export { getStateAccentColor } from '../config.js';