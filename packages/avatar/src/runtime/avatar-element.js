// avatar-element.js — <ego-avatar>: web component cero-dependencias.
// Adapted from agent-robot-avatar (MIT), vendor/agent-robot-avatar/core.js
// Rig visual de agent-robot-avatar: cabeza redondeada + ojos blancos con
// párpados (poses 100 % numéricas) + identidad determinista por semilla.
//
// Ciclo: plantilla SVG construida UNA vez → loop rAF a 30 fps que MUTA
// atributos (poses, parpadeo, mirada, tinte, movimiento, insignia,
// partículas). Sistemas portados de los repos de referencia:
//  · config con Bounds/clamp           → core/config.js       (ARA)
//  · tracks tween por campo + locks    → core/timeline.js     (coucou anim())
//  · política: reduced-motion, action records, auto-sleep → runtime/policy.js (ARA)
//  · FSM de presencia (hidden/compact/home/greet)         → runtime/presence.js (coucou)
//  · matemática ocular (barrido, warning, modificadores)  → runtime/fx-eyes.js    (ARA)
//  · keys de cabeza (error/nod/warning)+micros            → runtime/micro.js      (ARA+coucou)
//  · puntero/wander/aburrimiento + springs de cabeza      → runtime/pointer.js    (ARA CORE:368-1043)
//  · sonido procedural (28 recetas, cero assets)          → runtime/sound.js      (vendor/coucou/core/sound.ts)

import { generateGenome, temperamentProfile } from '../core/genome.js';
import { buildPalette, lerpHsl } from '../core/palette.js';
import { xmur3 } from '../core/prng.js';
import { clamp, lerp } from '../core/morph.js';
import { Ease, Tracked, Spring } from '../core/anim.js';
import { getConfig } from '../core/config.js';
import { createTimeline } from '../core/timeline.js';
import { renderShell } from '../render/shell.js';
import {
  eyeGeometry,
  edgeSqueeze,
  surpriseSpread,
  ARA_EYE,
} from '../render/eyes.js';
import { STATES, EMOTES, assertState, HOOK_STATE_MAP, HOOK_AUTO_RETURN } from './states.js';
import { POSES, createPoseState, lerpPose, morphDuration } from './poses.js';
import {
  samplePointer,
  emptyPointer,
  pointerInRange,
  nextWander,
  smoothLook,
  createHeadFollow,
  stepHeadFollow,
  LOOK_SPEED,
  BORED_STEPS,
} from './pointer.js';
import {
  nodModifier,
  angryDropModifier,
  eyeBobModifier,
  surpriseShakeModifier,
  waitingOrbit,
  inspectPhases,
  inspectEye,
  loveHeart,
  loveHeartGeometry,
  EYE_BOB,
  INSPECT_DURATION,
  errorEyeSweep,
  warningLids,
  warningEyeTransform,
  WARNING_PHASES,
} from './fx-eyes.js';
import {
  startMicro,
  badgePopSequence,
  BADGE_POP_GAP_MS,
  errorHeadKeys,
  nodKeys,
  warningHeadKeys,
} from './micro.js';
// STATE_SOUND / EMOTE_SOUND se importan SIEMPRE de sound.js: states.js exporta
// tablas idénticas y el barrel (index.js) las publica solo desde sound.js.
import { STATE_SOUND, EMOTE_SOUND, ACTION_SOUND, createSoundEngine } from './sound.js';
import {
  reducedMotion,
  beginAction,
  finishAction,
  cancelActiveAction,
  createAutoSleep,
} from './policy.js';
import { PresenceStateMachine } from './presence.js';
import {
  runBeforePlay,
  runAfterPlay,
  runExtensionAction,
  runDraw,
  runReset,
  hasExtensionAction,
} from './extension-host.js';
// Host del backend canvas (modo studio): importación estática ligera — el
// motor pesado entra por import dinámico dentro del host.
import { isStudio, studioHost, mountStudio, setStateStudio, runEmoteStudio } from './studio-bridge.js';
import { toSVGString as serializeSVG } from './svg-export.js';

const FRAME_MS = 33; // ~30 fps (patrón agent-robot-avatar)
const CX = 120;
const CY = 126;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Acciones semánticas: estado temporal con retorno automático (coucou §3.3). */
const ACTIONS = Object.freeze({
  success: { state: 'success', duration: 5200 },
  error: { state: 'error', duration: 4200 },
  waiting: { state: 'waiting', duration: WARNING_PHASES.duration + 400 },
  inspect: { state: 'waiting', duration: INSPECT_DURATION + 300 },
  roll: { state: 'finished', duration: 1100 },
  greet: { state: 'idle', duration: 1900 },
});
const ACTION_ALIASES = Object.freeze({
  fail: 'error',
  failed: 'error',
  'system-error': 'error',
  'policy-blocked': 'error',
  warning: 'waiting',
  wait: 'waiting',
  // 'inspect' deja de ser alias de waiting: es su propia acción (INSPECT_DURATION)
});

/** Fases acumuladas de la inspección (6560 ms) — construidas una sola vez. */
const INSPECT_PHASES = inspectPhases();

/** Dwell de hover: 1900 ms sobre el avatar → emote `love` (ARA dwell). */
const DWELL_MS = 1900;

/** Ventana de las palmadas: 3 golpes en 1700 ms → `dizzy`. */
const SLAP_WINDOW_MS = 1700;

/** Los ojos quedan en línea 800 ms tras una palmada. */
const SLAP_EYE_MS = 800;

/** Dedup de sonido: estado y acción con la misma receta no deben sonar dos veces. */
const SOUND_DEDUP_MS = 150;

const STYLES = `
:host { display: inline-block; width: var(--avatar-size, 112px); height: var(--avatar-size, 112px); }
:host([hidden]) { display: none; }
.avatar-svg { width: 100%; height: 100%; overflow: visible; display: block; }
.badge text { font-family: system-ui, -apple-system, sans-serif; }
.particles path, .particles circle { pointer-events: none; }
.eye-base, .eye-input, .eye-top, .eye-bottom { pointer-events: none; }
.studio-canvas { width: 100%; height: 100%; display: block; }
`;

function uidFromSeed(seed) {
  return xmur3(String(seed))().toString(36).slice(0, 6);
}

/**
 * Base del custom element. En navegador es HTMLElement; en Node (tests sin
 * DOM) se sustituye por una clase neutra para que importar el módulo no lance.
 */
const ElementBase = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

/** ¿Hay DOM SVG nativo para inserciones programáticas? (Node no lo tiene) */
function supportsSvgInsert() {
  return (
    typeof document !== 'undefined' &&
    typeof document.createElementNS === 'function' &&
    typeof Element !== 'undefined'
  );
}

/** Copia profunda del genoma (generateGenome devuelve uno congelado). */
function cloneGenome(genome) {
  return JSON.parse(JSON.stringify(genome));
}

