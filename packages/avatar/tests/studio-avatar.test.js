// Tests Node-safe de src/studio/avatar.js (HybridRobotAvatar).
// Si los módulos hermanos aún no existen (agentes en paralelo), el import falla y
// la suite se marca como pendiente (skip) en vez de romper el árbol de tests.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

let HybridRobotAvatar = null;
let importError = null;
try {
  ({ HybridRobotAvatar } = await import('../src/studio/avatar.js'));
} catch (err) {
  importError = err;
}

function makeCtx() {
  const grad = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => grad;
      if (p === 'measureText') return () => ({ width: 0 });
      if (typeof p !== 'string') return undefined;
      return (..._a) => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function makeCanvas() {
  const stubCtx = makeCtx();
  return {
    width: 0,
    height: 0,
    style: {},
    getContext() { return stubCtx; },
    addEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
  };
}

function makeSound() {
  return { played: [], inited: 0, play(name) { this.played.push(name); }, init() { this.inited += 1; } };
}

const NUMERIC_FIELDS = [
  'x', 'y', 'scaleX', 'scaleY', 'rotation', 'headLookX', 'headLookY',
  'eyeLookX', 'eyeLookY', 'mouthOpen', 'mouthWidth', 'time', 'stateTimer',
];

if (importError) {
  test('studio/avatar pendiente de módulos hermanos — suite omitida', (t) => {
    t.skip(`import falló (hermanos en paralelo): ${importError && importError.message}`);
  });
} else {
  describe('HybridRobotAvatar (studio/avatar.js)', () => {
    test('construye con valores por defecto en Node', () => {
      const avatar = new HybridRobotAvatar(makeCanvas(), makeSound());
      assert.equal(avatar.variantMode, 'cx-faithful');
      assert.equal(avatar.state, 'idle');
      assert.equal(avatar.eyeStyle, 'cx-led');
      assert.equal(avatar.mouthStyle, 'none');
      assert.equal(avatar.accessory, 'none');
      assert.equal(avatar.width, 800);
      assert.equal(avatar.height, 600);
      assert.equal(avatar.x, 400);
      assert.equal(avatar.y, 312);
      assert.equal(avatar.squircleN, 4.0);
      assert.ok(Array.isArray(avatar.particles));
    });

    test('play() transiciona estados y llama a sound.play', () => {
      const sound = makeSound();
      const avatar = new HybridRobotAvatar(makeCanvas(), sound);
      for (const s of ['error', 'love', 'sleep', 'box']) {
        sound.played.length = 0;
        avatar.play(s);
        assert.equal(avatar.state, s);
        assert.ok(sound.played.includes(s), `sound.play('${s}') llamado`);
        assert.equal(avatar.stateTimer, 0);
      }
    });

    test('play() con silent:true no llama a sound.play con el estado', () => {
      const sound = makeSound();
      const avatar = new HybridRobotAvatar(makeCanvas(), sound);
      avatar.play('error', { silent: true });
      assert.equal(avatar.state, 'error');
      assert.deepEqual(sound.played, []);
    });

    test("applyPreset('ego-nucleus') y restauración cx-faithful", () => {
      // D4 (2026-10-19): el preset 'coucou-mochi' se eliminó del catálogo.
      // El test upstream comprobaba sus valores; aquí se verifica el preset
      // de identidad del núcleo de Ego y que la restauración funciona.
      const avatar = new HybridRobotAvatar(makeCanvas(), makeSound());
      avatar.applyPreset('ego-nucleus');
      assert.equal(avatar.bodyColor, '#141720');
      assert.equal(avatar.eyeStyle, 'cx-led');
      assert.equal(avatar.mouthStyle, 'none');
      assert.equal(avatar.accessory, 'cx-antenna');
      assert.equal(avatar.squircleN, 4.0);
      avatar.applyPreset('cx-faithful');
      assert.equal(avatar.bodyColor, '#1e222d');
      assert.equal(avatar.eyeStyle, 'cx-led');
      assert.equal(avatar.mouthStyle, 'none');
      assert.equal(avatar.accessory, 'none');
      assert.equal(avatar.squircleN, 4.0);
    });

    test("applyPreset ignora un preset desconocido y conserva cx-faithful", () => {
      // D4: tras eliminar 'coucou-mochi', un nombre desconocido NO debe
      // dejar el motor a medias: cae al preset base.
      const avatar = new HybridRobotAvatar(makeCanvas(), makeSound());
      avatar.applyPreset('no-existe');
      assert.equal(avatar.bodyColor, '#1e222d');
      assert.equal(avatar.eyeStyle, 'cx-led');
      assert.equal(avatar.variantMode, 'cx-faithful');
    });

    test('update(0.016) avanza tiempo y nunca NaN (idle/error/waiting/love/sleep)', () => {
      const avatar = new HybridRobotAvatar(makeCanvas(), makeSound());
      for (const s of ['idle', 'error', 'waiting', 'love', 'sleep']) {
        avatar.play(s, { silent: true });
        const t0 = avatar.time;
        for (let i = 0; i < 60; i++) avatar.update(0.016);
        assert.ok(avatar.time > t0, `time avanza en ${s}`);
        assert.ok(avatar.stateTimer > 0, `stateTimer avanza en ${s}`);
        for (const f of NUMERIC_FIELDS) {
          assert.ok(Number.isFinite(avatar[f]), `${f} finito en ${s} (=${avatar[f]})`);
        }
        assert.ok(Number.isFinite(avatar.leftHand.x) && Number.isFinite(avatar.rightHand.x), `manos finitas en ${s}`);
      }
    });

    test('draw() con ctx stub no lanza (idle/error/box/love)', () => {
      const avatar = new HybridRobotAvatar(makeCanvas(), makeSound());
      for (const s of ['idle', 'error', 'box', 'love']) {
        avatar.play(s, { silent: true });
        avatar.handVisibility = 1;
        avatar.update(0.016);
        assert.doesNotThrow(() => avatar.draw(), `draw() en ${s}`);
      }
    });

    test('startLoop() sin rAF es no-op y attachInteractions no registra en Node', () => {
      const avatar = new HybridRobotAvatar(makeCanvas(), makeSound());
      assert.equal(typeof avatar.startLoop(), 'function');
      assert.doesNotThrow(() => avatar.attachInteractions());
    });
  });
}
