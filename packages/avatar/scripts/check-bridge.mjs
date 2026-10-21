#!/usr/bin/env node
// scripts/check-bridge.mjs — puerta del contrato del puente Ego <-> studio.
//
// El puente traduce el vocabulario de Ego (motor SVG) al del studio (motor
// canvas). Su contrato, escrito en src/studio/adapter.js, es:
//
//   "Para todo estado de Ego, el round-trip Ego -> studio -> Ego conserva la
//    identidad: el avatar nunca puede mostrar un estado distinto del que el
//    chat pidió."
//
// Un mapa de traducción y un catálogo de estados pueden desincronizarse: si
// el mapa directo nombra un estado que el catálogo no tiene, el motor cae a un
// `default` y el estado se pierde EN SILENCIO. Este script comprueba TODOS los
// mapas que nombran estados del studio, no solo el de estados.
//
// Qué comprueba:
//   (a) todo estado de Ego mapea a un estado de studio que EXISTE;
//   (b) el round-trip Ego -> studio -> Ego devuelve el original (1:1);
//   (c) ninguna imagen de studio la comparten dos estados de Ego;
//   (d) todo estado de studio tiene inverso, y el inverso es un estado de Ego;
//   (e) los emotes de Ego mapean a estados de studio que existen;
//   (f) los sonidos de Ego mapean a sonidos de studio que existen.
//
// Uso: node scripts/check-bridge.mjs [--json]
// Salida: 0 = contrato cumplido; 1 = contrato incumplido; 2 = error de uso.

import { STATE_NAMES } from '../src/runtime/states.js';
import {
  EGO_TO_STUDIO_STATE,
  STUDIO_TO_EGO_STATE,
  EGO_TO_STUDIO_EMOTE,
  EGO_SOUND_TO_STUDIO_SOUND,
  studioStateForEgo,
} from '../src/studio/adapter.js';
import { STUDIO_STATES } from '../src/studio/config.js';
import { STUDIO_SOUND_NAMES } from '../src/studio/sound.js';

const asJson = process.argv.includes('--json');
const studioNames = STUDIO_STATES.map((s) => s.name);
const studioSet = new Set(studioNames);
const studioSounds = new Set(STUDIO_SOUND_NAMES);

const problems = [];

// (a) Todo estado de Ego mapea a un estado de studio que EXISTE.
const targets = [];
for (const [ego, studio] of Object.entries(EGO_TO_STUDIO_STATE)) {
  if (!studioSet.has(studio)) {
    problems.push(`EGO_TO_STUDIO_STATE.${ego} -> '${studio}': ese estado NO existe en STUDIO_STATES`);
  }
  targets.push([ego, studio]);
}

// (b) Round-trip 1:1.
const lossy = [];
for (const ego of STATE_NAMES) {
  const studio = studioStateForEgo(ego);
  const back = STUDIO_TO_EGO_STATE[studio];
  if (back !== ego) {
    lossy.push(ego);
    problems.push(`round-trip: ${ego} -> studio '${studio}' -> Ego '${back}': se pierde la identidad`);
  }
}

// (c) Ninguna imagen de studio compartida por dos estados de Ego.
const owners = new Map();
for (const [ego, studio] of targets) {
  if (!owners.has(studio)) owners.set(studio, []);
  owners.get(studio).push(ego);
}
for (const [studio, egos] of owners) {
  if (egos.length > 1) {
    problems.push(`la imagen de studio '${studio}' la comparten ${egos.join(', ')}: el dock no puede distinguirlos`);
  }
}

// (d) Todo estado de studio tiene inverso, y el inverso es un estado de Ego.
for (const studio of studioNames) {
  const ego = STUDIO_TO_EGO_STATE[studio];
  if (!ego) { problems.push(`el estado de studio '${studio}' no tiene inverso`); continue; }
  if (!STATE_NAMES.includes(ego)) problems.push(`studio '${studio}' -> Ego '${ego}': ese estado no existe`);
}

// (e) Los emotes de Ego mapean a estados de studio que existen.
for (const [emote, studio] of Object.entries(EGO_TO_STUDIO_EMOTE)) {
  if (!studioSet.has(studio)) {
    problems.push(`EGO_TO_STUDIO_EMOTE.${emote} -> '${studio}': ese estado NO existe en STUDIO_STATES`);
  }
}

// (f) Los sonidos de Ego mapean a sonidos de studio que existen.
for (const [egoSound, studioSound] of Object.entries(EGO_SOUND_TO_STUDIO_SOUND)) {
  if (!studioSounds.has(studioSound)) {
    problems.push(`EGO_SOUND_TO_STUDIO_SOUND.${egoSound} -> '${studioSound}': ese sonido NO existe en STUDIO_SOUND_NAMES`);
  }
}

const orphans = studioNames.filter((n) => !owners.has(n));
const result = {
  ok: problems.length === 0,
  egoStates: STATE_NAMES.length,
  studioStates: studioNames.length,
  roundTrip1to1: STATE_NAMES.length - lossy.length,
  lossy,
  collisions: [...owners.entries()].filter(([, v]) => v.length > 1).map(([k]) => k),
  orphanStudioStates: orphans,
  problems,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

console.log(`puente Ego(${result.egoStates}) <-> studio(${result.studioStates}): ` +
  `round-trip 1:1 = ${result.roundTrip1to1}/${result.egoStates} | ` +
  `colisiones = ${result.collisions.length} | ` +
  `estados de studio sin dueño Ego = ${orphans.length}`);
if (result.ok) {
  console.log('  CONTRATO CUMPLIDO: ningún mapa nombra un estado del studio inexistente y el round-trip conserva la identidad.');
  process.exit(0);
}
console.error(`  ${problems.length} PROBLEMA(S):`);
for (const p of problems) console.error(`    ${p}`);
process.exit(1);
