// studio/element-host.js — backend canvas de <ego-avatar mode="studio">.
// El elemento es dueño del vocabulario de Ego (14 estados, 11 emotes,
// genoma); este host traduce al motor HybridRobotAvatar y lo conduce:
// carga perezosa (import dinámico: el modo SVG no paga el coste), sizing del
// canvas sin el clamp 300×200 del resize() del studio, y re-adopción de
// transiciones nacidas en el canvas (poke→dizzy, box, spin…).
// Sin DOM (Node/tests) el host existe pero nunca crea backend: toda la API
// degrada a no-op seguro.

import {
  studioStateForEgo,
  studioEmoteForEgo,
  STUDIO_TO_EGO_STATE,
  applyGenomeToStudio,
  studioSoundFor,
  studioMicroFor,
} from './adapter.js';
import { STUDIO_STATES } from './config.js';

/** Nombres de estado válidos del motor canvas. */
const STUDIO_STATE_NAMES = new Set(STUDIO_STATES.map((s) => s.name));

const HAS_DOCUMENT = typeof document !== 'undefined';

/**
 * Parámetros escalares del studio ajustables desde el elemento/demos.
 * `userScale` es propio del host: multiplica el auto-encuadre
 * (el backend.globalScale lo gestiona el sizing, no el usuario directo).
 */
export const STUDIO_PARAM_KEYS = new Set([
  'eyeStyle', 'mouthStyle', 'accessory',
  'bodyColor', 'visorColor', 'eyeColor',
  'showVisor', 'showSidePods', 'autoStateColors',
  'bodyWidthRatio', 'bodyHeightRatio',
  'visorWidthRatio', 'visorHeightRatio', 'visorCornerRadius',
  'eyeWidthRatio', 'eyeHeightRatio', 'eyeSpacing', 'eyeOffsetY', 'eyeGlowBlur',
  'mouthScale', 'mouthOffsetY',
  'accessoryScale', 'accessoryOffsetY', 'accessoryBounce',
  'handScaleConfig', 'handsMode',
  'jellyIntensity', 'parallaxIntensity', 'liveliness',
  'userScale', 'squircleN',
]);

/** Presets que el backend sabe aplicar (Ego Robot Studio). */
export const STUDIO_PRESET_NAMES = Object.freeze([
  'cx-faithful',
  'ego-nucleus',
  'ego-cyber',
  'ego-sentinel',
  'ego-architect',
  'coucou-mochi',
]);

export class StudioHost {
  /**
   * @param {object} el el elemento (usa getState/_genome/_palette/_adoptExternalState)
   */
  constructor(el) {
    this.el = el;
    this.canvas = null;
    this.backend = null; // HybridRobotAvatar
    this.sound = null; // SoundSynthesizer
    this._loading = null;
    this.expect = 'idle'; // último estado pedido por el elemento
    this.pointerOn = true;
    this.soundOn = true;
    this.userScale = 1; // multiplicador sobre el auto-encuadre
    this._pendingParams = {}; // params fijados antes de que cargue el motor
    this._dead = false;
  }

  /** ¿Hay backend vivo? */
  get ready() {
    return !!this.backend;
  }

  /**
   * Vincula el canvas y arranca la carga del motor.
   * @param {HTMLCanvasElement} canvas
   */
  attach(canvas) {
    this.canvas = canvas || null;
    this._sizeBackend();
    return this.ensure();
  }

