// tests/hands-attribute.test.js — la ruta del atributo `hands`.
//
// El rig de manos flotantes articuladas se controla desde el elemento con el
// atributo `hands` (`always` | `auto` | `hidden`). Antes de que existiera ese
// atributo, `handsMode` solo era ajustable desde el propio Studio, y en la app
// las manos quedaban invisibles.
//
// Esta es la ruta que faltaba cubrir:
//
//     atributo `hands`  ->  setParam('handsMode')  ->  sobrevive al preset
//
// Es decir: el modo que pide el usuario NO se pierde al aplicar un preset que
// no toca las manos. Sin este test, la regresión volvería sin que nadie lo
// notase.
//
// Nota sobre el orden: en el navegador los atributos se parsean ANTES de que
// el elemento se conecte, así que el host canvas todavía no existe cuando el
// atributo se procesa. El test reproduce ese orden real (primero el
// atributo, después el host), que es donde la ruta se rompía.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EgoAvatar } from '../src/index.js';
import { StudioHost } from '../src/studio/element-host.js';

/**
 * Backend canvas falso.
 *
 * `applyPreset` reinicia `handsMode` a propósito: modela el caso duro (un
 * preset que reinicia los parámetros paramétricos del motor, incluida la
 * visibilidad de las manos) y obliga a que el host re-aplique el modo que
 * pidió el usuario. Es un modelo ESTRICTO a propósito: el host debe
 * restaurar el modo sí o sí.
 */
function makeBackend() {
  return {
    state: 'idle',
    handsMode: 'auto',
    applied: [],
    applyPreset(name) {
      this.applied.push(name);
      this.handsMode = 'auto'; // el preset reinicia los params del motor
    },
    update() {},
    draw() {},
    resize() {},
    play() {},
    speak() {},
    restore() {},
  };
}

/** Elemento en modo studio con un host y un backend falsos. */
function makeAvatar() {
  const a = new EgoAvatar();
  a.setMode('studio');
  const host = a._studio();
  const backend = makeBackend();
  host.backend = backend;
  return { a, host, backend };
}

/** El navegador llama a attributeChangedCallback; en Node no hay setAttribute. */
function setAttr(a, name, value) {
  a.attributeChangedCallback(name, null, value);
}

test('el atributo `hands` está observado por el elemento', () => {
  assert.ok(EgoAvatar.observedAttributes.includes('hands'));
});

test('el atributo hands llega al motor aunque el host todavía no exista', () => {
  // Orden real del navegador: los atributos se parsean antes de conectar el
  // elemento, así que el host canvas aún no existe.
  const a = new EgoAvatar();
  a.setMode('studio');
  assert.equal(a._studioHost, null, 'precondición: el host aún no existe');

  setAttr(a, 'hands', 'always');
  assert.equal(a._handsMode, 'always', 'el elemento guarda el modo');

  const host = a._studio();
  assert.equal(host.getParam('handsMode'), 'always',
    'el modo debe llegar al host aunque se crease después del atributo');
});

test('el modo sobrevive a un preset que no toca las manos', () => {
  // ESTA es la regresión que faltaba cubrir: el preset reinicia los
  // parámetros del motor, pero NO debe perder el modo de manos pedido.
  const { a, host, backend } = makeAvatar();
  setAttr(a, 'hands', 'always');
  assert.equal(backend.handsMode, 'always', 'el backend recibe el modo');

  a.applyStudioPreset('ego-nucleus');
  assert.deepEqual(backend.applied, ['ego-nucleus'], 'el preset se aplicó');
  assert.equal(backend.handsMode, 'always',
    'el preset NO puede perder el modo de manos');
  assert.equal(host.getParam('handsMode'), 'always',
    'el host sigue reportando el modo pedido');
});

test('la ruta inversa: preset -> atributo -> setParam', () => {
  const { a, host, backend } = makeAvatar();
  a.applyStudioPreset('ego-nucleus');
  setAttr(a, 'hands', 'hidden');
  assert.equal(a._handsMode, 'hidden');
  assert.equal(host.getParam('handsMode'), 'hidden');
  assert.equal(backend.handsMode, 'hidden',
    'tras un preset, cambiar el atributo sigue llegando al motor');
});

test('un valor inválido degrada a auto sin romper', () => {
  const { a, host, backend } = makeAvatar();
  setAttr(a, 'hands', 'no-existe');
  assert.equal(a._handsMode, 'auto', 'un valor desconocido cae a auto');
  assert.equal(host.getParam('handsMode'), 'auto');
  assert.equal(backend.handsMode, 'auto');

  // Atributo ausente o nulo: el comportamiento previo (auto), sin lanzar.
  assert.doesNotThrow(() => setAttr(a, 'hands', null));
  assert.equal(a._handsMode, 'auto');
  assert.doesNotThrow(() => setAttr(a, 'hands', undefined));
  assert.equal(a._handsMode, 'auto');
});

test('los alias del atributo hands se normalizan', () => {
  const { a, host } = makeAvatar();
  for (const [value, expected] of [
    ['always', 'always'], ['on', 'always'], ['true', 'always'], ['ALWAYS', 'always'],
    ['hidden', 'hidden'], ['off', 'hidden'], ['false', 'hidden'],
    ['auto', 'auto'], ['', 'auto'], ['  always  ', 'always'],
  ]) {
    setAttr(a, 'hands', value);
    assert.equal(a._handsMode, expected, `hands="${value}"`);
    assert.equal(host.getParam('handsMode'), expected, `hands="${value}" (host)`);
  }
});

test('el atributo hands se puede cambiar de valor en caliente', () => {
  const { a, backend } = makeAvatar();
  setAttr(a, 'hands', 'always');
  assert.equal(backend.handsMode, 'always');
  setAttr(a, 'hands', 'hidden');
  assert.equal(backend.handsMode, 'hidden');
  setAttr(a, 'hands', 'auto');
  assert.equal(backend.handsMode, 'auto');
});

test('el modo de manos no depende de que exista el host (sin host, no rompe)', () => {
  // En modo SVG no hay host de studio: el atributo se guarda igual y no lanza.
  const a = new EgoAvatar();
  assert.equal(a.getMode(), 'svg');
  assert.doesNotThrow(() => setAttr(a, 'hands', 'always'));
  assert.equal(a._handsMode, 'always');
  assert.equal(a._studioHost, null, 'en SVG no se crea host de studio');
});

test('el host expone handsMode como parámetro del studio', () => {
  const el = { getState: () => 'idle', _adoptExternalState() {}, _genome: null, _palette: null };
  const host = new StudioHost(el);
  assert.equal(host.getParam('handsMode'), 'auto', 'valor por defecto');
  assert.equal(host.setParam('handsMode', 'always'), true, 'la clave es válida');
  assert.equal(host.getParam('handsMode'), 'always');
  assert.equal(host.setParam('noExiste', 1), false, 'una clave inválida se rechaza');
});
