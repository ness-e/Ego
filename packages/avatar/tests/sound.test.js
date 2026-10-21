// sound.test.js — motor de sonido procedural: cobertura de recetas, mapeos y
// sintetizador con contexto inyectable (sin AudioContext real).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/sound.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOUND_NAMES,
  SOUND_DEFAULT_VOLUME,
  SOUND_VOLUME_BOUNDS,
  SOUND_IDLE_SUSPEND_MS,
  STATE_SOUND,
  EMOTE_SOUND,
  ACTION_SOUND,
  SOUND_RECIPES,
  recipeFor,
  createSoundEngine,
} from '../src/runtime/sound.js';

// ── Dobles ────────────────────────────────────────────────────────────────────

function fakeParam(initial = 0) {
  return {
    value: initial,
    calls: [],
    setValueAtTime(v, t) {
      this.calls.push(['set', v, t]);
      this.value = v;
    },
    linearRampToValueAtTime(v, t) {
      this.calls.push(['lin', v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.calls.push(['exp', v, t]);
    },
  };
}

function fakeContext(state = 'running') {
  const ctx = {
    state,
    currentTime: 0.5,
    destination: { kind: 'destination' },
    calls: [],
    counters: { oscillator: 0, gain: 0, bufferSource: 0, filter: 0, buffer: 0 },
    gains: [],
    resume() {
      ctx.calls.push('resume');
      ctx.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      ctx.calls.push('suspend');
      ctx.state = 'suspended';
      return Promise.resolve();
    },
    close() {
      ctx.calls.push('close');
      ctx.state = 'closed';
      return Promise.resolve();
    },
    createGain() {
      ctx.counters.gain += 1;
      const node = {
        kind: 'gain',
        gain: fakeParam(),
        connect(target) {
          ctx.calls.push(['connect', 'gain', target?.kind ?? 'unknown']);
        },
      };
      ctx.gains.push(node);
      return node;
    },
    createOscillator() {
      ctx.counters.oscillator += 1;
      return {
        kind: 'oscillator',
        type: 'sine',
        frequency: fakeParam(440),
        start(t) {
          ctx.calls.push(['start', t]);
        },
        stop(t) {
          ctx.calls.push(['stop', t]);
        },
        connect(target) {
          ctx.calls.push(['connect', 'oscillator', target?.kind ?? 'unknown']);
        },
      };
    },
    createBiquadFilter() {
      ctx.counters.filter += 1;
      return {
        kind: 'filter',
        type: 'lowpass',
        frequency: fakeParam(350),
        Q: fakeParam(1),
        connect(target) {
          ctx.calls.push(['connect', 'filter', target?.kind ?? 'unknown']);
        },
      };
    },
    createBufferSource() {
      ctx.counters.bufferSource += 1;
      return {
        kind: 'bufferSource',
        buffer: null,
        start(t) {
          ctx.calls.push(['bstart', t]);
        },
        stop(t) {
          ctx.calls.push(['bstop', t]);
        },
        connect(target) {
          ctx.calls.push(['connect', 'bufferSource', target?.kind ?? 'unknown']);
        },
      };
    },
    createBuffer(numberOfChannels, length, sampleRate) {
      ctx.counters.buffer += 1;
      const data = new Float32Array(length);
      return {
        numberOfChannels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData() {
          return data;
        },
      };
    },
  };
  return ctx;
}

function fakeTimers() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    setTimeout(fn, ms) {
      const i = ++id;
      tasks.set(i, { fn, at: now + ms, ms });
      return i;
    },
    clearTimeout(i) {
      tasks.delete(i);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const [i, t] of tasks) {
          if (t.at <= target && (!next || t.at < next.at)) next = { i, t };
        }
        if (!next) break;
        now = next.t.at;
        tasks.delete(next.i);
        next.t.fn();
      }
      now = target;
    },
    get pending() {
      return tasks.size;
    },
    get lastDelay() {
      let last = null;
      for (const t of tasks.values()) last = t.ms;
      return last;
    },
  };
}

// ── Tablas ────────────────────────────────────────────────────────────────────

test('SOUND_NAMES: 28 nombres sin duplicados', () => {
  assert.equal(SOUND_NAMES.length, 28);
  assert.equal(new Set(SOUND_NAMES).size, 28);
});

test('SOUND_RECIPES cubre exactamente los 28 nombres (bidireccional)', () => {
  const recipeKeys = Object.keys(SOUND_RECIPES);
  assert.equal(recipeKeys.length, SOUND_NAMES.length, 'mismo número de recetas que de nombres');
  for (const name of SOUND_NAMES) {
    assert.ok(Object.hasOwn(SOUND_RECIPES, name), `falta receta para '${name}'`);
  }
  for (const key of recipeKeys) {
    assert.ok(SOUND_NAMES.includes(key), `receta '${key}' no está en SOUND_NAMES`);
  }
});

