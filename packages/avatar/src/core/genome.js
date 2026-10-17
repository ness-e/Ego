// genome.js — seed → genoma (identidad inmutable del avatar).
// Principios: determinismo total (P1) y traits composicionales (P2).
// La cabeza es la del robot de agent-robot-avatar: el gen de forma es su
// `roundness` 0–100 (cuadrado…redondo) + `ratio` (aplastado vertical).
// NOTA DE RUPTURA (2026-10-14): los genes de forma/ojos anteriores
// (exponent/wobble/kind/corner/style) se reemplazaron por el rig ARA —
// la misma semilla genera otro aspecto que en v1/v2. El orden de extracción
// de los genes que quedan es FIJO.

import { makeRng, deriveSeed } from './prng.js';

export const MARKINGS = Object.freeze(['none', 'dots', 'stripe', 'orbit']);
export const APPENDAGES = Object.freeze(['none', 'antenna', 'sprout', 'ears']);

/**
 * Genera el genoma completo de un avatar a partir de su semilla.
 * @param {string} seed  ej. "subego:conocimiento"
 * @returns {object} genoma congelado (deep-freeze: la identidad no se muta)
 */
export function generateGenome(seed) {
  const r = makeRng(deriveSeed(seed, 'genome'));

  const genome = {
    seed: String(seed),
    shape: {
      // Redondeo ARA (head-roundness.js): 0 = cuadrado … 100 = redondo.
      roundness: Math.round(r.range(0, 100)),
      ratio: round(r.range(0.88, 1.12), 3), // alto / ancho (solo aplasta)
    },
    eyes: {
      scale: round(r.range(0.8, 1.25), 3),
      spacing: round(r.range(0.28, 0.42), 3), // 0.34 = plantilla exacta (86/154)
      yBias: round(r.range(-0.06, 0.04), 3), // fracción vertical (±10 px)
    },
    palette: extractPalette(r),
    marking: r.pick(MARKINGS),
    appendage: r.pick(APPENDAGES),
    aura: round(r.range(0.25, 1), 3),
    temperament: round(r.range(0, 1), 3),
  };

  // Detalles del marking (posiciones) con una semilla derivada independiente:
  // cambiar cuántos genes se extraigan antes no desplaza estos valores.
  genome.markingDetail = extractMarkingDetail(genome, seed);

  return deepFreeze(genome);
}

function extractPalette(r) {
  const hue = r.int(0, 359);
  return {
    hue,
    sat: round(r.range(45, 72), 2), // saturación base %
    deepShift: round(r.range(-26, 26), 2), // desplazamiento de matiz en el gradiente
    accentHue: (hue + r.int(28, 160)) % 360, // acento complementario/análogo
    accentSat: round(r.range(60, 85), 2),
    accentLight: round(r.range(52, 64), 2),
    inkLight: r.range(12, 17), // luminancia % de la tinta (siempre oscura → contraste)
  };
}

function extractMarkingDetail(genome, seed) {
  const r = makeRng(deriveSeed(seed, 'marking-detail'));
  switch (genome.marking) {
    case 'dots': {
      const count = r.int(3, 6);
      return {
        count,
        spots: Array.from({ length: count }, () => ({
          cx: round(r.range(-0.62, 0.62), 3), // fracción de rx
          cy: round(r.range(-0.55, 0.62), 3),
          r: round(r.range(0.05, 0.11), 3), // fracción de rx
        })),
      };
    }
    case 'stripe':
      return {
        y: round(r.range(-0.35, 0.25), 3), // fracción de ry
        thickness: round(r.range(0.1, 0.18), 3),
        tilt: round(r.range(-14, 14), 1), // grados
      };
    case 'orbit':
      return {
        tilt: round(r.range(-24, 24), 1),
        ratio: round(r.range(1.18, 1.42), 3),
        thickness: round(r.range(0.05, 0.09), 3),
      };
    default:
      return null;
  }
}

/**
 * Temperamento → perfil de comportamiento (P6: identidad ≠ estado).
 * Calma (≤0.35) · Equilibrio (0.35–0.65) · Energía (>0.65).
 */
export function temperamentProfile(temperament) {
  const t = clamp(temperament, 0, 1);
  return {
    blinkMin: Math.round(lerp(3200, 1400, t)),
    blinkMax: Math.round(lerp(5600, 3000, t)),
    wanderAmp: lerp(10, 24, t), // amplitud de mirada en px
    bounce: lerp(0, 2.6, t), // px de micro-bounce en idle
    breathScale: lerp(0.01, 0.03, t), // escala de respiración
    gazeGain: lerp(0.55, 1, t), // cuánto sigue el puntero
    doubleBlinkChance: lerp(0.1, 0.3, t),
  };
}

// — utils locales —
function round(v, d) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function deepFreeze(obj) {
  Object.values(obj).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(obj);
}
