// palette.js — genoma → paleta CSS (HSL).
// Toda la identidad cromática deriva del hue del genoma: misma seed ⇒ mismos colores.
// La tinta de ojos se mantiene siempre en luminancia baja (contraste ≥ 7:1 aprox.

/** Convierte HSL (grados / % / %) a string CSS. */
export function hsl(h, s, l, a = 1) {
  const hh = ((h % 360) + 360) % 360;
  return a === 1 ? `hsl(${hh} ${s}% ${l}%)` : `hsl(${hh} ${s}% ${l}% / ${a})`;
}

/**
 * Construye la paleta del avatar desde su genoma.
 * @param {object} genome
 */
export function buildPalette(genome) {
  const p = genome.palette;
  const h = p.hue;
  return Object.freeze({
    // cuerpo (4 paradas de gradiente, patrón de relleno de coucou §3c)
    light: hsl(h + 6, p.sat, 84), // tope superior
    base: hsl(h, p.sat, 74), // color principal
    deep: hsl(h + p.deepShift, p.sat + 4, 58), // sombra inferior
    edge: hsl(h + p.deepShift * 1.6, p.sat + 6, 44), // rim
    // acento (insignias, marcas, chispas)
    accent: hsl(p.accentHue, p.accentSat, p.accentLight),
    accentSoft: hsl(p.accentHue, p.accentSat, p.accentLight, 0.35),
    // tinta y auxiliares
    ink: hsl(h, 20, p.inkLight),
    inkSoft: hsl(h, 18, p.inkLight + 26),
    blush: hsl(h + 130, 62, 66, 0.45),
    aura: hsl(h, p.sat, 66),
    // tintes de estado (capa de situación — DESIGN §5)
    white: hsl(h, 12, 97),
  });
}

/**
 * Color de tinte de estado con intensidad (0..1) sobre el cuerpo.
 * @param {string} color estado color en hsl
 * @param {number} strength 0..1
 */
export function stateTint(color, strength) {
  return { color, strength: clamp(strength, 0, 1) };
}

/** Interpola dos strings hsl() numéricamente (h con camino corto). */
export function lerpHsl(a, b, t) {
  const A = parseHsl(a);
  const B = parseHsl(b);
  if (!A || !B) return t < 0.5 ? a : b;
  let dh = B.h - A.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return hsl(
    A.h + dh * t,
    A.s + (B.s - A.s) * t,
    A.l + (B.l - A.l) * t,
    A.a + (B.a - A.a) * t
  );
}

function parseHsl(str) {
  const m = /hsl\(\s*([\d.-]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+)%?)?\s*\)/.exec(str);
  if (!m) return null;
  return { h: +m[1], s: +m[2], l: +m[3], a: m[4] === undefined ? 1 : +m[4] / 100 };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
