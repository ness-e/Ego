// palette.test.js — paleta determinista y contraste de tinta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateGenome } from '../src/core/genome.js';
import { buildPalette, lerpHsl, hsl } from '../src/core/palette.js';

test('misma semilla ⇒ paleta idéntica', () => {
  const a = buildPalette(generateGenome('paleta-1'));
  const b = buildPalette(generateGenome('paleta-1'));
  assert.deepEqual({ ...a }, { ...b });
});

test('la paleta está congelada', () => {
  const p = buildPalette(generateGenome('frozen'));
  assert.ok(Object.isFrozen(p));
});

test('tinta siempre oscura (luminancia ≤ 20%) para contraste sobre el cuerpo', () => {
  for (let i = 0; i < 60; i++) {
    const p = buildPalette(generateGenome(`ink-${i}`));
    const m = /hsl\([\d.]+\s+[\d.]+%\s+([\d.]+)%\)/.exec(p.ink);
    assert.ok(m, `ink inválido: ${p.ink}`);
    assert.ok(+m[1] <= 20, `ink demasiado claro: ${p.ink}`);
    assert.ok(+m[1] >= 10, `ink demasiado oscuro: ${p.ink}`);
  }
});

test('lerpHsl interpola con camino corto de matiz', () => {
  const a = hsl(350, 60, 55);
  const b = hsl(10, 60, 55); // cruce de 0/360 → debe pasar por 0, no por 180
  const mid = lerpHsl(a, b, 0.5);
  const m = /hsl\(([\d.-]+)/.exec(mid);
  const h = +m[1];
  assert.ok(h >= 0 && h <= 360);
  // camino corto: 350 → 0 → 10 (cualquier punto intermedio ≈ 0)
  const near0 = h < 20 || h > 350;
  assert.ok(near0, `matiz intermedio inesperado: ${h}`);
});

test('lerpHsl extremos devuelven los originales', () => {
  const a = hsl(200, 50, 60);
  const b = hsl(40, 70, 30);
  assert.equal(lerpHsl(a, b, 0), a);
  assert.equal(lerpHsl(a, b, 1), b);
});
