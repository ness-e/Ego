// micro.test.js — tablas de micro-animaciones, duraciones y runner sobre timeline real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MICRO,
  MICRO_NAMES,
  microDuration,
  startMicro,
  badgePopSequence,
  BADGE_POP_SHRINK_MS,
  BADGE_POP_GROW_MS,
  BADGE_POP_GAP_MS,
  BLINK_KEYS,
  BLINK_DURATION,
  errorHeadKeys,
  nodKeys,
  warningHeadKeys,
} from '../src/runtime/micro.js';
import {
  WARNING_PHASES,
} from '../src/runtime/fx-eyes.js';
import { createTimeline } from '../src/core/timeline.js';
import { Ease } from '../src/core/anim.js';

/**
 * Avanza el reloj manual en pasos de frame llamando a update() en cada uno:
 * createTimeline avanza UNA key por update, así que un salto grande no la
 * fast-forwarda. Pasos de 16 ms ≈ 60 fps.
 */
function stepTo(clock, tl, target, dt = 16) {
  while (clock.t < target) {
    clock.t = Math.min(target, clock.t + dt);
    tl.update();
  }
}

test('MICRO_NAMES incluye los micros canónicos de coucou', () => {
  const required = [
    'squash', 'gulp', 'errorShake', 'approvalHop', 'badgePop', 'loveLift',
    'surpriseLift', 'proudTilt', 'winkTilt', 'yawn', 'happyBlush', 'greet',
    'happyBounce', 'annoyedHead', 'loveRock', 'hop', 'roll', 'rollDouble',
  ];
  for (const name of required) {
    assert.ok(MICRO_NAMES.includes(name), `falta el micro ${name}`);
  }
});

test('cada micro tiene fields no vacíos y keys [number, number, function] con duración > 0', () => {
  for (const [name, m] of Object.entries(MICRO)) {
    assert.equal(typeof m.fields, 'object', `${name}: fields debe ser objeto`);
    assert.ok(m.fields !== null && !Array.isArray(m.fields), `${name}: fields no vacío`);
    const fieldNames = Object.keys(m.fields);
    assert.ok(fieldNames.length > 0, `${name}: al menos un campo`);
    for (const [field, keys] of Object.entries(m.fields)) {
      assert.ok(Array.isArray(keys), `${name}.${field}: keys debe ser array`);
      assert.ok(keys.length > 0, `${name}.${field}: al menos una key`);
      for (const k of keys) {
        assert.equal(k.length, 3, `${name}.${field}: key con 3 elementos`);
        assert.equal(typeof k[0], 'number', `${name}.${field}: valor objetivo number`);
        assert.equal(typeof k[1], 'number', `${name}.${field}: duración number`);
        assert.equal(typeof k[2], 'function', `${name}.${field}: ease function`);
        assert.ok(k[1] > 0, `${name}.${field}: duración > 0`);
      }
    }
  }
});

test('microDuration: suma la secuencia de keys más larga (o 0 si no existe)', () => {
  assert.equal(microDuration('squash'), 370); // 70+130+170
  assert.equal(microDuration('errorShake'), 280); // 50+70+70+90
  assert.equal(microDuration('yawn'), 1000); // 500+500
  assert.equal(microDuration('nope'), 0);
});

test('badgePopSequence: encoge 90 ms y crece 280 ms con back (coucou setBadge)', () => {
  const seq = badgePopSequence();
  assert.equal(seq.shrink.length, 1);
  assert.equal(seq.shrink[0][0], 0);
  assert.equal(seq.shrink[0][1], BADGE_POP_SHRINK_MS);
  assert.equal(typeof seq.shrink[0][2], 'function');
  assert.equal(seq.grow.length, 1);
  assert.equal(seq.grow[0][0], 1);
  assert.equal(seq.grow[0][1], BADGE_POP_GROW_MS);
  assert.equal(typeof seq.grow[0][2], 'function');
  assert.equal(BADGE_POP_SHRINK_MS, 90);
  assert.equal(BADGE_POP_GROW_MS, 280);
  assert.equal(typeof BADGE_POP_GAP_MS, 'number');
});

test('blink: 2 keys de 200 ms total que terminan en 1', () => {
  assert.equal(BLINK_DURATION, 200);
  assert.equal(BLINK_KEYS.length, 2);
  assert.equal(BLINK_KEYS[0][1] + BLINK_KEYS[1][1], BLINK_DURATION);
  assert.equal(BLINK_KEYS[1][0], 1, 'la última key abre a 1');
});

