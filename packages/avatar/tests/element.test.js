// element.test.js — humo del web component <ego-avatar> SIN DOM.
// Node no tiene HTMLElement ni document: el módulo debe poder IMPORTARSE y su
// superficie pública nueva (genoma, seguimiento de puntero, sonido) debe poder
// USARSE sin montar el SVG. Aquí no se renderiza nada — eso lo cubre
// tests/render.test.js con el render estático.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as barrel from '../src/index.js';
import { EgoAvatar, EMOTE_NAMES } from '../src/index.js';
import {
  STATE_SOUND,
  EMOTE_SOUND,
  ACTION_SOUND,
  SOUND_NAMES,
} from '../src/runtime/sound.js';
import { generateGenome } from '../src/core/genome.js';

/* ─── importación en Node ─────────────────────────────────────────────────── */

test('importar el elemento en Node no lanza (HTMLElement ausente)', () => {
  assert.equal(typeof EgoAvatar, 'function');
  // sin `window` el módulo no intenta registrar el custom element
  assert.equal(typeof globalThis.window, 'undefined');
});

/* ─── atributos observados ────────────────────────────────────────────────── */

test('observedAttributes cubre los atributos públicos', () => {
  const observed = EgoAvatar.observedAttributes;
  assert.ok(Array.isArray(observed));
  for (const attr of [
    'seed',
    'state',
    'size',
    'motion',
    'auto-sleep',
    'presence',
    'pointer-follow',
    'sound',
  ]) {
    assert.ok(observed.includes(attr), `falta ${attr}`);
  }
});

/* ─── superficie pública ──────────────────────────────────────────────────── */

test('el prototipo expone la API pública', () => {
  for (const name of [
    // genoma
    'setGene',
    'patchGenome',
    'resetGenome',
    'getGenome',
    // puntero
    'setPointerFollow',
    'isPointerFollow',
    // sonido
    'mute',
    'setSoundEnabled',
    'isMuted',
    'setSoundVolume',
    'getSoundVolume',
    // superficie heredada
    'setSeed',
    'getState',
    'setState',
    'play',
    'notify',
    'reset',
    'toSVGString',
  ]) {
    assert.equal(typeof EgoAvatar.prototype[name], 'function', `falta ${name}`);
  }
});

/* ─── construcción sin DOM ────────────────────────────────────────────────── */

test('new EgoAvatar() no lanza y arranca en idle sin genoma', () => {
  const a = new EgoAvatar();
  assert.equal(a.getState(), 'idle');
  // el genoma se construye al montar o al tocar un gen, no en el constructor
  assert.equal(a.getGenome(), null);
  // sin shadowRoot la instantánea SVG es una cadena vacía, no undefined
  assert.equal(a.toSVGString(), '');
});

/* ─── overrides de genoma ─────────────────────────────────────────────────── */

test('setGene por ruta construye el genoma y lo devuelve congelado', () => {
  const a = new EgoAvatar();
  a.setGene('shape.roundness', 80);
  assert.equal(a.getGenome().shape.roundness, 80);
  assert.equal(Object.isFrozen(a.getGenome()), true);
  assert.equal(Object.isFrozen(a.getGenome().shape), true);
});

test('setGene acepta también un patch anidado', () => {
  const a = new EgoAvatar();
  a.setGene({ eyes: { scale: 1.2 } });
  assert.equal(a.getGenome().eyes.scale, 1.2);
});

test('patchGenome mezcla en profundidad sin pisar los genes vecinos', () => {
  const a = new EgoAvatar();
  a.patchGenome({ aura: 0.5 });
  const ratio = a.getGenome().shape.ratio;
  a.patchGenome({ shape: { roundness: 20 } });
  assert.equal(a.getGenome().shape.roundness, 20);
  assert.equal(a.getGenome().shape.ratio, ratio); // vecino intacto
  assert.equal(a.getGenome().aura, 0.5); // el override anterior sigue
});

test('resetGenome devuelve exactamente el genoma de la semilla', () => {
  const a = new EgoAvatar();
  a.setGene('aura', 0.42);
  assert.equal(a.getGenome().aura, 0.42);
  a.resetGenome();
  assert.deepEqual(a.getGenome(), generateGenome('ego')); // semilla por defecto
});

/* ─── seguimiento de puntero ──────────────────────────────────────────────── */

test('setPointerFollow / isPointerFollow conmutan el estado', () => {
  const a = new EgoAvatar();
  assert.equal(typeof a.isPointerFollow(), 'boolean');
  assert.equal(a.setPointerFollow(true), true);
  assert.equal(a.isPointerFollow(), true);
  assert.equal(a.setPointerFollow(false), false);
  assert.equal(a.isPointerFollow(), false);
});

