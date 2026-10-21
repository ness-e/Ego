// studio-eyes.test.js — Rig y render de ojos del avatar studio.
// Fuente: repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
//   constructor defaults: líneas 713-766 (visor/ojos/parámetros) + 769-865
//   (mirada, parpadeo, rig ocular) · updateEyeRig: 1531-1751 ·
//   drawEyes/drawCyberVisorBar/drawSingleEye/drawCXArtLabEye: 2565-3028 ·
//   drawInnerVisor: 2476-2563.
// Node-safe: ctx stub que registra llamadas (sin canvas real).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/studio-eyes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateEyeRig } from '../src/studio/rig/eyes.js';
import {
  buildEyeSilhouettePath,
  drawEyes,
  drawSingleEye,
  drawCXArtLabEye,
  drawCyberVisorBar,
  getStateAccentColor,
} from '../src/studio/render/eyes.js';
import { drawInnerVisor } from '../src/studio/render/visor.js';

/** ctx stub: registra cada llamada 2D; gradientes con addColorStop no-op. */
function makeStubCtx(log = []) {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'addColorStop') return () => {};
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args) => {
          log.push(`${String(prop)}(${args.join(',')})`);
          return gradient;
        };
      }
      if (prop in t) return t[prop];
      return (...args) => {
        log.push(`${String(prop)}(${args.length})`);
      };
    },
    set(t, prop, value) {
      t[prop] = value;
      log.push(`set:${String(prop)}`);
      return true;
    },
  });
}

/** Rig ocular por defecto (constructor, líneas 858-865). */
const EYE_RIG_DEFAULTS = {
  w: 26, h: 36, radius: 12,
  topLid: 0, bottomLid: 0, slant: 0,
  happyArch: 0, sadArch: 0,
  offX: 0, offY: 0, rot: 0,
  cross: 0, ring: 0, pupilScale: 1,
};

/** Estado mínimo falso con los defaults del constructor (713-766, 769-865). */
function makeS(over = {}) {
  return {
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
    jellyIntensity: 1.0,
    parallaxIntensity: 1.0,
    liveliness: 1.0,
    headLookX: 0,
    headLookY: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    bodyHoverAmount: 0,
    pettingAmount: 0,
    leftFlinch: 0,
    rightFlinch: 0,
    visorGlowBoost: 0,
    blinkProgress: 0,
    mouthOpen: 0,
    isHoveringLeftHand: false,
    isHoveringRightHand: false,
    state: 'idle',
    stateTimer: 0,
    time: 1.0,
    leftEye: { ...EYE_RIG_DEFAULTS },
    rightEye: { ...EYE_RIG_DEFAULTS },
    ...over,
  };
}

const RIG_KEYS = Object.keys(EYE_RIG_DEFAULTS);

function assertRigFinite(S, where) {
  for (const side of ['leftEye', 'rightEye']) {
    assert.deepEqual(Object.keys(S[side]).sort(), [...RIG_KEYS].sort(), `${where}: ${side} conserva sus claves`);
    for (const k of RIG_KEYS) {
      assert.ok(Number.isFinite(S[side][k]), `${where}: ${side}.${k} finito (${S[side][k]})`);
    }
  }
}

/** Itera el rig hasta converger (speed = dt*16 por paso). */
function converge(S, steps = 200, dt = 0.016) {
  for (let i = 0; i < steps; i++) updateEyeRig(S, dt);
}

test('updateEyeRig no lanza y mantiene el rig finito en 8 estados', () => {
  for (const state of ['idle', 'error', 'love', 'sleep', 'surprise', 'warning', 'input', 'dizzy']) {
    const S = makeS({ state });
    assert.doesNotThrow(() => updateEyeRig(S, 0.016), `updateEyeRig en ${state}`);
    assertRigFinite(S, state);
  }
});

test('updateEyeRig: error converge a cross=1', () => {
  const S = makeS({ state: 'error' });
  converge(S);
  assert.ok(Math.abs(S.leftEye.cross - 1) < 1e-9, `cross L=${S.leftEye.cross}`);
  assert.ok(Math.abs(S.rightEye.cross - 1) < 1e-9, `cross R=${S.rightEye.cross}`);
});

test('updateEyeRig: love fija h=34 (mayor que sleep), sleep reduce h hacia ~10', () => {
  const love = makeS({ state: 'love' });
  converge(love);
  const sleep = makeS({ state: 'sleep' });
  converge(sleep);
  assert.ok(Math.abs(love.leftEye.h - 34) < 0.5, `love h=${love.leftEye.h}`);
  assert.ok(Math.abs(sleep.leftEye.h - 10) < 0.5, `sleep h=${sleep.leftEye.h}`);
  assert.ok(love.leftEye.h > sleep.leftEye.h, 'love h > sleep h');
});