// Validador recursivo: hojas y capas de acorde deben ser sintetizables.
function assertValidRecipe(node, label) {
  if (Array.isArray(node)) {
    assert.ok(node.length > 0, `${label}: acorde vacío`);
    node.forEach((layer, i) => assertValidRecipe(layer, `${label}[${i}]`));
    return;
  }
  assert.equal(typeof node, 'object', `${label}: debe ser objeto o array`);
  assert.ok(['tone', 'noise', 'sweep', 'chord'].includes(node.kind), `${label}: kind inválido '${node.kind}'`);
  if (node.kind === 'chord') {
    assert.ok(Array.isArray(node.layers), `${label}: chord sin layers`);
    node.layers.forEach((layer, i) => assertValidRecipe(layer, `${label}.layers[${i}]`));
    return;
  }
  assert.ok(Number.isFinite(node.dur) && node.dur > 0, `${label}: dur debe ser finita y > 0`);
  assert.ok(typeof node.gain === 'number' && node.gain > 0 && node.gain <= 1, `${label}: gain fuera de (0, 1]`);
  if (node.kind === 'tone' || node.kind === 'sweep') {
    assert.ok(Number.isFinite(node.f0) && node.f0 > 0, `${label}: f0 inválida`);
    if (node.kind === 'sweep') assert.ok(Number.isFinite(node.f1) && node.f1 > 0, `${label}: f1 inválida`);
    assert.ok(['sine', 'square', 'sawtooth', 'triangle'].includes(node.type), `${label}: tipo de onda inválido`);
  }
  if (node.filter) {
    assert.ok(['lowpass', 'highpass', 'bandpass'].includes(node.filter), `${label}: filtro inválido`);
    assert.ok(Number.isFinite(node.filterFreq) && node.filterFreq > 0, `${label}: filterFreq inválida`);
  }
  if (node.delay !== undefined) assert.ok(Number.isFinite(node.delay) && node.delay >= 0, `${label}: delay inválido`);
}

test('toda receta es sintetizable: dur > 0, gain en (0, 1] y kind válido (recursivo)', () => {
  for (const name of SOUND_NAMES) {
    assertValidRecipe(SOUND_RECIPES[name], name);
  }
});

test('los mapas estado/emote/acción solo apuntan a nombres válidos', () => {
  for (const table of [STATE_SOUND, EMOTE_SOUND, ACTION_SOUND]) {
    for (const [key, sound] of Object.entries(table)) {
      assert.ok(SOUND_NAMES.includes(sound), `'${key}' apunta a '${sound}' inexistente`);
    }
  }
});

test('recipeFor: fallback blip con la misma referencia', () => {
  assert.equal(recipeFor('blip'), SOUND_RECIPES.blip);
  assert.equal(recipeFor('nope'), SOUND_RECIPES.blip);
  assert.equal(recipeFor(undefined), SOUND_RECIPES.blip);
  assert.equal(recipeFor('peek'), SOUND_RECIPES.peek);
});

// ── Motor ─────────────────────────────────────────────────────────────────────

test('setVolume recorta a [0, 0.2] y propaga al master', () => {
  const ctx = fakeContext();
  const engine = createSoundEngine({ audioContext: ctx, masterVolume: 0.5 });
  assert.equal(engine.getVolume(), SOUND_VOLUME_BOUNDS[1]);
  assert.equal(engine.setVolume(0.5), SOUND_VOLUME_BOUNDS[1]);
  assert.equal(engine.setVolume(-1), SOUND_VOLUME_BOUNDS[0]);
  assert.equal(engine.setVolume(0.1), 0.1);
  assert.equal(engine.setVolume(Number.NaN), 0.1, 'no finito → se ignora');
  assert.ok(engine.play('blip'));
  // master = primer GainNode creado; su ganancia sigue al volumen actual.
  assert.equal(ctx.gains[0].gain.value, 0.1);
  engine.setVolume(0.2);
  assert.equal(ctx.gains[0].gain.value, 0.2);
});

test('play sintetiza la receta; setEnabled(false) la silencia sin crear nodos', () => {
  const ctx = fakeContext();
  const engine = createSoundEngine({ audioContext: ctx });
  assert.equal(engine.getVolume(), SOUND_DEFAULT_VOLUME);
  assert.equal(engine.isEnabled(), true);

  assert.equal(engine.play('blip'), true);
  assert.equal(ctx.counters.oscillator, 1, 'blip crea un OscillatorNode');
  assert.ok(ctx.calls.some((c) => Array.isArray(c) && c[0] === 'start'), 'el oscilador arranca');
  assert.ok(ctx.calls.some((c) => Array.isArray(c) && c[0] === 'connect' && c[2] === 'filter'), 'blip pasa por su lowpass');

  engine.setEnabled(false);
  assert.equal(engine.isEnabled(), false);
  const before = { ...ctx.counters };
  assert.equal(engine.play('blip'), false);
  assert.deepEqual(ctx.counters, before, 'deshabilitado → ni nodos ni calls nuevas');

  engine.setEnabled(true);
  assert.equal(engine.play('blip'), true);
});

test('play de nombre desconocido devuelve false sin tocar el contexto', () => {
  const ctx = fakeContext();
  const engine = createSoundEngine({ audioContext: ctx });
  const before = { ...ctx.counters };
  assert.equal(engine.play('unknown-name'), false);
  assert.deepEqual(ctx.counters, before);
});

