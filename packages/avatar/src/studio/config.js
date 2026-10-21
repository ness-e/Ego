// studio/config.js — datos declarativos del Avatar Studio:
// defaults del constructor (HybridRobotAvatar:713-766), presets
// (applyPreset:4732-4781), enumeraciones del dock y mapa estado→acento
// (getStateAccentColor:2069-2096). Sin lógica, solo datos.
// Fuente: avatar_studio_cx_artlab_mochi_2_0.html (ver LICENSE.md).

/** Defaults del constructor (variante cx-faithful). */
export const STUDIO_DEFAULTS = Object.freeze({
  variantMode: 'cx-faithful',
  bodyColor: '#1e222d',
  visorColor: '#06080e',
  showVisor: true,
  showSidePods: true,
  eyeColor: '#dbf59d',
  autoStateColors: true,
  eyeStyle: 'cx-led',
  mouthStyle: 'none',
  accessory: 'none',
  bodyWidthRatio: 1.0,
  bodyHeightRatio: 1.0,
  globalScale: 1.0,
  squircleN: 4.0,
  visorWidthRatio: 1.0,
  visorHeightRatio: 1.0,
  visorCornerRadius: 30,
  eyeWidthRatio: 1.0,
  eyeHeightRatio: 1.0,
  eyeSpacing: 28,
  eyeOffsetY: -2,
  eyeGlowBlur: 18,
  mouthScale: 1.0,
  mouthOffsetY: 24,
  accessoryScale: 1.0,
  accessoryOffsetY: 0,
  accessoryBounce: 1.0,
  jellyIntensity: 1.0,
  parallaxIntensity: 1.0,
  liveliness: 1.0,
  handsMode: 'auto',
  handScaleConfig: 1.0,
});

/** Reseteo paramétrico común al cambiar de modelo base (4736-4751). */
export const PRESET_DIM_RESET = Object.freeze({
  bodyWidthRatio: 1.0,
  bodyHeightRatio: 1.0,
  globalScale: 1.0,
  visorWidthRatio: 1.0,
  visorHeightRatio: 1.0,
  visorCornerRadius: 30,
  eyeWidthRatio: 1.0,
  eyeHeightRatio: 1.0,
  eyeSpacing: 28,
  eyeOffsetY: -2,
  eyeGlowBlur: 18,
  mouthScale: 1.0,
  mouthOffsetY: 24,
  accessoryScale: 1.0,
  accessoryOffsetY: 0,
  accessoryBounce: 1.0,
});

/**
 * Presets del Robot Studio de Ego.
 *
 * Cada preset es una identidad completa: chasis, visor, color de ojos, estilo
 * de ojo, boca, accesorio y estado inicial. `ego-nucleus` es el del núcleo de
 * Ego; el resto identifica a los Sub-Egos por color y accesorio.
 *
 * No existe ningún preset "Mochi": el producto no distribuye la identidad
 * visual de Mochi.
 */
