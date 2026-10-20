// src/studio/sound.js — sintetizador procedural del studio (verbatim de avatar_studio_cx_artlab_mochi_2_0.html:609-705).
// Port fiel de `SoundSynthesizer`: misma matemática, mismas constantes, mismo comportamiento.
// Sin `window`/`document`/`AudioContext` en tiempo de importación: el acceso a `window`
// ocurre solo dentro de `init()` (tiempo de ejecución) y está protegido con
// `typeof window`, de modo que en Node (sin AudioContext) `play()` es un no-op
// seguro que devuelve `false` en lugar de lanzar.

/** Nombres de sonido del `switch` de `play()` (html:642-701), incluido `'default'`. */
export const STUDIO_SOUND_NAMES = Object.freeze([
  'hover',
  'highfive',
  'success',
  'wake',
  'send',
  'spin',
  'failure',
  'bored',
  'error',
  'blocked',
  'poke',
  'warning',
  'surprise',
  'inspect',
  'waiting',
  'input',
  'wave',
  'love',
  'talk',
  'dizzy',
  'default',
]);

export class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      // Guardia Node: sin `window` no hay AudioContext; se mantiene `ctx = null`.
      if (typeof window === 'undefined') return;
      // `webkitAudioContext` es el prefijo heredado de Safari; no está en los
      // tipos estándar de DOM, así que se lee de forma indexada.
      const win = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (window));
      const AudioCtx = win['AudioContext'] ?? win['webkitAudioContext'];
      if (typeof AudioCtx === 'function') {
        const Ctor = /** @type {new () => AudioContext} */ (AudioCtx);
        this.ctx = new Ctor();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /**
   * @param {number} f1 frecuencia inicial (Hz)
   * @param {number} f2 frecuencia final (Hz)
   * @param {number} dur duración (s)
   * @param {number} start offset de inicio (s)
   * @param {OscillatorType} [type]
   * @param {number} [vol]
   */
  tone(f1, f2, dur, start, type = 'sine', vol = 0.11) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), start + dur);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }

  // En el original no devuelve nada; aquí devuelve `true` si programó tonos y
  // `false` si es no-op (deshabilitado, sin contexto o excepción). La tabla de
  // sonidos es idéntica al original.
  play(state) {
    if (!this.enabled) return false;
    try {
      this.init();
      if (!this.ctx) return false;
      const t = this.ctx.currentTime;
      switch (state) {
        case 'hover':
          this.tone(580, 720, 0.045, t, 'sine', 0.04);
          break;
        case 'highfive':
          this.tone(520, 880, 0.07, t, 'triangle', 0.12);
          this.tone(880, 1180, 0.11, t + 0.06, 'sine', 0.13);
          break;
        case 'success':
        case 'wake':
          this.tone(440, 587, 0.08, t, 'triangle', 0.11);
          this.tone(587, 880, 0.14, t + 0.08, 'sine', 0.14);
          break;
        case 'send':
          this.tone(300, 1250, 0.18, t, 'sine', 0.13);
          break;
        case 'spin':
          this.tone(360, 920, 0.14, t, 'sine', 0.12);
          this.tone(920, 540, 0.14, t + 0.12, 'triangle', 0.11);
          break;
        case 'failure':
        case 'bored':
          this.tone(380, 200, 0.22, t, 'triangle', 0.11);
          break;
        case 'error':
        case 'blocked':
        case 'poke':
          this.tone(190, 135, 0.12, t, 'sawtooth', 0.1);
          this.tone(160, 105, 0.18, t + 0.11, 'sawtooth', 0.1);
          break;
        case 'warning':
          this.tone(660, 660, 0.09, t, 'sine', 0.11);
          this.tone(520, 520, 0.12, t + 0.11, 'sine', 0.11);
          break;
        case 'surprise':
          this.tone(420, 980, 0.12, t, 'sine', 0.14);
          break;
        case 'inspect':
        case 'waiting':
        case 'input':
          this.tone(540, 630, 0.06, t, 'sine', 0.08);
          break;
        case 'wave':
        case 'love':
          this.tone(520, 680, 0.09, t, 'sine', 0.12);
          this.tone(680, 880, 0.14, t + 0.09, 'sine', 0.14);
          break;
        case 'talk':
          for (let i = 0; i < 5; i++) {
            const f = 380 + ((i * 110) % 280);
            this.tone(f, f * 1.15, 0.055, t + i * 0.075, 'triangle', 0.08);
          }
          break;
        case 'dizzy':
          for (let i = 0; i < 4; i++) {
            this.tone(420 + (i % 2) * 160, 520 - (i % 2) * 140, 0.07, t + i * 0.06, 'sine', 0.1);
          }
          break;
        default:
          this.tone(480, 600, 0.05, t, 'sine', 0.07);
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}
