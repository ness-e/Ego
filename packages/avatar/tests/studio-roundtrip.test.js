// tests/studio-roundtrip.test.js — contrato del puente Ego <-> studio.
//
// El puente traduce el vocabulario de Ego (15 estados) al del studio (canvas).
// Si la ida y la vuelta no son inversas, un estado que el chat pide puede
// acabar mostrando OTRO: el avatar miente.
//
// Estos tests fijan el invariante: para TODO estado de Ego, el round-trip por
// el puente conserva la identidad, y ninguna imagen de studio la comparten
// dos estados de Ego.
//
// Contexto: el motor `warning` (Ola 2) es 1:1 en las dos direcciones. Los
// estados `thinking`, `approval`, `question` y `ratelimit` NO lo eran: se
// perdían al cruzar el puente.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATE_NAMES } from '../src/runtime/states.js';
import {
  EGO_TO_STUDIO_STATE,
  STUDIO_TO_EGO_STATE,
  EGO_TO_STUDIO_EMOTE,
} from '../src/studio/adapter.js';
import { STUDIO_STATES, STATE_ACCENT } from '../src/studio/config.js';
import { drawStateOverlays } from '../src/studio/render/overlays.js';

const STUDIO_NAMES = STUDIO_STATES.map((s) => s.name);

/**
 * Contexto de canvas que REGISTRA todas las operaciones: la "imagen" de un
 * estado es su traza de dibujo. Determinista al 100 % (sin reloj real).
 */
function recordingCtx(log) {
  const grad = { addColorStop() {} };
  const rec = (name) => (...args) => { log.push(`${name}(${args.map(fmt).join(',')})`); };
  const state = (name) => (...args) => { log.push(`${name}=${args.map(fmt).join(',')}`); };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
    lineJoin: 'miter', shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
    globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
  };
  for (const n of ['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke', 'clip']) ctx[n] = rec(n);
  for (const n of ['translate', 'scale', 'rotate', 'setTransform']) ctx[n] = state(n);
  for (const n of ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'rect', 'fillRect', 'strokeRect', 'arcTo', 'fillText']) {
    ctx[n] = rec(n);
  }
  ctx.createLinearGradient = (...a) => { log.push(`createLinearGradient(${a.map(fmt).join(',')})`); return grad; };
  ctx.createRadialGradient = (...a) => { log.push(`createRadialGradient(${a.map(fmt).join(',')})`); return grad; };
  return ctx;
}

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Traza de dibujo del overlay de un estado de studio. */
function overlayTrace(studio) {
  const S = {
    state: studio,
    time: 0.5,
    autoStateColors: true,
    eyeColor: '#dbf59d',
    eyeLookX: 0,
    eyeLookY: 0,
    eyeOffsetY: 0,
    eyeSpacing: 28,
    eyeWidthRatio: 1,
    handVisibility: 0,
    leftHand: { x: 0, y: 0 },
    rightHand: { x: 0, y: 0 },
  };
  const log = [];
  drawStateOverlays(recordingCtx(log), S, 84, 77.28);
  return log.join('\n');
}

test('el round-trip Ego -> studio -> Ego conserva la identidad de todos los estados', () => {
  for (const ego of STATE_NAMES) {
    const studio = EGO_TO_STUDIO_STATE[ego];
    assert.ok(studio, `${ego} no tiene estado de studio asignado`);
    assert.ok(STUDIO_NAMES.includes(studio), `${ego} -> '${studio}': ese estado no existe en el studio`);
    const back = STUDIO_TO_EGO_STATE[studio];
    assert.equal(back, ego, `${ego} -> studio '${studio}' -> Ego '${back}': se pierde la identidad`);
  }
});

test('ningún estado de studio lo reclaman dos estados de Ego', () => {
  // Si dos estados de Ego comparten imagen de studio, el dock no puede
  // distinguirlos y el round-trip es multiple: uno de los dos se pierde.
  const owners = new Map();
  for (const [ego, studio] of Object.entries(EGO_TO_STUDIO_STATE)) {
    if (!owners.has(studio)) owners.set(studio, []);
    owners.get(studio).push(ego);
  }
  const shared = [...owners.entries()].filter(([, egos]) => egos.length > 1);
  assert.deepEqual(shared, [], `imagenes de studio compartidas: ${JSON.stringify(shared)}`);
});

test('el puente es total en ambas direcciones para los estados de Ego', () => {
  // Todo estado de studio debe devolver un estado de Ego que exista.
  for (const studio of STUDIO_NAMES) {
    const ego = STUDIO_TO_EGO_STATE[studio];
    assert.ok(ego, `el estado de studio '${studio}' no tiene inverso`);
    assert.ok(STATE_NAMES.includes(ego), `studio '${studio}' -> Ego '${ego}': estado inexistente`);
  }
});