test('updateEyeRig: surprise fija ring≈0.85', () => {
  const S = makeS({ state: 'surprise', stateTimer: 0 });
  converge(S);
  assert.ok(Math.abs(S.leftEye.ring - 0.85) < 1e-9, `ring L=${S.leftEye.ring}`);
  assert.ok(Math.abs(S.rightEye.ring - 0.85) < 1e-9, `ring R=${S.rightEye.ring}`);
});

test('drawEyes/drawSingleEye/drawCXArtLabEye/drawCyberVisorBar/drawInnerVisor no lanzan y registran llamadas', () => {
  // D4 (2026-10-19): 'mochi-sphere' se eliminó del catálogo; 'zen-arc' cubre
  // la misma rama vectorial con un estilo vigente.
  for (const eyeStyle of ['cx-led', 'zen-arc', 'anime', 'pixel', 'terminal', 'heart']) {
    for (const state of ['idle', 'love']) {
      const S = makeS({ eyeStyle, state });
      const log = [];
      const ctx = makeStubCtx(log);
      assert.doesNotThrow(() => drawEyes(ctx, S, 84, 77), `drawEyes ${eyeStyle}/${state}`);
      assert.doesNotThrow(() => drawSingleEye(ctx, S, 0, 0, 1, true, getStateAccentColor(S)), `drawSingleEye L ${eyeStyle}/${state}`);
      assert.doesNotThrow(() => drawSingleEye(ctx, S, 0, 0, 1, false, getStateAccentColor(S)), `drawSingleEye R ${eyeStyle}/${state}`);
      assert.doesNotThrow(() => drawCXArtLabEye(ctx, S, S.leftEye, true, getStateAccentColor(S)), `drawCXArtLabEye ${eyeStyle}/${state}`);
      assert.doesNotThrow(() => drawCyberVisorBar(ctx, S, 0, 0, getStateAccentColor(S)), `drawCyberVisorBar ${eyeStyle}/${state}`);
      assert.doesNotThrow(() => drawInnerVisor(ctx, S, 84, 77), `drawInnerVisor ${eyeStyle}/${state}`);
      assert.ok(log.length > 0, `log con llamadas 2D en ${eyeStyle}/${state}`);
    }
  }
});

test('drawEyes cubre cyber-visor, cyclops y ramas vectoriales (dizzy/cross/arch/sleep)', () => {
  const log = [];
  const ctx = makeStubCtx(log);
  assert.doesNotThrow(() => drawEyes(ctx, makeS({ eyeStyle: 'cyber-visor', state: 'waiting' }), 84, 77));
  assert.doesNotThrow(() => drawEyes(ctx, makeS({ eyeStyle: 'cyclops' }), 84, 77));
  // Las ramas vectoriales (dizzy / cross / arch / sleep) se alcanzan con
  // cualquier estilo que no sea 'cx-led' ni 'terminal'.
  assert.doesNotThrow(() => drawSingleEye(ctx, makeS({ eyeStyle: 'anime', state: 'dizzy' }), 0, 0, 1, true, '#dbf59d'));
  const cross = makeS({ eyeStyle: 'anime' });
  cross.leftEye.cross = 1;
  assert.doesNotThrow(() => drawSingleEye(ctx, cross, 0, 0, 1, true, '#dbf59d'));
  const arch = makeS({ eyeStyle: 'anime' });
  arch.leftEye.happyArch = 0.9;
  assert.doesNotThrow(() => drawSingleEye(ctx, arch, 0, 0, 1, true, '#dbf59d'));
  assert.doesNotThrow(() => drawSingleEye(ctx, makeS({ eyeStyle: 'anime', state: 'sleep', blinkProgress: 0.8 }), 0, 0, 1, true, '#dbf59d'));
  assert.ok(log.length > 0, 'ramas vectoriales registran llamadas 2D');
});

test('buildEyeSilhouettePath emite path sin lanzar (con y sin agujero)', () => {
  for (const includeRingHole of [false, true]) {
    const log = [];
    const ctx = makeStubCtx(log);
    const rig = { ...EYE_RIG_DEFAULTS, topLid: 0.2, slant: 0.3, happyArch: 0.4, ring: 0.85 };
    assert.doesNotThrow(() => buildEyeSilhouettePath(ctx, 26, 36, 12, rig, true, includeRingHole));
    assert.doesNotThrow(() => buildEyeSilhouettePath(ctx, 26, 36, 12, rig, false, includeRingHole));
    for (const name of ['beginPath', 'moveTo', 'quadraticCurveTo', 'closePath']) {
      assert.ok(log.some((e) => e.startsWith(name)), `log incluye ${name} (agujero=${includeRingHole})`);
    }
  }
  const holeLog = [];
  const rig = { ...EYE_RIG_DEFAULTS, ring: 0.85 };
  buildEyeSilhouettePath(makeStubCtx(holeLog), 26, 36, 12, rig, true, true);
  assert.ok(holeLog.some((e) => e.startsWith('ellipse')), 'el agujero surprise usa ellipse');
});
