// helpers.js — Ayudas de dibujo 2D (puerto verbatim del avatar studio).
// Fuente: repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
//   roundRectPath: líneas 896-915 · hexToRgba: 4112-4117 ·
//   shadeColor: 4119-4128 · buildSquirclePath: 2227-2240 ·
//   getStateAccentColor: 2069-2096.
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

/** Hex → rgba con alfa dado. */
export function hexToRgba(hex, alpha) {
  let c = (hex || '#dbf59d').replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const num = parseInt(c, 16) || 0;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** Aclara (percent > 0) u oscurece (percent < 0) un color hex. */
export function shadeColor(hex, percent) {
  let c = (hex || '#1e222d').replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
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

/** Color de acento según el estado (respeta S.autoStateColors / S.eyeColor). */
export function getStateAccentColor(S) {
  if (!S.autoStateColors) return S.eyeColor;
  switch (S.state) {
    case 'error':
    case 'blocked':
    case 'poke':
      return '#f43f5e';
    case 'warning':
      return '#f59e0b';
    case 'waiting':
    case 'input':
    case 'inspect':
    case 'listen':
      return '#38bdf8';
    case 'failure':
    case 'bored':
      return '#818cf8';
    case 'love':
      return '#fb7185';
    case 'surprise':
    case 'send':
      return '#c084fc';
    case 'sleep':
      return '#94a3b8';
    default:
      return S.eyeColor;
  }
}
