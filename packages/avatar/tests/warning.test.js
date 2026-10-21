// tests/warning.test.js — el estado `warning`: "degradación tolerable".
//
// CONTEXTO (Ola 2, T1). La app ya tenía la SEÑAL pero no su REPRESENTACIÓN:
// `ego-chat.tsx` recibe `kind: "tool_error"` y el avatar caía en
// `default: return "idle"` del mapa legacy, de modo que una tool que fallaba
// se pintaba como un avatar en reposo. `warning` es el estado que cierra ese
// hueco: algo falló, pero el turno continúa.
//
// Este fichero fija el CONTRATO del estado, no su implementación:
//   - existe y tiene la forma de los demás estados;
//   - su pose, movimiento, insignia y sonido existen de verdad;
//   - NO se confunde con `error` (fallo duro) ni con `ratelimit`;
//   - el puente studio lo conserva (ida y vuelta);
//   - es renderizable por el motor SVG.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATES, STATE_NAMES, STATE_SOUND, assertState, resolveState } from '../src/runtime/states.js';
import { POSES, POSE_NAMES } from '../src/runtime/poses.js';
import { SOUND_NAMES } from '../src/runtime/sound.js';
import { staticSVG } from '../src/render/static.js';
import {
  EGO_TO_STUDIO_STATE,
  STUDIO_TO_EGO_STATE,
} from '../src/studio/adapter.js';
import { STUDIO_STATES } from '../src/studio/config.js';

/** Vocabulario de movimiento que el motor SVG implementa (`_applyMovement`). */
const MOVEMENTS = ['breathe', 'bounce', 'hop', 'sway', 'shake', 'tilt', 'pulse', 'orbit'];

/** Vocabulario de insignia que el renderer SVG sabe pintar. */
const BADGES = ['dots', 'dot', 'bang', 'question', 'warn'];

