// tests/profile.test.js — el perfil declarativo alimenta el render (EGO-FIND-116).
//
// El perfil persiste y hace round-trip, pero el motor no lo observaba: el
// avatar se pintaba igual con un perfil o con otro. Estos tests comprueban
// que el RENDER cambia — no que "el atributo se acepta".
//
// La prueba de render es sobre el SVG REAL (renderShell), no sobre un
// aceptador de atributos: si el perfil no llega al dibujo, el SVG no cambia.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EgoAvatar } from '../src/index.js';
import { renderShell } from '../src/render/shell.js';
import { generateGenome } from '../src/core/genome.js';
import { buildPalette } from '../src/core/palette.js';
import {
  BASE_FORMS,
  OUTFITS,
  TRAIT_KINDS,
  parseTraits,
  resolveProfile,
  applyProfileToGenome,
} from '../src/runtime/profile.js';

/** El SVG que se pinta con un genoma dado (el mismo camino del motor). */
function renderWith(genome) {
  const palette = buildPalette(genome);
  return renderShell('uid-test', genome, palette);
}

/** El elemento con el perfil puesto (como el renderer lo hace). */
function avatarWithProfile({ baseForm, traits, outfit }) {
  const a = new EgoAvatar();
  a.setMode('studio');
  a._studio();                       // el host existe (sin DOM, sin backend)
  if (baseForm !== undefined) a.attributeChangedCallback('base-form', null, baseForm);
  if (traits !== undefined) a.attributeChangedCallback('traits', null, traits);
  if (outfit !== undefined) a.attributeChangedCallback('outfit', null, outfit);
  return a;
}

test('el elemento OBSERVA base-form, traits y outfit', () => {
  assert.ok(EgoAvatar.observedAttributes.includes('base-form'), 'base-form observado');
  assert.ok(EgoAvatar.observedAttributes.includes('traits'), 'traits observado');
  assert.ok(EgoAvatar.observedAttributes.includes('outfit'), 'outfit observado');
});

test('EL RENDER CAMBIA: la forma base cambia la silueta pintada', () => {
  const base = generateGenome('perfil');
  const defaultSvg = renderWith(base);

  // quantum-monolith (la más redonda) vs fractal-polyhedron (poliedrica).
  const redondo = applyProfileToGenome(base, resolveProfile({ baseForm: 'quantum-monolith' }));
  const poliedrico = applyProfileToGenome(base, resolveProfile({ baseForm: 'fractal-polyhedron' }));

  assert.notEqual(renderWith(redondo), defaultSvg, 'la forma base debe cambiar el SVG');
  assert.notEqual(
    renderWith(poliedrico),
    renderWith(redondo),
    'dos formas base distintas deben dar SVG distintos',
  );
  // Y la razon del motor: roundness es la palanca de la silueta.
  assert.ok(redondo.shape.roundness > poliedrico.shape.roundness, 'monolito mas redondo que poliedro');
  assert.ok(
    BASE_FORMS['fractal-polyhedron'].roundness < BASE_FORMS['quantum-monolith'].roundness,
    'el poliedro es mas angular que el monolito',
  );
});

test('EL RENDER CAMBIA: un rasgo cambia el genoma y el dibujo', () => {
  const base = generateGenome('perfil');
  const sinRasgos = renderWith(base);

  const conAntena = applyProfileToGenome(base, resolveProfile({ traits: ['antennae'] }));
  assert.notEqual(renderWith(conAntena), sinRasgos, 'el rasgo antennae debe cambiar el SVG');
  assert.equal(conAntena.appendage, 'antenna', 'antennae -> apendice antenna');
  assert.ok(TRAIT_KINDS.antennae, 'antennae es un rasgo conocido');
});

test('EL RENDER CAMBIA: el outfit cambia el accesorio del studio', () => {
  const a = avatarWithProfile({ baseForm: 'quantum-monolith', outfit: 'crown' });
  const host = a._studioHost;
  assert.ok(host, 'el host del studio existe');
  assert.equal(host.getParam('accessory'), OUTFITS.crown, 'el outfit fija el accesorio');
  assert.equal(host.getParam('accessory'), 'crown');
});

test('el outfit manda sobre el rasgo que tambien pide accesorio', () => {
  const conCrown = resolveProfile({ traits: ['quantum-crown'], outfit: 'santaHat' });
  assert.equal(conCrown.accessory, 'santa', 'la ropa explicita gana');
  const soloCrown = resolveProfile({ traits: ['quantum-crown'] });
  assert.equal(soloCrown.accessory, 'crown', 'sin outfit, gana el rasgo');
});

test('el perfil se aplica al genoma del elemento', () => {
  const a = avatarWithProfile({ baseForm: 'fractal-polyhedron' });
  const genome = a.getGenome();
  assert.equal(genome.shape.roundness, BASE_FORMS['fractal-polyhedron'].roundness);
  assert.equal(genome.shape.ratio, BASE_FORMS['fractal-polyhedron'].ratio);
});

test('cambiar el perfil despues RE-pinta el avatar (no solo se guarda)', () => {
  const a = avatarWithProfile({ baseForm: 'quantum-monolith' });
  const antes = a.getGenome().shape.roundness;
  a.attributeChangedCallback('base-form', null, 'fractal-polyhedron');
  const despues = a.getGenome().shape.roundness;
  assert.notEqual(antes, despues, 'el genoma debe cambiar al cambiar el perfil');
  assert.equal(despues, BASE_FORMS['fractal-polyhedron'].roundness);
});

test('el mismo perfil produce SIEMPRE el mismo resultado (determinista)', () => {
  const p = { baseForm: 'energy-core', traits: ['antennae', 'aura-field'], outfit: 'crown' };
  const a = resolveProfile(p);
  const b = resolveProfile(p);
  assert.deepEqual(a, b);
  const base = generateGenome('perfil');
  assert.equal(
    renderWith(applyProfileToGenome(base, a)),
    renderWith(applyProfileToGenome(base, b)),
  );
});

test('un perfil corrupto degrada (no rompe)', () => {
  assert.deepEqual(parseTraits('no-es-json'), []);
  assert.deepEqual(parseTraits(null), []);
  assert.deepEqual(parseTraits('{"no":"es","un":"array"}'), []);
  assert.deepEqual(parseTraits('[]'), []);
  // Una forma base desconocida cae en la del motor (no inventa).
  const r = resolveProfile({ baseForm: 'forma-inventada', traits: 'tampoco-es-json' });
  assert.equal(r.shape.roundness, BASE_FORMS['quantum-monolith'].roundness);
  assert.equal(r.accessory, 'none');
});

test('un rasgo que el motor no expresa se DECLARA, no se inventa', () => {
  const r = resolveProfile({ traits: ['floating-shards'] });
  assert.ok(r.unmapped.includes('floating-shards'), 'se declara como no expresado');
  assert.equal(r.accessory, 'none', 'no se inventa un accesorio');
});
