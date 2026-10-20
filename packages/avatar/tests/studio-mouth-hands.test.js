// studio-mouth-hands.test.js — boca, orejas, accesorios y rig de manos (módulos studio puros).
// Cubre src/studio/render/mouth.js, ears.js, accessories.js y src/studio/rig/hands.js
// con ctx stub (Proxy) y estado plano `S` con los defaults del constructor
// (avatar_studio_cx_artlab_mochi_2_0.html, líneas 713-766).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawMouth, updateMouth } from '../src/studio/render/mouth.js';
import { drawRobotEars3D } from '../src/studio/render/ears.js';
import { drawTopAccessory } from '../src/studio/render/accessories.js';
import { drawHands, drawSingleHand, updateHandsRig } from '../src/studio/rig/hands.js';

/** ctx 2D stub: todo método es no-op; los gradientes exponen addColorStop. */
function makeStubCtx() {
    const grad = { addColorStop() {} };
    return new Proxy({}, {
        get(_t, p) {
            if (p === 'canvas') return {};
            if (p === 'roundRect') return undefined; // ejerce la rama fallback de roundRectPath
            return (..._a) => (String(p).startsWith('create') ? grad : undefined);
        },
        set() { return true; },
    });
}

/** Mano por defecto del constructor (líneas 831-842). */
function makeHand(x, rot) {
    return { x, y: 20, vx: 0, vy: 0, rot, vRot: 0, scale: 1, pose: 'normal', layer: 'front', hoverReach: 0, fingerWave: 0 };
}

/** Estado plano mínimo con los defaults del constructor (líneas 713-766 y campos usados). */
function makeFakeS(overrides = {}) {
    return {
        variantMode: 'cx-faithful',
        bodyColor: '#1e222d',
        visorColor: '#06080e',
        showVisor: true,
        showSidePods: true,
        eyeColor: '#dbf59d',
        autoStateColors: true,
        eyeStyle: 'cx-led',
        mouthStyle: 'led-wave',
        accessory: 'none',
        bodyWidthRatio: 1.0,
        bodyHeightRatio: 1.0,
        globalScale: 1.0,
        visorWidthRatio: 1.0,
        visorHeightRatio: 1.0,
        visorCornerRadius: 30,
        eyeWidthRatio: 1.0,
        eyeHeightRatio: 1.0,
        eyeSpacing: 28,
        eyeOffsetY: -2,
        eyeGlowBlur: 18,
        mouthScale: 1.0,
        mouthOffsetY: 24,
        accessoryScale: 1.0,
        accessoryOffsetY: 0,
        accessoryBounce: 1.0,
        jellyIntensity: 1.0,
        parallaxIntensity: 1.0,
        liveliness: 1.0,
        handsMode: 'auto',
        handScaleConfig: 1.0,
        handsActiveTimer: 0,
        handVisibility: 1,
        isTalking: false,
        talkTimer: 0,
        mouthOpen: 0,
        mouthWidth: 1,
        state: 'idle',
        stateTimer: 0,
        time: 0,
        x: 400, y: 300, vx: 0, vy: 0,
        isDragging: false,
        dragStretchX: 0, dragStretchY: 0,
        isHoveringBody: false,
        bodyHoverAmount: 0,
        leftPodHoverAmount: 0, rightPodHoverAmount: 0,
        leftHandHoverAmount: 0, rightHandHoverAmount: 0,
        pointerX: 400, pointerY: 300,
        headLookX: 0, headLookY: 0,
        eyeLookX: 0, eyeLookY: 0,
        spinAngle: 0, spinTarget: 0,
        antennaAngle: 0,
        earPerk: 0,
        leftHand: makeHand(-112, -0.15),
        rightHand: makeHand(112, 0.15),
        ...overrides,
    };
}

