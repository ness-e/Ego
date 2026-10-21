// sound.js — motor de sonido procedural (cero assets: todo se sintetiza con Web Audio).
// Adapted from coucou (MIT), vendor/coucou/core/sound.ts
// El original reproduce 28 WAV; aquí cada sonido es una receta sintetizada, así el
// módulo sigue siendo cero-dependencias y funciona sin red.

/** Los 28 nombres de coucou (sound.ts:6-11, literal). */
export const SOUND_NAMES = Object.freeze([
  'peek', 'open', 'close', 'hover', 'blip', 'slap', 'annoyed', 'dizzy', 'greet',
  'work', 'finish', 'error', 'approval', 'question', 'approve', 'gulp', 'tick',
  'send', 'love', 'pop', 'proud', 'wink', 'yawn', 'attach', 'think', 'search',
  'rate', 'sleep',
]);

/** Volumen por defecto del original (sound.ts:17). */
export const SOUND_DEFAULT_VOLUME = 0.12;

/** Rango del slider del original: [0, 0.2] (sound.ts:79). */
export const SOUND_VOLUME_BOUNDS = Object.freeze([0, 0.2]);

/** La suspensión por inactividad programa su timer con este delay (sound.ts:74). */
export const SOUND_IDLE_SUSPEND_MS = 1500;

/** Estado → sonido (vendor/coucou/mochi/engine.ts:106-110, literal). */
export const STATE_SOUND = Object.freeze({
  working: 'work', thinking: 'think', searching: 'search', approval: 'approval',
  question: 'question', error: 'error', finished: 'finish', ratelimit: 'rate',
  sleeping: 'sleep', dizzy: 'dizzy',
});

/** Emote → sonido (acorde con runtime/states.js EMOTES). */
export const EMOTE_SOUND = Object.freeze({
  love: 'love', surprised: 'pop', proud: 'proud', annoyed: 'annoyed',
  wink: 'wink', yawn: 'yawn', happy: 'blip', angry: 'annoyed',
  sad: 'yawn', surprise: 'pop', cool: 'proud',
});

/** Acción semántica → sonido. */
export const ACTION_SOUND = Object.freeze({
  success: 'finish', error: 'error', waiting: 'tick',
  hover: 'hover', click: 'blip', slap: 'slap', greet: 'greet',
  pop: 'pop', send: 'send', approve: 'approve',
});

// ── Recetas ───────────────────────────────────────────────────────────────────

// Tipos de onda válidos para los OscillatorNode.
const WAVE_TYPES = Object.freeze(['sine', 'square', 'sawtooth', 'triangle']);

// Duración del búfer de ruido blanco generado una sola vez y cacheado.
const NOISE_SECONDS = 0.25;

// Fábricas internas: mantienen la tabla de recetas compacta y homogénea.
// Todas las capas llevan `gain` (0..1) y `dur` (segundos); `delay` compasa capas.
const tone = (type, f0, dur, gain, extra = {}) => ({
  kind: 'tone', type, f0, dur, gain, filter: null, filterFreq: null, q: 1, curve: 'exp', ...extra,
});

const sweep = (type, f0, f1, dur, gain, extra = {}) => ({
  kind: 'sweep', type, f0, f1, dur, gain, filter: null, filterFreq: null, q: 1, curve: 'exp', ...extra,
});

const noise = (dur, gain, extra = {}) => ({
  kind: 'noise', dur, gain, filter: null, filterFreq: null, q: 1, curve: 'exp', ...extra,
});

