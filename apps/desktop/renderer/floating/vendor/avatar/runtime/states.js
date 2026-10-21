// states.js — tabla estado → configuración visual (P5: estados son datos).
// Patrón: coucou `BOT_STATES` (vendor/coucou/mochi/engine.ts:91-103, MIT) —
// re-orientada a los hooks del Cognitive Runtime de Ego (HOOK_STATE_MAP).
// Añadidos de coucou: estados searching/finished/ratelimit/dizzy, badges de
// un punto, flags de comportamiento (scans/zz/sweat) y mapeo de hooks con
// auto-retorno (Stop → finished 5.2 s, hooks.ts:233-246).
// Adapted from coucou (MIT), vendor/coucou/mochi/engine.ts

/**
 * Cada estado define: tinte sobre el cuerpo, pose de ojos, insignia,
 * movimiento base, intensidad de aura y flags de comportamiento:
 *   scans  → mirada que barre (sin(t·2.6)·0.6, engine.ts:514-517)
 *   dizzyGaze → mirada mareada (sin(t·9)·0.25, engine.ts:519)
 *   zz     → partículas "z" ambiente cada 1.3 s (engine.ts:584-588)
 *   sweat  → gotas de sudor ambiente
 */
export const STATES = Object.freeze({
  idle: { tint: null, tintStrength: 0, pose: 'idle', badge: null, movement: 'breathe', glow: 0.15 },
  thinking: { tint: 'hsl(262 70% 62%)', tintStrength: 0.55, pose: 'thinking', badge: 'dots', movement: 'sway', glow: 0.55 },
  working: { tint: 'hsl(210 90% 58%)', tintStrength: 0.5, pose: 'idle', badge: 'dots', movement: 'bounce', glow: 0.6 },
  searching: { tint: 'hsl(233 88% 64%)', tintStrength: 0.55, pose: 'wide', badge: 'dots', movement: 'breathe', glow: 0.55, scans: true },
  listening: { tint: 'hsl(185 80% 52%)', tintStrength: 0.45, pose: 'input', badge: null, movement: 'pulse', glow: 0.7 },
  waiting: { tint: 'hsl(35 92% 58%)', tintStrength: 0.45, pose: 'idle', badge: null, movement: 'orbit', glow: 0.5 },
  success: { tint: 'hsl(152 65% 46%)', tintStrength: 0.5, pose: 'happy', badge: null, movement: 'bounce', glow: 0.65 },
  finished: { tint: 'hsl(160 81% 52%)', tintStrength: 0.4, pose: 'happy', badge: 'dot', movement: 'breathe', glow: 0.5 },
  error: { tint: 'hsl(352 85% 58%)', tintStrength: 0.6, pose: 'flat', badge: 'bang', movement: 'shake', glow: 0.65 },
  /**
   * `warning` = DEGRADACIÓN TOLERABLE: algo falló pero el turno continúa.
   *
   * No es `error` (fallo duro: rojo, enfado, sacudida) ni `ratelimit` (señal
   * de vocabulario del proveedor: naranja, cansancio, sudor). Es un aviso
   * atenuado: tono amarillo-caution fuera del cluster naranja (27/30/35),
   * intensidad rebajada respecto al error, gesto contenido (un vaivén leve,
   * no la sacudida del error) y una insignia propia (triángulo ⚠) en lugar
   * de la "!" de error.
   */
  warning: { tint: 'hsl(48 92% 55%)', tintStrength: 0.4, pose: 'warn', badge: 'warn', movement: 'sway', glow: 0.4 },
  ratelimit: { tint: 'hsl(27 96% 59%)', tintStrength: 0.55, pose: 'tired', badge: 'dot', movement: 'breathe', glow: 0.45, sweat: true },
  approval: { tint: 'hsl(30 95% 56%)', tintStrength: 0.55, pose: 'wide', badge: 'bang', movement: 'hop', glow: 0.7 },
  question: { tint: 'hsl(180 75% 45%)', tintStrength: 0.5, pose: 'idle', badge: 'question', movement: 'tilt', glow: 0.6 },
  dizzy: { tint: 'hsl(330 86% 72%)', tintStrength: 0.55, pose: 'spiral', badge: null, movement: 'breathe', glow: 0.5, dizzyGaze: true },
  sleeping: { tint: 'hsl(215 14% 64%)', tintStrength: 0.35, pose: 'closed', badge: null, movement: 'breathe', glow: 0.05, zz: true },
});

export const STATE_NAMES = Object.freeze(Object.keys(STATES));

/**
 * Emotes: capa transitoria con caducidad (patrón `eyeOverride`/`eyeOverrideUntil`
 * de coucou, engine.ts:382-383 y 579-582). No cambian el estado — superponen
 * pose/movimiento/partículas y vuelven solas.
 * Campos opcionales:
 *   eyes  → override de POSE ocular mientras dura el emote (clave de poses.js;
 *           todas son números ARA, así que el override interpola sin cortes)
 *   micro → clave de micro-gesto (src/runtime/micro.js) que otro módulo aplica
 *   sound → clave del catálogo de sonidos que otro módulo reproduce
 * Base: coucou triggerEmote/EMOTE_EYE (engine.ts:112-115, BotEngine.swift:613-683)
 * + reacciones ARA (love/surprised/proud/annoyed/wink).
 */
