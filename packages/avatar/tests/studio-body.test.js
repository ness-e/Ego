// tests/studio-body.test.js — Puerto studio/render: cuerpo + overlays + partículas.
// Node-safe: ctx stub que graba llamadas (incluye strokeRect, usado por drawBoxBody).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSquirclePath, hexToRgba, roundRectPath, shadeColor } from '../src/studio/render/helpers.js';
import { drawBoxBody, drawRearChassis3D, drawSquircleBody } from '../src/studio/render/body.js';
import { drawStateOverlays, getStateAccentColor } from '../src/studio/render/overlays.js';
import { drawParticles, spawnParticles, updateParticles } from '../src/studio/render/particles.js';

function makeCtx() {
  const calls = [];
  const grad = { addColorStop() { calls.push('addColorStop'); } };
  return {
    calls,
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    translate() { calls.push('translate'); },
    scale() { calls.push('scale'); },
    rotate() { calls.push('rotate'); },
    beginPath() { calls.push('beginPath'); },
    closePath() { calls.push('closePath'); },
    fill() { calls.push('fill'); },
    stroke() { calls.push('stroke'); },
    clip() { calls.push('clip'); },
    arc() { calls.push('arc'); },
    ellipse() { calls.push('ellipse'); },
    fillRect() { calls.push('fillRect'); },
    strokeRect() { calls.push('strokeRect'); },
    clearRect() { calls.push('clearRect'); },
    moveTo() { calls.push('moveTo'); },
    lineTo() { calls.push('lineTo'); },
    quadraticCurveTo() { calls.push('quadraticCurveTo'); },
    bezierCurveTo() { calls.push('bezierCurveTo'); },
    arcTo() { calls.push('arcTo'); },
    rect() { calls.push('rect'); },
    fillText() { calls.push('fillText'); },
    createRadialGradient() { calls.push('createRadialGradient'); return grad; },
    createLinearGradient() { calls.push('createLinearGradient'); return grad; },
    setLineDash() { calls.push('setLineDash'); },
    drawImage() { calls.push('drawImage'); },
    measureText() { return { width: 0 }; }
  };
}

// Defaults del constructor (líneas 713-766 del HTML) + física/posición/look.
function makeS(over = {}) {
  return {
    variantMode: 'cx-faithful',
    bodyColor: '#1e222d',
    visorColor: '#06080e',
    showVisor: true,
    showSidePods: true,
    eyeColor: '#dbf59d',
    autoStateColors: true,
    eyeStyle: 'cx-led',
    mouthStyle: 'none',
    accessory: 'none',
    bodyWidthRatio: 1.0,
    bodyHeightRatio: 1.0,
    globalScale: 1.0,
    squircleN: 4.0,
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
    state: 'idle',
    stateTimer: 0,
    time: 0,
    x: 120, y: 120,
    vx: 0, vy: 0,
    pointerX: 120, pointerY: 120,
    headLookX: 0, headLookY: 0,
    eyeLookX: 0, eyeLookY: 0,
    bodyHoverAmount: 0,
    pettingAmount: 0,
    handVisibility: 0,
    leftHand: { x: -112, y: 20 },
    rightHand: { x: 112, y: 20 },
    particles: [],
    ...over
  };
}

test('hexToRgba formatea rgba', () => {
  assert.equal(hexToRgba('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)');
  assert.equal(hexToRgba('#0f0', 1), 'rgba(0, 255, 0, 1)');
});

test('shadeColor fija límites 0-255', () => {
  assert.equal(shadeColor('#000000', -100), '#000000');
  assert.equal(shadeColor('#ffffff', 100), '#ffffff');
  assert.match(shadeColor('#1e222d', 30), /^#[0-9a-f]{6}$/);
});

test('buildSquirclePath emite moveTo/lineTo/closePath sin lanzar', () => {
  const ctx = makeCtx();
  buildSquirclePath(ctx, 84, 77, 4.0);
  assert.ok(ctx.calls.includes('moveTo'));
  assert.ok(ctx.calls.includes('lineTo'));
  assert.ok(ctx.calls.includes('closePath'));
});

test('roundRectPath emite path sin lanzar', () => {
  const ctx = makeCtx();
  roundRectPath(ctx, 0, 0, 10, 10, 3);
  assert.ok(ctx.calls.includes('beginPath'));
});

test('cuerpos dibujan sin lanzar y registran llamadas', () => {
  for (const state of ['idle', 'error', 'waiting', 'love', 'box']) {
    const S = makeS({ state });
    let ctx = makeCtx();
    drawSquircleBody(ctx, S, 84, 77, 4.0);
    assert.ok(ctx.calls.length > 0, `squircle ${state}`);
    ctx = makeCtx();
    drawRearChassis3D(ctx, S, 84, 77, 0, -1);
    assert.ok(ctx.calls.length > 0, `chassis ${state}`);
    ctx = makeCtx();
    drawBoxBody(ctx, S, 84, 77);
    assert.ok(ctx.calls.length > 0, `box ${state}`);
  }
});

test('overlays y partículas dibujan sin lanzar en todos los estados', () => {
  for (const state of ['idle', 'error', 'waiting', 'love', 'box']) {
    const S = makeS({ state, time: 1.5, handVisibility: 1 });
    let ctx = makeCtx();
    drawStateOverlays(ctx, S, 84, 77);
    assert.ok(ctx.calls.length >= 0, `overlay ${state}`);
    ctx = makeCtx();
    S.particles = [{ type: 'spark', x: 0, y: 0, vx: 1, vy: 1, life: 0.9 }];
    drawParticles(ctx, S);
    assert.ok(ctx.calls.length > 0, `particles ${state}`);
  }
});

test('overlays con ramas activas registran llamadas', () => {
  for (const state of ['error', 'waiting', 'input', 'warning', 'listen', 'inspect', 'dizzy', 'send', 'poke', 'bored']) {
    const ctx = makeCtx();
    drawStateOverlays(ctx, makeS({ state, time: 1.2, handVisibility: 1 }), 84, 77);
    assert.ok(ctx.calls.length > 0, `overlay ${state} dibuja`);
  }
});

test('getStateAccentColor devuelve hexes documentados', () => {
  const eye = '#dbf59d';
  assert.equal(getStateAccentColor(makeS({ state: 'error' })), '#f43f5e');
  assert.equal(getStateAccentColor(makeS({ state: 'warning' })), '#f59e0b');
  assert.equal(getStateAccentColor(makeS({ state: 'love' })), '#fb7185');
  assert.equal(getStateAccentColor(makeS({ state: 'sleep' })), '#94a3b8');
  assert.equal(getStateAccentColor(makeS({ state: 'idle' })), eye);
  assert.equal(getStateAccentColor(makeS({ state: 'error', autoStateColors: false })), eye);
});

test('spawnParticles añade N partículas; updateParticles integra y expira', () => {
  const S = makeS();
  spawnParticles(S, 'spark', 5);
  assert.equal(S.particles.length, 5);
  const p0 = { ...S.particles[0] };
  updateParticles(S, 0.016);
  assert.equal(S.particles.length, 5);
  assert.equal(S.particles[0].x, p0.x + p0.vx);
  assert.equal(S.particles[0].y, p0.y + p0.vy);
  assert.ok(S.particles[0].life < p0.life);
  updateParticles(S, 10);
  assert.equal(S.particles.length, 0);
});
