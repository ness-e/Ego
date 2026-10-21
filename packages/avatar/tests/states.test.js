// states.test.js — integridad de la tabla de estados y mapeos.
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/states.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, EMOTES, HOOK_STATE_MAP, resolveState, assertState, STATE_NAMES } from '../src/runtime/states.js';
import { POSES, POSE_NAMES, createPoseState, lerpPose } from '../src/runtime/poses.js';

const REQUIRED = ['tint', 'tintStrength', 'pose', 'badge', 'movement', 'glow'];

test('todo estado tiene las claves requeridas y pose válida', () => {
  for (const [name, cfg] of Object.entries(STATES)) {
    for (const k of REQUIRED) assert.ok(k in cfg, `${name} falta ${k}`);
    assert.ok(POSE_NAMES.includes(cfg.pose), `${name}: pose "${cfg.pose}" inexistente`);
    if (cfg.tint) assert.match(cfg.tint, /^hsl\(/);
    assert.ok(cfg.tintStrength >= 0 && cfg.tintStrength <= 1);
    assert.ok(cfg.glow >= 0 && cfg.glow <= 1);
    if (cfg.badge) assert.ok(['dots', 'dot', 'bang', 'question', 'warn'].includes(cfg.badge));
  }
  assert.ok(STATE_NAMES.length >= 15, 'mínimo 15 estados (10 originales + searching/finished/ratelimit/dizzy de coucou + warning de Ego)');
  assert.ok(STATE_NAMES.includes('warning'), 'el estado `warning` (degradación tolerable) debe existir');
});

test('todo emote referencia una pose válida', () => {
  for (const [name, cfg] of Object.entries(EMOTES)) {
    assert.ok(POSE_NAMES.includes(cfg.pose), `${name}: pose "${cfg.pose}"`);
    assert.ok(cfg.duration > 0);
  }
});

test('HOOK_STATE_MAP solo apunta a estados existentes (mapeo Ego)', () => {
  for (const [hook, state] of Object.entries(HOOK_STATE_MAP)) {
    assert.ok(STATES[state], `${hook} → ${state} inexistente`);
  }
  assert.equal(HOOK_STATE_MAP.UserPromptSubmit, 'thinking');
  assert.equal(HOOK_STATE_MAP.PermissionRequest, 'approval');
  assert.equal(HOOK_STATE_MAP.StopFailure, 'error');
});

test('resolveState respeta prioridad: approval > error > idle', () => {
  assert.equal(resolveState('idle', 'approval'), 'approval');
  assert.equal(resolveState('approval', 'error'), 'approval');
  assert.equal(resolveState('error', 'idle'), 'error');
  assert.equal(resolveState('working', 'question'), 'question');
});

test('assertState lanza con nombres desconocidos', () => {
  assert.equal(assertState('sleeping'), 'sleeping');
  assert.throws(() => assertState('volando'), /desconocido/);
});

test('lerpPose interpola todos los números sin conmutaciones (rig ARA)', () => {
  const from = createPoseState('idle');
  const to = createPoseState('angry');
  // claves numéricas presentes en ambos extremos
  for (const k of ['w', 'h', 'topY', 'bottomY', 'topAL', 'topAR']) {
    assert.ok(Number.isFinite(from[k]) && Number.isFinite(to[k]), `clave ${k}`);
  }
  const early = lerpPose(from, to, 0.2);
  const late = lerpPose(from, to, 0.8);
  // morph continuo: el valor intermedio está entre los extremos
  assert.ok(early.topY > from.topY && early.topY < to.topY, `topY interpola: ${early.topY}`);
  assert.ok(late.topY > early.topY, 'progresa hacia angry');
  assert.deepEqual(Object.keys(early).sort(), Object.keys(lerpPose(from, to, 1)).sort(), 'forma estable');
  // la clave viaja con el extremo más cercano
  assert.equal(early.key, 'idle');
  assert.equal(late.key, 'angry');
  // sin NaN en todo el recorrido
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const r = lerpPose(from, to, t);
    for (const k of ['w', 'h', 'topY', 'bottomY', 'topAL', 'topAR', 'bottomAL', 'bottomAR', 'scale']) {
      assert.ok(Number.isFinite(r[k]), `NaN en ${k} a t=${t}`);
    }
  }
});

test('poses propias de Ego + aliases', () => {
  // Las cifras las produce la REGLA de `poses.js` (intenciones -> numeros del
  // rig). El test fija PROPIEDADES, no numeros de un upstream:
  //   · los parpados de reposo estan abiertos y simetricos;
  //   · `sad` y `angry` estrechan el ojo por arriba y se inclinan en
  //     sentidos OPUESTOS (el ceño no puede parecerse a la tristeza);
  //   · `happy` sube el parpado inferior (la sonrisa);
  //   · `surprise` es el ojo mas grande.
  assert.ok(POSES.idle.topY < 0 && POSES.idle.bottomY > 0, 'reposo: parpados abiertos');
  assert.equal(POSES.idle.topY, -POSES.idle.bottomY, 'reposo: parpados simetricos');
  assert.ok(POSES.angry.topY > POSES.idle.topY, 'angry: el parpado superior baja');
  assert.ok(POSES.angry.topAL * POSES.angry.topAR < 0, 'angry: inclina en sentidos opuestos');
  assert.ok(POSES.sad.topAL * POSES.sad.topAR < 0, 'sad: tambien inclina');
  assert.notEqual(POSES.angry.topAL, POSES.sad.topAL, 'sad y angry no inclinan igual');
  assert.ok(POSES.happy.bottomY < POSES.idle.bottomY, 'happy: el parpado inferior sube (sonrisa)');
  assert.ok(POSES.surprise.w > POSES.idle.w, 'surprise: el ojo es mas ancho');
  assert.ok(POSES.surprise.h > POSES.idle.h, 'surprise: el ojo es mas alto');
  // aliases propios sobre las poses propias
  assert.deepEqual(POSES.flat, POSES.angry, 'flat = angry');
  assert.deepEqual(POSES.wide, POSES.surprise, 'wide = surprise');
  assert.deepEqual(POSES.closed, POSES.sleep, 'closed = sleep');
  assert.deepEqual(POSES.tired, POSES.sleepy, 'tired = sleepy');
  assert.deepEqual(POSES.spiral, POSES.sleepy, 'spiral = sleepy');
  assert.equal(POSES.thinking.gaze.join(','), '0.45,-0.5', 'thinking mira arriba-derecha');
});