  /** Carga el motor una sola vez (promesa cacheada, null si no hay DOM). */
  ensure() {
    if (this.backend) return Promise.resolve(this.backend);
    if (!this._loading) {
      this._loading = import('./index.js').then((m) => {
        if (this._dead || !this.canvas || !HAS_DOCUMENT) return null;
        const sound = new m.SoundSynthesizer();
        sound.enabled = this.soundOn;
        const backend = new m.HybridRobotAvatar(this.canvas, sound);
        backend.parallaxIntensity = this.pointerOn ? 1 : 0;
        this.sound = sound;
        this.backend = backend;
        // params pendientes (fijados antes de cargar) + encuadre
        for (const [k, v] of Object.entries(this._pendingParams)) {
          if (k === 'userScale') this.userScale = Number(v) || 1;
          else {
            try {
              backend[k] = v;
            } catch {
              /* campo de solo lectura: se ignora */
            }
          }
        }
        this._pendingParams = {};
        this._sizeBackend();
        this.syncGenome();
        // montaje silencioso: el estado ya lo tiene el elemento
        this.expect = studioStateForEgo(this.el.getState ? this.el.getState() : 'idle');
        try {
          backend.play(this.expect, { silent: true });
        } catch {
          /* estado válido siempre por el mapa; red por si acaso */
        }
        try {
          backend.attachInteractions();
        } catch {
          /* sin puntero no hay interacciones */
        }
        return backend;
      }).catch(() => null);
    }
    return this._loading;
  }

  /** Dimensiona canvas + backend desde el tamaño real (sin clamp 300×200). */
  resize() {
    this._sizeBackend();
  }

  _sizeBackend() {
    const c = this.canvas;
    if (!c || !HAS_DOCUMENT) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    let rect = null;
    try {
      rect = c.getBoundingClientRect();
    } catch {
      rect = null;
    }
    const w = Math.max(1, Math.round((rect && rect.width) || c.clientWidth || 300));
    const h = Math.max(1, Math.round((rect && rect.height) || c.clientHeight || 300));
    try {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    } catch {
      /* canvas stub */
    }
    const b = this.backend;
    if (!b) return;
    if (b.ctx && typeof b.ctx.setTransform === 'function') {
      try {
        b.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } catch {
        /* ctx stub */
      }
    }
    b.width = w;
    b.height = h;
    b.homeX = w / 2;
    b.homeY = h / 2;
    // auto-encuadre: el avatar del studio mide ~240 px con manos fuera;
    // se escala para que quepa entero en el elemento (el override manual de
    // globalScale queda para la demo a pantalla completa, no para el elemento)
    b.globalScale = (Math.min(w, h) / 240) * (Number(this.userScale) || 1);
    if (!b.isDragging) {
      b.x = b.homeX;
      b.y = b.homeY;
    }
  }

  /** Reaplica genoma/paleta del elemento sobre el backend. */
  syncGenome() {
    if (!this.backend) return false;
    return applyGenomeToStudio(this.backend, this.el._genome, this.el._palette);
  }

  /**
   * Estado persistente de Ego → studio (con su propio sonido).
   * @param {string} egoState @param {{silent?:boolean}} [opts]
   */
  applyState(egoState, opts = {}) {
    this.expect = studioStateForEgo(egoState);
    if (!this.backend) {
      this.ensure();
      return false;
    }
    try {
      this.backend.play(this.expect, { silent: !!opts.silent });
    } catch {
      return false;
    }
    return true;
  }

  /** Emote transitorio de Ego → estado del studio. */
  playEmote(egoEmote) {
    const mapped = studioEmoteForEgo(egoEmote);
    this.expect = mapped;
    if (!this.backend) {
      this.ensure();
      return false;
    }
    try {
      this.backend.play(mapped);
    } catch {
      return false;
    }
    return true;
  }

  /** Vuelve al estado que marca el elemento (tras emote/cancelación). */
  restore() {
    return this.applyState(this.el.getState ? this.el.getState() : 'idle');
  }

  /**
   * Estado crudo del studio por nombre ('send', 'box', …): para acciones sin
   * equivalente en el vocabulario de Ego. Solo modo studio.
   * @param {string} name
   */
  playRawState(name) {
    if (!STUDIO_STATE_NAMES.has(name)) return false;
    this.expect = name;
    if (!this.backend) {
      this.ensure();
      return true;
    }
    try {
      this.backend.play(name);
    } catch {
      return false;
    }
    return true;
  }

  /**
   * Sonido por nombre de Ego → sintetizador del studio.
   * @param {string} name
   */
  playSound(name) {
    if (!this.soundOn || !this.sound) return false;
    try {
      return this.sound.play(studioSoundFor(name)) !== false;
    } catch {
      return false;
    }
  }

