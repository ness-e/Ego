// src/studio/sound.js — sintetizador procedural del studio.
//
// IMPLEMENTACIÓN PROPIA DE EGO — patrón asimilado del Avatar Studio
// (single-file HTML; su licencia no está declarada en el origen), sin
// traducción de código. La idea asimilada es "cada señal del avatar es un
// gesto sonoro corto, hecho de uno o dos tonos"; el catálogo y el sintetizador
// son de Ego.
//
// CÓMO ESTÁ HECHO: cada sonido es un **GESTO** declarado como datos —una raiz
// tonal, un patrón de pasos medidos en semitonos y una envolvente— y un
// **renderizador genérico** los convierte en tonos. El catálogo dice QUÉ suena;
// el renderizador decide CÓMO se sintetiza.
//
// Sin `window`/`document`/`AudioContext` en tiempo de importación: el acceso a
// `window` ocurre solo dentro de `init()` (tiempo de ejecución) y está
// protegido, de modo que en Node (sin AudioContext) `play()` es un no-op seguro
// que devuelve `false` en lugar de lanzar.

/**
 * Catálogo de gestos sonoros (datos de Ego).
 *
 *  - `root`  : tono raiz, en Hz.
 *  - `steps` : patron, en semitonos relativos a la raiz (negativo = baja).
 *  - `wave`  : forma de onda del oscilador.
 *  - `dur`   : duracion de cada tono, en segundos.
 *  - `vol`   : volumen de cada tono.
 *  - `gap`   : silencio entre tonos, en segundos.
 */
const VOICES = Object.freeze({
  hover: { root: 523.25, steps: [0, 5], wave: 'sine', dur: 0.05, vol: 0.05, gap: 0.03 },
  highfive: { root: 466.16, steps: [0, 7, 12], wave: 'triangle', dur: 0.07, vol: 0.12, gap: 0.05 },
  success: { root: 440.0, steps: [0, 4, 9], wave: 'triangle', dur: 0.08, vol: 0.11, gap: 0.06 },
  wake: { root: 440.0, steps: [0, 4, 9], wave: 'triangle', dur: 0.08, vol: 0.11, gap: 0.06 },
  send: { root: 392.0, steps: [0, 7, 12, 16], wave: 'sine', dur: 0.06, vol: 0.12, gap: 0.04 },
  spin: { root: 349.23, steps: [0, 7, 2], wave: 'sine', dur: 0.07, vol: 0.11, gap: 0.07 },
  failure: { root: 293.66, steps: [0, -3, -7], wave: 'triangle', dur: 0.08, vol: 0.1, gap: 0.06 },
  bored: { root: 293.66, steps: [0, -3, -7], wave: 'triangle', dur: 0.08, vol: 0.1, gap: 0.06 },
  error: { root: 196.0, steps: [0, -2, -5], wave: 'sawtooth', dur: 0.07, vol: 0.1, gap: 0.07 },
  blocked: { root: 196.0, steps: [0, -2, -5], wave: 'sawtooth', dur: 0.07, vol: 0.1, gap: 0.07 },
  poke: { root: 196.0, steps: [0, -2, -5], wave: 'sawtooth', dur: 0.07, vol: 0.1, gap: 0.07 },
  warning: { root: 622.25, steps: [0, 0, -3], wave: 'sine', dur: 0.09, vol: 0.11, gap: 0.1 },
  thinking: { root: 493.88, steps: [0, 2, 4], wave: 'sine', dur: 0.07, vol: 0.08, gap: 0.1 },
  approval: { root: 698.46, steps: [0, 0], wave: 'triangle', dur: 0.07, vol: 0.1, gap: 0.13 },
  question: { root: 554.37, steps: [0, 5], wave: 'sine', dur: 0.13, vol: 0.11, gap: 0.0 },
  ratelimit: { root: 329.63, steps: [0, -1, -3], wave: 'sine', dur: 0.09, vol: 0.09, gap: 0.07 },
  surprise: { root: 415.3, steps: [0, 12], wave: 'sine', dur: 0.12, vol: 0.13, gap: 0.0 },
  inspect: { root: 523.25, steps: [0, 3], wave: 'sine', dur: 0.06, vol: 0.08, gap: 0.0 },
  waiting: { root: 523.25, steps: [0, 3], wave: 'sine', dur: 0.06, vol: 0.08, gap: 0.0 },
  input: { root: 523.25, steps: [0, 3], wave: 'sine', dur: 0.06, vol: 0.08, gap: 0.0 },
  wave: { root: 493.88, steps: [0, 4, 9], wave: 'sine', dur: 0.09, vol: 0.12, gap: 0.07 },
  love: { root: 493.88, steps: [0, 4, 9], wave: 'sine', dur: 0.09, vol: 0.12, gap: 0.07 },
  talk: { root: 369.99, steps: [0, 3, 5, 7, 10], wave: 'triangle', dur: 0.055, vol: 0.08, gap: 0.02 },
  dizzy: { root: 440.0, steps: [0, 7, 0, 7], wave: 'sine', dur: 0.07, vol: 0.1, gap: 0.0 },
  default: { root: 466.16, steps: [0, 4], wave: 'sine', dur: 0.05, vol: 0.07, gap: 0.0 },
});

