// tests/profile-intensity.test.js — la INTENSIDAD de los rasgos llega al render.
//
// EGO-FIND-116 (Ola 12 · peticion de A4 §8.1b): el atributo `traits` solo
// transportaba NOMBRES, asi que la intensidad del rasgo se perdia en el
// camino. Ahora el atributo acepta las dos formas y la intensidad se expresa
// con las palancas que el motor YA tiene.
//
// La prueba es sobre el SVG REAL (el render estatico, que es el que fija el
// opacity del aura a partir del genoma): lo que se comprueba es que el DIBUJO
// cambia con la intensidad, no que "se acepta el atributo".

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { staticSVG } from '../src/render/static.js';
import { generateGenome } from '../src/core/genome.js';
import {
  AURA_RANGE,
  UNMAPPED_INTENSITIES,
  parseTraits,
  parseTraitEntries,
  resolveProfile,
  applyProfileToGenome,
} from '../src/runtime/profile.js';

/**
 * El SVG que se pinta con un genoma dado (el mismo camino del motor).
 *
 * Se usa el render ESTATICO y no `renderShell`: el estatico es el que fija el
 * `opacity` del aura a partir del genoma (`render/static.js:63`), que es la
 * palanca por la que viaja la intensidad del rasgo.
 */
function renderWith(genome) {
  return staticSVG('perfil', { genome });
}

/** El opacity del aura en el SVG (la palanca que lleva la intensidad). */
function auraOpacity(svg) {
  const m = /class="aura" opacity="([\d.]+)"/.exec(svg);
  assert.ok(m, 'el SVG debe traer el aura con su opacity');
  return Number(m[1]);
}

test('parseTraits acepta las DOS formas: nombres y objetos', () => {
  // La forma de los NOMBRES (la de siempre).
  assert.deepEqual(parseTraits('["halo","antennae"]'), ['halo', 'antennae']);
  // La forma canonica con intensidad (la que pide el renderer).
  assert.deepEqual(
    parseTraits('[{"kind":"halo","intensity":0.4},{"kind":"antennae","intensity":1}]'),
    ['halo', 'antennae'],
  );
  // Y mixtas.
  assert.deepEqual(parseTraits('["halo",{"kind":"antennae","intensity":0.2}]'), ['halo', 'antennae']);
});

test('parseTraitEntries devuelve la entrada completa (con su intensidad)', () => {
  assert.deepEqual(parseTraitEntries('["halo"]'), [{ kind: 'halo', intensity: 1, enabled: true }]);
  assert.deepEqual(parseTraitEntries('[{"kind":"halo","intensity":0.4}]'), [
    { kind: 'halo', intensity: 0.4, enabled: true },
  ]);
  assert.deepEqual(parseTraitEntries('[{"kind":"halo","intensity":0.4,"enabled":false}]'), [
    { kind: 'halo', intensity: 0.4, enabled: false },
  ]);
  // Un JSON corrupto es un perfil vacio, no un fallo.
  assert.deepEqual(parseTraitEntries('no-es-json'), []);
  assert.deepEqual(parseTraitEntries('{"no":"es","un":"array"}'), []);
  assert.deepEqual(parseTraitEntries(null), []);
});

test('LA INTENSIDAD CAMBIA EL RENDER: el aura del genoma la lleva', () => {
  const base = generateGenome('perfil');

  const tenue = applyProfileToGenome(
    base,
    resolveProfile({ traits: [{ kind: 'aura-field', intensity: 0.1 }] }),
  );
  const fuerte = applyProfileToGenome(
    base,
    resolveProfile({ traits: [{ kind: 'aura-field', intensity: 1 }] }),
  );

  // El SVG real cambia (el aura es la palanca que lleva la intensidad).
  assert.notEqual(renderWith(tenue), renderWith(fuerte), 'la intensidad debe cambiar el SVG');
  const opTenue = auraOpacity(renderWith(tenue));
  const opFuerte = auraOpacity(renderWith(fuerte));
  assert.ok(opTenue < opFuerte, `aura tenue (${opTenue}) < aura fuerte (${opFuerte})`);

  // Y la intensidad cae dentro del rango que el genoma admite.
  assert.ok(tenue.aura >= AURA_RANGE[0] && tenue.aura <= AURA_RANGE[1], `aura ${tenue.aura}`);
  assert.ok(fuerte.aura >= AURA_RANGE[0] && fuerte.aura <= AURA_RANGE[1], `aura ${fuerte.aura}`);
});

test('un rasgo desactivado (enabled:false) NO se aplica', () => {
  const base = generateGenome('perfil');
  const conAura = applyProfileToGenome(base, resolveProfile({ traits: [{ kind: 'aura-field', intensity: 1 }] }));
  const sinAura = applyProfileToGenome(
    base,
    resolveProfile({ traits: [{ kind: 'aura-field', intensity: 1, enabled: false }] }),
  );
  assert.equal(sinAura.aura, base.aura, 'desactivado = el aura del genoma');
  assert.notEqual(conAura.aura, base.aura, 'activado = el aura del perfil');
});

test('la intensidad que el motor NO expresa se DECLARA (no se amaga)', () => {
  // El motor solo tiene UNA palanca de intensidad: el aura.
  const r = resolveProfile({ traits: [{ kind: 'antennae', intensity: 0.2 }] });
  assert.ok(
    r.unmappedIntensity.includes('antennae'),
    'antennae no tiene palanca de intensidad',
  );
  assert.ok(
    UNMAPPED_INTENSITIES.includes('antennae'),
    'y se declara en UNMAPPED_INTENSITIES',
  );
  // Y NO esta en `unmapped`: el rasgo SI se aplica (lo que no se expresa es su
  // magnitud, no el rasgo).
  assert.ok(!r.unmapped.includes('antennae'), 'antennae si se aplica');
  assert.equal(r.appendage, 'antenna');
});

test('sin intensidad, el rasgo se aplica a tope (compatibilidad)', () => {
  const r = resolveProfile({ traits: ['aura-field'] });
  assert.equal(r.aura, AURA_RANGE[1], 'sin intensidad, el aura al maximo');
});
