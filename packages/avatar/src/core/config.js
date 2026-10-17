// config.js — configuración global con normalización y acotación.
// PORTADO de agent-robot-avatar: patrón `XXX_DEFAULTS` + `XXX_BOUNDS` +
// clampConfig (vendor/agent-robot-avatar/random.js:31-82, variante canónica)
// y `parseSize` literal (vendor/agent-robot-avatar/core.js:63-68).
// Toda cifra que entra al runtime se normaliza y se acota — nunca hay
// valores fuera de rango ni NaN silenciosos.

/** Valores por defecto del runtime del avatar. */
export const AVATAR_DEFAULTS = Object.freeze({
  size: 112, // px del elemento
  autoSleepMs: 45000, // sin actividad → sleeping (ARA: 45 s)
  fps: 30, // fps del loop de dibujo (patrón ARA)
  blinkMinMs: 2200, // ventana de parpadeo (coucou: 2.2 s)
  blinkMaxMs: 5400, // …a 5.4 s (coucou: 2.2 + rand*3.2)
  doubleBlinkChance: 0.22, // 22 % de doble parpadeo (coucou engine.ts:574)
  doubleBlinkDelayMs: 230, // retardo del segundo parpadeo (coucou: 230 ms)
  gazeGain: 1, // ganancia de seguimiento de puntero
  pointerFollow: true, // ¿seguir el puntero?
  boredAfterMs: 10000, // idle sin puntero → rutina de aburrimiento (ARA)
  ambientMs: 1300, // partículas ambiente (zz/sweat) cada 1.3 s (coucou:584)
  jellyResponse: 0.34, // respuesta del muelle "jelly" en impactos (s)
  jellyDamping: 0.6, // fracción de amortiguación ζ (coucou slot spring)
});

/** Límites [min, max] por clave. Todo lo acotado aquí es inegociable. */
export const AVATAR_BOUNDS = Object.freeze({
  size: [24, 2048],
  autoSleepMs: [0, 86400000],
  fps: [10, 60],
  blinkMinMs: [400, 20000],
  blinkMaxMs: [500, 30000],
  doubleBlinkChance: [0, 1],
  doubleBlinkDelayMs: [50, 2000],
  gazeGain: [0, 4],
  pointerFollow: [false, true],
  boredAfterMs: [1000, 300000],
  ambientMs: [200, 60000],
  jellyResponse: [0.08, 2],
  jellyDamping: [0.05, 4],
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Port literal de parseSize (ARA core.js:63-68): números o "<n>px", si no, fallback. */
export const DEFAULT_SIZE = 112;
export function parseSize(value, fallback = DEFAULT_SIZE) {
  const text = String(value ?? '').trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/i.test(text)) return fallback;
  const numeric = Number.parseFloat(text);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

/**
 * Normaliza un valor según los límites de su clave.
 * booleanos → coerción; números → clamp; desconocidos → fallback.
 */
export function normalizeConfigValue(key, value, defaults = AVATAR_DEFAULTS, bounds = AVATAR_BOUNDS) {
  const fallback = defaults[key];
  const range = bounds[key];
  if (typeof fallback === 'boolean') return value === true || value === 'true';
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (!range) return n;
  return clamp(n, range[0], range[1]);
}

/** Aplica Defaults + Bounds a un objeto config completo (porte de clampConfig). */
export function clampConfig(config = {}, defaults = AVATAR_DEFAULTS, bounds = AVATAR_BOUNDS) {
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (config[key] !== undefined) out[key] = normalizeConfigValue(key, config[key], defaults, bounds);
  }
  // una config congelada por defecto: el runtime solo lee
  return Object.freeze(out);
}

let globalConfig = clampConfig();

/** Config global activa (congelada). */
export function getConfig() {
  return globalConfig;
}

/**
 * Actualiza la config global: mezcla, normaliza y acota el parche.
 * @param {object} patch claves de AVATAR_DEFAULTS
 * @returns {object} config resultante (congelada)
 */
export function configure(patch = {}) {
  globalConfig = clampConfig({ ...globalConfig, ...patch });
  return globalConfig;
}

/** Restaura los valores por defecto. */
export function resetConfig() {
  globalConfig = clampConfig();
  return globalConfig;
}