// D4 (2026-10-19): 'mochi-cute' se eliminó del catálogo; la lista cubre los
// cinco estilos de boca vigentes.
const MOUTH_STYLES = ['none', 'led-wave', 'cat-kawaii', 'vocoder', 'pixel-mouth'];
const MOUTH_STATES = ['idle', 'error', 'love', 'sleep'];
const ACCESSORIES = ['none', 'cx-full-kit', 'cx-antenna', 'headphones', 'cat-ears', 'bunny-ears',
    'fox-ears', 'bear-ears', 'aviator-glasses', 'cyber-goggles', 'glasses', 'witch',
    'crown', 'halo', 'sprout', 'santa'];
const POSES = ['open', 'fist', 'point', 'type', 'thumbsup', 'grip', 'rest'];

function assertFiniteHand(S, label) {
    for (const key of ['leftHand', 'rightHand']) {
        for (const f of ['x', 'y', 'rot', 'scale']) {
            assert.ok(Number.isFinite(S[key][f]), `${label}: ${key}.${f} finito (${S[key][f]})`);
        }
    }
}

// --- updateMouth ---

test('updateMouth: hablando abre la boca en (0,1] y todo es finito', () => {
    const S = makeFakeS({ state: 'talk', talkTimer: 5, time: 0.5 });
    let max = 0;
    for (let i = 0; i < 40; i++) {
        S.time += 1 / 60;
        if (S.talkTimer <= 0) S.talkTimer = 5;
        updateMouth(S, 1 / 60);
        assert.ok(Number.isFinite(S.mouthOpen) && Number.isFinite(S.mouthWidth), 'finitos');
        max = Math.max(max, S.mouthOpen);
    }
    assert.ok(S.mouthOpen > 0, `boca abierta al hablar (${S.mouthOpen})`);
    assert.ok(max <= 1.1, `apertura acotada (${max})`);
});

test('updateMouth: en idle decae a 0 y todo es finito', () => {
    const S = makeFakeS({ state: 'idle', mouthOpen: 0.8, mouthWidth: 1.2, time: 1 });
    for (let i = 0; i < 200; i++) {
        S.time += 1 / 60;
        updateMouth(S, 1 / 60);
    }
    assert.ok(Math.abs(S.mouthOpen) < 0.01, `decae a 0 (${S.mouthOpen})`);
    assert.ok(Number.isFinite(S.mouthOpen) && Number.isFinite(S.mouthWidth), 'finitos');
});

test('updateMouth: listen oscila sin explotar', () => {
    const S = makeFakeS({ state: 'listen', time: 2 });
    for (let i = 0; i < 60; i++) {
        S.time += 1 / 60;
        updateMouth(S, 1 / 60);
        assert.ok(Number.isFinite(S.mouthOpen) && Number.isFinite(S.mouthWidth), 'finitos');
    }
    assert.ok(S.mouthOpen >= 0 && S.mouthOpen <= 0.5, `rango listen (${S.mouthOpen})`);
});

// --- drawMouth ---

test('drawMouth no lanza para los 5 estilos × idle/error/love/sleep', () => {
    // D4 (2026-10-19): 'mochi-cute' se eliminó del catálogo; quedan 5 estilos
    // vigentes -> 5 x 4 = 20 combinaciones.
    const ctx = makeStubCtx();
    let count = 0;
    for (const mouthStyle of MOUTH_STYLES) {
        for (const state of MOUTH_STATES) {
            const S = makeFakeS({ mouthStyle, state, mouthOpen: state === 'idle' ? 0 : 0.5, time: 1.3 });
            assert.doesNotThrow(() => drawMouth(ctx, S, 84, 77), `${mouthStyle}/${state}`);
            count++;
        }
    }
    assert.equal(count, 20);
});

// --- updateHandsRig ---

test('updateHandsRig fija manos finitas en idle/wave/input/error/box', () => {
    for (const state of ['idle', 'wave', 'input', 'error', 'box']) {
        const S = makeFakeS({ state, time: 1.1, handVisibility: 1 });
        for (let i = 0; i < 10; i++) {
            S.time += 1 / 60;
            updateHandsRig(S, 1 / 60);
        }
        assertFiniteHand(S, state);
        assert.ok(typeof S.leftHand.pose === 'string' && typeof S.rightHand.pose === 'string', `${state}: poses`);
        assert.ok(['front', 'back'].includes(S.leftHand.layer), `${state}: capa izq`);
    }
});

