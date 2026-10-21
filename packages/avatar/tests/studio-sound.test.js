// tests/studio-sound.test.js — sintetizador del studio (src/studio/sound.js).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/studio-sound.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoundSynthesizer, STUDIO_SOUND_NAMES } from '../src/studio/sound.js';

test('STUDIO_SOUND_NAMES: ≥20 entradas incl. hover/highfive/talk/dizzy', () => {
  assert.ok(STUDIO_SOUND_NAMES.length >= 20, `hay ${STUDIO_SOUND_NAMES.length}`);
  for (const n of ['hover', 'highfive', 'talk', 'dizzy', 'default']) {
    assert.ok(STUDIO_SOUND_NAMES.includes(n), `falta '${n}'`);
  }
  assert.equal(new Set(STUDIO_SOUND_NAMES).size, STUDIO_SOUND_NAMES.length);
  assert.ok(Object.isFrozen(STUDIO_SOUND_NAMES), 'congelado');
});

test('SoundSynthesizer se construye en Node sin AudioContext', () => {
  const s = new SoundSynthesizer();
  assert.equal(s.ctx, null);
  assert.equal(s.enabled, true);
});

test('play() sin AudioContext es no-op seguro que devuelve false', () => {
  const s = new SoundSynthesizer();
  assert.equal(s.play('hover'), false);
  assert.equal(s.play('talk'), false);
  assert.equal(s.play('dizzy'), false);
  assert.equal(s.play('cualquier-estado'), false);
});

test('play() respeta enabled=false sin tocar nada', () => {
  const s = new SoundSynthesizer();
  s.enabled = false;
  assert.equal(s.play('hover'), false);
});

test('tone() sin ctx es seguro (no lanza, no hace nada)', () => {
  const s = new SoundSynthesizer();
  assert.doesNotThrow(() => {
    s.tone(440, 880, 0.1, 0, 'sine', 0.1);
  });
  assert.equal(s.ctx, null);
});

test('init() en Node no lanza y mantiene ctx nulo', () => {
  const s = new SoundSynthesizer();
  assert.doesNotThrow(() => s.init());
  assert.equal(s.ctx, null);
});