export const STUDIO_PRESETS = Object.freeze({
  'cx-faithful': Object.freeze({
    variantMode: 'cx-faithful',
    bodyColor: '#1e222d',
    visorColor: '#06080e',
    showVisor: true,
    showSidePods: true,
    eyeColor: '#dbf59d',
    autoStateColors: true,
    eyeStyle: 'cx-led',
    mouthStyle: 'none',
    accessory: 'none',
    squircleN: 4.0,
    handsActiveTimer: 0,
    play: 'idle',
    playOptions: Object.freeze({ keepHandsHidden: true }),
  }),
  'ego-nucleus': Object.freeze({
    variantMode: 'cx-faithful',
    bodyColor: '#141720',
    visorColor: '#06080e',
    showVisor: true,
    showSidePods: true,
    eyeColor: '#f59e0b',
    autoStateColors: true,
    eyeStyle: 'cx-led',
    mouthStyle: 'none',
    accessory: 'cx-antenna',
    squircleN: 4.0,
    handsActiveTimer: 0,
    play: 'idle',
    playOptions: Object.freeze({ keepHandsHidden: true }),
  }),
  'ego-cyber': Object.freeze({
    variantMode: 'cx-faithful',
    bodyColor: '#0f172a',
    visorColor: '#06080e',
    showVisor: true,
    showSidePods: true,
    eyeColor: '#38bdf8',
    autoStateColors: true,
    eyeStyle: 'cyber-visor',
    mouthStyle: 'none',
    accessory: 'cyber-goggles',
    squircleN: 4.0,
    handsActiveTimer: 0,
    play: 'idle',
    playOptions: Object.freeze({ keepHandsHidden: true }),
  }),
  'ego-sentinel': Object.freeze({
    variantMode: 'cx-faithful',
    bodyColor: '#1f1218',
    visorColor: '#06080e',
    showVisor: true,
    showSidePods: true,
    eyeColor: '#f43f5e',
    autoStateColors: true,
    eyeStyle: 'cyclops',
    mouthStyle: 'none',
    accessory: 'cx-full-kit',
    squircleN: 4.0,
    handsActiveTimer: 0,
    play: 'idle',
    playOptions: Object.freeze({ keepHandsHidden: true }),
  }),
  'ego-architect': Object.freeze({
    variantMode: 'cx-faithful',
    bodyColor: '#0d1f1a',
    visorColor: '#06080e',
    showVisor: true,
    showSidePods: true,
    eyeColor: '#10b981',
    autoStateColors: true,
    eyeStyle: 'terminal',
    mouthStyle: 'none',
    accessory: 'headphones',
    squircleN: 4.0,
    handsActiveTimer: 0,
    play: 'idle',
    playOptions: Object.freeze({ keepHandsHidden: true }),
  }),
});

/** Los 22 estados en orden del dock (nombre + etiqueta ES + emoji). */
export const STUDIO_STATES = Object.freeze([
  Object.freeze({ name: 'idle', label: 'idle', emoji: '🙂' }),
  Object.freeze({ name: 'talk', label: 'talk', emoji: '🗣️' }),
  Object.freeze({ name: 'bored', label: 'bored', emoji: '😒' }),
  Object.freeze({ name: 'waiting', label: 'waiting', emoji: '⏳' }),
  Object.freeze({ name: 'input', label: 'input', emoji: '⌨️' }),
  Object.freeze({ name: 'send', label: 'send', emoji: '🚀' }),
  Object.freeze({ name: 'success', label: 'success', emoji: '✅' }),
  Object.freeze({ name: 'failure', label: 'failure', emoji: '🫠' }),
  Object.freeze({ name: 'warning', label: 'warning', emoji: '⚠️' }),
  Object.freeze({ name: 'inspect', label: 'inspect', emoji: '🧐' }),
  Object.freeze({ name: 'blocked', label: 'blocked', emoji: '🛑' }),
  Object.freeze({ name: 'error', label: 'error', emoji: '⚡' }),
  Object.freeze({ name: 'surprise', label: 'surprise', emoji: '😲' }),
  Object.freeze({ name: 'sleep', label: 'sleep', emoji: '😴' }),
  Object.freeze({ name: 'wake', label: 'wake', emoji: '🌅' }),
  Object.freeze({ name: 'wave', label: 'coucou', emoji: '👋' }),
  Object.freeze({ name: 'poke', label: 'poke', emoji: '😠' }),
  Object.freeze({ name: 'dizzy', label: 'dizzy', emoji: '😵‍💫' }),
  Object.freeze({ name: 'spin', label: 'spin 360°', emoji: '🔄' }),
  Object.freeze({ name: 'box', label: 'box drop', emoji: '📦' }),
  Object.freeze({ name: 'listen', label: 'listen', emoji: '🎙️' }),
  Object.freeze({ name: 'love', label: 'love', emoji: '😍' }),
  // Estados con dueño propio de Ego (Ola 2). Existen para que el round-trip
  // Ego -> studio -> Ego conserve la identidad: cada uno tiene su propia
  // IMAGEN en render/overlays.js y su propio color.
  Object.freeze({ name: 'thinking', label: 'thinking', emoji: '💭' }),
  Object.freeze({ name: 'approval', label: 'approval', emoji: '✋' }),
  Object.freeze({ name: 'question', label: 'question', emoji: '❓' }),
  Object.freeze({ name: 'ratelimit', label: 'ratelimit', emoji: '⏳' }),
]);

