// guards.test.js — regression de los parches de robustez (null-guards,
// Node-safety, leaks y edge cases de timeline/micro). Cero DOM: todo corre en Node.
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/guards.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTimeline, buildPhases, piecewise } from '../src/core/timeline.js';
import { Ease } from '../src/core/anim.js';
import {
  startMicro,
  errorHeadKeys,
  nodKeys,
  warningHeadKeys,
} from '../src/runtime/micro.js';
import { WARNING_PHASES } from '../src/runtime/fx-eyes.js';
import { EgoAvatar } from '../src/runtime/avatar-element.js';
import { StudioHost } from '../src/studio/element-host.js';
import { HybridRobotAvatar } from '../src/studio/avatar.js';

/* ─── timeline: keys vacías / duraciones raras ─────────────────────────── */

test('timeline.anim con keys vacías es no-op (sin lock, sin busy)', () => {
  let t = 0;
  const tl = createTimeline({ now: () => t });
  tl.anim('hx', [], undefined, 0);
  assert.equal(tl.locked('hx'), false);
  assert.equal(tl.busy, false);
  assert.doesNotThrow(() => tl.update());
});

test('timeline.anim con keys no-array es no-op', () => {
  let t = 0;
  const tl = createTimeline({ now: () => t });
  tl.anim('hx', null, undefined, 0);
  assert.equal(tl.busy, false);
  assert.doesNotThrow(() => tl.update());
});

test('timeline.update tolera duración 0/negativa y ease ausente', () => {
  let t = 0;
  const tl = createTimeline({ now: () => t });
  tl.anim('a', [[5, 0, undefined]], undefined, 0);
  t = 10;
  assert.doesNotThrow(() => tl.update());
  assert.equal(tl.get('a'), 5);
  assert.equal(tl.locked('a'), false);

  let t2 = 0;
  const tl2 = createTimeline({ now: () => t2 });
  tl2.anim('b', [[7, -50, undefined]], undefined, 0);
  t2 = 10;
  assert.doesNotThrow(() => tl2.update());
  assert.equal(tl2.get('b'), 7);
});

test('buildPhases con timing nulo devuelve duration 0 congelado', () => {
  const p = buildPhases(null);
  assert.equal(p.duration, 0);
  assert.ok(Object.isFrozen(p));
  const p2 = buildPhases(undefined);
  assert.equal(p2.duration, 0);
});

test('piecewise con stops vacíos/nulos devuelve 0 sin lanzar', () => {
  assert.equal(piecewise(0.5, []), 0);
  assert.equal(piecewise(0.5, null), 0);
  assert.equal(piecewise(0.5, undefined), 0);
});

/* ─── micro: timeline nulo y duraciones inválidas ──────────────────────── */

test('startMicro con timeline nulo o sin métodos devuelve false', () => {
  assert.equal(startMicro(null, 'squash'), false);
  assert.equal(startMicro(undefined, 'squash'), false);
  assert.equal(startMicro({}, 'squash'), false);
  assert.equal(startMicro({ anim() {}, locked: null }, 'squash'), false);
});

test('errorHeadKeys/nodKeys sanean duración inválida a defaults', () => {
  for (const fn of [errorHeadKeys, nodKeys]) {
    for (const bad of [0, -10, NaN, undefined]) {
      const keys = fn(bad);
      assert.ok(keys.length > 0);
      assert.equal(keys.at(-1)[0], 0, 'termina en 0');
      for (const k of keys) {
        assert.ok(Number.isFinite(k[0]) && Number.isFinite(k[1]) && k[1] > 0);
        assert.equal(typeof k[2], 'function');
      }
    }
  }
  // defaults sanos: 1380 y 920
  const eh = errorHeadKeys();
  assert.ok(Math.abs(eh.reduce((a, k) => a + k[1], 0) - 1380) < 1e-9);
  const nk = nodKeys();
  assert.ok(Math.abs(nk.reduce((a, k) => a + k[1], 0) - 920) < 1e-9);
});

test('warningHeadKeys con fases nulas devuelve fallback seguro', () => {
  for (const bad of [null, undefined, 42, 'x']) {
    const keys = warningHeadKeys(bad);
    assert.ok(Array.isArray(keys) && keys.length > 0);
    assert.doesNotThrow(() => {
      let t = 0;
      const tl = createTimeline({ now: () => t });
      tl.anim('hy', keys, undefined, 0);
      t = 500;
      tl.update();
    });
  }
  // caso válido intacto: cubre la duration del fx
  const sum = warningHeadKeys(WARNING_PHASES).reduce((a, k) => a + k[1], 0);
  assert.ok(Math.abs(sum - WARNING_PHASES.duration) < 1);
});

/* ─── avatar-element: Node-safety ─────────────────────────────────────── */

