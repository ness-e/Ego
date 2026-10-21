// genome.test.js — determinismo y rangos del genoma (P1/P2).
// Genes de forma/ojos del rig ARA: shape {roundness, ratio}, eyes
// {scale, spacing, yBias} (sin estilos ni exponentes).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/genome.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateGenome,
  temperamentProfile,
  MARKINGS,
  APPENDAGES,
} from '../src/core/genome.js';

test('misma semilla ⇒ genoma idéntico (determinismo)', () => {
  const a = generateGenome('subego:conocimiento');
  const b = generateGenome('subego:conocimiento');
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('semillas distintas ⇒ genomas distintos', () => {
  const a = generateGenome('subego:luna');
  const b = generateGenome('subego:orion');
  const same = JSON.stringify(a) === JSON.stringify(b);
  assert.equal(same, false);
});

test('el genoma queda congelado (deep-freeze)', () => {
  const g = generateGenome('frozen-test');
  assert.ok(Object.isFrozen(g));
  assert.ok(Object.isFrozen(g.shape));
  assert.throws(() => {
    'use strict';
    g.shape.roundness = 9;
  });
});

test('genes dentro de rangos declarados', () => {
  for (let i = 0; i < 50; i++) {
    const g = generateGenome(`seed-${i}`);
    assert.ok(Number.isInteger(g.shape.roundness) && g.shape.roundness >= 0 && g.shape.roundness <= 100, `roundness ${g.shape.roundness}`);
    assert.ok(g.shape.ratio >= 0.88 && g.shape.ratio <= 1.12);
    assert.ok(g.eyes.scale >= 0.8 && g.eyes.scale <= 1.25);
    assert.ok(g.eyes.spacing >= 0.28 && g.eyes.spacing <= 0.42);
    assert.ok(g.eyes.yBias >= -0.06 && g.eyes.yBias <= 0.04);
    assert.ok(MARKINGS.includes(g.marking), g.marking);
    assert.ok(APPENDAGES.includes(g.appendage), g.appendage);
    assert.ok(g.aura >= 0.25 && g.aura <= 1);
    assert.ok(g.temperament >= 0 && g.temperament <= 1);
    assert.ok(g.palette.hue >= 0 && g.palette.hue <= 359);
    assert.equal(g.palette.accentHue >= 0 && g.palette.accentHue < 360, true);
  }
});

test('markingDetail coherente con el marking', () => {
  for (let i = 0; i < 40; i++) {
    const g = generateGenome(`md-${i}`);
    if (g.marking === 'none') assert.equal(g.markingDetail, null);
    else assert.ok(g.markingDetail && typeof g.markingDetail === 'object');
    if (g.marking === 'dots') {
      assert.equal(g.markingDetail.spots.length, g.markingDetail.count);
      assert.ok(g.markingDetail.count >= 3 && g.markingDetail.count <= 6);
    }
  }
});

test('temperamento: más energía ⇒ parpadeo más rápido y más mirada', () => {
  const calm = temperamentProfile(0.1);
  const energy = temperamentProfile(0.95);
  assert.ok(calm.blinkMin > energy.blinkMin);
  assert.ok(calm.wanderAmp < energy.wanderAmp);
  assert.ok(calm.bounce < energy.bounce);
  assert.ok(calm.gazeGain <= energy.gazeGain);
});

test('cobertura de aleatoriedad: marcas, apéndices y redondeos varían en 200 seeds', () => {
  const rounds = new Set();
  const marks = new Set();
  const apps = new Set();
  for (let i = 0; i < 200; i++) {
    const g = generateGenome(`cov-${i}`);
    rounds.add(g.shape.roundness);
    marks.add(g.marking);
    apps.add(g.appendage);
  }
  assert.ok(rounds.size > 10, `redondeo varía: ${rounds.size} valores`);
  assert.equal(marks.size, MARKINGS.length, `marcas: ${[...marks]}`);
  assert.equal(apps.size, APPENDAGES.length, `apéndices: ${[...apps]}`);
});