/** Nombres de sonido del studio (el catalogo manda: son sus claves). */
export const STUDIO_SOUND_NAMES = Object.freeze(Object.keys(VOICES));

/** Hz de un paso (semitonos relativos a la raiz). */
function stepHz(root, semitones) {
  return root * 2 ** (semitones / 12);
}

export class SoundSynthesizer {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (this.ctx) {
      const state = this.ctx.state;
      if (state === 'suspended') this.ctx.resume();
      return;
    }
    // Guardia Node: sin `window` no hay AudioContext; se mantiene `ctx = null`.
    if (typeof window === 'undefined') return;
    // `webkitAudioContext` es el prefijo heredado de Safari; no esta en los
    // tipos estandar de DOM, asi que se lee de forma indexada.
    const win = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (window));
    const Ctor = win['AudioContext'] ?? win['webkitAudioContext'];
    if (typeof Ctor === 'function') {
      this.ctx = new (/** @type {new () => AudioContext} */ (Ctor))();
    }
  }

  /**
   * Programa un tono con envolvente de ataque corto y caida exponencial.
   * @param {number} from frecuencia inicial (Hz)
   * @param {number} to frecuencia final (Hz)
   * @param {number} seconds duración (s)
   * @param {number} when offset de inicio (s)
   * @param {OscillatorType} [shape]
   * @param {number} [gain]
   */
  tone(from, to, seconds, when, shape = 'sine', gain = 0.1) {
    if (this.ctx === null || this.enabled === false) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const end = when + seconds;
    const attack = Math.min(0.015, seconds / 4);
    osc.type = shape;
    // envolvente: silencio -> meseta -> silencio
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.linearRampToValueAtTime(gain, when + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    // barrido de frecuencia (glissando hacia el tono siguiente)
    const landing = Math.max(40, to);
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(landing, end);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(when);
    osc.stop(end + 0.02);
  }

  /** Convierte un gesto en tonos: cada paso glissa hacia el siguiente. */
  _render(voice, when) {
    const hz = voice.steps.map((semi) => stepHz(voice.root, semi));
    let at = when;
    for (let i = 0; i < hz.length; i++) {
      const next = i + 1 < hz.length ? hz[i + 1] : hz[i];
      this.tone(hz[i], next, voice.dur, at, voice.wave, voice.vol);
      at += voice.gap;
    }
  }

  /**
   * Suena el gesto de un estado. Devuelve `true` si programó tonos y `false`
   * si es no-op (deshabilitado, sin contexto o excepción).
   * @param {string} state
   */
  play(state) {
    if (!this.enabled) return false;
    try {
      this.init();
      if (!this.ctx) return false;
      const voice = VOICES[state] ?? VOICES.default;
      this._render(voice, this.ctx.currentTime);
      return true;
    } catch {
      return false;
    }
  }
}