/* ─── sonido ──────────────────────────────────────────────────────────────── */

test('mute / setSoundEnabled / isMuted conmutan el silencio', () => {
  const a = new EgoAvatar();
  assert.equal(a.isMuted(), false);
  a.mute();
  assert.equal(a.isMuted(), true);
  a.mute(false);
  assert.equal(a.isMuted(), false);
  a.setSoundEnabled(false);
  assert.equal(a.isMuted(), true);
});

test('setSoundVolume recorta al rango canónico [0, 0.2]', () => {
  const a = new EgoAvatar();
  assert.equal(a.setSoundVolume(9), 0.2);
  assert.equal(a.getSoundVolume(), 0.2);
  assert.equal(a.setSoundVolume(-1), 0);
  assert.equal(a.getSoundVolume(), 0);
  assert.equal(a.setSoundVolume(0.12), 0.12);
});

test('el motor de sonido degrada a no-op sin Web Audio', () => {
  const a = new EgoAvatar();
  // sin AudioContext global: play devuelve false y jamás lanza
  assert.equal(a._playSound('blip'), false);
  assert.equal(a._playSound(undefined), false);
  a.mute();
  assert.equal(a._playSound('blip'), false);
});

/* ─── sonidos: una sola fuente ────────────────────────────────────────────── */

test('STATE_SOUND y EMOTE_SOUND salen SOLO de sound.js (misma referencia)', () => {
  assert.equal(barrel.STATE_SOUND, STATE_SOUND);
  assert.equal(barrel.EMOTE_SOUND, EMOTE_SOUND);
  assert.equal(barrel.ACTION_SOUND, ACTION_SOUND);
});

test('toda receta referenciada existe en SOUND_NAMES', () => {
  const used = [
    ...Object.values(STATE_SOUND),
    ...Object.values(EMOTE_SOUND),
    ...Object.values(ACTION_SOUND),
  ];
  for (const name of used) {
    assert.ok(SOUND_NAMES.includes(name), `receta desconocida: ${name}`);
  }
});

test('EMOTE_SOUND cubre los 11 emotes con la receta del emote', () => {
  const { EMOTES } = barrel;
  for (const name of EMOTE_NAMES) {
    assert.ok(EMOTE_SOUND[name], `sin sonido para ${name}`);
    assert.equal(EMOTE_SOUND[name], EMOTES[name].sound);
  }
});

/* ─── barrel: módulos nuevos ──────────────────────────────────────────────── */

test('el barrel publica los módulos nuevos', () => {
  for (const name of [
    // pointer.js
    'POINTER_DEFAULTS',
    'LOOK_SPEED',
    'HEAD_FOLLOW',
    'samplePointer',
    'emptyPointer',
    'pointerInRange',
    'nextWander',
    'smoothLook',
    'createHeadFollow',
    'stepHeadFollow',
    // fx-eyes.js (matemática ocular unificada)
    'EYE_BOB',
    'INSPECT_DURATION',
    'inspectPhases',
    'inspectLidBlend',
    'inspectVerticalShift',
    'inspectEye',
    'nodModifier',
    'loveHeart',
    'loveHeartGeometry',
    'waitingOrbit',
    'warningLids',
    'warningEyeTransform',
    'warningLidFactor',
    'BORED_STEPS',
    // micro.js (+ keys de cabeza ARA)
    'MICRO',
    'microDuration',
    'startMicro',
    'badgePopSequence',
    'BADGE_POP_GAP_MS',
    'errorHeadKeys',
    'nodKeys',
    'warningHeadKeys',
    // sound.js
    'ACTION_SOUND',
    'SOUND_RECIPES',
    'createSoundEngine',
    'recipeFor',
    // cabeza y ojos ARA
    'ARA_HEAD_D',
    'ARA_HEAD',
    'ARA_EYE',
    'eyeGeometry',
    'edgeSqueeze',
    'surpriseSpread',
    'DEFAULT_ROUNDNESS',
    'headRoundness',
    'headPathFor',
    'parseHeadPoints',
    'flattenHeadPoints',
    // poses
    'POSES',
    'POSE_KEYS',
    'createPoseState',
    'lerpPose',
    // estados
    'EMOTE_NAMES',
    'STATE_NAMES',
  ]) {
    assert.ok(name in barrel, `falta en el barrel: ${name}`);
  }
});
