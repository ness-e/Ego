// tests/studio-config.test.js — datos declarativos del studio (src/studio/config.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDIO_DEFAULTS,
  STUDIO_PRESETS,
  STUDIO_STATES,
  EYE_STYLE_NAMES,
  MOUTH_STYLE_NAMES,
  ACCESSORY_NAMES,
  STATE_ACCENT,
  accentFor,
} from '../src/studio/config.js';

test('STUDIO_DEFAULTS: valores literales del constructor (html:713-754)', () => {
  assert.equal(STUDIO_DEFAULTS.variantMode, 'cx-faithful');
  assert.equal(STUDIO_DEFAULTS.bodyColor, '#1e222d');
  assert.equal(STUDIO_DEFAULTS.visorColor, '#06080e');
  assert.equal(STUDIO_DEFAULTS.showVisor, true);
  assert.equal(STUDIO_DEFAULTS.showSidePods, true);
  assert.equal(STUDIO_DEFAULTS.eyeColor, '#dbf59d');
  assert.equal(STUDIO_DEFAULTS.autoStateColors, true);
  assert.equal(STUDIO_DEFAULTS.eyeStyle, 'cx-led');
  assert.equal(STUDIO_DEFAULTS.mouthStyle, 'none');
  assert.equal(STUDIO_DEFAULTS.accessory, 'none');
  assert.equal(STUDIO_DEFAULTS.bodyWidthRatio, 1.0);
  assert.equal(STUDIO_DEFAULTS.bodyHeightRatio, 1.0);
  assert.equal(STUDIO_DEFAULTS.globalScale, 1.0);
  assert.equal(STUDIO_DEFAULTS.squircleN, 4.0);
  assert.equal(STUDIO_DEFAULTS.visorCornerRadius, 30);
  assert.equal(STUDIO_DEFAULTS.eyeSpacing, 28);
  assert.equal(STUDIO_DEFAULTS.eyeOffsetY, -2);
  assert.equal(STUDIO_DEFAULTS.eyeGlowBlur, 18);
  assert.equal(STUDIO_DEFAULTS.mouthOffsetY, 24);
  assert.equal(STUDIO_DEFAULTS.handsMode, 'auto');
  assert.equal(STUDIO_DEFAULTS.handScaleConfig, 1.0);
  assert.ok(Object.isFrozen(STUDIO_DEFAULTS), 'congelado');
});

test('STUDIO_PRESETS: valores distintivos de cada variante', () => {
  // D4 (2026-10-19): el preset 'coucou-mochi' se eliminó del catálogo. Este
  // test verifica ahora los presets de identidad de Ego.
  const cx = STUDIO_PRESETS['cx-faithful'];
  assert.equal(cx.bodyColor, '#1e222d');
  assert.equal(cx.eyeStyle, 'cx-led');
  assert.equal(cx.mouthStyle, 'none');
  assert.equal(cx.accessory, 'none');
  assert.equal(cx.squircleN, 4.0);
  assert.equal(cx.play, 'idle');

  const nucleus = STUDIO_PRESETS['ego-nucleus'];
  assert.equal(nucleus.bodyColor, '#141720');
  assert.equal(nucleus.showVisor, true);
  assert.equal(nucleus.showSidePods, true);
  assert.equal(nucleus.eyeColor, '#f59e0b');
  assert.equal(nucleus.autoStateColors, true);
  assert.equal(nucleus.eyeStyle, 'cx-led');
  assert.equal(nucleus.mouthStyle, 'none');
  assert.equal(nucleus.accessory, 'cx-antenna');
  assert.equal(nucleus.squircleN, 4.0);
  assert.equal(nucleus.play, 'idle');

  // Cada preset de Sub-Ego se distingue por color de ojos y accesorio.
  assert.equal(STUDIO_PRESETS['ego-cyber'].eyeColor, '#38bdf8');
  assert.equal(STUDIO_PRESETS['ego-cyber'].eyeStyle, 'cyber-visor');
  assert.equal(STUDIO_PRESETS['ego-cyber'].accessory, 'cyber-goggles');
  assert.equal(STUDIO_PRESETS['ego-sentinel'].eyeColor, '#f43f5e');
  assert.equal(STUDIO_PRESETS['ego-sentinel'].eyeStyle, 'cyclops');
  assert.equal(STUDIO_PRESETS['ego-sentinel'].accessory, 'cx-full-kit');
  assert.equal(STUDIO_PRESETS['ego-architect'].eyeColor, '#10b981');
  assert.equal(STUDIO_PRESETS['ego-architect'].eyeStyle, 'terminal');
  assert.equal(STUDIO_PRESETS['ego-architect'].accessory, 'headphones');

  // Ningún preset conserva la identidad del studio heredado.
  assert.equal(STUDIO_PRESETS['coucou-mochi'], undefined);

  assert.ok(Object.isFrozen(STUDIO_PRESETS), 'congelado');
});