// Congela la tabla completa (recetas y capas anidadas) — inmutable en runtime.
function deepFreeze(table) {
  for (const value of Object.values(table)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(table);
}

/**
 * Receta sintetizada por sonido. Cada campo:
 *   kind   'tone' | 'noise' | 'sweep' | 'chord'
 *   type   tipo de onda ('sine'|'square'|'sawtooth'|'triangle') — solo 'tone'/'sweep'
 *   f0/f1  frecuencia inicial/final Hz ('sweep' hace glissando f0→f1)
 *   dur    segundos
 *   gain   amplitud 0..1 (se multiplica por el volumen global)
 *   delay  segundos de retardo (para compasar dos golpes)
 *   filter 'lowpass'|'highpass'|'bandpass'|null + filterFreq (corte Hz) + q
 *   curve  'exp'|'lin'  envolvente de amplitud
 * Una receta puede ser un ARRAY de capas (chord / lub-dub).
 */
export const SOUND_RECIPES = deepFreeze({
  // Mirada rápida hacia arriba: glissando corto que sube.
  peek: sweep('sine', 520, 900, 0.09, 0.7),
  // Abrir: subida cálida en triangle.
  open: sweep('triangle', 300, 640, 0.12, 0.65),
  // Cerrar: el mismo camino de open, en reversa.
  close: sweep('triangle', 640, 280, 0.12, 0.6),
  // Hover: nota breve y discreta.
  hover: tone('sine', 880, 0.05, 0.4),
  // Click de interfaz: cuadrada filtrada (blip clásico).
  blip: tone('square', 660, 0.06, 0.55, { filter: 'lowpass', filterFreq: 2200, q: 1 }),
  // Slap: golpe seco = ruido blanco con banda centrada en 1.6 kHz.
  slap: noise(0.1, 0.9, { filter: 'bandpass', filterFreq: 1600, q: 0.8 }),
  // Fastidio: dos cuadradas desafinadas (240 y 210 Hz) — un quejido robótico.
  annoyed: [
    tone('square', 240, 0.16, 0.5, { filter: 'lowpass', filterFreq: 1400, q: 0.8 }),
    tone('square', 210, 0.16, 0.45, { filter: 'lowpass', filterFreq: 1400, q: 0.8, delay: 0.015 }),
  ],
  // Mareo: barrido 400→180 y vuelta a 380 Hz (dos capas encadenadas).
  dizzy: [
    sweep('sine', 400, 180, 0.22, 0.6),
    sweep('sine', 180, 380, 0.23, 0.55, { delay: 0.22 }),
  ],
  // Saludo: acorde mayor (do-mi-sol) escalonado.
  greet: [
    tone('sine', 523, 0.18, 0.55),
    tone('sine', 659, 0.18, 0.5, { delay: 0.06 }),
    tone('sine', 784, 0.18, 0.45, { delay: 0.12 }),
  ],
  // Trabajo: zumbido grave de sierra filtrado (motor en marcha).
  work: tone('sawtooth', 320, 0.12, 0.5, { filter: 'lowpass', filterFreq: 900, q: 0.9 }),
  // Finalización: acorde mayor con tónica alta (do-mi-sol-do') escalonado.
  finish: [
    tone('sine', 523, 0.3, 0.5),
    tone('sine', 659, 0.3, 0.45, { delay: 0.05 }),
    tone('sine', 784, 0.3, 0.4, { delay: 0.1 }),
    tone('sine', 1046, 0.3, 0.4, { delay: 0.15 }),
  ],
  // Error: caída de cuadrada 420→160 Hz (buzzer de fallo).
  error: sweep('square', 420, 160, 0.3, 0.55, { filter: 'lowpass', filterFreq: 1800, q: 0.8 }),
  // Aprobación pendiente: pregunta ascendente sol→si.
  approval: sweep('sine', 392, 587, 0.16, 0.6),
  // Pregunta: sube y baja (¿?) — dos barridos encadenados.
  question: [
    sweep('sine', 440, 660, 0.1, 0.55),
    sweep('sine', 660, 440, 0.1, 0.5, { delay: 0.1 }),
  ],
  // Confirmación: dos notas ascendentes (sol → do').
  approve: [
    tone('sine', 784, 0.08, 0.6),
    tone('sine', 1046, 0.1, 0.55, { delay: 0.07 }),
  ],
  // Traguito: barrido 300→90 Hz con lowpass (el bolo que baja).
  gulp: sweep('sine', 300, 90, 0.22, 0.65, { filter: 'lowpass', filterFreq: 500, q: 0.7 }),
  // Tick de reloj / cuenta regresiva: chasquido agudísimo.
  tick: tone('square', 1200, 0.03, 0.5, { filter: 'highpass', filterFreq: 800, q: 0.7 }),
  // Send: whoosh ascendente 660→1320 Hz.
  send: sweep('sine', 660, 1320, 0.1, 0.6),
  // Love: acorde mi-sol# seguido de un eco suave (lub-dub).
  love: [
    tone('sine', 659, 0.34, 0.5),
    tone('sine', 830, 0.34, 0.45),
    tone('sine', 659, 0.22, 0.25, { delay: 0.16 }),
    tone('sine', 830, 0.22, 0.22, { delay: 0.16 }),
  ],
  // Pop: puff corto que salta 180→720 Hz.
  pop: sweep('sine', 180, 720, 0.07, 0.7),
  // Proud: acorde re-fa#-la escalonado (fanfarria breve).
  proud: [
    tone('sine', 587, 0.26, 0.5),
    tone('sine', 740, 0.26, 0.45, { delay: 0.05 }),
    tone('sine', 932, 0.26, 0.4, { delay: 0.1 }),
  ],
  // Wink: dos chasquidos agudos muy cortos.
  wink: [
    tone('sine', 988, 0.05, 0.5),
    tone('sine', 1318, 0.05, 0.45, { delay: 0.06 }),
  ],
  // Yawn: bostezo largo que cae 380→220 Hz.
  yawn: sweep('sine', 380, 220, 0.5, 0.5),
  // Attach: click de enganche (dos golpes en triangle).
  attach: [
    tone('triangle', 700, 0.05, 0.55),
    tone('triangle', 1050, 0.05, 0.5, { delay: 0.05 }),
  ],
  // Think: "dun…" — dos golpes graves con silencio entre ellos.
  think: [
    tone('sine', 300, 0.09, 0.55),
    tone('sine', 300, 0.09, 0.4, { delay: 0.13 }),
  ],
  // Search: barrido de ida y vuelta 520→760→520 Hz (radar).
  search: [
    sweep('sine', 520, 760, 0.18, 0.5),
    sweep('sine', 760, 520, 0.18, 0.45, { delay: 0.18 }),
  ],
  // Rate limit: alerta grave sostenida (cuadrada filtrada).
  rate: tone('square', 180, 0.28, 0.55, { filter: 'lowpass', filterFreq: 600, q: 0.8 }),
  // Sleep: descenso largo y amortiguado (el avatar se apaga).
  sleep: sweep('sine', 440, 220, 0.6, 0.35, { filter: 'lowpass', filterFreq: 400, q: 0.7 }),
});

/** Receta de un sonido (fallback: 'blip'). */
export function recipeFor(name) {
  if (Object.hasOwn(SOUND_RECIPES, name)) return SOUND_RECIPES[name];
  return SOUND_RECIPES.blip;
}

// ── Motor ────────────────────────────────────────────────────────────────────

/** Clamp de volumen al rango canónico [0, 0.2]. */
function clampVolume(value) {
  const [min, max] = SOUND_VOLUME_BOUNDS;
  const n = Number(value);
  if (!Number.isFinite(n)) return SOUND_DEFAULT_VOLUME;
  return Math.max(min, Math.min(max, n));
}

/** Frecuencia estrictamente positiva (los ramps exponenciales no admited cero). */
function positiveFreq(value, fallback) {
  const f = Number(value);
  return Number.isFinite(f) && f > 0 ? f : fallback;
}

// Envoltorios de AudioParam compatibles con dobles mínimos (sin setValueAtTime).
function paramAt(param, value, time) {
  if (!param) return;
  if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, time);
  else param.value = value;
}