test('ningún mapa del puente nombra un estado de studio inexistente', () => {
  // El patrón de bug: el mapa directo y el catálogo de estados se
  // desincronizan y el motor cae a un `default`, perdiendo el estado en
  // silencio. Se comprueban TODOS los mapas que nombran estados de studio,
  // no solo el de estados.
  for (const [ego, studio] of Object.entries(EGO_TO_STUDIO_STATE)) {
    assert.ok(STUDIO_NAMES.includes(studio),
      `EGO_TO_STUDIO_STATE.${ego} -> '${studio}': ese estado no existe en STUDIO_STATES`);
  }
  for (const [emote, studio] of Object.entries(EGO_TO_STUDIO_EMOTE)) {
    assert.ok(STUDIO_NAMES.includes(studio),
      `EGO_TO_STUDIO_EMOTE.${emote} -> '${studio}': ese estado no existe en STUDIO_STATES`);
  }
});

test('ningún estado de studio con dueño de Ego comparte IMAGEN con otro', () => {
  // El color no basta: waiting, input, inspect y listen son todos cian. Lo
  // que los distingue es la IMAGEN (el overlay). Por tanto, dos estados CON
  // dueño de Ego no pueden dibujar exactamente lo mismo.
  // Los estados sin overlay (idle, success, wake) se distinguen por el cuerpo
  // y por el sonido: son la línea base del studio, no una imagen compartida.
  const owners = new Set(Object.values(EGO_TO_STUDIO_STATE));
  const traces = new Map();
  for (const studio of owners) {
    const trace = overlayTrace(studio);
    if (!trace) continue; // sin overlay: se distingue por el cuerpo
    const prev = traces.get(trace);
    assert.equal(prev, undefined,
      `los estados de studio '${prev}' y '${studio}' dibujan EXACTAMENTE lo mismo`);
    traces.set(trace, studio);
  }
});

test('los estados de studio con dueño de Ego tienen color propio o imagen propia', () => {
  // Salvo la línea base (idle/success/finished, que se distinguen por el
  // cuerpo), cada estado con dueño de Ego necesita una señal visual propia:
  // color propio, imagen propia, o ambas.
  const base = new Set(['idle', 'success', 'wake']);
  for (const [ego, studio] of Object.entries(EGO_TO_STUDIO_STATE)) {
    if (base.has(studio)) continue;
    const tieneColor = Boolean(STATE_ACCENT[studio]);
    const tieneImagen = overlayTrace(studio).length > 0;
    assert.ok(tieneColor || tieneImagen,
      `el estado de studio '${studio}' (imagen de '${ego}') no se distingue: ` +
      'ni color propio ni imagen propia');
  }
});

test('los estados nuevos del studio tienen imagen propia y distinta', () => {
  // thinking, approval, question y ratelimit se añadieron para que el
  // round-trip fuese 1:1. Cada uno necesita su PROPIA imagen: si compartieran
  // overlay, el studio los Presents igual y el round-trip volvería a perder
  // información.
  const nuevos = ['thinking', 'approval', 'question', 'ratelimit'];
  const traces = new Map();
  for (const studio of nuevos) {
    const trace = overlayTrace(studio);
    assert.ok(trace.length > 0, `el estado '${studio}' no dibuja imagen propia`);
    const prev = traces.get(trace);
    assert.equal(prev, undefined, `'${studio}' dibuja lo mismo que '${prev}'`);
    traces.set(trace, studio);
  }
  // Y no pueden coincidir con ninguna imagen ya existente.
  for (const studio of STUDIO_NAMES) {
    if (nuevos.includes(studio)) continue;
    const trace = overlayTrace(studio);
    if (!trace) continue;
    for (const nuevo of nuevos) {
      assert.notEqual(trace, overlayTrace(nuevo),
        `el estado '${nuevo}' dibuja lo mismo que el estado existente '${studio}'`);
    }
  }
});

test('los estados de studio que son imagen de un estado de Ego son unívocos', () => {
  // Los estados de studio con dueño de Ego no pueden reutilizarse para otro.
  const conDueño = new Set(Object.values(EGO_TO_STUDIO_STATE));
  for (const studio of conDueño) {
    const owners = Object.entries(EGO_TO_STUDIO_STATE).filter(([, s]) => s === studio).map(([e]) => e);
    assert.equal(owners.length, 1, `studio '${studio}' tiene ${owners.length} dueños: ${owners}`);
  }
});