  /**
   * Micro de Ego → gesto del studio (giro 360° o micro idle aleatorio).
   * @param {string} name
   */
  playMicro(name) {
    const m = studioMicroFor(name);
    if (!m || !this.backend) return false;
    try {
      if (m.spin) this.backend.triggerSpin(m.spin);
      else this.backend.triggerIdleMicroAnimation();
    } catch {
      return false;
    }
    return true;
  }

  /** Seguimiento de puntero → parallax del studio (1 on / 0 off). */
  setPointerFollow(on) {
    this.pointerOn = Boolean(on);
    if (this.backend) this.backend.parallaxIntensity = this.pointerOn ? 1 : 0;
    return this.pointerOn;
  }

  /**
   * Fija un parámetro escalar del motor (lista en STUDIO_PARAM_KEYS).
   * Antes de cargar se guarda como pendiente; `userScale` multiplica el
   * auto-encuadre en vez de pisar globalScale.
   */
  setParam(key, value) {
    if (!STUDIO_PARAM_KEYS.has(key)) return false;
    if (key === 'userScale') {
      this.userScale = Number(value) || 1;
      this._sizeBackend();
      return true;
    }
    this._pendingParams[key] = value;
    if (this.backend) {
      try {
        this.backend[key] = value;
      } catch {
        return false;
      }
    }
    return true;
  }

  /** Lee un parámetro (pendiente > backend > undefined). */
  getParam(key) {
    if (!STUDIO_PARAM_KEYS.has(key)) return undefined;
    if (key === 'userScale') return this.userScale;
    if (key in this._pendingParams) return this._pendingParams[key];
    return this.backend ? this.backend[key] : undefined;
  }

  /** Foto de todos los parámetros ajustables. */
  getParams() {
    const out = {};
    for (const key of STUDIO_PARAM_KEYS) out[key] = this.getParam(key);
    return out;
  }

  /**
   * Aplica un preset fiel del studio (re-pinta identidad: chasis, ojos,
   * boca, accesorio). Re-encuadra después porque el preset toca la escala.
   */
  applyPreset(name) {
    if (!STUDIO_PRESET_NAMES.includes(name)) return false;
    const effectiveName = name === 'coucou-mochi' ? 'cx-faithful' : name;
    this._pendingParams = {};
    if (!this.backend) {
      this.ensure();
      return true;
    }
    try {
      this.backend.applyPreset(effectiveName);
    } catch {
      return false;
    }
    this.expect = 'idle';
    this._sizeBackend();
    return true;
  }

  /**
   * Habla por el motor (boca + burbuja #avatar-bubble si existe + sonido).
   * @param {string} text @param {number} [seconds]
   */
  speak(text, seconds = 3.2) {
    if (!this.backend || typeof text !== 'string' || !text) return false;
    try {
      this.backend.speak(text, seconds);
    } catch {
      return false;
    }
    return true;
  }

  /** Silencio → flag enabled del sintetizador del studio. */
  setSoundOn(on) {
    this.soundOn = Boolean(on);
    if (this.sound) this.sound.enabled = this.soundOn;
    return this.soundOn;
  }

  /**
   * Un frame del loop del elemento: avanza el motor, dibuja y re-adopta
   * transiciones nacidas en el canvas (poke→dizzy, box, spin…).
   * @param {number} dt segundos
   */
  frame(dt) {
    const b = this.backend;
    if (!b) {
      this.ensure();
      return;
    }
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0.016;
    try {
      b.update(step);
    } catch {
      return;
    }
    try {
      b.draw();
    } catch {
      /* dibujo parcial tolerado */
    }
    const seen = b.state;
    if (seen && seen !== this.expect) {
      this.expect = seen;
      if (this.el._adoptExternalState) {
        this.el._adoptExternalState(STUDIO_TO_EGO_STATE[seen] || 'idle');
      }
    }
  }

  /** Suelta interacciones y marca como muerto (re-montaje/desconexión). */
  detach() {
    this._dead = true;
    try {
      this.backend?.detachInteractions?.();
    } catch {
      /* ya suelto */
    }
    this.backend = null;
    this.sound = null;
    this.canvas = null;
    this._loading = null;
  }
}
