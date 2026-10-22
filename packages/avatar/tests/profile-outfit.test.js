// tests/profile-outfit.test.js — el outfit del renderer LLEGA al motor.
//
// EGO-FIND-116 (Ola 13 · peticion de A4 §6.1): el renderer ofrece 8
// accesorios (`ACCESSORY_OPTIONS`: none, cx-full-kit, cx-antenna, headphones,
// cyber-goggles, crown, halo, sprout) y el motor YA TENIA las 8 piezas; lo que
// faltaba era el MAPA. Sin el, 7 de 8 caian en `unmapped` y el accesorio
// persistido no se aplicaba.
//
// Lo que se comprueba aqui NO es que "se acepta el atributo": es que la pieza
// SE DIBUJA (se cuenta contra el ctx stub del motor de canvas) y que el
// elemento la deja puesta en el studio.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EgoAvatar } from '../src/index.js';
import {
  ENGINE_ACCESSORIES,
  OUTFITS,
  UNMAPPED_OUTFITS,
  resolveProfile,
} from '../src/runtime/profile.js';
import { drawTopAccessory } from '../src/studio/render/accessories.js';

/**
 * El ctx stub del motor de canvas: cada llamada se cuenta.
 * @returns {{ctx: CanvasRenderingContext2D, count: () => number}}
 */
function makeStubCtx() {
  let calls = 0;
  const grad = { addColorStop() {} };
  const target = {
    canvas: {},
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: () => ({ width: 0 }),
  };
  const ctx = new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      return () => {
        calls++;
        return undefined;
      };
    },
  });
  return { ctx, count: () => calls };
}

/** El estado plano que el studio usa (lo minimo para dibujar). */
function studioState(accessory) {
  return {
    accessory,
    state: 'idle',
    time: 1.7,
    bodyColor: '#1e222d',
    eyeColor: '#dbf59d',
    showVisor: true,
    autoStateColors: true,
    headLookX: 0,
    headLookY: 0,
    accessoryScale: 1,
    accessoryOffsetY: 0,
    antennaAngle: 0,
    earPerk: 0,
    bodyHoverAmount: 0,
    eyeLookX: 0,
    eyeLookY: 0,
  };
}

/** Los 8 accesorios que ofrece el renderer (`ACCESSORY_OPTIONS`). */
const RENDERER_ACCESSORIES = [
  'none',
  'cx-full-kit',
  'cx-antenna',
  'headphones',
  'cyber-goggles',
  'crown',
  'halo',
  'sprout',
];

test('los 8 accesorios del renderer tienen pieza en el motor (y NO quedan unmapped)', () => {
  for (const outfit of RENDERER_ACCESSORIES) {
    const r = resolveProfile({ outfit });
    assert.ok(
      !r.unmapped.includes(outfit),
      `el outfit "${outfit}" no debe quedar unmapped (si no, el accesorio persistido no se aplica)`,
    );
    assert.ok(
      ENGINE_ACCESSORIES.includes(r.accessory),
      `el outfit "${outfit}" -> "${r.accessory}" debe ser una pieza que el motor tiene`,
    );
  }
});

test('el mapa cubre el vocabulario del renderer Y el legacy', () => {
  for (const outfit of [...RENDERER_ACCESSORIES, 'santaHat', 'partyHat', 'sunglasses', 'roundGlasses']) {
    assert.ok(outfit in OUTFITS, `falta el outfit "${outfit}" en el mapa`);
  }
});

test('EL OUTFIT SE DIBUJA: la pieza produce operaciones de pintado', () => {
  const count = (accessory) => {
    const { ctx, count: n } = makeStubCtx();
    drawTopAccessory(ctx, studioState(accessory), 84, 77);
    return n();
  };

  // `none` no dibuja nada.
  assert.equal(count('none'), 0, 'la pieza `none` no dibuja');

  // Las demas sí (con su geometría propia).
  for (const outfit of RENDERER_ACCESSORIES.filter((o) => o !== 'none')) {
    const { accessory } = resolveProfile({ outfit });
    assert.ok(
      count(accessory) > 0,
      `el outfit "${outfit}" -> "${accessory}" tiene que dibujar algo`,
    );
  }
});

test('el elemento deja la pieza del outfit puesta en el studio', () => {
  const a = new EgoAvatar();
  a.setMode('studio');
  a._studio();
  a.attributeChangedCallback('outfit', null, 'headphones');
  assert.equal(a._studioHost.getParam('accessory'), 'headphones');
});

test('lo que el motor NO expresa se declara (outfits sin pieza)', () => {
  // El motor tiene UN hueco de accesorio y 16 piezas: no hay gorro aderido,
  // ni bufanda, ni lazo.
  for (const outfit of UNMAPPED_OUTFITS) {
    const r = resolveProfile({ outfit });
    assert.ok(r.unmapped.includes(outfit), `el outfit "${outfit}" debe declararse unmapped`);
    assert.equal(r.accessory, 'none', `el outfit "${outfit}" no debe inventar una pieza`);
  }
});
