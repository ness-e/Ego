// studio-adapter.test.js — puente Ego → Studio: tablas y genoma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EGO_TO_STUDIO_STATE,
  EGO_TO_STUDIO_EMOTE,
  studioStateForEgo,
  studioEmoteForEgo,
  studioConfigForGenome,
} from '../src/studio/adapter.js';
import { STATE_NAMES } from '../src/runtime/states.js';
import { EMOTE_NAMES } from '../src/runtime/states.js';
import { STUDIO_STATES } from '../src/studio/config.js';

const STUDIO_STATE_NAMES = new Set(STUDIO_STATES.map((s) => s.name));

test('todo estado de Ego mapea a un estado válido del studio', () => {
  for (const name of STATE_NAMES) {
    const mapped = studioStateForEgo(name);
    assert.ok(STUDIO_STATE_NAMES.has(mapped), `${name} → ${mapped} inválido`);
  }
  assert.equal(studioStateForEgo('idle'), 'idle');
  assert.equal(studioStateForEgo('sleeping'), 'sleep');
  assert.equal(studioStateForEgo('nope'), 'idle', 'fallback seguro');
});

test('todo emote de Ego mapea a un estado válido del studio', () => {
  for (const name of EMOTE_NAMES) {
    const mapped = studioEmoteForEgo(name);
    assert.ok(STUDIO_STATE_NAMES.has(mapped), `${name} → ${mapped} inválido`);
  }
  assert.equal(studioEmoteForEgo('love'), 'love');
});

test('genoma → config del studio: rangos y determinismo', () => {
  const genome = {
    shape: { roundness: 80, ratio: 1.0 },
    eyes: { scale: 1.1, spacing: 0.34, yBias: 0 },
  };
  const palette = { ink: '#111111', accent: '#dbf59d' };
  const cfg = studioConfigForGenome(genome, palette);
  assert.equal(cfg.bodyColor, '#111111');
  assert.equal(cfg.eyeColor, '#dbf59d');
  assert.ok(cfg.squircleN >= 2.0 && cfg.squircleN <= 7.5, `squircleN ${cfg.squircleN}`);
  assert.equal(cfg.eyeSpacing, 34);
  // redondeo 0/100 → extremos del slider squircle
  assert.equal(studioConfigForGenome({ shape: { roundness: 0 }, eyes: {} }, {}).squircleN, 2.0);
  assert.equal(studioConfigForGenome({ shape: { roundness: 100 }, eyes: {} }, {}).squircleN, 7.5);
  // sin genoma ni paleta: defaults seguros
  const fallback = studioConfigForGenome(null, null);
  assert.equal(fallback.variantMode, 'cx-faithful');
  assert.ok(Number.isFinite(fallback.squircleN));
});
