// studio-element.test.js — <ego-avatar mode="studio"> sin DOM.
// En Node no hay canvas: el host existe pero sin backend; la API de Ego
// (estados, emotes, genes, sonido) debe seguir operativa y degradar a no-op.
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/studio-element.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EgoAvatar } from '../src/index.js';
import {
  STUDIO_TO_EGO_STATE,
  studioSoundFor,
  studioMicroFor,
  applyGenomeToStudio,
  studioStateForEgo,
} from '../src/studio/adapter.js';
import { STATE_NAMES } from '../src/runtime/states.js';
import { STUDIO_SOUND_NAMES } from '../src/studio/sound.js';
import { STUDIO_STATES } from '../src/studio/config.js';

/* ─── atributo y API de modo ─────────────────────────────────────────── */

test('observedAttributes incluye mode', () => {
  assert.ok(EgoAvatar.observedAttributes.includes('mode'));
});

test('getMode por defecto svg; setMode conmuta y sanea', () => {
  const a = new EgoAvatar();
  assert.equal(a.getMode(), 'svg');
  assert.equal(a.setMode('studio'), 'studio');
  assert.equal(a.getMode(), 'studio');
  assert.equal(a.setMode('bogus'), 'svg');
  assert.equal(a.getMode(), 'svg');
});

test('en modo studio sin DOM: estados y emotes no lanzan', async () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  a.setState('working');
  assert.equal(a.getState(), 'working');
  await a.play('success', { duration: 30 });
  assert.equal(a.getState(), 'working', 'la acción restaura al estado previo');
  await a.play('love', { duration: 30 });
  assert.equal(a.getState(), 'working', 'el emote no cambia el estado');
  await a.play('nope');
  assert.equal(a.getState(), 'working', 'desconocida no cambia el estado');
  a._autoSleep.clear(); // sin esto el timer de auto-sleep retiene el proceso
});

test('en modo studio sin backend: sonido/micros degradan a false, SVG a ""', () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  assert.equal(a.playSound('love'), false);
  assert.equal(a.playMicro('squash'), false);
  assert.equal(a.playMicro('nope'), false);
  assert.equal(a.toSVGString(), '');
});

test('setGene en modo studio no lanza y conserva el genoma', () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  a.setGene('shape.roundness', 80);
  assert.equal(a.getGenome().shape.roundness, 80);
});

test('passthrough studio sin backend: params pendientes, preset y speak degradan', () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  assert.equal(a.setStudioParam('eyeStyle', 'anime'), true, 'clave válida se acepta como pendiente');
  assert.equal(a.getStudioParam('eyeStyle'), 'anime', 'el pendiente se lee');
  assert.equal(a.setStudioParam('noExiste', 1), false, 'clave inválida se rechaza');
  assert.equal(a.getStudioParam('noExiste'), undefined);
  const params = a.getStudioParams();
  assert.ok(params && typeof params === 'object', 'foto de params');
  assert.equal(params.eyeStyle, 'anime');
  // D4 (2026-10-19): 'coucou-mochi' ya no es un preset válido; el que se
  // usa para comprobar la aceptación es 'ego-nucleus'.
  assert.equal(a.applyStudioPreset('ego-nucleus'), true, 'preset válido aceptado sin backend');
  assert.equal(a.applyStudioPreset('coucou-mochi'), false, 'preset eliminado rechazado');
  assert.equal(a.applyStudioPreset('nope'), false);
  assert.equal(a.speak('hola'), false, 'sin backend no hay boca');
  a._autoSleep.clear();
});

test('play() acepta estados crudos del studio solo en modo studio', async () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  await a.play('box', { duration: 30 });
  assert.equal(a.getState(), 'idle', 'el _state de Ego no cambia con estados crudos');
  await a.play('send', { duration: 30 });
  assert.equal(a.getState(), 'idle');
  a._autoSleep.clear();
});

test('play() en modo svg rechaza estados crudos como unknown', async () => {
  const a = new EgoAvatar();
  await a.play('box', { duration: 30 });
  assert.equal(a.getState(), 'idle');
  a._autoSleep.clear();
});

test('_adoptExternalState adopta y emite solo si cambia', () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  let events = 0;
  a.addEventListener?.('state-change', () => events++);
  a._adoptExternalState('error');
  assert.equal(a.getState(), 'error');
  a._adoptExternalState('error');
  assert.equal(a.getState(), 'error');
  // sin DOM no hay dispatch real (ElementBase neutro): solo no debe lanzar
  assert.ok(events >= 0);
  a._adoptExternalState('volando');
  assert.equal(a.getState(), 'error', 'estado inválido se ignora');
  a._autoSleep.clear();
});

test('noteActivity es alias público de _noteActivity', () => {
  const a = new EgoAvatar();
  assert.equal(a.noteActivity(false), a, 'encadenable');
  a._autoSleep.clear();
});

/* ─── adaptador inverso y puentes ────────────────────────────────────── */

test('STUDIO_TO_EGO_STATE cubre los 26 estados con destinos válidos', () => {
  const names = new Set(STUDIO_STATES.map((s) => s.name));
  assert.equal(Object.keys(STUDIO_TO_EGO_STATE).length, 26);
  for (const [studio, ego] of Object.entries(STUDIO_TO_EGO_STATE)) {
    assert.ok(names.has(studio), `origen desconocido: ${studio}`);
    assert.ok(STATE_NAMES.includes(ego), `${studio} → ${ego} inválido`);
  }
});

test('studioSoundFor: directo si existe, equivalente si no, default al final', () => {
  assert.equal(studioSoundFor('love'), 'love');
  assert.equal(studioSoundFor('hover'), 'hover');
  assert.equal(studioSoundFor('blip'), 'inspect');
  assert.equal(studioSoundFor('slap'), 'poke');
  assert.equal(studioSoundFor('finish'), 'success');
  assert.equal(studioSoundFor('nope'), 'default');
  assert.equal(studioSoundFor(''), 'default');
  assert.equal(studioSoundFor(null), 'default');
  for (const name of ['love', 'hover', 'inspect', 'poke', 'success', 'default']) {
    assert.ok(STUDIO_SOUND_NAMES.includes(name), `el puente apunta a ${name}`);
  }
});

test('studioMicroFor: roll→spin, resto válido→idle, desconocido→null', () => {
  assert.deepEqual(studioMicroFor('roll'), { spin: 1 });
  assert.deepEqual(studioMicroFor('rollDouble'), { spin: 1 });
  assert.deepEqual(studioMicroFor('squash'), { idle: true });
  assert.deepEqual(studioMicroFor('happyBounce'), { idle: true });
  assert.equal(studioMicroFor('nope'), null);
  assert.equal(studioMicroFor(''), null);
});

test('applyGenomeToStudio asigna identidad y es null-safe', () => {
  assert.equal(applyGenomeToStudio(null, {}, {}), false);
  const studio = {};
  const genome = { shape: { roundness: 80, ratio: 1 }, eyes: { scale: 1.1, spacing: 0.34, yBias: 0 } };
  assert.equal(applyGenomeToStudio(studio, genome, { ink: '#111111', accent: '#dbf59d' }), true);
  assert.equal(studio.bodyColor, '#111111');
  assert.equal(studio.eyeColor, '#dbf59d');
  assert.equal(studio.eyeSpacing, 34);
  assert.ok(studio.squircleN >= 2 && studio.squircleN <= 7.5);
  // ida y vuelta de estados coherente en los casos clave
  assert.equal(studioStateForEgo('sleeping'), 'sleep');
});