test('setSeed en Node no lanza y reconstruye el genoma', () => {
  const a = new EgoAvatar();
  assert.doesNotThrow(() => a.setSeed('luna'));
  assert.ok(a.getGenome(), 'genoma construido');
  assert.equal(a.getGenome().seed, 'luna');
});

test('disconnectedCallback/_start/_stop son no-op seguros en Node', () => {
  const a = new EgoAvatar();
  assert.doesNotThrow(() => a._start());
  assert.equal(a._running, false, 'sin rAF no arranca');
  assert.doesNotThrow(() => a._stop());
  assert.doesNotThrow(() => a.disconnectedCallback());
});

test('per-frame con nodos ausentes no lanza (tint/aura/body/ojos/insignia)', () => {
  const a = new EgoAvatar();
  a.setGene('shape.roundness', 50);
  a._n = {};
  const now = Date.now();
  assert.doesNotThrow(() => a._paintTint());
  assert.doesNotThrow(() => a._updateGlow(now, 0, false));
  assert.doesNotThrow(() => a._applyMovement(0, now, 0.016, false));
  assert.doesNotThrow(() => a._applyEyes(now));
  assert.doesNotThrow(() => a._applyBadgeContent('dots'));
  assert.doesNotThrow(() => a._applyBadgeContent(null));
  assert.doesNotThrow(() => a._applyBadgeTransform());
  assert.doesNotThrow(() => a._spawnAmbientParticle('z'));
  assert.doesNotThrow(() => a._spawnAmbientParticle('sweat'));
  assert.doesNotThrow(() => a._updateBadge(now, 0));
});

test('playMicro: desconocido false; reduced-motion bloquea sin lanzar', () => {
  const a = new EgoAvatar();
  assert.equal(a.playMicro('nope-que-no-existe'), false);
  assert.equal(a.playMicro(''), false);
  assert.equal(a.playMicro(null), false);
  a._runtimeMotionQuery = { matches: true };
  assert.equal(a.playMicro('squash'), false, 'reduced-motion bloquea');
  delete a._runtimeMotionQuery;
});

test('cambio SVG→studio→SVG limpia el host previo sin lanzar', () => {
  const a = new EgoAvatar();
  a.setGene('shape.roundness', 50);
  // simula un host SVG previo colgado (caso del leak)
  a._studioHost = new StudioHost(a);
  a._renderMode = 'svg';
  // _mount en Node retorna temprano pero debe soltar el host
  assert.doesNotThrow(() => a._mount());
  assert.equal(a._studioHost, null, 'el host previo se suelta al montar SVG');
});

/* ─── studio/avatar: canvas nulo y leak de resize ─────────────────────── */

test('HybridRobotAvatar con canvas nulo no lanza; draw/resize son no-op', () => {
  let avatar = null;
  assert.doesNotThrow(() => {
    avatar = new HybridRobotAvatar(null, null);
  });
  assert.equal(avatar.ctx, null);
  assert.ok(Number.isFinite(avatar.width) && Number.isFinite(avatar.height));
  assert.doesNotThrow(() => avatar.resize());
  assert.doesNotThrow(() => avatar.draw());
  assert.doesNotThrow(() => avatar.detachInteractions());
  assert.doesNotThrow(() => avatar.detachInteractions(), 'doble detach seguro');
});

test('detachInteractions suelta el resize del constructor sin lanzar', () => {
  const canvas = {
    width: 800,
    height: 600,
    style: {},
    getContext() {
      return new Proxy({}, {
        get(t, p) {
          if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop() {} });
          if (typeof p !== 'string') return undefined;
          return (..._a) => undefined;
        },
        set(t, p, v) { t[p] = v; return true; },
      });
    },
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
  };
  const avatar = new HybridRobotAvatar(canvas, null);
  assert.equal(typeof avatar._onResize, 'function');
  assert.doesNotThrow(() => avatar.attachInteractions());
  assert.doesNotThrow(() => avatar.detachInteractions());
});

/* ─── studio/element-host: frame sanea dt ─────────────────────────────── */

test('StudioHost.frame sanea dt no-finito sin envenenar el backend', () => {
  const el = { getState: () => 'idle', _adoptExternalState() {}, _genome: null, _palette: null };
  const host = new StudioHost(el);
  const seen = [];
  host.backend = {
    state: 'idle',
    update(dt) { seen.push(dt); },
    draw() {},
  };
  assert.doesNotThrow(() => host.frame(NaN));
  assert.doesNotThrow(() => host.frame(undefined));
  assert.doesNotThrow(() => host.frame(-5));
  assert.doesNotThrow(() => host.frame(Infinity));
  assert.equal(seen.length, 4);
  for (const dt of seen) {
    assert.ok(Number.isFinite(dt) && dt > 0 && dt <= 0.1, `dt saneado, got ${dt}`);
  }
  host.detach();
});