test('un acorde crea una capa por nota, compasada por delay', () => {
  const ctx = fakeContext();
  const engine = createSoundEngine({ audioContext: ctx });
  assert.equal(engine.play('greet'), true); // capas con delay 0 / 0.06 / 0.12
  assert.equal(ctx.counters.oscillator, 3);
  const starts = ctx.calls.filter((c) => Array.isArray(c) && c[0] === 'start').map((c) => c[1]);
  assert.deepEqual(starts, [0.5, 0.56, 0.62], 'cada nota arranca en currentTime + su delay');
});

test('el ruido usa un AudioBufferSourceNode con búfer cacheado', () => {
  const ctx = fakeContext();
  const engine = createSoundEngine({ audioContext: ctx, rand: () => 0.5 });
  assert.equal(engine.play('slap'), true);
  assert.equal(ctx.counters.bufferSource, 1);
  assert.equal(ctx.counters.buffer, 1, 'el búfer de ruido se genera una vez');
  assert.equal(ctx.counters.filter, 1, 'slap pasa por su bandpass');
  assert.equal(engine.play('slap'), true);
  assert.equal(ctx.counters.bufferSource, 2);
  assert.equal(ctx.counters.buffer, 1, 'el segundo slap reutiliza el búfer cacheado');
});

test('play retoma un contexto suspendido', () => {
  const ctx = fakeContext('suspended');
  const engine = createSoundEngine({ audioContext: ctx });
  assert.equal(engine.play('blip'), true);
  assert.ok(ctx.calls.includes('resume'));
  assert.equal(ctx.state, 'running');
});

test('idle() programa la suspensión y la ejecuta tras el delay', () => {
  const ctx = fakeContext();
  const timers = fakeTimers();
  const engine = createSoundEngine({
    audioContext: ctx,
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });
  engine.idle();
  assert.equal(timers.pending, 1);
  assert.equal(timers.lastDelay, SOUND_IDLE_SUSPEND_MS);
  assert.equal(engine.isIdle, true, 'timer pendiente = inactivo');
  timers.advance(SOUND_IDLE_SUSPEND_MS - 1);
  assert.ok(!ctx.calls.includes('suspend'), 'aún no suspende un ms antes');
  timers.advance(1);
  assert.ok(ctx.calls.includes('suspend'), 'el callback dispara suspend()');
  assert.equal(ctx.state, 'suspended');
  assert.equal(timers.pending, 0);
});

test('idle() no programa nada si el contexto no está running', () => {
  const ctx = fakeContext('suspended');
  const timers = fakeTimers();
  const engine = createSoundEngine({
    audioContext: ctx,
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });
  engine.idle();
  assert.equal(timers.pending, 0);
});

test('resume() cancela el timer idle pendiente', () => {
  const ctx = fakeContext();
  const timers = fakeTimers();
  const engine = createSoundEngine({
    audioContext: ctx,
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });
  engine.idle();
  assert.equal(timers.pending, 1);
  engine.resume();
  assert.equal(timers.pending, 0, 'resume limpia el timer');
  assert.ok(ctx.calls.includes('resume'));
  timers.advance(SOUND_IDLE_SUSPEND_MS);
  assert.ok(!ctx.calls.includes('suspend'), 'el timer cancelado ya no suspende');
  assert.equal(engine.isIdle, false);
});

test('play() cancela la suspensión idle programada', () => {
  const ctx = fakeContext();
  const timers = fakeTimers();
  const engine = createSoundEngine({
    audioContext: ctx,
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });
  engine.idle();
  assert.equal(engine.play('tick'), true);
  assert.equal(timers.pending, 0, 'sonar limpia el timer idle');
  timers.advance(SOUND_IDLE_SUSPEND_MS);
  assert.ok(!ctx.calls.includes('suspend'));
});

test('dispose() cierra el contexto y anula el juego', () => {
  const ctx = fakeContext();
  const timers = fakeTimers();
  const engine = createSoundEngine({
    audioContext: ctx,
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });
  engine.idle();
  engine.dispose();
  assert.equal(timers.pending, 0);
  assert.ok(ctx.calls.includes('close'));
  assert.equal(engine.play('blip'), false, 'tras dispose ya no suena');
});

test('sin contexto: todos los métodos son no-op seguros', () => {
  const engine = createSoundEngine();
  assert.equal(engine.context, null);
  assert.equal(engine.isIdle, false);
  assert.equal(engine.play('blip'), false);
  assert.equal(engine.play('unknown-name'), false);
  assert.equal(engine.setVolume(0.5), SOUND_VOLUME_BOUNDS[1], 'el clamp sigue funcionando');
  assert.equal(engine.getVolume(), SOUND_VOLUME_BOUNDS[1]);
  assert.equal(engine.isEnabled(), true);
  engine.setEnabled(false);
  assert.equal(engine.isEnabled(), false);
  engine.idle();
  engine.resume();
  engine.dispose(); // no lanza
  assert.equal(engine.context, null);
});