test('STUDIO_STATES: los 22 estados del dock (html:190-257)', () => {
  const names = STUDIO_STATES.map((s) => s.name);
  assert.equal(names.length, 22);
  for (const n of [
    'idle', 'talk', 'bored', 'waiting', 'input', 'send', 'success', 'failure',
    'warning', 'inspect', 'blocked', 'error', 'surprise', 'sleep', 'wake',
    'wave', 'poke', 'dizzy', 'spin', 'box', 'listen', 'love',
  ]) {
    assert.ok(names.includes(n), `falta estado '${n}'`);
  }
  assert.equal(new Set(names).size, 22);
  // Etiquetas visibles literales del dock.
  const byName = Object.fromEntries(STUDIO_STATES.map((s) => [s.name, s.label]));
  assert.equal(byName.wave, 'coucou');
  assert.equal(byName.spin, 'spin 360°');
  assert.equal(byName.box, 'box drop');
});

test('enumeraciones del dock no vacías', () => {
  // D4 (2026-10-19): 'mochi-sphere' y 'mochi-cute' se eliminaron del dock.
  assert.deepEqual([...EYE_STYLE_NAMES], [
    'cx-led', 'cyber-visor', 'pixel', 'anime',
    'cyclops', 'heart', 'zen-arc', 'terminal',
  ]);
  assert.deepEqual([...MOUTH_STYLE_NAMES], [
    'none', 'led-wave', 'cat-kawaii', 'vocoder', 'pixel-mouth',
  ]);
  assert.equal(ACCESSORY_NAMES.length, 16);
  assert.equal(ACCESSORY_NAMES[0], 'none');
  assert.ok(ACCESSORY_NAMES.includes('witch'));
  assert.ok(ACCESSORY_NAMES.includes('santa'));
});

test('accentFor: hex documentado por estado y eyeColor con auto=false (html:2069-2096)', () => {
  const eye = '#dbf59d';
  assert.equal(accentFor('error', eye), '#f43f5e');
  assert.equal(accentFor('blocked', eye), '#f43f5e');
  assert.equal(accentFor('poke', eye), '#f43f5e');
  assert.equal(accentFor('warning', eye), '#f59e0b');
  assert.equal(accentFor('waiting', eye), '#38bdf8');
  assert.equal(accentFor('input', eye), '#38bdf8');
  assert.equal(accentFor('inspect', eye), '#38bdf8');
  assert.equal(accentFor('listen', eye), '#38bdf8');
  assert.equal(accentFor('failure', eye), '#818cf8');
  assert.equal(accentFor('bored', eye), '#818cf8');
  assert.equal(accentFor('love', eye), '#fb7185');
  assert.equal(accentFor('surprise', eye), '#c084fc');
  assert.equal(accentFor('send', eye), '#c084fc');
  assert.equal(accentFor('sleep', eye), '#94a3b8');
  // Rama `default` del original: devuelve eyeColor.
  assert.equal(accentFor('idle', eye), eye);
  assert.equal(accentFor('dizzy', eye), eye);
  // Puerta `!autoStateColors → eyeColor` (html:2070).
  assert.equal(accentFor('error', '#09090b', false), '#09090b');
  assert.equal(accentFor('love', '#09090b', false), '#09090b');
  assert.equal(STATE_ACCENT.DEFAULT, null);
});
