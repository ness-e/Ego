// config.test.js — sistema de configuración (Defaults/Bounds/clamp/parseSize).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_DEFAULTS,
  AVATAR_BOUNDS,
  parseSize,
  normalizeConfigValue,
  clampConfig,
  configure,
  getConfig,
  resetConfig,
} from '../src/core/config.js';

test('parseSize: port literal de ARA (números, px, basura → fallback)', () => {
  assert.equal(parseSize('120'), 120);
  assert.equal(parseSize('120px'), 120);
  assert.equal(parseSize('87.5px'), 87.5);
  assert.equal(parseSize('0'), 112); // no positivo → fallback
  assert.equal(parseSize('-5'), 112);
  assert.equal(parseSize('50%'), 112);
  assert.equal(parseSize(null), 112);
  assert.equal(parseSize(undefined, 64), 64); // fallback custom
});

test('normalizeConfigValue: acota al rango y sanea NaN', () => {
  assert.equal(normalizeConfigValue('fps', 120), 60);
  assert.equal(normalizeConfigValue('fps', 5), 10);
  assert.equal(normalizeConfigValue('fps', 'no-num'), 30); // fallback
  assert.equal(normalizeConfigValue('gazeGain', 99), 4);
  assert.equal(normalizeConfigValue('pointerFollow', true), true);
  assert.equal(normalizeConfigValue('pointerFollow', 'true'), true);
  assert.equal(normalizeConfigValue('pointerFollow', 'false'), false);
});

test('clampConfig: aplica defaults y congela', () => {
  const cfg = clampConfig({ fps: 144, unknownKey: 1 });
  assert.equal(cfg.fps, 60);
  assert.equal(cfg.autoSleepMs, AVATAR_DEFAULTS.autoSleepMs);
  assert.ok(!('unknownKey' in cfg), 'claves desconocidas se descartan');
  assert.ok(Object.isFrozen(cfg), 'config congelada (solo lectura)');
});

test('configure/resetConfig: ciclo global', () => {
  resetConfig();
  assert.equal(getConfig().fps, 30);
  configure({ fps: 24, blinkMinMs: 1000 });
  assert.equal(getConfig().fps, 24);
  assert.equal(getConfig().blinkMinMs, 1000);
  // valores fuera de rango quedan acotados
  configure({ blinkMinMs: 999999 });
  assert.equal(getConfig().blinkMinMs, AVATAR_BOUNDS.blinkMinMs[1]);
  resetConfig();
  assert.equal(getConfig().blinkMinMs, AVATAR_DEFAULTS.blinkMinMs);
});

test('toda clave de DEFAULTS tiene BOUNDS (salvo booleanos)', () => {
  for (const key of Object.keys(AVATAR_DEFAULTS)) {
    if (typeof AVATAR_DEFAULTS[key] === 'boolean') continue;
    assert.ok(AVATAR_BOUNDS[key], `${key} sin_BOUNDS`);
    const [lo, hi] = AVATAR_BOUNDS[key];
    assert.ok(lo <= AVATAR_DEFAULTS[key] && AVATAR_DEFAULTS[key] <= hi, `${key}: default fuera de rango`);
  }
});
