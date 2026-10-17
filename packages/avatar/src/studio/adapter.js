// studio/adapter.js — puente entre la API de Ego (<ego-avatar>, estados
// cognitivos, genoma determinista) y el motor HybridRobotAvatar.
// Tablas de correspondencia documentadas abajo; sin lógica de dibujo.

import { STUDIO_SOUND_NAMES as STUDIO_SOUNDS } from './sound.js';
import { MICRO_NAMES as EGO_MICROS } from '../runtime/micro.js';

/** Nombres válidos para SoundSynthesizer.play() (conjunto para búsqueda). */
const STUDIO_SOUND_NAMES = new Set(STUDIO_SOUNDS);

/** Micros de Ego válidos (conjunto para búsqueda). */
const EGO_MICRO_NAMES = new Set(EGO_MICROS);

/**
 * Estado de Ego (14) → estado del studio (22). Criterio: equivalencia de
 * affordance (qué le comunica al usuario), no igualdad de nombre.
 */
export const EGO_TO_STUDIO_STATE = Object.freeze({
  idle: 'idle',
  thinking: 'waiting', // puntos de espera: "procesando"
  working: 'input', // tecleando: tool calls en curso
  searching: 'inspect', // lupa: búsqueda activa
  listening: 'listen', // sonar: escuchando al usuario
  waiting: 'waiting',
  success: 'success',
  finished: 'wake', // despertar + estrellas al terminar
  error: 'error',
  ratelimit: 'warning', // aviso ámbar antes de bloquear
  approval: 'waiting', // espera atenta de decisión humana
  question: 'inspect', // atención + lupa
  dizzy: 'dizzy',
  sleeping: 'sleep',
});

/** Emote de Ego (11) → estado/acción del studio. */
export const EGO_TO_STUDIO_EMOTE = Object.freeze({
  love: 'love',
  surprised: 'surprise',
  surprise: 'surprise',
  proud: 'success',
  annoyed: 'poke',
  angry: 'blocked',
  wink: 'wave', // saludo unilateral como guiño más cercano
  yawn: 'bored',
  happy: 'wave',
  sad: 'failure',
  cool: 'spin',
});

/**
 * Traduce un estado de Ego al del studio (identidad si ya es válido).
 * @param {string} egoState
 */
export function studioStateForEgo(egoState) {
  if (typeof egoState !== 'string') return 'idle';
  return EGO_TO_STUDIO_STATE[egoState] || 'idle';
}

/**
 * Traduce un emote de Ego al del studio (identidad si ya es válido).
 * @param {string} emote
 */
export function studioEmoteForEgo(emote) {
  if (typeof emote !== 'string') return 'idle';
  return EGO_TO_STUDIO_EMOTE[emote] || 'idle';
}

/**
 * Configuración inicial del studio derivada del genoma determinista:
 * la tinta pinta el chasis, el acento los ojos; el redondeo gobierna la
 * forma squircle (n 2.0–7.5) y la separación de ojos (px).
 * @param {object} genome genoma de core/genome.js
 * @param {object} palette paleta de core/palette.js ({ink, accent, ...})
 */
export function studioConfigForGenome(genome, palette = {}) {
  palette = palette || {};
  const shape = genome?.shape || {};
  const eyes = genome?.eyes || {};
  const roundness = Number.isFinite(shape.roundness) ? shape.roundness : 50;
  return {
    variantMode: 'cx-faithful',
    bodyColor: palette.ink || '#1e222d',
    eyeColor: palette.accent || '#dbf59d',
    autoStateColors: true,
    eyeStyle: 'cx-led',
    mouthStyle: 'none',
    accessory: 'none',
    squircleN: Math.round((2.0 + (roundness / 100) * 5.5) * 10) / 10,
    eyeSpacing: Math.round((Number.isFinite(eyes.spacing) ? eyes.spacing : 0.34) * 100),
    eyeWidthRatio: Number.isFinite(eyes.scale) ? eyes.scale : 1,
    eyeHeightRatio: Number.isFinite(eyes.scale) ? eyes.scale : 1,
    eyeOffsetY: Number.isFinite(eyes.yBias) ? Math.round(eyes.yBias * 100) : 0,
  };
}

