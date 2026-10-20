// emotes.test.js — tabla extendida de emotes: campos, ojos y catálogo de sonidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMOTES, EMOTE_NAMES, STATE_SOUND, EMOTE_SOUND } from '../src/runtime/states.js';

// Catálogo canónico de sonidos (28 nombres).
const SOUNDS = [
  'peek', 'open', 'close', 'hover', 'blip', 'slap', 'annoyed', 'dizzy',
  'greet', 'work', 'finish', 'error', 'approval', 'question', 'approve',
  'gulp', 'tick', 'send', 'love', 'pop', 'proud', 'wink', 'yawn', 'attach',
  'think', 'search', 'rate', 'sleep',
];

// Modos de ojo válidos: claves de pose ARA (poses.js) — el override de un
// emote interpola números, sin modos ni trazos.
import { POSE_NAMES } from '../src/runtime/poses.js';
const EYE_MODES = POSE_NAMES;

test('todo emote tiene pose, duration y eyes (duration > 0)', () => {
  for (const [name, cfg] of Object.entries(EMOTES)) {
    assert.ok(typeof cfg.pose === 'string' && cfg.pose, `${name}: falta pose`);
    assert.ok(typeof cfg.duration === 'number' && cfg.duration > 0, `${name}: duration`);
    assert.ok(typeof cfg.eyes === 'string' && cfg.eyes, `${name}: falta eyes`);
  }
});

test('los ojos de cada emote son poses ARA válidas', () => {
  for (const [name, cfg] of Object.entries(EMOTES)) {
    assert.ok(EYE_MODES.includes(cfg.eyes), `${name}: ojos "${cfg.eyes}"`);
  }
});

test('todo sonido de emote pertenece al catálogo de28', () => {
  assert.equal(SOUNDS.length, 28, 'el catálogo local debe tener28 nombres');
  for (const [name, cfg] of Object.entries(EMOTES)) {
    if (cfg.sound !== undefined) {
      assert.ok(SOUNDS.includes(cfg.sound), `${name}: sonido "${cfg.sound}" fuera del catálogo`);
    }
  }
});

test('STATE_SOUND apunta solo a sonidos del catálogo', () => {
  for (const [state, sound] of Object.entries(STATE_SOUND)) {
    assert.ok(SOUNDS.includes(sound), `${state}: sonido "${sound}" fuera del catálogo`);
  }
});

test('EMOTE_SOUND: espejo de EMOTES.sound (solo emotes con sonido)', () => {
  assert.ok(Object.isFrozen(EMOTE_SOUND));
  for (const [name, cfg] of Object.entries(EMOTES)) {
    if (cfg.sound) assert.equal(EMOTE_SOUND[name], cfg.sound, name);
    else assert.equal(EMOTE_SOUND[name], undefined, name);
  }
});

test('EMOTE_NAMES congelado y cubre los emotes esperados', () => {
  assert.ok(Object.isFrozen(EMOTE_NAMES));
  for (const name of ['love', 'surprised', 'proud', 'annoyed', 'wink', 'yawn', 'happy', 'angry', 'sad']) {
    assert.ok(EMOTE_NAMES.includes(name), `falta el emote "${name}"`);
  }
  assert.deepEqual([...EMOTE_NAMES], Object.keys(EMOTES));
});

test('los5 emotes originales conservan sus campos originales', () => {
  assert.equal(EMOTES.love.particles, 'heart');
  assert.equal(EMOTES.wink.wink, true);
  assert.equal(EMOTES.surprised.movement, 'hop');
  assert.equal(EMOTES.annoyed.movement, 'shake');
  assert.equal(EMOTES.proud.particles, 'star');
  // y sus campos base
  assert.equal(EMOTES.love.duration, 2400);
  assert.equal(EMOTES.surprised.duration, 1100);
  assert.equal(EMOTES.proud.duration, 2200);
  assert.equal(EMOTES.annoyed.duration, 900);
  assert.equal(EMOTES.wink.duration, 700);
});
