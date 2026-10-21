// studio-integration.test.js — el motor completo corre headless en Node con
// un ctx stub: play() → update() → draw() sin DOM ni canvas real.
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/studio-integration.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HybridRobotAvatar } from '../src/studio/avatar.js';
import { SoundSynthesizer } from '../src/studio/sound.js';

function stubCtx() {
  const calls = [];
  return new Proxy(
    { calls },
    {
      get(t, prop) {
        if (prop === 'calls') return t.calls;
        if (prop === 'canvas') return {};
        if (typeof prop !== 'string') return undefined;
        return (...args) => {
          t.calls.push(prop);
          if (prop.startsWith('create')) return { addColorStop() {} };
          if (prop === 'measureText') return { width: 0 };
          if (prop === 'getImageData') return { data: [] };
          return undefined;
        };
      },
      set(t, prop, v) {
        t[prop] = v;
        return true;
      },
    }
  );
}

function stubCanvas() {
  return {
    width: 800,
    height: 600,
    getContext() {
      return stubCtx();
    },
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return { width: 800, height: 600, left: 0, top: 0 };
    },
  };
}

function makeAvatar() {
  const sound = new SoundSynthesizer();
  let played = [];
  const orig = sound.play.bind(sound);
  sound.play = (name) => {
    played.push(name);
    return orig(name);
  };
  const av = new HybridRobotAvatar(stubCanvas(), sound);
  return { av, played: () => played };
}

test('ciclo completo headless: play → update × N → draw sin lanzar', () => {
  const { av } = makeAvatar();
  for (const state of ['idle', 'error', 'love', 'sleep', 'box', 'talk', 'inspect', 'dizzy', 'send', 'wave']) {
    av.play(state, { silent: true });
    assert.equal(av.state, state, `play ${state}`);
    for (let i = 0; i < 30; i++) av.update(0.016);
    av.draw();
  }
});

test('update integra física sin NaN en estados exigentes', () => {
  const { av } = makeAvatar();
  av.play('blocked', { silent: true });
  for (let i = 0; i < 120; i++) av.update(0.016);
  for (const k of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'headLookX', 'eyeLookX', 'mouthOpen', 'spinAngle']) {
    assert.ok(Number.isFinite(av[k]), `${k} = ${av[k]}`);
  }
  assert.ok(Number.isFinite(av.leftEye.w) && Number.isFinite(av.rightEye.h), 'rig ocular finito');
  assert.ok(Number.isFinite(av.leftHand.x) && Number.isFinite(av.rightHand.y), 'rig de manos finito');
});

test('play() dispara sonido salvo silent:true', () => {
  const { av, played } = makeAvatar();
  av.play('error');
  assert.ok(played().includes('error'), 'sonido del estado');
  const n = played().length;
  av.play('idle', { silent: true });
  assert.equal(played().length, n, 'silent suprime sonido');
});

test('presets conmutan variante completa', () => {
  // D4 (2026-10-19): 'coucou-mochi' ya no existe; los presets de identidad
  // de Ego son los que conmutan la variante completa.
  const { av } = makeAvatar();
  av.applyPreset('ego-sentinel');
  assert.equal(av.variantMode, 'cx-faithful');
  assert.equal(av.eyeStyle, 'cyclops');
  assert.equal(av.accessory, 'cx-full-kit');
  assert.equal(av.showVisor, true);
  assert.equal(av.bodyColor, '#1f1218');
  av.applyPreset('cx-faithful');
  assert.equal(av.variantMode, 'cx-faithful');
  assert.equal(av.eyeStyle, 'cx-led');
  assert.equal(av.showVisor, true);
  assert.equal(av.bodyColor, '#1e222d');
});

test('interacciones registrables sin DOM (métodos existen y no lanzan)', () => {
  const { av } = makeAvatar();
  assert.equal(typeof av.attachInteractions, 'function');
  assert.equal(typeof av.startLoop, 'function');
  const stop = av.startLoop();
  assert.equal(typeof stop === 'function' || stop === undefined, true);
  if (typeof stop === 'function') stop();
});