/**
 * Aplica el genoma/paleta de Ego sobre un backend HybridRobotAvatar vivo.
 * Solo toca identidad visual (chasis, ojos, forma); el estilo de ojos, la
 * boca y el accesorio quedan en manos del usuario del studio.
 * @param {object} studio instancia de HybridRobotAvatar
 * @param {object} genome @param {object} palette
 */
export function applyGenomeToStudio(studio, genome, palette) {
  if (!studio) return false;
  const cfg = studioConfigForGenome(genome, palette);
  studio.bodyColor = cfg.bodyColor;
  studio.eyeColor = cfg.eyeColor;
  studio.autoStateColors = cfg.autoStateColors;
  studio.squircleN = cfg.squircleN;
  studio.eyeSpacing = cfg.eyeSpacing;
  studio.eyeWidthRatio = cfg.eyeWidthRatio;
  studio.eyeHeightRatio = cfg.eyeHeightRatio;
  studio.eyeOffsetY = cfg.eyeOffsetY;
  return true;
}

/**
 * Studio (22) → Ego (14). Mejor esfuerzo para transiciones nacidas en el
 * canvas (poke/dizzy/box/spin por interacción directa): los flujos lanciados
 * por API conservan el vocabulario exacto de Ego sin pasar por aquí.
 */
export const STUDIO_TO_EGO_STATE = Object.freeze({
  idle: 'idle',
  talk: 'listening',
  bored: 'idle',
  waiting: 'waiting',
  input: 'working',
  send: 'waiting',
  success: 'success',
  failure: 'error',
  warning: 'ratelimit',
  inspect: 'searching',
  blocked: 'error',
  error: 'error',
  surprise: 'idle',
  sleep: 'sleeping',
  wake: 'finished',
  wave: 'idle',
  poke: 'idle',
  dizzy: 'dizzy',
  spin: 'idle',
  box: 'idle',
  listen: 'listening',
  love: 'idle',
});

/**
 * Sonido de Ego (28 recetas) → sonido del studio (~21). Coincidencia directa
 * cuando el nombre existe en el sintetizador del studio; si no, equivalente
 * documentado; en último caso 'default' (blip neutro del switch).
 */
export const EGO_SOUND_TO_STUDIO_SOUND = Object.freeze({
  hover: 'hover',
  error: 'error',
  love: 'love',
  dizzy: 'dizzy',
  send: 'send',
  blip: 'inspect',
  slap: 'poke',
  annoyed: 'blocked',
  greet: 'wave',
  work: 'waiting',
  finish: 'success',
  approval: 'waiting',
  question: 'inspect',
  approve: 'success',
  gulp: 'send',
  tick: 'inspect',
  pop: 'surprise',
  proud: 'success',
  wink: 'wave',
  yawn: 'bored',
  attach: 'input',
  think: 'waiting',
  search: 'inspect',
  rate: 'warning',
  sleep: 'bored',
  peek: 'surprise',
  open: 'wake',
  close: 'bored',
});

/**
 * Traduce un sonido de Ego al sintetizador del studio.
 * @param {string} name receta de Ego (o ya del studio)
 * @returns {string} nombre válido para SoundSynthesizer.play()
 */
export function studioSoundFor(name) {
  if (typeof name !== 'string' || !name) return 'default';
  if (STUDIO_SOUND_NAMES.has(name)) return name;
  return EGO_SOUND_TO_STUDIO_SOUND[name] || 'default';
}

/**
 * Micro de Ego (21) → gesto del studio. El studio no tiene keyframes con
 * nombre: `roll` equivale a su giro 360° y el resto a un micro idle aleatorio.
 * @param {string} name clave de MICRO
 * @returns {{spin:number}|{idle:true}|null}
 */
export function studioMicroFor(name) {
  if (name === 'roll' || name === 'rollDouble') return { spin: 1 };
  if (typeof name === 'string' && EGO_MICRO_NAMES.has(name)) return { idle: true };
  return null;
}