export const EMOTES = Object.freeze({
  love: { pose: 'happy', duration: 2400, particles: 'heart', eyes: 'happy', sound: 'love', micro: 'loveLift' },
  surprised: { pose: 'surprise', duration: 1100, movement: 'hop', eyes: 'surprise', sound: 'pop', micro: 'surpriseLift' },
  proud: { pose: 'happy', duration: 2200, particles: 'star', eyes: 'happy', sound: 'proud', micro: 'proudTilt' },
  annoyed: { pose: 'flat', duration: 900, movement: 'shake', eyes: 'angry', sound: 'annoyed', micro: 'annoyedHead' },
  wink: { pose: 'happy', duration: 700, wink: true, eyes: 'happy', sound: 'wink', micro: 'winkTilt' },
  yawn: { pose: 'closed', duration: 1400, particles: 'z', eyes: 'sleep', sound: 'yawn', micro: 'yawn' },
  // sound 'blip': el catálogo de28 sonidos no contiene 'happy' (coucou no
  // reproduce sonido en el emote happy) — se usa el blip más cercano.
  happy: { pose: 'happy', duration: 900, eyes: 'happy', sound: 'blip', micro: 'happyBounce' },
  angry: { pose: 'flat', duration: 1000, movement: 'shake', eyes: 'angry', sound: 'annoyed', micro: 'annoyedHead' },
  surprise: { pose: 'surprise', duration: 1100, movement: 'hop', eyes: 'surprise', sound: 'pop', micro: 'surpriseLift' }, // alias amable de surprised
  sad: { pose: 'sad', duration: 1200, eyes: 'sad', sound: 'yawn', micro: 'happyBlush' },
  cool: { pose: 'happy', duration: 1600, particles: 'star', eyes: 'happy', sound: 'proud', micro: 'loveRock' },
});

/** Emotes que el usuario puede lanzar desde la demo (orden de la UI). */
export const EMOTE_NAMES = Object.freeze(Object.keys(EMOTES));

/** Estado → sonido (vendor/coucou/mochi/engine.ts:106-110 STATE_SOUND, literal). */
export const STATE_SOUND = Object.freeze({
  working: 'work', thinking: 'think', searching: 'search', approval: 'approval',
  question: 'question', error: 'error', finished: 'finish', ratelimit: 'rate',
  sleeping: 'sleep', dizzy: 'dizzy',
  // `warning`: el catálogo de 28 sonidos no tiene una receta de aviso, y no se
  // inventa ninguna. Se usa 'tick' — el más breve y no alarmista del catálogo
  // (es el mismo que usa la ACCIÓN `waiting`; el catálogo lo comparten
  // estados y acciones, y ambos sonidos pueden convivir).
  warning: 'tick',
});

/** Emote → sonido (solo emotes con `sound`). */
export const EMOTE_SOUND = Object.freeze(Object.fromEntries(
  Object.entries(EMOTES).map(([k, v]) => [k, v.sound]).filter(([, v]) => v)
));

/**
 * Mapeo hooks del Cognitive Runtime (Ego) → estados visuales.
 * Base: vendor/coucou/island/hooks.ts handleHook() (143-284) — UserPromptSubmit → thinking,
 * Pre/PostToolUse → working, PostToolUseFailure → working, Stop → finished,
 * StopFailure → error, PermissionRequest → approval, SessionEnd → idle.
 * Notification → question (el runtime puede re-dirigir a ratelimit si el
 * mensaje menciona rate limit — hooks.ts:220-231).
 */
export const HOOK_STATE_MAP = Object.freeze({
  SessionStart: 'idle',
  UserPromptSubmit: 'thinking',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PostToolUseFailure: 'working',
  SubagentStart: 'working',
  SubagentStop: 'working',
  Stop: 'finished',
  StopFailure: 'error',
  PermissionRequest: 'approval',
  Notification: 'question',
  SessionEnd: 'idle',
});

/**
 * Auto-retorno tras hooks puntuales (vendor/coucou/island/hooks.ts:239-246: Stop → idle a
 * los 5200 ms). El elemento aplica setState(prev) tras el delay.
 */
export const HOOK_AUTO_RETURN = Object.freeze({
  finished: 5200,
});

/** Prioridad de urgencia para un avatar que resume múltiples Sub-Egos (coucou §15). */
const PRIORITY = [
  'approval', 'question', 'error', 'ratelimit', 'warning', 'dizzy', 'working', 'searching',
  'waiting', 'listening', 'success', 'finished', 'thinking', 'sleeping', 'idle',
];

/**
 * Resuelve qué estado prevalece cuando dos se solapan.
 * @param {string} current estado actual
 * @param {string} incoming estado entrante
 */
export function resolveState(current, incoming) {
  const a = PRIORITY.indexOf(current);
  const b = PRIORITY.indexOf(incoming);
  const pa = a === -1 ? 99 : a;
  const pb = b === -1 ? 99 : b;
  return pb < pa ? incoming : current;
}

/** Valida que un nombre de estado exista. */
export function assertState(name) {
  if (!STATES[name]) throw new Error(`[ego-avatar] estado desconocido: "${name}"`);
  return name;
}