test('startMicro sobre un timeline real: squash recorre la curva y termina en reposo', () => {
  const clock = { t: 0 };
  const tl = createTimeline({ now: () => clock.t });
  assert.equal(startMicro(tl, 'squash'), true);
  assert.equal(tl.locked('sy'), true);
  assert.equal(tl.locked('sx'), true);
  assert.equal(tl.busy, true);

  clock.t = 80;
  tl.update();
  const sy = tl.get('sy');
  const sx = tl.get('sx');
  assert.ok(sy >= 0.78 && sy <= 1.1, `sy a mitad de la primera key en rango, got ${sy}`);
  assert.ok(sx >= 0.95 && sx <= 1.16, `sx a mitad de la primera key en rango, got ${sx}`);

  stepTo(clock, tl, 400);
  assert.equal(tl.get('sy'), 1, 'sy vuelve a reposo');
  assert.equal(tl.get('sx'), 1, 'sx vuelve a reposo');
  assert.equal(tl.busy, false, 'timeline libre al terminar');
});

test('startMicro invoca onComplete exactamente una vez, al final', () => {
  const clock = { t: 0 };
  const tl = createTimeline({ now: () => clock.t });
  let done = 0;
  startMicro(tl, 'approvalHop', () => done++);
  stepTo(clock, tl, 100);
  assert.equal(done, 0, 'no completa antes de tiempo');
  stepTo(clock, tl, 1000);
  assert.equal(done, 1, 'onComplete una sola vez');
});

test('startMicro con nombre inexistente devuelve false y no bloquea nada', () => {
  const clock = { t: 0 };
  const tl = createTimeline({ now: () => clock.t });
  assert.equal(startMicro(tl, 'nope'), false);
  assert.equal(tl.busy, false);
  assert.equal(tl.locked('sy'), false);
  assert.equal(tl.locked('sx'), false);
  assert.equal(tl.locked('oy'), false);
});

test('startMicro respeta los locks: yawn no pisa el squash en curso', () => {
  const clock = { t: 0 };
  const tl = createTimeline({ now: () => clock.t });
  assert.equal(startMicro(tl, 'squash'), true);
  assert.equal(startMicro(tl, 'yawn'), true, 'lanza sin excepción');
  assert.equal(tl.locked('sy'), true);
  assert.equal(tl.locked('sx'), true);

  clock.t = 80;
  tl.update();
  // sy sigue la curva de squash (0.78→1.1 en 70 ms, ease.out), no la de yawn (1→1.12).
  const sy = tl.get('sy');
  assert.ok(sy <= 1.1, `yawn no pisó sy, got ${sy}`);

  stepTo(clock, tl, 400);
  assert.equal(tl.get('sy'), 1, 'sy termina en 1 según la secuencia de squash');
  assert.equal(tl.get('sx'), 1);
  assert.equal(tl.busy, false);
});

test('set escribe en campos libres e ignora los bloqueados', () => {
  const clock = { t: 0 };
  const tl = createTimeline({ now: () => clock.t });
  tl.set('ox', 5);
  assert.equal(tl.get('ox'), 5, 'campo libre escribible');
  startMicro(tl, 'errorShake');
  tl.set('ox', 99);
  assert.notEqual(tl.get('ox'), 99, 'campo bloqueado: set es no-op');
  stepTo(clock, tl, 500);
  assert.equal(tl.get('ox'), 0, 'ox termina en 0 según errorShake');
});

test('saneamiento de easings: f(0)=0, f(1)=1 e inOut(0.5)=0.5', () => {
  assert.equal(Ease.out(0), 0);
  assert.equal(Ease.out(1), 1);
  assert.equal(Ease.back(1), 1);
  assert.equal(Ease.inOut(0.5), 0.5);
});

test('keys de cabeza ARA terminan en 0 (sin cabeza colgada)', () => {
  for (const keys of [errorHeadKeys(), nodKeys(), warningHeadKeys(WARNING_PHASES)]) {
    assert.equal(keys.at(-1)[0], 0, 'último valor = 0');
    const total = keys.reduce((a, k) => a + k[1], 0);
    assert.ok(total > 400, 'duración razonable');
    for (const k of keys) assert.ok(Number.isFinite(k[0]) && Number.isFinite(k[1]) && typeof k[2] === 'function');
  }
  // warningHeadKeys cubre exactamente la duration del fx
  const sum = warningHeadKeys(WARNING_PHASES).reduce((a, k) => a + k[1], 0);
  assert.ok(Math.abs(sum - WARNING_PHASES.duration) < 1);
});
