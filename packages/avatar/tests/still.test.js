// still.test.js — pose estática determinista (port de coucou MochiStill.swift).
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/still.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staticSVG, djb2, poseForSeed } from '../src/render/static.js';
import { POSES, POSE_NAMES } from '../src/runtime/poses.js';

test('djb2: hash conocido y determinista', () => {
  // djb2("") = 5381
  assert.equal(djb2(''), 5381);
  assert.equal(djb2('abc'), djb2('abc'));
  assert.notEqual(djb2('abc'), djb2('abd'));
  assert.ok(Number.isInteger(djb2('subego:conocimiento')));
  assert.ok(djb2('x') >= 0);
});

test('poseForSeed: estable por semilla y siempre válida', () => {
  for (let i = 0; i < 30; i++) {
    const seed = `still-${i}`;
    const pose = poseForSeed(seed);
    assert.ok(POSE_NAMES.includes(pose), `${seed} → ${pose}`);
    assert.equal(poseForSeed(seed), pose, 'misma semilla ⇒ misma pose');
  }
});

test('pose hash produce al menos2 poses distintas en30 semillas (variabilidad)', () => {
  const seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(poseForSeed(`var-${i}`));
  assert.ok(seen.size >= 2, `solo ${seen.size} pose(s)`);
});

test('staticSVG con pose "hash" es determinista y válido', () => {
  const a = staticSVG('hash-seed', { state: 'idle', pose: 'hash' });
  const b = staticSVG('hash-seed', { state: 'idle', pose: 'hash' });
  assert.equal(a, b);
  assert.ok(!a.includes('NaN'));
});

test('staticSVG con pose nombrada explícita la respeta', () => {
  const svg = staticSVG('pose-explicita', { state: 'idle', pose: 'angry' });
  // pose angry: párpados inclinados (topAL 16 / topAR −16 en sus transforms)
  assert.ok(svg.includes('rotate(16 0 -5)'), 'párpado izquierdo inclinado');
  assert.ok(svg.includes('rotate(-16 0 -5)'), 'párpado derecho inclinado');
  void POSES;
});

test('estados nuevos de coucou renderizan: searching/finished/ratelimit/dizzy', () => {
  const searching = staticSVG('nuevo', { state: 'searching' });
  assert.ok(searching.includes('style="fill:hsl(233'), 'tinte searching');
  assert.ok(/class="badge-dots" visibility="visible"/.test(searching), 'dots searching');

  const finished = staticSVG('nuevo', { state: 'finished' });
  assert.ok(/class="badge-dot" visibility="hidden"/.test(finished), 'dot: puntos 2 y 3 ocultos');

  const ratelimit = staticSVG('nuevo', { state: 'ratelimit' });
  assert.ok(ratelimit.includes('class="eye-top"'), 'pose tired (sleepy) con párpados');

  const dizzy = staticSVG('nuevo', { state: 'dizzy' });
  assert.ok(dizzy.includes('class="eye-top"'), 'pose spiral (sleepy) con párpados');
});