/** Estilos de ojo del dock (predeterminados no-mochi). */
export const EYE_STYLE_NAMES = Object.freeze([
  'cx-led', 'cyber-visor', 'pixel', 'anime',
  'cyclops', 'heart', 'zen-arc', 'terminal',
]);

/** Estilos de boca del dock (predeterminados no-mochi). */
export const MOUTH_STYLE_NAMES = Object.freeze([
  'none', 'led-wave', 'cat-kawaii', 'vocoder', 'pixel-mouth',
]);

/** Accesorios del dock (botones .acc-btn[data-acc]). */
export const ACCESSORY_NAMES = Object.freeze([
  'none', 'cx-full-kit', 'cx-antenna', 'headphones', 'cat-ears', 'bunny-ears',
  'fox-ears', 'bear-ears', 'aviator-glasses', 'cyber-goggles', 'glasses',
  'witch', 'crown', 'halo', 'sprout', 'santa',
]);

/**
 * Estado → color de acento (getStateAccentColor:2069-2096, literal).
 * DEFAULT: null = "usar eyeColor" (ver accentFor).
 */
export const STATE_ACCENT = Object.freeze({
  error: '#f43f5e',
  blocked: '#f43f5e',
  poke: '#f43f5e',
  warning: '#f59e0b',
  waiting: '#38bdf8',
  input: '#38bdf8',
  inspect: '#38bdf8',
  listen: '#38bdf8',
  failure: '#818cf8',
  bored: '#818cf8',
  love: '#fb7185',
  surprise: '#c084fc',
  send: '#c084fc',
  sleep: '#94a3b8',
  // Estados con dueño propio de Ego (Ola 2, round-trip 1:1). Cada uno con
  // un color y una IMAGEN propios, para que el dock distinga siempre de qué
  // estado de Ego se trata.
  thinking: '#a78bfa',   // procesando
  approval: '#fb923c',   // tu turno
  question: '#2dd4bf',   // te pregunto
  ratelimit: '#facc15',  // el proveedor nos frena
  DEFAULT: null,
});

/**
 * Color de acento según el estado (respeta S.autoStateColors / S.eyeColor).
 *
 * ÚNICA fuente de verdad del acento por estado. Antes vivía replicado en
 * `render/overlays.js`, `render/eyes.js` y `render/helpers.js`: tres switch
 * que debían mantenerse en sincronía a mano (y que se desincronizarían en
 * cuanto se añadiera un estado). Ahora los tres módulos reexportan esta
 * función, así que añadir un estado es un cambio en un solo sitio.
 *
 * @param {{state: string, autoStateColors?: boolean, eyeColor?: string}} S
 * @returns {string}
 */
export function getStateAccentColor(S) {
  if (!S.autoStateColors) return S.eyeColor;
  return STATE_ACCENT[S.state] ?? S.eyeColor;
}

/**
 * Acento efectivo: sin auto-colores manda el color de ojos del usuario.
 * @param {string} state @param {string} eyeColor @param {boolean} [auto=true]
 */
export function accentFor(state, eyeColor, auto = true) {
  if (!auto) return eyeColor;
  return Object.prototype.hasOwnProperty.call(STATE_ACCENT, state) && STATE_ACCENT[state]
    ? STATE_ACCENT[state]
    : eyeColor;
}