/** Mezcla profunda de `patch` dentro de `target` (escalares y arrays: reemplazo). */
function deepMergeInto(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    const dst = target[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      dst && typeof dst === 'object' && !Array.isArray(dst)
    ) {
      deepMergeInto(dst, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/** Escribe un valor en una ruta anidada ('shape.kind' → {shape:{kind:v}}). */
function setPath(obj, parts, value) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

/** Congela en profundidad (el genoma sigue siendo inmutable para el consumidor). */
function deepFreeze(obj) {
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

/**
 * Modo de las manos flotantes articuladas (rig de 5 dedos, `studio/rig/hands.js`).
 *
 * El motor del Robot Studio tiene el rig, pero `handsMode` SOLO era
 * ajustable desde el propio Studio: el elemento `<ego-avatar>` no exponía
 * ninguna vía para encenderlo, así que en la app las manos quedaban
 * invisibles (modo `auto`: solo visibles durante los 10 s que dura el
 * temporizador que dispara un emote o el hover de una mano).
 *
 * Se expone como atributo `hands` del elemento:
 *   - `always` → siempre visibles.
 *   - `auto`   → aparecen tras una interacción (comportamiento original).
 *   - `hidden` → nunca.
 * Ausente o con un valor desconocido → `auto` (comportamiento previo).
 *
 * @param {string|null|undefined} value
 * @returns {'always'|'auto'|'hidden'}
 */
function normalizeHandsMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'always' || v === 'on' || v === 'true') return 'always';
  if (v === 'hidden' || v === 'off' || v === 'false') return 'hidden';
  return 'auto';
}

export class EgoAvatar extends ElementBase {
  static get observedAttributes() {
    return ['seed', 'state', 'size', 'motion', 'auto-sleep', 'presence', 'pointer-follow', 'sound', 'mode', 'preset', 'hands'];
  }

  constructor() {
    super();
    const cfg = getConfig();
    this._cfgRuntime = cfg;
    this._seed = 'ego';
    this._uid = 'ego';
    this._genome = null;
    this._palette = null;
    this._profile = null;
    this._eyeGeo = null;
    this._mounted = false;
    this._running = false;
    this._raf = 0;
    this._lastFrame = 0;
    this._t0 = 0;
    this._phase = 0; // desfase de idle por semilla (determinista)

    // estado
    this._state = 'idle';
    this._cfg = STATES.idle;
    this._tintCur = { color: 'hsl(0 0% 0%)', strength: 0 };
    this._tintFrom = null;
    this._tintStart = 0;
    this._glowCur = 0;

    // pose
    this._pose = createPoseState('idle');
    this._poseFrom = null;
    this._poseTo = null;
    this._poseStart = 0;
    this._poseDur = 200;
    this._poseName = 'idle';

    // mirada / parpadeo
    this._look = { x: 0, y: 0 };
    this._lookTarget = { x: 0, y: 0 };
    this._wander = { x: 0, y: 0 };
    this._nextWander = 0;
    this._blink = 1;
    this._blinkStart = 0;
    this._nextBlink = 0;
    this._doubleBlinkQueued = false;
    this._pointer = null;
    this._lastPointerMove = 0;
    this._rect = null;

    // seguimiento de puntero y de cabeza (runtime/pointer.js, ARA CORE:368-1043)
    this._ptr = emptyPointer(performance.now());
    this._lastSampledMove = -1; // último movimiento ya muestreado en _ptr
    this._headFollow = createHeadFollow();
    this._headFollowEl = null; // grupo SVG .head-follow (null si el envoltorio falla)
    this._pointerFollow = cfg.pointerFollow;
    // Modo de las manos flotantes articuladas (rig de 5 dedos). El atributo
    // `hands` del elemento manda sobre este valor; por defecto se conserva
    // el comportamiento del motor (`auto`: solo tras una interacción).
    this._handsMode = normalizeHandsMode(this.getAttribute?.('hands'));
    this._hover = null; // {since, dwellFired} — dwell de 1900 ms → emote love
    this._slapTimes = [];
    this._dragging = null; // {startX, startY, moved} — arrastre "jelly"
    this._suppressClick = false; // el arrastre no debe producir palmada

    // valores dinámicos por frame (movimiento + tweens de cabeza)
    this._dyn = { ox: 0, oy: 0, hx: 0, hy: 0, sx: 1, sy: 1, tiltAdd: 0, auraScale: 1 };
    this._tl = createTimeline(); // tracks: 'hx' (shake/error), 'hy' (nod/warning)
    this._jelly = new Spring(0, cfg.jellyResponse, cfg.jellyDamping); // impacto "jelly"

    // fx de acción + modificadores de ojos (runtime/expressions.js)
    this._fx = {
      warning: null,
      errorSweep: null,
      nod: null,
      angryDrop: null,
      eyeBob: null,
      surpriseShake: null,
      love: null,
      inspect: null,
      waitingOrbit: null,
    };
    this._emoteEye = null; // override de modo de ojo (EMOTES[...].eyes)
    this._slapEyeTimer = 0; // restablece _emoteEye 800 ms tras una palmada

    // rutina de aburrimiento (ARA actions.js:266-275)
    this._bored = null;

    // movimiento / insignia / emote
    this._moveT = 0;
    this._badge = null;
    this._badgeTracked = new Tracked(0);
    this._emote = null;
    this._winkSide = null;
    this._particles = [];
    this._action = null; // {name, token}
    this._token = 0;
    this._pending = new Set();

    // política: action records + auto-sleep (ARA runtime.js)
    this._activeActionState = null;
    this._actionStateSequence = 0;
    this._autoSleep = createAutoSleep({
      getDelayMs: () => {
        const attr = this.getAttribute?.('auto-sleep');
        return attr !== null && attr !== undefined ? Number(attr) : this._cfgRuntime.autoSleepMs;
      },
      isBlocked: () => !!this._action || !!this._emote || (typeof document !== 'undefined' && document.hidden),
      onSleep: () => this.setState('sleeping'),
    });

    // actividad / presencia
    this._lastActivity = Date.now();
    this._presence = new PresenceStateMachine();
    this._presence.onTransition = (_from, to) => {
      this.setAttribute('data-presence', to);
      this.dispatchEvent(
        new CustomEvent('presence-change', { detail: { state: to }, bubbles: true, composed: true })
      );
    };

    // hooks con auto-retorno
    this._hookReturnTimer = 0;

    // ambiente (zz/sweat) — vendor/coucou/mochi/engine.ts:584-588
    this._lastAmbient = 0;

    // sonido procedural (runtime/sound.js): 28 recetas sintetizadas, sin assets.
    // Sin Web Audio el motor degrada a no-op — nunca lanza.
    this._sound = createSoundEngine();
    this._soundEnabled = true;
    this._lastSound = null; // dedup: estado y acción con la misma receta
    this._lastSoundAt = -Infinity;

    // genoma con overrides por ruta (setGene/patchGenome/resetGenome)
    this._geneOverrides = {};

    // interactividad: handlers estables (se registran en _mount y se retiran
    // en disconnectedCallback; _mount los deduplica como a _onPointerMove)
    this._onEnter = () => {
      this._hover = { since: performance.now(), dwellFired: false };
      this._playSound(ACTION_SOUND.hover);
      this._sound.resume();
    };
    this._onLeave = () => {
      this._hover = null;
    };
    this._onHostClick = () => {
      this._sound.resume();
      if (this._suppressClick) {
        this._suppressClick = false; // fue un arrastre, no una palmada
        return;
      }
      this._playSound(ACTION_SOUND.click);
      this._onSlap();
    };
    this._onKeyDown = () => {
      this._sound.resume();
    };
    this._onDragStart = (e) => {
      this._suppressClick = false;
      this._dragging = { startX: e.clientX, startY: e.clientY, moved: false };
      this._sound.resume();
    };
    this._onDragMove = (e) => {
      const d = this._dragging;
      if (!d || d.moved) return;
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 2.5) d.moved = true;
    };
    this._onDragEnd = () => {
      const d = this._dragging;
      this._dragging = null;
      if (!d) return;
      if (d.moved) {
        // "squeeze": apretón con respuesta jelly (coucou slot spring)
        this._suppressClick = true;
        startMicro(this._tl, 'squash');
        this._jellyImpact(30);
      }
    };

    // nodos cacheados
    this._n = {};

    // motor de render: 'svg' (rig ARA, defecto) o 'studio' (canvas
    // HybridRobotAvatar). El backend pesado lo crea el host por demanda.
    this._renderMode = 'svg';
    this._studioHost = null;
    this._resizeObserver = null;
  }

  /* ─── ciclo de vida ─────────────────────────────────────────── */

  /** ¿Renderiza con el motor canvas del studio? (atributo `mode` manda) */
  _isStudio() {
    return isStudio(this, this._renderMode);
  }

  /**
   * Host del backend canvas, creado por demanda (en Node guarda pendientes
   * sin backend). Solo en modo studio; en SVG devuelve null.
   */
  _studio() {
    return studioHost(this);
  }

  /** Motor actual: 'svg' o 'studio'. */
  getMode() {
    return this._isStudio() ? 'studio' : 'svg';
  }

  /**
   * Cambia el motor de render y re-monta si ya estaba montado.
   * @param {'svg'|'studio'} mode
   */
  setMode(mode) {
    this._renderMode = mode === 'studio' ? 'studio' : 'svg';
    this.setAttribute?.('mode', this._renderMode);
    if (this._mounted) {
      this._mount();
      this._applyStateImmediate(this._state);
    }
    return this._renderMode;
  }

  /**
   * El canvas del studio cambió de estado por interacción directa
   * (poke→dizzy, box, spin…): se adopta el equivalente de Ego y se emite
   * `state-change`. Los flujos por API no pasan por aquí.
   */
  _adoptExternalState(egoState) {
    if (!STATES[egoState] || egoState === this._state) return;
    const previous = this._state;
    this._state = egoState;
    this._cfg = STATES[egoState];
    // dispatch opcional: en Node (tests sin DOM) no hay EventTarget
    this.dispatchEvent?.(
      new CustomEvent('state-change', { detail: { state: egoState, previous }, bubbles: true, composed: true })
    );
  }

  connectedCallback() {
    if (!this._genome) this._rebuild();
    this._mount();
    const initState = this.getAttribute?.('state');
    this._applyStateImmediate(initState && STATES[initState] ? initState : 'idle');
    const presenceAttr = (this.getAttribute?.('presence') || '').trim().toLowerCase();
    const presenceInit = { hidden: 'forceHidden', compact: 'forceCompact', home: 'forceHome', greet: 'launch' }[presenceAttr];
    if (presenceInit) this._presence[presenceInit]();
    this._start();
  }

  disconnectedCallback() {
    this._stop();
    for (const e of this._pending) {
      clearTimeout(e.id);
      e.resolve(false);
    }
    this._pending.clear();
    this._autoSleep.clear();
    this._presence.cancelTimers();
    clearTimeout(this._hookReturnTimer);
    clearTimeout(this._slapEyeTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointermove', this._onDragMove);
      window.removeEventListener('pointerup', this._onDragEnd);
      window.removeEventListener('pointercancel', this._onDragEnd);
      window.removeEventListener('resize', this._onStudioResize);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    this.removeEventListener?.('mouseenter', this._onEnter);
    this.removeEventListener?.('mouseleave', this._onLeave);
    this.removeEventListener?.('click', this._onHostClick);
    this.removeEventListener?.('keydown', this._onKeyDown);
    this._n.svg?.removeEventListener?.('pointerdown', this._onDragStart);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._studioHost?.detach();
    this._studioHost = null;
    this._sound.idle(); // el contexto de audio no debe quedar girando solo
  }

  attributeChangedCallback(name, oldV, newV) {
    if (oldV === newV) return;
    if (name === 'seed') {
      this._seed = newV || 'ego';
      if (this._genome) {
        this._rebuild();
        if (this._mounted) {
          this._mount();
          this._applyStateImmediate(this._state);
        }
      }
      return;
    }
    if (name === 'size') this.style.setProperty('--avatar-size', /^\d+$/.test(newV) ? `${newV}px` : newV || '112px');
    if (name === 'state' && this._mounted && STATES[newV]) this.setState(newV, { immediate: true });
    if (name === 'presence' && this._mounted && newV) {
      const map = { hidden: 'forceHidden', compact: 'forceCompact', home: 'forceHome' };
      this._presence[map[newV] || 'forceCompact']();
    }
    // seguimiento de puntero: el atributo manda sobre la config global
    if (name === 'pointer-follow') {
      this._pointerFollow = newV === null ? this._cfgRuntime.pointerFollow : newV !== 'false' && newV !== '0';
      this._studioHost?.setPointerFollow(this._pointerFollow);
      return;
    }
    if (name === 'sound') {
      this._applySoundEnabled(newV === null ? true : newV !== 'false' && newV !== '0');
    }
    // Manos flotantes articuladas: el atributo manda sobre el motor.
    if (name === 'hands') {
      this._handsMode = normalizeHandsMode(newV);
      // `_studio()` (y no `this._studioHost`) a propósito: en el navegador
      // los atributos se parsean ANTES de conectar el elemento, así que el
      // host canvas todavía no existe. Con el host opcional el valor se
      // perdía por el camino (solo quedaba en `_handsMode`) y el motor
      // nacía con el modo por defecto.
      this._studio()?.setParam('handsMode', this._handsMode);
      return;
    }
    if (name === 'mode') {
      this._renderMode = newV === 'studio' ? 'studio' : 'svg';
      if (this._mounted) {
        this._mount();
        this._applyStateImmediate(this._state);
      }
      return;
    }
    if (name === 'preset' && newV) {
      this.applyStudioPreset(newV);
      return;
    }
    if (name === 'size' && this._studioHost) this._studioHost.resize();
  }

  /* ─── construcción ──────────────────────────────────────────── */

  /**
   * Regenera el genoma desde la semilla y aplica encima los overrides de
   * `setGene`/`patchGenome` (generateGenome devuelve uno congelado: se clona
   * antes de mezclar y se vuelve a congelar el resultado).
   */
  _rebuild() {
    // getAttribute?.(): en Node (tests sin DOM) el elemento no es un HTMLElement
    this._seed = this.getAttribute?.('seed') || this._seed || 'ego';
    const base = generateGenome(this._seed);
    this._genome = Object.keys(this._geneOverrides).length
      ? deepFreeze(deepMergeInto(cloneGenome(base), this._geneOverrides))
      : base;
    this._palette = buildPalette(this._genome);
    this._profile = temperamentProfile(this._genome.temperament);
    this._eyeGeo = eyeGeometry(this._genome);
    this._uid = uidFromSeed(this._seed);
    this._phase = (xmur3(`${this._seed}::phase`)() % 1000) / 1000; // desfase de ciclo
  }

  /**
   * Envuelve cuerpo/insignia/partículas en un grupo `.head-follow` cuando la
   * plantilla no lo trae (renderShell no lo crea): se inserta como primer hijo
   * de `.motion-group`. `.eyes` vive DENTRO de `.body-group` y de su clip
   * `bodyclip-uid`, así que viaja con el cuerpo en vez de re-colgarse (re-colgarlo
   * rompería el clip de silueta). Si la inserción falla, `_n.headFollow` queda
   * `null` y todos lo consumidores lo toleran.
   */
  _ensureHeadFollow(q) {
    if (q('.head-follow') || !supportsSvgInsert()) return;
    try {
      const motion = q('.motion-group');
      if (!motion) return;
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'head-follow');
      motion.insertBefore(g, motion.firstChild);
      for (const sel of ['.body-group', '.badge', '.particles']) {
        const el = q(sel);
        if (el) g.appendChild(el);
      }
    } catch {
      /* sin inserción SVG el grupo queda ausente (null tolerado) */
    }
  }

  _mount() {
    if (this._isStudio()) return this._mountStudio();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._studioHost?.detach();
    this._studioHost = null;
    if (typeof document === 'undefined' || typeof this.attachShadow !== 'function') return;
    if (!this._genome || !this._palette) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>${renderShell(this._uid, this._genome, this._palette)}`;
    const q = (s) => this.shadowRoot.querySelector(s);
    this._ensureHeadFollow(q);
    this._n = {
      svg: q('svg'),
      motion: q('.motion-group'),
      headFollow: q('.head-follow'),
      body: q('.body-group'),
      tint: q('.tint'),
      aura: q('.aura'),
      lids: [...(q('.eyes')?.querySelectorAll('.eye-top, .eye-bottom') ?? [])],
      eyes: { L: q('.eye-L'), R: q('.eye-R') },
      badge: q('.badge'),
      badgeBg: q('.badge-bg'),
      badgeDots: q('.badge-dots'),
      badgeDot: [...(q('.badge-dots')?.querySelectorAll('.badge-dot') ?? [])],
      badgeBang: q('.badge-bang'),
      badgeQuestion: q('.badge-question'),
      badgeWarn: q('.badge-warn'),
      badgeWarnFrame: q('.badge-warn-frame'),
      badgeWarnBar: q('.badge-warn-bar'),
      badgeWarnDot: q('.badge-warn-dot'),
      particles: q('.particles'),
      appendage: q('.appendage'),
    };
    this._headFollowEl = this._n.headFollow;
    // color de acento fijo por identidad
    if (this._n.badgeBg) this._n.badgeBg.setAttribute('fill', this._palette.accent);
    for (const d of this._n.badgeDot) d.setAttribute('fill', this._palette.white);
    for (const t of [this._n.badgeBang, this._n.badgeQuestion]) t?.setAttribute('fill', this._palette.white);
    // El aviso (warning) se pinta en claro sobre el círculo de acento, igual que
    // la "!" de error: mismo lenguaje, distinto signo.
    for (const t of [this._n.badgeWarnFrame, this._n.badgeWarnBar]) {
      t?.setAttribute('stroke', this._palette.white);
    }
    this._n.badgeWarnDot?.setAttribute('fill', this._palette.white);
    if (this._n.appendage) this._n.appendage.style.color = this._palette.accent;
    this._mounted = true;
    // listeners deduplicados (evita duplicados al re-montar por setSeed)
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointermove', this._onDragMove);
      window.removeEventListener('pointerup', this._onDragEnd);
      window.removeEventListener('pointercancel', this._onDragEnd);
      window.removeEventListener('resize', this._onStudioResize);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    this.removeEventListener?.('mouseenter', this._onEnter);
    this.removeEventListener?.('mouseleave', this._onLeave);
    this.removeEventListener?.('click', this._onHostClick);
    this.removeEventListener?.('keydown', this._onKeyDown);
    this._n.svg?.removeEventListener('pointerdown', this._onDragStart);
    this._onPointerMove = (e) => {
      this._pointer = { x: e.clientX, y: e.clientY };
      this._lastPointerMove = performance.now();
      this._bored = null; // el interés del puntero cancela la rutina
      this._noteActivity(false);
    };
    this._onVisibility = () => (typeof document !== 'undefined' && document.hidden ? this._stop() : this._start());
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this._onPointerMove, { passive: true });
      window.addEventListener('pointermove', this._onDragMove, { passive: true });
      window.addEventListener('pointerup', this._onDragEnd, { passive: true });
      window.addEventListener('pointercancel', this._onDragEnd, { passive: true });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibility);
    }
    this.addEventListener?.('mouseenter', this._onEnter, { passive: true });
    this.addEventListener?.('mouseleave', this._onLeave, { passive: true });
    this.addEventListener?.('click', this._onHostClick, { passive: true });
    this.addEventListener?.('keydown', this._onKeyDown, { passive: true });
    this._n.svg?.addEventListener('pointerdown', this._onDragStart, { passive: true });
  }

  /* ─── montaje studio (canvas) ─────────────────────────────── */

  /**
   * Monta el backend canvas (HybridRobotAvatar) en lugar del SVG. El studio
   * gestiona sus propias interacciones (hover/poke/drag/petting/spin/box);
   * el elemento solo conserva actividad (auto-sleep) y visibilidad.
   */
  _mountStudio() {
    const res = mountStudio(this, STYLES);
    // El atributo `hands` puede fijarse ANTES de que exista el backend
    // canvas (el elemento se construye con los atributos ya puestos): se
    // re-aplica al montar para que el motor nace con el modo correcto.
    this._studioHost?.setParam('handsMode', this._handsMode);
    return res;
  }

  /* ─── loop ──────────────────────────────────────────────────── */

  _start() {
    if (this._running) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (typeof requestAnimationFrame !== 'function') return;
    this._running = true;
    this._t0 = performance.now();
    this._lastFrame = 0;
    this._nextBlink = performance.now() + this._randBlinkDelay();
    this._nextWander = performance.now() + 1200;
    this._autoSleep.schedule();
    this._raf = requestAnimationFrame(this._loop);
  }

  _stop() {
    this._running = false;
    this._autoSleep.clear();
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _loop = (now) => {
    if (!this._running) return;
    if (now - this._lastFrame >= FRAME_MS) {
      const dt = Math.min(0.066, (now - this._lastFrame) / 1000);
      this._lastFrame = now;
      this._frame(now, dt || 0.033);
    }
    if (typeof requestAnimationFrame === 'function') this._raf = requestAnimationFrame(this._loop);
  };

  _frame(now, dt) {
    // modo studio: el loop del elemento conduce al motor canvas
    if (this._isStudio()) {
      this._studioHost?.frame(dt);
      return;
    }
    const t = (now - this._t0) / 1000 + this._phase * 10;
    const reduced = this._reducedMotion();

    this._tl.update(); // tweens de cabeza (hx/hy) — coucou anim()
    this._updatePose(now);
    this._updateTint(now);
    this._updateBlink(now);
    this._updateGaze(now, dt, reduced);
    this._applyEyes(now);
    this._applyMovement(t, now, dt, reduced);
    this._updateHeadFollow(dt * 1000, reduced);
    this._updateGlow(now, t, reduced);
    this._updateBadge(now, t);
    this._updateParticles(dt);
    this._updateAmbient(now);
    this._updateBored(now, reduced);
    this._updateDwell(now);
    this._badgeTracked.update(now);
    this._applyBadgeTransform();
    this._updateFx(now);
    runDraw(this, now);
  }

  /* ─── pose ──────────────────────────────────────────────────── */

  _updatePose(now) {
    if (!this._poseFrom) return;
    const k = (now - this._poseStart) / this._poseDur;
    if (k >= 1) {
      this._pose = { ...this._poseTo };
      this._poseFrom = null;
    } else {
      this._pose = lerpPose(this._poseFrom, this._poseTo, Ease.inOutCubic(k));
    }
  }

  _gotoPose(name, { immediate = false } = {}) {
    const target = POSES[name] ? name : 'idle';
    if (immediate) {
      this._pose = createPoseState(target);
      this._poseFrom = null;
      this._poseName = target;
      return;
    }
    this._poseFrom = { ...this._pose };
    this._poseTo = createPoseState(target);
    this._poseStart = performance.now();
    this._poseDur = morphDuration(this._poseName, target);
    this._poseName = target;
  }

  /* ─── tinte de estado ───────────────────────────────────────── */

  _updateTint(now) {
    if (!this._tintFrom) return;
    const k = clamp((now - this._tintStart) / 380, 0, 1);
    const e = Ease.inOutCubic(k);
    const to = this._tintTo;
    this._tintCur = {
      color: k === 0 ? this._tintFrom.color : lerpHsl(this._tintFrom.color, to.color, e),
      strength: lerp(this._tintFrom.strength, to.strength, e),
    };
    if (k >= 1) this._tintFrom = null;
    this._paintTint();
  }

  _paintTint() {
    const { color, strength } = this._tintCur;
    if (!this._n.tint) return;
    this._n.tint.style.fill = color;
    this._n.tint.setAttribute('opacity', String(strength.toFixed(3)));
    // los párpados son del color de la cabeza: si no se tiñen con ella, el
    // tinte de estado los delata como bandas (la cabeza se tiñe por overlay
    // pero los lids son parte de la silueta — como en ARA, un solo color).
    if (this._n.lids) {
      const lidInk = strength > 0.001 ? lerpHsl(this._palette.ink, color, strength) : this._palette.ink;
      for (const lid of this._n.lids) lid.setAttribute('fill', lidInk);
    }
  }

  /* ─── parpadeo ──────────────────────────────────────────────── */

  _updateBlink(now) {
    const cfg = this._cfgRuntime;
    if (this._blinkStart) {
      const k = (now - this._blinkStart) / 150;
      if (k >= 1) {
        this._blinkStart = 0;
        this._blink = 1;
        this._nextBlink = now + this._randBlinkDelay();
        // 22 % de doble parpadeo (vendor/coucou/mochi/engine.ts:574: setTimeout(blink, 230))
        // la chance la modula el temperamento; el retardo viene de la config
        if (!this._doubleBlinkQueued && Math.random() < this._profile.doubleBlinkChance) {
          this._doubleBlinkQueued = true;
          setTimeout(() => {
            if (this._running) this._blinkStart = performance.now();
          }, cfg.doubleBlinkDelayMs);
        }
        this._doubleBlinkQueued = false;
      } else if (now >= this._blinkStart) {
        this._blink = 1 - 0.94 * Math.sin(k * Math.PI);
      }
    } else if (now >= this._nextBlink && !this._reducedMotion()) {
      this._blinkStart = now;
    }
  }

  _randBlinkDelay() {
    const cfg = this._cfgRuntime;
    // ventana coucou 2.2–5.4 s modulada por el temperamento del genoma y
    // acotada por la config global (BOUNDS)
    const p = this._profile;
    const lo = clamp(p.blinkMin, cfg.blinkMinMs, cfg.blinkMaxMs);
    const hi = clamp(p.blinkMax, cfg.blinkMinMs, cfg.blinkMaxMs);
    return lo + Math.random() * (hi - lo);
  }

  /* ─── mirada ────────────────────────────────────────────────── */

  _updateGaze(now, dt, reduced) {
    const amp = this._profile.wanderAmp;
    const cfgState = this._cfg;

    // muestreo del puntero: solo re-muestrea cuando hubo un movimiento real
    this._samplePointer();

    if (now >= this._nextWander && !reduced) {
      // wander ARA (12–25 px sobre viewBox 240) escalado al amplitud del genoma
      const w = nextWander(Math.random, now);
      const k = amp / 25;
      this._wander = { x: w.x * k, y: w.y * k };
      this._nextWander = w.nextAt;
    }
    let tx = this._wander.x;
    let ty = this._wander.y;

    // pose con mirada forzada (p.ej. thinking ↑der)
    if (this._pose.gaze) {
      tx = this._pose.gaze[0] * amp * 1.6;
      ty = this._pose.gaze[1] * amp * 1.2;
    }
    // escaneo: sin(t·2.6)·0.6 (vendor/coucou/mochi/engine.ts:514-517)
    if (cfgState.scans && !reduced) {
      tx = Math.sin(now / 1000 * 2.6) * amp * 0.85;
      ty = -0.12 * amp;
    }
    // mirada mareada: sin(t·9)·0.25 (vendor/coucou/mochi/engine.ts:519)
    if (cfgState.dizzyGaze && !reduced) {
      tx = Math.sin(now / 1000 * 9) * amp * 0.4;
      ty = Math.cos(now / 1000 * 7) * amp * 0.15;
    }
    // dormido: pitch hacia abajo (vendor/coucou/mochi/engine.ts:518)
    if (this._state === 'sleeping') {
      tx = 0;
      ty = -0.28 * amp;
    }
    // movimiento "orbit" (waiting) — la mirada recorre un óvalo
    if (cfgState.movement === 'orbit' && !reduced) {
      const t = (now - this._t0) / 1000;
      tx += Math.cos(t * 2.2) * amp * 1.4;
      ty += Math.sin(t * 2.2) * amp * 0.7;
    }
    // seguimiento de puntero (ARA CORE:368-383): peso = influencia^1.6 · ganancia
    const ptrActive = this._pointerFollow && pointerInRange(this._ptr, now);
    if (ptrActive && !reduced) {
      const w = Math.pow(this._ptr.influence, 1.6) * this._profile.gazeGain;
      tx = lerp(tx, this._ptr.x * 0.34, w);
      ty = lerp(ty, this._ptr.y * 0.30, w);
    }

    // rutina de aburrimiento (ARA actions.js:268-275): pasos de mirada
    if (this._bored) {
      const step = BORED_STEPS[this._bored.index];
      const scale = amp / 18; // los pasos originales están en px sobre viewBox 240
      tx = step.x * scale;
      ty = step.y * scale;
    }

    this._lookTarget = { x: tx, y: ty };
    if (reduced) {
      this._look = { ...this._lookTarget };
    } else {
      // suavizado ARA invariante al framerate: k = 1-(1-speed)^(dt/16.67)
      // la velocidad sube cuando algo "tira" de la mirada (tween de cabeza,
      // impacto jelly, puntero activo o la rutina de aburrimiento)
      let speed = LOOK_SPEED.default;
      if (this._tl.locked('hx') || this._tl.locked('hy')) speed = LOOK_SPEED.locked;
      else if (Math.abs(this._jelly.value) > 0.5) speed = LOOK_SPEED.jelly;
      else if (ptrActive) speed = LOOK_SPEED.pointer;
      else if (this._bored) speed = LOOK_SPEED.bored;
      const ms = dt * 1000;
      this._look.x = smoothLook(this._look.x, tx, speed, ms);
      this._look.y = smoothLook(this._look.y, ty, speed, ms);
    }
  }

  /**
   * Muestrea el puntero respecto al rectángulo del SVG. Solo re-muestrea cuando
   * llegó un movimiento nuevo (el rectángulo se cachea y se refresca al 2 %),
   * así la ventana de frescura de 900 ms de pointer.js significa algo.
   */
  _samplePointer() {
    if (!this._pointer || this._lastPointerMove === this._lastSampledMove) return;
    if (!this._rect || Math.random() < 0.02) {
      const rect = this._n.svg?.getBoundingClientRect?.();
      if (rect && rect.width) this._rect = rect;
    }
    if (!this._rect) return;
    // `lastMove` = instante del movimiento: es lo que pointer.js evalúa contra
    // POINTER_DEFAULTS.freshnessMs (900 ms)
    this._ptr = samplePointer(this._rect, this._pointer, this._lastPointerMove);
    this._lastSampledMove = this._lastPointerMove;
  }

  /**
   * Spring de seguimiento de cabeza (ARA CORE:955-1043). Con puntero fresco el
   * grupo `.head-follow` persigue la posición; sin él asienta a neutro.
   * @param {number} dtMs milisegundos desde el último frame
   */
  _updateHeadFollow(dtMs, reduced) {
    const el = this._n.headFollow || this._headFollowEl;
    if (!el) return;
    const canFollow =
      !reduced && this._pointerFollow && !this._dragging && pointerInRange(this._ptr, performance.now());
    const source = reduced ? { x: 0, y: 0 } : canFollow ? this._ptr : this._look;
    const s = stepHeadFollow(this._headFollow, source, canFollow, dtMs);
    // centro de rotación (120,120): el de la plantilla ARA (core.js:995)
    el.setAttribute(
      'transform',
      `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) ` +
        `translate(120 120) rotate(${s.rot.toFixed(2)}) translate(-120 -120)`
    );
  }

  /** Dwell de hover: 1900 ms sostenidos → emote `love` (no interrumpe acciones). */
  _updateDwell(now) {
    const h = this._hover;
    if (!h || h.dwellFired) return;
    if (this._action || this._state === 'sleeping') return;
    if (now - h.since < DWELL_MS) return;
    h.dwellFired = true;
    void this.play('love', { source: 'dwell' });
  }

  /**
   * Ojos del rig ARA (core.js `_draw`/`setEye`, literal): elipse blanca +
   * párpados por números de pose + compresión de borde + modificadores.
   * Sin modos ni trazos: toda expresión es geometría.
   */
  _applyEyes(now) {
    if (!this._n.eyes || !this._eyeGeo || !this._pose) return;
    const pose = this._pose; // pose numérica interpolada {w,h,topY,…,key,gaze}
    const blink = this._blink; // 1 = abierto
    const geo = this._eyeGeo; // {left, right, y, rx, ry} según genoma
    const gs = geo.rx / ARA_EYE.baseRX; // escala del gen sobre la plantilla
    const look = this._look;
    const jellyY = this._jelly.value;

    // escala extra de los micro-gestos (surpriseLift/happyBlush escriben 'es')
    const es = this._tl.get('es') ?? 1;

    // modificadores puros (runtime/fx-eyes.js) — se auto-limpian
    const mods = this._collectEyeModifiers(now);

    // fx de warning: transform por ojo + apertura de párpado (ARA drawWarning)
    const warnElapsed = this._fx.warning ? now - this._fx.warning.start : -1;

    // ── ojos de amor (ARA love.js): dos óvalos blancos inclinados que se
    // solapan abajo y se leen como UN corazón — override total de la mirada ──
    if (this._fx.love) {
      const heart = loveHeart(now - this._fx.love.start);
      if (heart.done) {
        this._fx.love = null;
      } else {
        const hg = loveHeartGeometry(Math.max(0.02, heart.morph));
        for (const side of ['L', 'R']) {
          const gEl = this._n.eyes[side];
          if (!gEl) continue;
          const base = gEl.querySelector('.eye-base');
          const inputBar = gEl.querySelector('.eye-input');
          const top = gEl.querySelector('.eye-top');
          const bottom = gEl.querySelector('.eye-bottom');
          if (!base || !inputBar || !top || !bottom) continue;
          const e2 = side === 'L' ? hg.left : hg.right;
          base.setAttribute('cx', '0');
          base.setAttribute('cy', hg.cy.toFixed(2));
          base.setAttribute('rx', (hg.rx * heart.scale).toFixed(2));
          base.setAttribute('ry', (hg.ry * heart.scale).toFixed(2));
          base.setAttribute('opacity', '1');
          inputBar.setAttribute('opacity', '0');
          // párpados fuera del camino para no cortar nunca el corazón
          // (love.js:198-206, literal: topY −36→−150, bottomY 36→150)
          const loveTopY = lerp(-36, -150, heart.morph);
          const loveBottomY = lerp(36, 150, heart.morph);
          top.setAttribute('y', (loveTopY - 90).toFixed(2));
          top.setAttribute('transform', `rotate(0 0 ${loveTopY.toFixed(2)})`);
          bottom.setAttribute('y', loveBottomY.toFixed(2));
          bottom.setAttribute('transform', `rotate(0 0 ${loveBottomY.toFixed(2)})`);
          gEl.setAttribute(
            'transform',
            `translate(${e2.x.toFixed(2)} ${e2.y.toFixed(2)}) rotate(${e2.tilt.toFixed(2)})`
          );
        }
        return;
      }
    }

    const isInput = pose.key === 'input';
    // cursor del modo input: parpadeo de 530 ms (ARA cursorPeriod, core.js:1041)
    const inputOn = isInput ? Math.floor(now / 265) % 2 === 0 : true;

    for (const side of ['L', 'R']) {
      const gEl = this._n.eyes[side];
      if (!gEl) continue;
      const base = gEl.querySelector('.eye-base');
      const inputBar = gEl.querySelector('.eye-input');
      const top = gEl.querySelector('.eye-top');
      const bottom = gEl.querySelector('.eye-bottom');
      if (!base || !inputBar || !top || !bottom) continue;
      const isLeft = side === 'L';

      // wink: un ojo con párpados de sleep, el otro con la pose del emote
      // (ARA no tiene wink: cerrar un ojo es nuestro gesto, con sus números).
      const shut = this._winkSide === side;
      // EMOTES[...].eyes manda sobre la pose mientras dura el emote (clave Pose)
      const ov = !shut && this._emoteEye && POSES[this._emoteEye] ? POSES[this._emoteEye] : null;
      const p = shut ? POSES.sleep : ov || pose;

      // órbita de la espera: cada ojo viaja ±34 px (ARA waiting.js)
      let orbitX = 0;
      let orbitDepth = 1;
      if (mods.orbit) {
        orbitX = (isLeft ? mods.orbit.leftX : mods.orbit.rightX) - CX;
        orbitDepth = (isLeft ? mods.orbit.leftDepth : mods.orbit.rightDepth) * mods.orbit.foreshorten;
      }

      let wfx = null;
      let lidO = 1; // apertura: 1 = párpados en reposo de la pose
      let lidPress = 0; // presión extra hacia abajo (warning, ARA lidShift)
      if (warnElapsed >= 0) {
        wfx = warningEyeTransform(warnElapsed, isLeft ? 'near' : 'far');
        // Estructura literal del warning (fx-eyes.js): lids 0…1 + lidShift en px
        // (actions.js:370-390 — topY = lerp(-36,-8,lids)+lidShift).
        const wl = warningLids(warnElapsed);
        lidO = Math.min(lidO, clamp(wl.lids, 0, 1));
        lidPress = wl.lidShift + (!isLeft ? wl.farDeepLidDrop * 0.3 : 0);
      }
      // apertura combinada: el que más cierra manda (warning · inspección)
      const openness = Math.min(lidO, mods.lid ?? 1);

      // tamaño con parpadeo + modificadores (ARA _draw:1039-1040)
      const blinkH = Math.max(2.6, p.h * blink * mods.sy * mods.sx);
      const yAdjust = (p.h - blinkH) * 0.02;
      const baseW = p.w * mods.sx * es;
      // compresión de borde + apertura de sorpresa (literales setEye)
      const spread = surpriseSpread(p.w);
      const cx0 = (isLeft ? geo.left : geo.right) + (isLeft ? -spread : spread);
      const sq = edgeSqueeze(side, cx0, look.x, baseW, blinkH);
      const rx = Math.max(0.4, (sq.w / 2) * gs * (wfx ? wfx.sx : 1) * orbitDepth);
      const ry = Math.max(0.4, (sq.h / 2) * gs * (wfx ? wfx.sy : 1) * orbitDepth);

      // párpados: la apertura interpola cada borde entre el entrecerrado
      // (±8, aperture ARA) y el reposo de la pose; la presión del warning
      // desplaza ambos hacia abajo (lidShift literal).
      const shutK = clamp(openness, 0, 1);
      const topY = lerp(-8, p.topY, shutK) + lidPress;
      const bottomY = lerp(8, p.bottomY, shutK) + lidPress * 0.95;
      const ta = (isLeft ? p.topAL : p.topAR) * shutK;
      const ba = (isLeft ? p.bottomAL : p.bottomAR) * shutK;

      if (isInput && !shut) {
        // modo input: barra de cursor en el centro, elipse oculta (ARA _draw)
        base.setAttribute('opacity', '0');
        inputBar.setAttribute('x', (-p.w / 2).toFixed(2));
        inputBar.setAttribute('y', (-p.h / 2 + yAdjust).toFixed(2));
        inputBar.setAttribute('width', p.w.toFixed(2));
        inputBar.setAttribute('height', p.h.toFixed(2));
        inputBar.setAttribute('opacity', inputOn ? '1' : '0');
      } else {
        inputBar.setAttribute('opacity', '0');
        base.setAttribute('cx', '0');
        base.setAttribute('cy', yAdjust.toFixed(2));
        base.setAttribute('rx', rx.toFixed(2));
        base.setAttribute('ry', ry.toFixed(2));
        base.setAttribute('opacity', '1');
      }
      top.setAttribute('y', (topY - 90).toFixed(2));
      top.setAttribute('height', '90');
      top.setAttribute('transform', `rotate(${ta.toFixed(2)} 0 ${topY.toFixed(2)})`);
      bottom.setAttribute('y', bottomY.toFixed(2));
      bottom.setAttribute('height', '90');
      bottom.setAttribute('transform', `rotate(${ba.toFixed(2)} 0 ${bottomY.toFixed(2)})`);

      const inward = sq.inwardShift * gs;
      const ex = isInput && !shut
        ? CX
        : cx0 + look.x + inward + orbitX + (wfx ? wfx.dx : 0);
      const ey = geo.y + look.y + jellyY + mods.dy + (wfx ? wfx.dy : 0);
      const rot = wfx ? wfx.rot : 0;
      gEl.setAttribute(
        'transform',
        `translate(${ex.toFixed(2)} ${ey.toFixed(2)}) rotate(${rot.toFixed(2)})`
      );
    }
  }

  /**
   * Acumula los modificadores puros de ojos para ESTE frame y limpia los que
   * ya terminaron (envoltorio estándar de runtime/fx-eyes.js: los dx/dy se
   * suman, los sx/sy se multiplican, el lid mínimo manda).
   * Devuelve { dx, dy, sx, sy, lid, orbit } — orbit es el struct de
   * waitingOrbit o null (por ojo, se aplica en el loop).
   */
  _collectEyeModifiers(now) {
    const mods = { dx: 0, dy: 0, sx: 1, sy: 1, lid: 1, orbit: null };

    const nod = this._fx.nod;
    if (nod) {
      const r = nodModifier(now - nod.start);
      if (r.done) this._fx.nod = null;
      else {
        mods.dy += r.dy;
        mods.sy *= r.sy;
      }
    }

    const drop = this._fx.angryDrop;
    if (drop) {
      const r = angryDropModifier(now - drop.start);
      if (r.done) this._fx.angryDrop = null;
      else mods.dy += r.dy;
    }

    const bob = this._fx.eyeBob;
    if (bob) {
      const r = eyeBobModifier(now - bob.start, bob.kind === 'sad' ? EYE_BOB.sad : EYE_BOB.happy);
      if (r.done) this._fx.eyeBob = null;
      else mods.dy += r.dy;
    }

    const shake = this._fx.surpriseShake;
    if (shake) {
      const r = surpriseShakeModifier(now - shake.start);
      if (r.done) this._fx.surpriseShake = null;
      else {
        mods.sx *= r.sx;
        mods.sy *= r.sy;
      }
    }

    const inspect = this._fx.inspect;
    if (inspect) {
      const r = inspectEye(now - inspect.start, INSPECT_PHASES);
      if (r.done) {
        this._fx.inspect = null; // la secuencia completa (6560 ms) terminó
      } else {
        mods.lid = Math.min(mods.lid, r.lid);
        mods.dy += r.dy;
      }
    }

    // la órbita solo manda mientras la inspección no esté pilotando la mirada
    if (this._fx.waitingOrbit && !this._fx.inspect) {
      mods.orbit = waitingOrbit(now - this._fx.waitingOrbit.start);
    }

    return mods;
  }

  /* ─── movimiento del cuerpo ─────────────────────────────────── */

  _applyMovement(t, now, dt, reduced) {
    const dyn = this._dyn;
    let ox = 0;
    let oy = 0;
    let tilt = 0; // las poses ARA no inclinan: el tilt viene del movimiento
    let sx = 1;
    let sy = 1;
    let auraScale = 1;

    if (!reduced) {
      const p = this._profile;
      const move = this._emote?.cfg?.movement || this._cfg.movement;
      const bt = 1.4 + p.bounce * 0.25; // velocidad de respiración según temperamento
      switch (move) {
        case 'breathe':
          sy = 1 + Math.sin(t * bt) * p.breathScale;
          sx = 1 - (sy - 1) * 0.65;
          break;
        case 'bounce':
          sy = 1 + Math.sin(t * bt) * p.breathScale;
          sx = 1 - (sy - 1) * 0.65;
          oy = -Math.abs(Math.sin(t * 5.2)) * Math.max(1.6, p.bounce);
          break;
        case 'hop':
          oy = -Math.abs(Math.sin(t * 5.2)) * 5.5;
          sx = 1 + Math.sin(t * 10.4) * 0.02;
          sy = 1 - (sx - 1);
          break;
        case 'sway':
          tilt += Math.sin(t * 1.15) * 4;
          sy = 1 + Math.sin(t * bt) * p.breathScale;
          sx = 1 - (sy - 1) * 0.65;
          break;
        case 'shake':
          ox = Math.sin(t * 31) * 3.4;
          break;
        case 'tilt':
          tilt += 8 + Math.sin(t * 1.3) * 1.2;
          break;
        case 'pulse':
          auraScale = 1 + Math.sin(t * 3.1) * 0.05;
          sy = 1 + Math.sin(t * 3.1) * 0.015;
          sx = 1 - (sy - 1);
          break;
        default:
          break;
      }
      // micro-deriva orgánica siempre presente (vida sin importar el estado)
      ox += Math.sin(t * 0.9) * 0.6;
      oy += Math.cos(t * 0.7 + 1.3) * 0.5;
    }

    // muelle "jelly" de impacto (coucou slot spring: ω₀=2π/0.25, ζ=0.6)
    if (!reduced && (Math.abs(this._jelly.value) > 0.01 || Math.abs(this._jelly.velocity) > 0.5)) {
      this._jelly.step(dt);
      oy += this._jelly.value;
    }

    // micro-gestos que mandan sobre el timeline (micro.js): tilt en radianes →
    // grados, roll en grados. `roll` se pone a 0 al terminar su micro.
    tilt += (this._tl.get('tilt') ?? 0) * (180 / Math.PI);
    const roll = this._tl.get('roll') ?? 0;

    // los tweens de cabeza (hx/hy) mandan sobre sus campos
    this._tl.set('ox', ox);
    this._tl.set('oy', oy);
    this._tl.set('sy', sy);
    this._tl.set('sx', sx);
    const finalOx = this._tl.get('ox') ?? ox;
    const finalOy = this._tl.get('oy') ?? oy;
    const finalSx = this._tl.get('sx') ?? sx;
    const finalSy = this._tl.get('sy') ?? sy;
    const hx = this._tl.get('hx') ?? 0;
    const hy = this._tl.get('hy') ?? 0;
    dyn.ox = finalOx;
    dyn.oy = finalOy;

    if (!this._n.body) {
      dyn.auraScale = auraScale;
      return;
    }
    this._n.body.setAttribute(
      'transform',
      `translate(${(finalOx + hx).toFixed(2)} ${(finalOy + hy).toFixed(2)}) rotate(${(tilt + roll).toFixed(2)} ${CX} ${CY}) ` +
        `translate(${CX} ${CY}) scale(${finalSx.toFixed(4)} ${finalSy.toFixed(4)}) translate(${-CX} ${-CY})`
    );
    dyn.auraScale = auraScale;

    // apéndice: balanceo con retardo (la "masa" sigue al cuerpo)
    if (this._n.appendage && this._n.appendage.childElementCount) {
      const sway = clamp(finalOx * 1.6 + Math.sin(t * 1.7) * 1.6, -9, 9);
      for (const part of this._n.appendage.children) {
        const [ax, ay] = (part.getAttribute('data-anchor') || `${CX} ${CY}`).split(' ').map(Number);
        part.setAttribute('transform', `rotate(${sway.toFixed(2)} ${ax} ${ay})`);
      }
    }
  }

  _updateGlow(now, t, reduced) {
    if (!this._genome || !this._cfg || !this._n.aura) return;
    const target = this._genome.aura * this._cfg.glow;
    this._glowCur = lerp(this._glowCur, target, reduced ? 1 : 0.08);
    let op = this._glowCur;
    if (this._cfg.movement === 'pulse' && !reduced) op *= 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.1));
    this._n.aura.setAttribute('opacity', op.toFixed(3));
    const auraScale = this._dyn.auraScale || 1;
    if (auraScale !== 1) {
      this._n.aura.setAttribute('r', (106 * auraScale).toFixed(1));
    }
  }

  /* ─── insignia ──────────────────────────────────────────────── */

  _updateBadge(now, t) {
    const target = this._cfg.badge;
    if (target !== this._badge) {
      const hadBadge = !!this._badge;
      this._badge = target;
      if (!target) {
        // ocultar: cancela un pop en curso y cierra con curva (sin rebote)
        this._tl.clear('badgeS');
        this._tl.set('badgeS', 0);
        this._applyBadgeContent(null);
        this._badgeTracked.curveTo(0, 0.28);
      } else if (hadBadge) {
        // cambio con insignia visible: encoge 90 ms → intercambia el contenido →
        // vuelve a crecer con `badgePop` (coucou setBadge en dos tiempos)
        const seq = badgePopSequence();
        const from = this._badgeScale();
        this._tl.clear('badgeS');
        this._tl.anim(
          'badgeS',
          [...seq.shrink, [0, BADGE_POP_GAP_MS, Ease.lin]],
          () => {
            this._applyBadgeContent(target);
            startMicro(this._tl, 'badgePop');
          },
          from
        );
        this._badgeTracked.jump(1); // durante el pop manda el timeline, no el muelle
      } else {
        // aparece: el contenido entra de inmediato y el pop crece desde 0
        this._applyBadgeContent(target);
        this._tl.set('badgeS', 0);
        startMicro(this._tl, 'badgePop');
        this._badgeTracked.jump(1);
      }
    }
    if (this._badge === 'dots') {
      this._n.badgeDot?.forEach((d, i) => {
        const ph = (t * 2.4 + i * 0.33) % 1;
        d.setAttribute('opacity', (0.35 + 0.65 * (1 - Math.abs(ph * 2 - 1))).toFixed(2));
      });
    }
  }

  /** Escribe el contenido de la insignia: 'dots' · 'dot' · 'bang' · 'question' · 'warn'. */
  _applyBadgeContent(target) {
    this._n.badgeDots?.setAttribute('visibility', target === 'dots' || target === 'dot' ? 'visible' : 'hidden');
    this._n.badgeDot?.forEach((d, i) => {
      d.setAttribute('visibility', target === 'dot' && i > 0 ? 'hidden' : 'visible');
    });
    this._n.badgeBang?.setAttribute('visibility', target === 'bang' ? 'visible' : 'hidden');
    this._n.badgeQuestion?.setAttribute('visibility', target === 'question' ? 'visible' : 'hidden');
    this._n.badgeWarn?.setAttribute('visibility', target === 'warn' ? 'visible' : 'hidden');
  }

  /** Escala efectiva de la insignia: el timeline manda mientras hay un pop. */
  _badgeScale() {
    return this._tl.locked('badgeS') ? (this._tl.get('badgeS') ?? 0) : this._badgeTracked.value;
  }

  _applyBadgeTransform() {
    if (!this._n.badge) return;
    const s = this._badgeScale();
    this._n.badge.setAttribute('transform', `translate(198 66) scale(${s.toFixed(3)})`);
  }

  /* ─── partículas ────────────────────────────────────────────── */

  _spawnParticles(kind) {
    if (!this._mounted || !this._n.particles || typeof document === 'undefined') return; // sin DOM no hay partículas
    const n = kind === 'heart' ? 5 : 6;
    for (let i = 0; i < n; i++) {
      const kind2 = kind === 'heart' ? (i % 2 ? 'heart' : 'spark') : i % 3 === 0 ? 'star' : 'spark';
      const el = document.createElementNS('http://www.w3.org/2000/svg', kind2 === 'spark' ? 'circle' : 'path');
      const dir = i % 2 ? 1 : -1;
      const x = CX + dir * (18 + Math.random() * 34);
      const y = CY - 30 - Math.random() * 16;
      if (kind2 === 'spark') {
        el.setAttribute('r', String(2 + Math.random() * 2.5));
        el.setAttribute('fill', Math.random() < 0.5 ? this._palette.accent : this._palette.white);
      } else {
        el.setAttribute(
          'd',
          kind2 === 'heart'
            ? 'M0 6 C-6 1 -8 -3 -5 -6 C-2.5 -8.5 -0.5 -6 0 -4 C0.5 -6 2.5 -8.5 5 -6 C8 -3 6 1 0 6 Z'
            : 'M0 -8 Q1.5 -1.5 8 0 Q1.5 1.5 0 8 Q-1.5 1.5 -8 0 Q-1.5 -1.5 0 -8 Z'
        );
        el.setAttribute('fill', kind2 === 'heart' ? 'hsl(352 85% 62%)' : this._palette.accent);
        el.setAttribute('transform', `translate(${x} ${y})`);
      }
      const p = {
        el,
        x,
        y,
        vx: dir * (8 + Math.random() * 26),
        vy: -38 - Math.random() * 34,
        rot: (Math.random() - 0.5) * 60,
        vrot: (Math.random() - 0.5) * 160,
        life: 0,
        max: 1.1 + Math.random() * 0.6,
        s: 0.7 + Math.random() * 0.7,
      };
      if (kind2 !== 'spark') el.setAttribute('transform', `translate(${x} ${y}) scale(${p.s}) rotate(${p.rot})`);
      this._particles.push(p);
      this._n.particles.appendChild(el);
      if (this._particles.length > 18) this._retireParticle(0);
    }
  }

  /** Partícula ambiente: "z" de sueño o gota de sudor (vendor/coucou/mochi/engine.ts:584-588). */
  _spawnAmbientParticle(kind) {
    if (!this._mounted || !this._n.particles || typeof document === 'undefined') return;
    if (!this._palette) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    if (kind === 'z') {
      el.setAttribute('d', 'M-4 -6 H4 L-4 6 H4');
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', this._palette.ink);
      el.setAttribute('stroke-width', '2.2');
      el.setAttribute('stroke-linejoin', 'round');
    } else {
      el.setAttribute('d', 'M0 -7 C3.5 -3 5 0 5 2.5 A5 5 0 1 1 -5 2.5 C-5 0 -3.5 -3 0 -7 Z');
      el.setAttribute('fill', 'hsl(205 85% 65%)');
    }
    const x = kind === 'z' ? CX - 52 : CX + (Math.random() < 0.5 ? -46 : 46);
    const y = kind === 'z' ? CY - 58 : CY - 42;
    el.setAttribute('transform', `translate(${x} ${y})`);
    const p = {
      el,
      x,
      y,
      vx: kind === 'z' ? -6 : (Math.random() - 0.5) * 4,
      vy: kind === 'z' ? -13 : 9,
      rot: 0,
      vrot: 0,
      life: 0,
      max: kind === 'z' ? 2.2 : 1.4,
      s: 0.8 + Math.random() * 0.3,
    };
    this._particles.push(p);
    this._n.particles.appendChild(el);
    if (this._particles.length > 18) this._retireParticle(0);
  }

  /** Emisión ambiente cada 1.3 s (vendor/coucou/mochi/engine.ts:584-588: zz / sweat 50 %). */
  _updateAmbient(now) {
    if (now - this._lastAmbient < this._cfgRuntime.ambientMs) return;
    this._lastAmbient = now;
    if (this._cfg.zz) this._spawnAmbientParticle('z');
    if (this._cfg.sweat && Math.random() < 0.5) this._spawnAmbientParticle('sweat');
    // re-programa la suspensión del AudioContext: play() la cancela, así que
    // si nada suena en 1.5 s el contexto se suspende solo (sound.js idle)
    this._sound.idle();
  }

  _retireParticle(i) {
    const p = this._particles[i];
    if (!p) return;
    p.el.remove();
    this._particles.splice(i, 1);
  }

  _updateParticles(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        this._retireParticle(i);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 62 * dt; // gravedad suave
      p.rot += p.vrot * dt;
      const k = p.life / p.max;
      const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      p.el.setAttribute('opacity', alpha.toFixed(2));
      p.el.setAttribute(
        'transform',
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` +
          (p.el.getAttribute('fill') === 'none' ? ` scale(${p.s})` : ` scale(${p.s}) rotate(${p.rot.toFixed(0)})`)
      );
    }
  }

  /* ─── rutina de aburrimiento ────────────────────────────────── */

  _updateBored(now, reduced) {
    if (reduced || this._action || this._emote || this._state !== 'idle' || this._pointer) {
      this._bored = null;
      return;
    }
    if (!this._bored) {
      const idleFor = now - (this._lastPointerMove || this._t0);
      if (idleFor > this._cfgRuntime.boredAfterMs) {
        this._bored = { index: 0, nextAt: now };
      }
      return;
    }
    if (now >= this._bored.nextAt) {
      const step = BORED_STEPS[this._bored.index];
      this._bored.index += 1;
      if (this._bored.index >= BORED_STEPS.length) {
        this._bored = null; // terminó la rutina; re-evalúa en el próximo frame
      } else {
        this._bored.nextAt = now + step.hold;
      }
    }
  }

  /* ─── fx de acción ──────────────────────────────────────────── */

  _updateFx(now) {
    // barrido de mirada del error (ARA actions.js:281-286): look.x = sweep·30 px
    if (this._fx.errorSweep) {
      const fx = this._fx.errorSweep;
      const t = clamp((now - fx.start) / fx.duration, 0, 1);
      const amp = this._profile.wanderAmp;
      this._look.x = errorEyeSweep(t) * amp * 2.2;
      this._look.y = 0;
      if (t >= 1) this._fx.errorSweep = null;
    }
  }

  _startErrorFx() {
    this._fx.errorSweep = { start: performance.now(), duration: 980 }; // ARA eyeDuration
    this._tl.anim('hx', errorHeadKeys(), () => {
      this._tl.set('hx', 0);
    }, 0);
    startMicro(this._tl, 'errorShake'); // micro-sacudida del cuerpo (ox)
  }

  _startSuccessFx() {
    this._fx.nod = { start: performance.now() }; // parpadeo de asentimiento (ARA)
    this._tl.anim('hy', nodKeys(), () => {
      this._tl.set('hy', 0);
    }, 0);
  }

  _startWarningFx() {
    this._fx.warning = { start: performance.now(), duration: WARNING_PHASES.duration };
    this._tl.anim('hy', warningHeadKeys(WARNING_PHASES), () => {
      this._fx.warning = null;
      this._tl.set('hy', 0);
    }, 0);
  }

  /** Inspección (6560 ms): fases de párpado + escaneo vertical (ARA inspect.js). */
  _startInspectFx() {
    this._fx.inspect = { start: performance.now() };
  }

  /** Acción `roll`: giro completo + chispas (estado `finished`). */
  _startRollFx() {
    this._startRollMicro();
    if (this._mounted) this._spawnParticles('spark');
  }

  /** Saludo: brinco corto con rebote (micro.js `greet`). */
  _startGreetFx() {
    startMicro(this._tl, 'greet');
  }

  /**
   * Giro de cuerpo (micro.js `roll`/`rollDouble`): 360° o 720° y vuelta a 0.
   * Sin este restablecimiento el cuerpo quedaría girado tras el micro.
   */
  _startRollMicro(name = 'roll') {
    startMicro(this._tl, name, () => this._tl.set('roll', 0));
  }

  /** Impulso "jelly" del muelle al impactar (coucou slot spring). */
  _jellyImpact(strength = 26) {
    if (this._reducedMotion()) return;
    this._jelly.configure(this._cfgRuntime.jellyResponse, this._cfgRuntime.jellyDamping);
    this._jelly.target = 0;
    this._jelly.velocity += strength;
  }

  /* ─── estados ───────────────────────────────────────────────── */

  /**
   * Cambia el estado visual del avatar.
   * @param {string} name  ver STATES (states.js)
   * @param {{immediate?: boolean, fromAction?: boolean}} [opts]
   */
  setState(name, opts = {}) {
    assertState(name);
    if (this._isStudio()) return this._setStateStudio(name, opts);
    const previous = this._state;
    if (previous === name && !opts.immediate) return this;
    this._state = name;
    this._cfg = STATES[name];

    // pose
    this._gotoPose(this._cfg.pose, opts);

    // tinte
    const to = {
      color: this._cfg.tint || this._tintCur.color,
      strength: this._cfg.tint ? this._cfg.tintStrength : 0,
    };
    if (opts.immediate) {
      this._tintCur = to;
      this._tintFrom = null;
      this._paintTint();
    } else {
      this._tintFrom = { ...this._tintCur };
      this._tintTo = to;
      this._tintStart = performance.now();
    }

    // impacto jelly al entrar en estados con movimiento fuerte
    if (!opts.immediate && (this._cfg.movement === 'hop' || this._cfg.movement === 'bounce' || name === 'error')) {
      this._jellyImpact();
    }

    // la órbita de la mirada existe solo mientras el estado es `waiting`
    if (name === 'waiting') this._fx.waitingOrbit = { start: performance.now() };
    else this._fx.waitingOrbit = null;

    // reacciones de entrada: solo en transiciones reales (ni al montar ni
    // cuando el cambio lo pidió una acción, que ya lleva su propio fx)
    if (!opts.immediate && !opts.fromAction) this._playEntryReaction(name);

    // sonido del estado (dedup 150 ms: si una acción comparte receta no dobla)
    this._playSound(STATE_SOUND[name]);

    // una acción temporal activa se invalida al cambiar de estado manual
    if (this._action && !opts.fromAction) this._cancelAction('state-change');

    this._noteActivity(false);
    this.dispatchEvent(
      new CustomEvent('state-change', { detail: { state: name, previous }, bubbles: true, composed: true })
    );
    return this;
  }

  /**
   * setState en modo studio: el vocabulario de Ego se traduce al motor
   * canvas (que pone su propio sonido/movimiento); aquí solo quedan
   * contabilidad (acción manual que interrumpe), actividad y el evento.
   */
  _setStateStudio(name, opts = {}) {
    return setStateStudio(this, name, opts);
  }

  /**
   * Reacciones al entrar en un estado (coucou engine/hooks): parpadeo en
   * `question`, giro en `finished`/`dizzy` y brinco de aprobación en `approval`.
   * @param {string} name
   */
  _playEntryReaction(name) {
    switch (name) {
      case 'question':
        this._blinkStart = performance.now(); // un parpadeo inmediato
        break;
      case 'finished':
        this._startRollMicro();
        if (this._mounted) this._spawnParticles('spark');
        break;
      case 'dizzy':
        this._startRollMicro('rollDouble');
        break;
      case 'approval':
        startMicro(this._tl, 'approvalHop');
        break;
      default:
        break;
    }
  }

  _applyStateImmediate(name) {
    if (this._isStudio()) {
      this._state = name;
      this._cfg = STATES[name] || STATES.idle;
      this._studioHost?.applyState(name, { silent: true });
      return;
    }
    this._state = name;
    this._cfg = STATES[name] || STATES.idle;
    this._gotoPose(this._cfg.pose, { immediate: true });
    this._tintCur = {
      color: this._cfg.tint || 'hsl(0 0% 0%)',
      strength: this._cfg.tint ? this._cfg.tintStrength : 0,
    };
    this._tintFrom = null;
    this._paintTint();
    this._glowCur = this._genome.aura * this._cfg.glow;
    this._badge = undefined; // fuerza re-evaluación
    this._updateBadge(performance.now(), 0);
  }

  /* ─── acciones y emotes ─────────────────────────────────────── */

  /**
   * Ejecuta una acción semántica (success/error/waiting/inspect/roll/greet) o
   * un emote transitorio (love/surprised/proud/annoyed/wink/…).
   * @param {string} rawAction
   * @param {{source?: string, duration?: number}} [opts]
   */
  async play(rawAction, opts = {}) {
    const action = ACTION_ALIASES[rawAction] || rawAction;
    const context = { source: opts.source || 'api', action };
    // una acción o emote programático despierta al avatar: si el Cognitive
    // Runtime dispara un hook mientras duerme, la reacción tiene que verse
    this._noteActivity();
    runBeforePlay(action, context);
    // registro de acción (ARA runtime.js beginAction)
    const record = beginAction(this, action, context.source, false, () => this._autoSleep.clear());

    const token = ++this._token;
    this._action = { name: action, token };
    let cancelled = false;
    let result;

    try {
      if (ACTIONS[action]) {
        const spec = ACTIONS[action];
        const prevState = this._state;
        this.setState(spec.state, { fromAction: true });
        // en modo studio el setState ya aplicó estado + sonido del motor;
        // los fx/micros/jelly del bloque son exclusivos del rig SVG
        if (!this._isStudio()) {          switch (action) {
            case 'error':
              this._startErrorFx();
              break;
            case 'success':
              this._startSuccessFx();
              break;
            case 'waiting':
              this._startWarningFx();
              break;
            case 'inspect':
              this._startInspectFx();
              break;
            case 'roll':
              this._startRollFx();
              break;
            case 'greet':
              this._startGreetFx();
              break;
            default:
              break;
          }
          // sonido de la acción: si comparte receta con el estado, el dedup de
          // 150 ms evita que suene dos veces
          this._playSound(ACTION_SOUND[action]);
          this._jellyImpact(action === 'error' ? 40 : 26);
        } else {
          // reacciones propias del motor canvas (el setState ya puso el estado)
          const host = this._studioHost;
          if (action === 'roll') host?.playMicro('roll'); // giro 360° + estrellas
          else if (action === 'greet') host?.playEmote('happy'); // studio 'wave'
          else if (action === 'inspect') host?.playRawState('inspect'); // lupa + láser
        }
        const ok = await this._wait(opts.duration || spec.duration, token);
        if (!ok) cancelled = true;
        else if (this._state === spec.state) this.setState(prevState, { fromAction: true });
        result = { cancelled };
      } else if (EMOTES[action]) {
        result = await this._runEmote(action, token);
      } else if (this._isStudio() && this._studioHost?.playRawState(action)) {
        // estado crudo del studio sin equivalente Ego ('send', 'box', …):
        // se muestra `duration` y se restaura el estado del elemento
        const ok = await this._wait(opts.duration || 2500, token);
        if (!ok) cancelled = true;
        else this._studioHost.restore();
        result = { cancelled };
      } else if (hasExtensionAction(action)) {
        result = await runExtensionAction(this, action);
      } else {
        cancelled = true;
        result = { cancelled, unknown: true };
      }
    } finally {
      if (this._action?.token === token) this._action = null;
      // cierre del registro (ARA finishAction) — emite 'end'/'cancel' y reprograma auto-sleep
      finishAction(this, record, cancelled || result?.cancelled ? 'cancel' : 'end', () => this._autoSleep.schedule());
      runAfterPlay(action, result, context);
    }
    return this;
  }

  async _runEmote(name, token) {
    const cfg = EMOTES[name];
    if (this._isStudio()) return this._runEmoteStudio(name, token, cfg);
    this._emote = { name, cfg };
    this._gotoPose(cfg.pose);
    if (cfg.wink) this._winkSide = Math.random() < 0.5 ? 'L' : 'R';
    if (cfg.particles) this._spawnParticles(cfg.particles);
    // ojos del emote (heart/star/line/open/arc) — el del wink lo resuelve el loop
    if (cfg.eyes && !cfg.wink) this._emoteEye = cfg.eyes;
    if (cfg.micro) startMicro(this._tl, cfg.micro); // micro-gesto del emote
    this._startEmoteFx(name);
    this._playSound(EMOTE_SOUND[name] || cfg.sound);
    this._jellyImpact(18);
    const ok = await this._wait(cfg.duration, token);
    if (!ok) return { cancelled: true };
    this._emote = null;
    this._winkSide = null;
    this._emoteEye = null;
    this._clearEmoteFx();
    this._gotoPose(STATES[this._state].pose);
    return { cancelled: false };
  }

  /**
   * Emote en modo studio: el estado traducido entra al motor canvas y al
   * terminar se restaura el estado del elemento. Sin poses ni timeline SVG.
   */
  async _runEmoteStudio(name, token, cfg) {
    return runEmoteStudio(this, name, token, cfg);
  }

  /** Enciende los modificadores de ojos propios de cada emote. */
  _startEmoteFx(name) {
    const start = performance.now();
    switch (name) {
      case 'love':
        this._fx.love = { start };
        break;
      case 'annoyed':
      case 'angry':
        this._fx.angryDrop = { start };
        break;
      case 'happy':
        this._fx.eyeBob = { start, kind: 'happy' };
        break;
      case 'sad':
        this._fx.eyeBob = { start, kind: 'sad' };
        break;
      case 'surprised':
      case 'surprise':
        this._fx.surpriseShake = { start };
        break;
      default:
        break;
    }
  }

  /** Apaga solo los modificadores que pertenecen a los emotes. */
  _clearEmoteFx() {
    this._fx.love = null;
    this._fx.angryDrop = null;
    this._fx.eyeBob = null;
    this._fx.surpriseShake = null;
  }

  _cancelAction(reason) {
    if (!this._action) return;
    this._token++;
    this._action = null;
    this._emote = null;
    this._winkSide = null;
    this._emoteEye = null;
    clearTimeout(this._slapEyeTimer);
    this._fx.warning = null;
    this._fx.errorSweep = null;
    this._fx.inspect = null;
    this._fx.nod = null;
    this._clearEmoteFx();
    if (this._isStudio()) {
      // el motor canvas no usa timeline/insignia SVG: basta restaurar estado
      this._studioHost?.restore();
    } else {
      // una insignia a media escalera salta a su valor final antes de frenar
      if (this._badge) this._badgeTracked.jump(1);
      this._tl.clearAll();
      // los campos que el timeline dejó a medias vuelven a su neutro
      this._tl.set('roll', 0);
      this._tl.set('tilt', 0);
      this._tl.set('es', 1);
      this._tl.set('badgeS', this._badge ? 1 : 0);
    }
    cancelActiveAction(this);
    for (const e of this._pending) {
      clearTimeout(e.id);
      e.resolve(false);
    }
    this._pending.clear();
    if (!this._isStudio()) this._gotoPose(STATES[this._state].pose);
    void reason;
  }

  /** Promise con timeout registrado; se resuelve(false) al cancelar. */
  _wait(ms, token) {
    return new Promise((resolve) => {
      const entry = {};
      entry.id = setTimeout(() => {
        this._pending.delete(entry);
        resolve(this._token === token && this._action?.token === token);
      }, ms);
      entry.resolve = resolve;
      this._pending.add(entry);
    });
  }

  /* ─── sonido ───────────────────────────────────────────────── */

  /**
   * Reproduce un sonido con dedup de 150 ms: el estado y la acción suelen
   * compartir receta (p.ej. `error`) y no debe sonar dos veces.
   * @param {string} [name] receta de sound.js
   * @returns {boolean} true si realmente intentó reproducirlo
   */
  _playSound(name) {
    if (!name || !this._soundEnabled) return false;
    const now = performance.now();
    if (name === this._lastSound && now - this._lastSoundAt < SOUND_DEDUP_MS) return false;
    this._lastSound = name;
    this._lastSoundAt = now;
    return this._sound.play(name);
  }

  /** Aplica el flag de sonido al motor (invocado desde attributeChanged). */
  _applySoundEnabled(on) {
    this._soundEnabled = Boolean(on);
    this._sound.setEnabled(this._soundEnabled);
    if (this._soundEnabled) this._sound.resume();
    this._studioHost?.setSoundOn(this._soundEnabled);
    return this;
  }

  /**
   * Reproduce una receta de sonido por su nombre (API pública, para demos y
   * extensión). Salta el dedup para que los botones siempre respondan.
   * En modo studio se traduce al sintetizador del motor canvas.
   * @param {string} name nombre de `SOUND_NAMES`
   * @returns {boolean}
   */
  playSound(name) {
    if (this._isStudio()) return this._studioHost ? this._studioHost.playSound(name) : false;
    this._sound.resume();
    return this._sound.play(name);
  }

  /**
   * Dispara una micro-animación por nombre (`MICRO_NAMES`). Es el hook que la
   * demo usa para probarlas una a una; el runtime ya las dispara solo en sus
   * momentos (estado, acción, emote, interacción).
   * En modo studio equivale al giro 360° o a un micro idle del motor.
   * @param {string} name
   * @returns {boolean} false si el nombre no existe o hay movimiento reducido
   */
  playMicro(name) {
    if (!name) return false;
    if (this._reducedMotion()) return false;
    if (this._isStudio()) return this._studioHost ? this._studioHost.playMicro(name) : false;
    return startMicro(this._tl, name);
  }

  /* ─── passthrough al motor studio ─────────────────────────── */

  /**
   * Fija un parámetro del motor canvas (estilo de ojos/boca, accesorio,
   * dimensiones, colores, física). Solo en modo studio.
   * @param {string} key @param {*} value
   * @returns {boolean} false si la clave no existe o no hay host
   */
  setStudioParam(key, value) {
    const host = this._studio();
    return host ? host.setParam(key, value) : false;
  }

  /** Lee un parámetro del motor canvas (pendiente > backend). */
  getStudioParam(key) {
    const host = this._studio();
    return host ? host.getParam(key) : undefined;
  }

  /** Foto de todos los parámetros ajustables del motor canvas. */
  getStudioParams() {
    const host = this._studio();
    return host ? host.getParams() : null;
  }

  /**
   * Aplica un preset fiel del studio ('cx-faithful' | 'coucou-mochi').
   * Re-pinta la identidad visual; el genoma de Ego queda intacto.
   */
  applyStudioPreset(name) {
    const host = this._studio();
    return host ? host.applyPreset(name) : false;
  }

  /**
   * Habla por el motor canvas (boca + burbuja + sonido 'talk').
   * @param {string} text @param {number} [seconds]
   */
  speak(text, seconds) {
    const host = this._studio();
    return host ? host.speak(text, seconds) : false;
  }

  /* ─── palmadas ─────────────────────────────────────────────── */

  /**
   * Click sobre el avatar: 1 palmada → squash; 3 en 1700 ms → `dizzy`.
   * (coucou: slap → squash, 3 slaps → groggy.)
   */
  _onSlap() {
    const now = performance.now();
    this._slapTimes = this._slapTimes.filter((t) => now - t < SLAP_WINDOW_MS);
    this._slapTimes.push(now);

    if (this._slapTimes.length >= 3) {
      this._slapTimes = [];
      this._playSound('dizzy');
      this.setState('dizzy');
      return;
    }

    this._playSound(ACTION_SOUND.slap);
    startMicro(this._tl, 'squash');
    // mirada enfadada 800 ms: el golpe deja al avatar plácidamente aturdido
    // (override de pose ARA — el rig no tiene "líneas", tiene párpados)
    this._emoteEye = 'angry';
    clearTimeout(this._slapEyeTimer);
    this._slapEyeTimer = setTimeout(() => {
      this._emoteEye = null;
    }, SLAP_EYE_MS);
  }

  /* ─── actividad / auto-sleep ────────────────────────────────── */

  _noteActivity(wake = true) {
    this._lastActivity = Date.now();
    if (wake && this._state === 'sleeping') this.setState('idle');
    this._autoSleep.schedule();
  }

  /**
   * Marca actividad del usuario (resetea el auto-sleep; con `wake` despierta
   * si dormía). Alias público de `_noteActivity`.
   */
  noteActivity(wake = true) {
    this._noteActivity(wake);
    return this;
  }

  _reducedMotion() {
    return reducedMotion(this);
  }

  /* ─── API pública ───────────────────────────────────────────── */

  /** Nueva identidad: regenera genoma, paleta y SVG. */
  setSeed(seed) {
    this.setAttribute?.('seed', String(seed));
    if (typeof this.setAttribute !== 'function') {
      this._seed = String(seed);
      return this._remountWithGenome();
    }
    return this;
  }

  /** Genoma actual (solo lectura, congelado). */
  getGenome() {
    return this._genome;
  }

  /**
   * Fija un gen concreto y reconstruye la identidad.
   * @param {string|object} path ruta ('shape.kind') o bien un patch anidado
   * @param {*} [value] valor cuando `path` es una ruta
   */
  setGene(path, value) {
    if (path && typeof path === 'object') return this.patchGenome(path);
    const parts = String(path || '').split('.').filter(Boolean);
    if (!parts.length) return this;
    setPath(this._geneOverrides, parts, value);
    return this._remountWithGenome();
  }

  /** Mezcla profunda de overrides encima del genoma de la semilla. */
  patchGenome(patch) {
    if (!patch || typeof patch !== 'object') return this;
    deepMergeInto(this._geneOverrides, patch);
    return this._remountWithGenome();
  }

  /** Borra todos los overrides: la identidad vuelve a ser la de la semilla. */
  resetGenome() {
    this._geneOverrides = {};
    return this._remountWithGenome();
  }

  /** Regenera el genoma (semilla + overrides) y repinta si ya estaba montado. */
  _remountWithGenome() {
    this._rebuild();
    if (this._mounted) {
      this._mount();
      this._applyStateImmediate(this._state);
      this._studioHost?.syncGenome();
    }
    return this;
  }

  /** Estado actual. */
  getState() {
    return this._state;
  }

  /** FSM de presencia (hidden/compact/home/greet). */
  get presence() {
    return this._presence;
  }

  set presence(v) {
    if (typeof v === 'string') {
      if (this.getAttribute?.('presence') !== v) {
        this.setAttribute?.('presence', v);
      } else if (this._mounted && this._presence) {
        const map = { hidden: 'forceHidden', compact: 'forceCompact', home: 'forceHome', greet: 'launch' };
        this._presence[map[v] || 'forceCompact']?.();
      }
    } else if (v && typeof v === 'object') {
      this._presence = v;
    }
  }

  /** Compatibilidad React 19: getters y setters seguros que delegan en atributos */
  get seed() {
    return this.getAttribute?.('seed') ?? this._seed ?? 'ego';
  }

  set seed(v) {
    if (v != null) {
      this.setAttribute?.('seed', String(v));
    } else {
      this.removeAttribute?.('seed');
    }
  }

  get state() {
    return this.getAttribute?.('state') ?? this._state ?? 'idle';
  }

  set state(v) {
    if (v != null) {
      this.setAttribute?.('state', String(v));
    } else {
      this.removeAttribute?.('state');
    }
  }

  get size() {
    return this.getAttribute?.('size') ?? '112';
  }

  set size(v) {
    if (v != null) {
      this.setAttribute?.('size', String(v));
    } else {
      this.removeAttribute?.('size');
    }
  }

  get mode() {
    return this.getAttribute?.('mode') ?? (this._isStudio() ? 'studio' : 'svg');
  }

  set mode(v) {
    if (v != null) {
      this.setAttribute?.('mode', String(v));
    } else {
      this.removeAttribute?.('mode');
    }
  }

  get motion() {
    return this.getAttribute?.('motion') ?? 'auto';
  }

  set motion(v) {
    if (v != null) {
      this.setAttribute?.('motion', String(v));
    } else {
      this.removeAttribute?.('motion');
    }
  }

  /** Snapshot SVG del estado actual (exportación/miniaturas; '' en modo studio). */
  toSVGString() {
    return serializeSVG(this);
  }

  /* ─── seguimiento de puntero ────────────────────────────────── */

  /**
   * Activa o desactiva el seguimiento de puntero (escribe también el atributo
   * `pointer-follow`, que es la fuente de verdad).
   * @param {boolean} on
   * @returns {boolean} estado resultante
   */
  setPointerFollow(on) {
    this._pointerFollow = Boolean(on);
    this.setAttribute?.('pointer-follow', this._pointerFollow ? '' : 'false');
    this._studioHost?.setPointerFollow(this._pointerFollow);
    return this._pointerFollow;
  }

  /** ¿Está activo el seguimiento de puntero? */
  isPointerFollow() {
    return this._pointerFollow;
  }

  /* ─── sonido ───────────────────────────────────────────────── */

  /**
   * Silencia el avatar. `mute()` silencia, `mute(false)` reactiva.
   * @param {boolean} [on]
   * @returns {EgoAvatar}
   */
  mute(on = true) {
    return this.setSoundEnabled(!on);
  }

  /**
   * Activa o desactiva el sonido procedural (también el atributo `sound`).
   * @param {boolean} on
   * @returns {EgoAvatar}
   */
  setSoundEnabled(on) {
    this._applySoundEnabled(on);
    this.setAttribute?.('sound', this._soundEnabled ? 'true' : 'false');
    return this;
  }

  /** ¿Está silenciado el avatar? */
  isMuted() {
    return !this._soundEnabled;
  }

  /**
   * Volumen global. Rango canónico de sound.js: [0, 0.2].
   * @param {number} v
   * @returns {number} volumen realmente aplicado (ya recortado)
   */
  setSoundVolume(v) {
    return this._sound.setVolume(v);
  }

  /** Volumen global actual. */
  getSoundVolume() {
    return this._sound.getVolume();
  }

  /** Reinicia efectos de extensiones y vuelve al estado idle. */
  reset() {
    this._cancelAction('reset');
    runReset(this);
    this.setState('idle');
    return this;
  }

  /**
   * Mapea un hook del Cognitive Runtime de Ego a su estado visual
   * (vendor/coucou/island/hooks.ts:143-284). `Stop` → finished con auto-retorno a los
   * 5.2 s (hooks.ts:239-246).
   * @param {string} hookName
   * @param {{noAutoReturn?: boolean}} [opts]
   */
  notify(hookName, opts = {}) {
    const s = HOOK_STATE_MAP[hookName];
    if (!s) return this;
    // un hook es actividad del host: despierta al avatar para que se vea
    this._noteActivity();
    const previous = this._state === s ? 'idle' : this._state;
    this.setState(s);
    const autoMs = HOOK_AUTO_RETURN[s];
    if (autoMs && !opts.noAutoReturn) {
      clearTimeout(this._hookReturnTimer);
      this._hookReturnTimer = setTimeout(() => {
        if (this._state === s) this.setState(previous);
      }, autoMs);
    }
    this._noteActivity(false);
    return this;
  }
}

if (typeof window !== 'undefined' && !customElements.get('ego-avatar')) {
  customElements.define('ego-avatar', EgoAvatar);
}