function paramRamp(param, value, time, exponential) {
  if (!param) return;
  const fn = exponential ? param.exponentialRampToValueAtTime : param.linearRampToValueAtTime;
  if (typeof fn === 'function') fn.call(param, value, time);
  else param.value = value;
}

/**
 * Crea el motor de sonido.
 * @param {{audioContext?: object, masterVolume?: number, enabled?: boolean,
 *          idleMs?: number, now?: () => number, setTimeoutFn?: Function,
 *          clearTimeoutFn?: Function, rand?: () => number}} [opts]
 *        `audioContext` inyectable para tests (basta un doble que registre llamadas).
 *        Sin contexto (ni global AudioContext) el motor degrada a no-op: nunca lanza.
 */
export function createSoundEngine(opts = {}) {
  const idleMs = Number.isFinite(opts.idleMs) && opts.idleMs > 0 ? opts.idleMs : SOUND_IDLE_SUSPEND_MS;
  const setTimeoutFn = typeof opts.setTimeoutFn === 'function' ? opts.setTimeoutFn : (fn, ms) => setTimeout(fn, ms);
  const clearTimeoutFn = typeof opts.clearTimeoutFn === 'function' ? opts.clearTimeoutFn : (id) => clearTimeout(id);
  const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;
  const nowFn = typeof opts.now === 'function' ? opts.now : null;

  // El contexto puede venir inyectado o crearse perezosamente en el primer play().
  let ctx = opts.audioContext ?? null;
  let master = null;
  let noiseBuffer = null;
  let idleTimer = null;
  let disposed = false;
  let enabled = opts.enabled !== false;
  const requestedVolume = Number(opts.masterVolume);
  let volume = Number.isFinite(requestedVolume) ? clampVolume(requestedVolume) : SOUND_DEFAULT_VOLUME;

  function resolveContext() {
    if (ctx) return ctx;
    if (disposed) return null;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (typeof Ctor !== 'function') return null;
    try {
      ctx = new Ctor();
    } catch {
      return null; // el navegador puede denegar el contexto (política de autoplay)
    }
    return ctx;
  }

  function contextTime() {
    if (nowFn) {
      const t = Number(nowFn());
      return Number.isFinite(t) && t >= 0 ? t : 0;
    }
    const t = Number(ctx?.currentTime);
    return Number.isFinite(t) ? t : 0;
  }

  // Nodo master: volumen global → destination. Se crea una sola vez.
  function ensureMaster() {
    if (!ctx) return null;
    if (master) return master;
    if (typeof ctx.createGain !== 'function' || !ctx.destination) return null;
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return master;
  }

  // Búfer de ruido blanco generado una vez y cacheado (sin dependencias ni assets).
  function ensureNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    if (typeof ctx.createBuffer !== 'function') return null;
    const rate = Math.max(8000, Number(ctx.sampleRate) || 44100);
    const length = Math.max(1, Math.ceil(rate * NOISE_SECONDS));
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer?.getChannelData?.(0);
    if (!data) return null;
    for (let i = 0; i < length; i += 1) data[i] = rand() * 2 - 1;
    noiseBuffer = buffer;
    return noiseBuffer;
  }

  function clearIdleTimer() {
    if (idleTimer == null) return;
    clearTimeoutFn?.(idleTimer);
    idleTimer = null;
  }

  // Envolvente: ataque lineal corto + caída (exponencial por defecto, 'lin' opcional).
  function applyEnvelope(node, t0, dur, peak, curve) {
    const param = node?.gain;
    const attack = Math.min(0.012, dur * 0.25);
    paramAt(param, 0, t0);
    paramRamp(param, peak, t0 + attack, false);
    if (curve === 'lin') paramRamp(param, 0, t0 + dur, false);
    else paramRamp(param, 0.0001, t0 + dur, true); // exponencial: peak > 0 siempre
  }

  // Inserta un BiquadFilterNode cuando la capa lo pide; devuelve la cabeza de la cadena.
  function insertFilter(layer, node) {
    if (!layer.filter || typeof ctx.createBiquadFilter !== 'function') return node;
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = layer.filter;
    if (filterNode.frequency) filterNode.frequency.value = positiveFreq(layer.filterFreq, 350);
    if (filterNode.Q) filterNode.Q.value = Number.isFinite(Number(layer.q)) ? Number(layer.q) : 1;
    node.connect(filterNode);
    return filterNode;
  }

  function scheduleTone(layer, t0, dur, peak) {
    if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
    const osc = ctx.createOscillator();
    osc.type = WAVE_TYPES.includes(layer.type) ? layer.type : 'sine';
    const f0 = positiveFreq(layer.f0, 440);
    paramAt(osc.frequency, f0, t0);
    if (layer.kind === 'sweep') paramRamp(osc.frequency, positiveFreq(layer.f1, f0), t0 + dur, true);
    const gain = ctx.createGain();
    applyEnvelope(gain, t0, dur, peak, layer.curve);
    insertFilter(layer, osc).connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function scheduleNoise(layer, t0, dur, peak) {
    if (typeof ctx.createBufferSource !== 'function' || typeof ctx.createGain !== 'function') return;
    const buffer = ensureNoiseBuffer();
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    applyEnvelope(gain, t0, dur, peak, layer.curve);
    insertFilter(layer, source).connect(gain);
    gain.connect(master);
    source.start(t0);
    source.stop(t0 + dur);
  }

  // Programa una receta: arrays y chord.expanden en capas; cada capa suma su `delay`.
  function scheduleLayer(layer, t0) {
    if (Array.isArray(layer)) {
      for (const sub of layer) scheduleLayer(sub, t0);
      return;
    }
    if (!layer || typeof layer !== 'object') return;
    if (layer.kind === 'chord') {
      for (const sub of Array.isArray(layer.layers) ? layer.layers : []) scheduleLayer(sub, t0);
      return;
    }
    const dur = Number(layer.dur);
    if (!Number.isFinite(dur) || dur <= 0) return;
    const delay = Number(layer.delay);
    const at = t0 + (Number.isFinite(delay) && delay > 0 ? delay : 0);
    const peak = Math.max(0.0001, Math.min(1, Number(layer.gain) || 0));
    if (layer.kind === 'noise') scheduleNoise(layer, at, dur, peak);
    else if (layer.kind === 'tone' || layer.kind === 'sweep') scheduleTone(layer, at, dur, peak);
  }

  function play(name) {
    if (disposed || !enabled) return false;
    if (!Object.hasOwn(SOUND_RECIPES, name)) return false; // nombre desconocido → sin receta
    if (!resolveContext()) return false; // sin Web Audio → no-op degradado
    if (!ensureMaster()) return false;
    clearIdleTimer(); // sonar cancela la suspensión programada
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        void ctx.resume(); // WebView2 puede entregar el contexto suspendido
      } catch {
        /* el navegador puede rechazar el resume; el próximo intento lo reintentará */
      }
    }
    scheduleLayer(SOUND_RECIPES[name], contextTime());
    return true;
  }

  function setVolume(v) {
    const n = Number(v);
    if (Number.isFinite(n)) {
      volume = clampVolume(n);
      if (master?.gain) master.gain.value = volume;
    }
    return volume;
  }

  function getVolume() {
    return volume;
  }

  function setEnabled(on) {
    enabled = Boolean(on);
  }

  function isEnabled() {
    return enabled;
  }

  // Un AudioContext suspendido consume un hilo de audio inútilmente; el delay
  // cubre la cola de lo último sonado y `play()` lo retoma por su cuenta.
  function idle() {
    if (!ctx || ctx.state !== 'running' || idleTimer != null || typeof setTimeoutFn !== 'function') return;
    idleTimer = setTimeoutFn(() => {
      idleTimer = null;
      try {
        void ctx?.suspend?.();
      } catch {
        /* el contexto pudo cerrarse durante la espera */
      }
    }, idleMs);
  }

  function resume() {
    clearIdleTimer();
    if (!ctx || typeof ctx.resume !== 'function') return;
    try {
      void ctx.resume();
    } catch {
      /* retomar es best-effort */
    }
  }

  function dispose() {
    clearIdleTimer();
    disposed = true;
    master = null;
    noiseBuffer = null;
    if (typeof ctx?.close === 'function') {
      try {
        void ctx.close();
      } catch {
        /* cerrar es best-effort */
      }
    }
  }

  return {
    play,
    setVolume,
    getVolume,
    setEnabled,
    isEnabled,
    idle,
    resume,
    dispose,
    get context() {
      return ctx;
    },
    // Inactivo = timer pendiente o contexto ya suspendido por ese timer.
    get isIdle() {
      return idleTimer != null || ctx?.state === 'suspended';
    },
  };
}
