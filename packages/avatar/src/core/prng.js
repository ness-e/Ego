// prng.js — PRNG determinista (identidad del avatar).
// Patrón: seed string → xmur3 hash → mulberry32.
// Referencia conceptual: DiceBear / boring-avatars (seed → hash → traits).
// NINGÚN módulo de identidad usa Math.random(): misma semilla ⇒ mismo avatar.

/** xmur3 — hash de string a 32 bits (dom purcell). Devuelve un generador de seeds. */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 — PRNG de 32 bits, rápido y con buena dispersión para propósito general. */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Crea un generador con API cómoda a partir de una semilla.
 * El orden de las llamadas es parte del contrato: el genoma se extrae
 * siempre en el mismo orden para garantizar determinismo.
 */
export function makeRng(seed) {
  const seedFn = xmur3(String(seed));
  const next = mulberry32(seedFn());
  return {
    /** float en [0,1) */
    next,
    /** float en [min,max) */
    range: (min, max) => next() * (max - min) + min,
    /** entero en [min,max] inclusive */
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    /** elemento de un array */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** true con probabilidad p */
    chance: (p) => next() < p,
    /** sesgo por potencia: v ∈ [0,1), <p> 0..1 empuja hacia 0 (o 1 con inverted) */
    biased: (p) => Math.pow(next(), p),
  };
}

/** Deriva una sub-semilla determinista (para capas independientes: marking, partículas…). */
export function deriveSeed(seed, label) {
  return `${seed}::${label}`;
}

/** Id corto determinista para ids de SVG (gradientes/clip) por avatar. */
export function uidFor(seed) {
  return xmur3(String(seed))().toString(36).slice(0, 6);
}