test('updateHandsRig con handVisibility 0 retrae (targets de retracción)', () => {
    const S = makeFakeS({ state: 'idle', time: 0.7, handVisibility: 0 });
    for (let i = 0; i < 30; i++) {
        S.time += 1 / 60;
        updateHandsRig(S, 1 / 60);
    }
    assertFiniteHand(S, 'retract');
    assert.ok(S.leftHand.scale < 0.01 && S.rightHand.scale < 0.01,
        `escala mínima al retraer (${S.leftHand.scale}/${S.rightHand.scale})`);
});

// --- drawHands / drawSingleHand ---

test('drawHands y drawSingleHand no lanzan para open/fist/point/type/thumbsup/grip/rest', () => {
    const ctx = makeStubCtx();
    for (const pose of POSES) {
        const S = makeFakeS({
            handVisibility: 1, time: 0.9,
            leftHand: { ...makeHand(-60, -0.2), pose, layer: 'front' },
            rightHand: { ...makeHand(60, 0.2), pose, layer: 'front' },
        });
        assert.doesNotThrow(() => drawHands(ctx, S, 'front'), `drawHands/${pose}`);
        assert.doesNotThrow(() => drawHands(ctx, S, 'back'), `drawHands-back/${pose} (vacío)`);
        assert.doesNotThrow(() => drawSingleHand(ctx, S, S.leftHand, true), `drawSingleHand-L/${pose}`);
        assert.doesNotThrow(() => drawSingleHand(ctx, S, S.rightHand, false), `drawSingleHand-R/${pose}`);
    }
    // handVisibility ~0: drawHands retorna sin dibujar
    const hidden = makeFakeS({ handVisibility: 0 });
    assert.doesNotThrow(() => drawHands(ctx, hidden, 'front'), 'drawHands oculto');
});

test('drawSingleHand cubre poses wave/stop/normal/thumbsup sin visor', () => {
    // El nombre histórico era "modo mochi"; la condición real que ejercita
    // esta rama es `showVisor: false` (cuerpo sin visor). D4 (2026-10-19)
    // eliminó la variante visual heredada; la cobertura se conserva.
    const ctx = makeStubCtx();
    for (const pose of ['wave', 'stop', 'normal', 'thumbsup']) {
        const S = makeFakeS({ showVisor: false, time: 0.4, leftHand: { ...makeHand(-50, 0), pose } });
        assert.doesNotThrow(() => drawSingleHand(ctx, S, S.leftHand, true), `sin-visor/${pose}`);
    }
});

// --- drawRobotEars3D ---

test('drawRobotEars3D corre en pase back y front', () => {
    const ctx = makeStubCtx();
    for (const pass of ['back', 'front']) {
        const S = makeFakeS({ time: 1.2, state: 'talk', leftPodHoverAmount: 0.3, rightPodHoverAmount: 0.1 });
        assert.doesNotThrow(() => drawRobotEars3D(ctx, S, 84, 77, pass, 0.4, 0.9), `pase ${pass}`);
        const S2 = makeFakeS({ time: 0.5, state: 'idle' });
        assert.doesNotThrow(() => drawRobotEars3D(ctx, S2, 84, 77, pass), `pase ${pass} por defecto`);
    }
});

// --- drawTopAccessory ---

test('drawTopAccessory corre para los 16 accesorios sin lanzar', () => {
    const ctx = makeStubCtx();
    assert.equal(ACCESSORIES.length, 16);
    for (const accessory of ACCESSORIES) {
        const S = makeFakeS({ accessory, time: 1.7, state: 'talk', bodyHoverAmount: 0.3 });
        assert.doesNotThrow(() => drawTopAccessory(ctx, S, 84, 77), accessory);
        // variante con giro para ejercer ramas de profundidad 3D
        assert.doesNotThrow(() => drawTopAccessory(ctx, S, 84, 77, 12, 0.5), `${accessory}/giro`);
    }
});