/** Separa el tono (hue) de un color `hsl(h s% l%)`. */
function hueOf(tint) {
  const m = /^hsl\(\s*([0-9.]+)/.exec(tint || '');
  return m ? Number(m[1]) : null;
}

/** Distancia angular entre dos tonos (0..180). */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

test('warning existe en la tabla de estados con la forma de los demás', () => {
  assert.ok(STATES.warning, 'el estado `warning` debe existir');
  assert.ok(STATE_NAMES.includes('warning'), 'debe aparecer en STATE_NAMES');
  for (const k of ['tint', 'tintStrength', 'pose', 'badge', 'movement', 'glow']) {
    assert.ok(k in STATES.warning, `warning falta ${k}`);
  }
  assert.match(STATES.warning.tint, /^hsl\(/, 'tint en formato hsl()');
  assert.ok(STATES.warning.tintStrength >= 0 && STATES.warning.tintStrength <= 1);
  assert.ok(STATES.warning.glow >= 0 && STATES.warning.glow <= 1);
});

test('warning: pose, movimiento, insignia y sonido existen de verdad', () => {
  const w = STATES.warning;
  assert.ok(POSE_NAMES.includes(w.pose), `pose "${w.pose}" no existe en el catalogo`);
  assert.ok(MOVEMENTS.includes(w.movement), `movement "${w.movement}" no lo implementa el motor`);
  assert.ok(BADGES.includes(w.badge), `badge "${w.badge}" no lo soporta el renderer`);
  assert.ok(STATE_SOUND.warning, 'warning debe tener sonido asignado');
  assert.ok(SOUND_NAMES.includes(STATE_SOUND.warning), `sonido "${STATE_SOUND.warning}" no existe`);
});

test('warning NO se confunde con error (fallo duro) ni con ratelimit', () => {
  const w = STATES.warning;
  const err = STATES.error;
  const rl = STATES.ratelimit;

  // Tinte: debe separarse por tono de ambos (no basta con el mismo color).
  const hw = hueOf(w.tint);
  assert.notEqual(hueOf(err.tint), hw, 'el tono debe diferir de error');
  assert.notEqual(hueOf(rl.tint), hw, 'el tono debe diferir de ratelimit');
  assert.ok(hueDistance(hw, hueOf(err.tint)) >= 25, `tono demasiado cerca de error (${hw})`);
  assert.ok(hueDistance(hw, hueOf(rl.tint)) >= 15, `tono demasiado cerca de ratelimit (${hw})`);

  // Gesto: pose, insignia y movimiento distintos de los dos.
  assert.notEqual(w.pose, err.pose, 'la pose debe diferir de error');
  assert.notEqual(w.pose, rl.pose, 'la pose debe diferir de ratelimit');
  assert.notEqual(w.badge, err.badge, 'la insignia debe diferir de error');
  assert.notEqual(w.badge, rl.badge, 'la insignia debe diferir de ratelimit');
  assert.notEqual(w.movement, err.movement, 'el movimiento debe diferir de error');
  assert.notEqual(w.movement, rl.movement, 'el movimiento debe diferir de ratelimit');

  // "Degradacion tolerable": menos intensidad que un fallo duro.
  assert.ok(w.tintStrength < err.tintStrength, 'mas atenuado que error');
  assert.ok(w.glow < err.glow, 'menos aura que error');
  assert.notEqual(w.glow, rl.glow, 'el aura debe diferir de ratelimit');
  assert.ok(w.tintStrength < rl.tintStrength, 'mas atenuado que ratelimit');
});

test('warning es renderizable por el motor SVG', () => {
  const svg = staticSVG('ego:test-warning', { state: 'warning' });
  assert.ok(svg.startsWith('<svg'), 'devuelve SVG');
  assert.ok(svg.includes('badge-warn'), 'la insignia de aviso debe estar en el markup');
  assert.ok(svg.length > 500, 'SVG con contenido');
  // La insignia de aviso ha de quedar ENCENDIDA (no solo presente): el
  // renderer decide que signo mostrar a partir de la insignia del estado.
  assert.ok(/class="badge-warn" visibility="visible"/.test(svg),
    'la insignia warn debe quedar visible en el estado warning');
});

test('las insignias de aviso y de error son excluyentes', () => {
  const warn = staticSVG('ego:test-warning', { state: 'warning' });
  const err = staticSVG('ego:test-warning', { state: 'error' });
  assert.ok(/class="badge-warn" visibility="visible"/.test(warn), 'warning enciende el aviso');
  assert.ok(/class="badge-warn" visibility="hidden"/.test(err), 'error apaga el aviso');
  assert.ok(/class="badge-bang" visibility="visible"/.test(err), 'error enciende la "!"');
  assert.ok(/class="badge-bang" visibility="hidden"/.test(warn), 'warning apaga la "!"');
  // El triángulo de aviso y su barra deben conservar su class (el renderer
  //_static reemplaza por class, no por texto: un prefijo compartido lo
  // corrompería).
  assert.ok(warn.includes('class="badge-warn-frame"'), 'el marco del aviso conserva su class');
  assert.ok(warn.includes('class="badge-warn-bar"'), 'la barra del aviso conserva su class');
  assert.ok(warn.includes('class="badge-warn-dot"'), 'el punto del aviso conserva su class');
});

test('el elemento acepta el estado `warning`', () => {
  assert.equal(assertState('warning'), 'warning');
  assert.throws(() => assertState('warningn'), /desconocido/);
});

test('puente studio: warning se conserva de ida y de vuelta', () => {
  // El studio tiene un estado `warning` propio: la imagen es un cartel ambar
  // con "!" (studio/render/overlays.js). El mapeo debe ser 1:1.
  assert.ok(STUDIO_STATES.some((s) => s.name === 'warning'), 'el studio debe tener estado warning');
  assert.equal(EGO_TO_STUDIO_STATE.warning, 'warning', 'Ego warning -> studio warning');
  assert.equal(STUDIO_TO_EGO_STATE.warning, 'warning', 'studio warning -> Ego warning');

  // Ida y vuelta: el estado no se pierde al cruzar el puente.
  const studio = EGO_TO_STUDIO_STATE.warning;
  assert.equal(STUDIO_TO_EGO_STATE[studio], 'warning', 'round-trip de warning');

  // Ningun otro estado de Ego puede reclamar la imagen de warning del studio:
  // si dos estados de Ego apuntan al mismo estado de studio, el usuario no
  // puede distinguirlos y el dock miente.
  const owners = Object.entries(EGO_TO_STUDIO_STATE)
    .filter(([, s]) => s === 'warning')
    .map(([k]) => k);
  assert.deepEqual(owners, ['warning'], `la imagen de studio "warning" la comparten: ${owners}`);
});

test('el motor de estados acepta `warning` en su prioridad', () => {
  // `warning` debe poder prevalecer sobre un estado de trabajo en curso.
  assert.equal(resolveState('working', 'warning'), 'warning');
  assert.equal(resolveState('idle', 'warning'), 'warning');
});
