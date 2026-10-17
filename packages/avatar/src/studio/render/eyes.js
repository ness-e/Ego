// eyes.js — Ojos del avatar studio (puerto verbatim del avatar studio).
// Fuente: repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
//   buildEyeSilhouettePath: líneas 922-981 · drawEyes: 2565-2588 ·
//   drawCyberVisorBar: 2593-2633 · drawSingleEye: 2635-2898 ·
//   drawCXArtLabEye: 2905-3028 · getStateAccentColor: 2069-2096.
// Vanilla ESM, sin dependencias. `S` es el objeto plano de estado del avatar
// (nunca se importa la clase — evita ciclos). `ctx` solo se toca dentro.
// Orden de ramas de drawSingleEye preservado: cx-led → terminal → dizzy →
// cross → arch → sleep → love → mochi → pixel → anime → cyclops.

import { roundRectPath, hexToRgba, shadeColor } from './helpers.js';

/** Color de acento según el estado (respeta S.autoStateColors / S.eyeColor). */
export function getStateAccentColor(S) {
  if (!S.autoStateColors) return S.eyeColor;
  switch (S.state) {
    case 'error':
    case 'blocked':
    case 'poke':
      return '#f43f5e';
    case 'warning':
      return '#f59e0b';
    case 'waiting':
    case 'input':
    case 'inspect':
    case 'listen':
      return '#38bdf8';
    case 'failure':
    case 'bored':
      return '#818cf8';
    case 'love':
      return '#fb7185';
    case 'surprise':
    case 'send':
      return '#c084fc';
    case 'sleep':
      return '#94a3b8';
    default:
      return S.eyeColor;
  }
}

/*
 * TRUE EYE SILHOUETTE GENERATOR (Fixes Point #1 completely):
 * Instead of drawing a full open eye and painting a fake "eyelid" polygon inside it,
 * this builds the exact closed vector contour of the squinted/slanted/arched eye!
 */
export function buildEyeSilhouettePath(ctx, w, h, baseRad, rig, isLeft, includeRingHole = false) {
  const dir = isLeft ? 1 : -1;
  const halfW = Math.max(4, w / 2);
  const halfH = Math.max(2, h / 2);

  const topBase = -halfH + h * Math.min(0.82, rig.topLid);
  const botBase = halfH - h * Math.min(0.82, rig.bottomLid);
  const slantPx = rig.slant * h * 0.42 * dir;

  // Left (-halfW) and Right (+halfW) Y coordinates of the top edge
  const yTL = Math.min(botBase - 2.5, Math.max(-halfH, topBase - slantPx));
  const yTR = Math.min(botBase - 2.5, Math.max(-halfH, topBase + slantPx));

  // Bottom edge Y coordinates + upward/downward arch curve control point
  const yBL = Math.max(yTL + 2.5, Math.min(halfH, botBase));
  const yBR = Math.max(yTR + 2.5, Math.min(halfH, botBase));

  const leftEdgeH = Math.max(2, yBL - yTL);
  const rightEdgeH = Math.max(2, yBR - yTR);

  const rTL = Math.min(baseRad, halfW * 0.48, leftEdgeH * 0.46);
  const rTR = Math.min(baseRad, halfW * 0.48, rightEdgeH * 0.46);
  const rBR = Math.min(baseRad, halfW * 0.48, rightEdgeH * 0.46);
  const rBL = Math.min(baseRad, halfW * 0.48, leftEdgeH * 0.46);

  // Curve control offsets for happy/sad expressions
  const topCurveOffset = -rig.happyArch * h * 0.22;
  const botCurveOffset = -rig.sadArch * h * 0.34 - rig.happyArch * h * 0.28;

  ctx.beginPath();
  ctx.moveTo(-halfW + rTL, yTL);
  ctx.quadraticCurveTo(
    0,
    (yTL + yTR) * 0.5 + topCurveOffset,
    halfW - rTR,
    yTR
  );
  ctx.quadraticCurveTo(halfW, yTR, halfW, yTR + rTR);
  ctx.lineTo(halfW, yBR - rBR);
  ctx.quadraticCurveTo(halfW, yBR, halfW - rBR, yBR);
  ctx.quadraticCurveTo(
    0,
    (yBL + yBR) * 0.5 + botCurveOffset,
    -halfW + rBL,
    yBL
  );
  ctx.quadraticCurveTo(-halfW, yBL, -halfW, yBL - rBL);
  ctx.lineTo(-halfW, yTL + rTL);
  ctx.quadraticCurveTo(-halfW, yTL, -halfW + rTL, yTL);
  ctx.closePath();

  // True transparent inner cutout for 'surprise' ring using evenodd winding rule
  if (includeRingHole && rig.ring > 0.08) {
    const holeRX = Math.max(1.5, w * 0.24 * rig.ring);
    const holeRY = Math.max(1.5, Math.min(leftEdgeH, rightEdgeH) * 0.26 * rig.ring);
    const centerY = (yTL + yTR + yBL + yBR) * 0.25;
    ctx.moveTo(holeRX, centerY);
    ctx.ellipse(0, centerY, holeRX, holeRY, 0, 0, Math.PI * 2, true);
  }
}

export function drawEyes(ctx, S, rx, ry) {
  const shiftX = S.eyeLookX * 24;
  const shiftY = S.eyeLookY * 18;
  const spacing = S.eyeStyle === 'cyclops' ? 0 : S.eyeSpacing;
  const baseY = S.eyeOffsetY + shiftY;

  const leftScaleX = 1.0 - Math.max(0, -S.eyeLookX) * 0.25;
  const rightScaleX = 1.0 - Math.max(0, S.eyeLookX) * 0.25;

  const activeColor = getStateAccentColor(S);

  if (S.eyeStyle === 'cyber-visor') {
    drawCyberVisorBar(ctx, S, shiftX, baseY - 2, activeColor);
    return;
  }

  if (S.eyeStyle === 'cyclops') {
    drawSingleEye(ctx, S, shiftX, baseY, 1.32, true, activeColor);
    return;
  }

  drawSingleEye(ctx, S, -spacing + shiftX, baseY, leftScaleX, true, activeColor);
  drawSingleEye(ctx, S, spacing + shiftX, baseY, rightScaleX, false, activeColor);
}

/*
 * Cyber Visor Bar with True Silhouette Contour (bends into V-slant, sad droop, happy arch, or equalizer)
 */
export function drawCyberVisorBar(ctx, S, x, y, activeColor) {
  const rig = S.leftEye;
  ctx.save();
  ctx.translate(x, y + rig.offY);

  const barW = (S.eyeSpacing * 2 + 44) * S.eyeWidthRatio;
  const barH = Math.max(4, rig.h * 0.62);
  const halfW = barW / 2;
  const halfH = barH / 2;

  ctx.shadowColor = activeColor;
  ctx.shadowBlur = S.eyeGlowBlur;
  ctx.fillStyle = activeColor;

  // Build true morphed contour of the visor bar
  const topCut = -halfH + barH * rig.topLid * 0.55;
  const centerDip = rig.slant * barH * 0.65 - rig.happyArch * barH * 0.45;
  const sideDroop = -rig.slant * barH * 0.35 + rig.sadArch * barH * 0.4;

  ctx.beginPath();
  ctx.moveTo(-halfW, topCut + sideDroop);
  ctx.quadraticCurveTo(0, topCut + centerDip, halfW, topCut + sideDroop);
  ctx.lineTo(halfW, halfH + sideDroop * 0.5);
  ctx.quadraticCurveTo(0, halfH - rig.happyArch * barH * 0.5 - rig.sadArch * barH * 0.35, -halfW, halfH + sideDroop * 0.5);
  ctx.closePath();
  ctx.fill();

  // Internal scanning beam for waiting / input / inspect
  ctx.save();
  ctx.clip();
  if (['waiting', 'input', 'inspect', 'send'].includes(S.state)) {
    const scanX = Math.sin(S.time * 7) * (halfW * 0.75);
    const scanGrad = ctx.createRadialGradient(scanX, 0, 2, scanX, 0, 24);
    scanGrad.addColorStop(0, '#ffffff');
    scanGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(-halfW, -barH, barW, barH * 2);
  }
  ctx.restore();
  ctx.restore();
}

export function drawSingleEye(ctx, S, x, y, scaleXFactor, isLeft, activeColor) {
  const rig = isLeft ? S.leftEye : S.rightEye;
  ctx.save();
  ctx.translate(x + rig.offX, y + rig.offY);
  ctx.scale(scaleXFactor, 1);

  if (S.eyeStyle === 'cx-led') {
    drawCXArtLabEye(ctx, S, rig, isLeft, activeColor);
    ctx.restore();
    return;
  }

  const w = Math.max(8, rig.w);
  const h = Math.max(3.5, rig.h);
  const rad = Math.min(w / 2, h / 2, rig.radius);

  const isDarkMochiEye = (S.eyeStyle === 'mochi-sphere' && !S.showVisor && !S.autoStateColors);
  const strokeColor = (S.eyeStyle === 'mochi-sphere' && !S.showVisor) ? '#181210' : activeColor;

  if (!isDarkMochiEye && S.eyeStyle !== 'mochi-sphere') {
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = S.eyeGlowBlur;
  }

  // 1. Terminal Prompts Eye Style (Dynamic ASCII per state!)
  if (S.eyeStyle === 'terminal') {
    ctx.fillStyle = activeColor;
    ctx.font = `bold ${Math.round(24 * Math.min(S.eyeWidthRatio, S.eyeHeightRatio))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let sym = isLeft ? '>' : '_';
    if (['success', 'wake', 'wave', 'spin'].includes(S.state) || S.pettingAmount > 0.3) sym = '^';
    else if (S.state === 'error') sym = 'X';
    else if (S.state === 'blocked' || S.state === 'poke') sym = isLeft ? '>' : '<';
    else if (S.state === 'warning') sym = '!';
    else if (S.state === 'surprise') sym = 'O';
    else if (S.state === 'failure') sym = 'T';
    else if (S.state === 'sleep' || S.state === 'bored') sym = '-';
    else if (S.state === 'waiting' || S.state === 'inspect') sym = '?';
    else if (S.state === 'dizzy') sym = '@';
    else if (S.state === 'love') sym = '♥';
    else if (S.state === 'send') sym = '$';
    ctx.fillText(sym, 0, 0);
    ctx.restore();
    return;
  }

  // 2. Universal Special Vector States (Dizzy Spiral, Error X, Happy Arch, Sleep Curve)
  if (S.state === 'dizzy') {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const spin = S.time * 10 * (isLeft ? 1 : -1);
    for (let a = 0; a < Math.PI * 3.4; a += 0.25) {
      const r = a * 1.6 * S.eyeWidthRatio;
      const px = Math.cos(a + spin) * r;
      const py = Math.sin(a + spin) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (rig.cross > 0.5) {
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const s = 10 * Math.min(S.eyeWidthRatio, S.eyeHeightRatio);
    ctx.beginPath();
    ctx.moveTo(-s, -s); ctx.lineTo(s, s);
    ctx.moveTo(s, -s);  ctx.lineTo(-s, s);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (rig.happyArch > 0.55 || S.eyeStyle === 'zen-arc') {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    const dir = isLeft ? 1 : -1;
    const slantY = rig.slant * 8 * dir;
    const archLift = (S.state === 'failure' || S.state === 'sleep')
      ? h * 0.45
      : -h * 0.55;
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, 4 - slantY);
    ctx.quadraticCurveTo(0, archLift, w * 0.46, 4 + slantY);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (S.state === 'sleep' && S.blinkProgress > 0.7) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -2);
    ctx.quadraticCurveTo(0, 6, w * 0.45, -2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (S.state === 'love' || S.eyeStyle === 'heart') {
    const heartColor = (S.state === 'love' || !S.autoStateColors) ? '#f43f5e' : activeColor;
    ctx.fillStyle = heartColor;
    const pulse = (1 + Math.sin(S.time * 10) * 0.12) * Math.min(S.eyeWidthRatio, S.eyeHeightRatio);
    ctx.save();
    ctx.scale(pulse, pulse);
    // Clip heart to true eyelid silhouette if squinting/slanted!
    if (rig.topLid > 0.04 || Math.abs(rig.slant) > 0.04) {
      buildEyeSilhouettePath(ctx, 32, 34, 12, rig, isLeft, false);
      ctx.clip();
    }
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-16, -4, -16, -18, 0, -9);
    ctx.bezierCurveTo(16, -18, 16, -4, 0, 8);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  // 3. Mochi 2.0, Pixel, Anime & Cyclops Eyes with TRUE SILHOUETTE CLIPPING (Zero fake mask polygons!)
  if (S.eyeStyle === 'mochi-sphere') {
    const mw = Math.max(10, w * 0.92);
    const mh = Math.max(5, h * 0.94);

    // Subtle soft drop shadow of the eye socket
    ctx.save();
    ctx.translate(0, 1.5);
    buildEyeSilhouettePath(ctx, mw + 1.5, mh + 1.5, Math.min(mw, mh) * 0.5, rig, isLeft, false);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fill();
    ctx.restore();

    // Clip directly to the true morphed eye silhouette!
    ctx.save();
    buildEyeSilhouettePath(ctx, mw, mh, Math.min(mw, mh) * 0.5, rig, isLeft, false);
    ctx.clip();

    const eyeGrad = ctx.createLinearGradient(0, -mh / 2, 0, mh / 2);
    eyeGrad.addColorStop(0, '#09090b');
    eyeGrad.addColorStop(0.68, '#18181b');
    eyeGrad.addColorStop(1, '#3f3f46');
    ctx.fillStyle = eyeGrad;
    ctx.fillRect(-mw, -mh, mw * 2, mh * 2);

    // Lower iris bounce reflection (tinted by state accent when active)
    ctx.fillStyle = S.autoStateColors && S.state !== 'idle'
      ? hexToRgba(activeColor, 0.28)
      : 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, mh * 0.24, mw * 0.34 * rig.pupilScale, mh * 0.18 * rig.pupilScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main upper-left catchlight (scales with pupilScale & quivers on failure/warning)
    const jitter = (S.state === 'failure' || S.state === 'warning') ? Math.sin(S.time * 35) * 0.8 : 0;
    const pupilShiftX = S.eyeLookX * 2.8 + jitter;
    const pupilShiftY = S.eyeLookY * 2.8 + jitter;
    const catchR = 4.5 * rig.pupilScale;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-mw * 0.15 + pupilShiftX, -mh * 0.18 + pupilShiftY, catchR, catchR * 1.12, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Secondary bottom-right catchlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.arc(mw * 0.16 + pupilShiftX * 0.5, mh * 0.16 + pupilShiftY * 0.5, 2.2 * rig.pupilScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  } else if (S.eyeStyle === 'pixel') {
    const pw = Math.round(w * 0.88);
    const ph = Math.max(5, Math.round(h * 0.85));
    ctx.save();
    buildEyeSilhouettePath(ctx, pw, ph, 2, rig, isLeft, true);
    ctx.clip('evenodd');

    ctx.fillStyle = activeColor;
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);

    // Pixel pupil
    const pSize = Math.max(4, Math.round(6 * rig.pupilScale));
    ctx.fillStyle = '#090b10';
    ctx.fillRect(
      Math.round(-pSize / 2 + S.eyeLookX * 4),
      Math.round(-pSize / 2 + S.eyeLookY * 4),
      pSize,
      pSize
    );
    ctx.restore();
  } else if (S.eyeStyle === 'anime') {
    const aw = w * 1.04;
    const ah = Math.max(5, h * 0.96);
    ctx.save();
    buildEyeSilhouettePath(ctx, aw, ah, Math.min(aw, ah) * 0.48, rig, isLeft, false);
    ctx.clip();

    const animeGrad = ctx.createLinearGradient(0, -ah / 2, 0, ah / 2);
    animeGrad.addColorStop(0, shadeColor(activeColor, -25));
    animeGrad.addColorStop(0.55, activeColor);
    animeGrad.addColorStop(1, shadeColor(activeColor, 35));
    ctx.fillStyle = animeGrad;
    ctx.fillRect(-aw, -ah, aw * 2, ah * 2);

    // Rotating 4-point star sparkle inside anime eye
    ctx.save();
    ctx.translate(S.eyeLookX * 3, S.eyeLookY * 3);
    ctx.rotate(S.time * (S.state === 'success' ? 4 : 1.2));
    const starS = 9.5 * rig.pupilScale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -starS); ctx.quadraticCurveTo(0, 0, starS, 0);
    ctx.quadraticCurveTo(0, 0, 0, starS); ctx.quadraticCurveTo(0, 0, -starS, 0);
    ctx.quadraticCurveTo(0, 0, 0, -starS);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5, -6, 3 * rig.pupilScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (S.eyeStyle === 'cyclops') {
    const cw = w * 1.15;
    const ch = h * 1.05;
    ctx.save();
    buildEyeSilhouettePath(ctx, cw, ch, Math.min(cw, ch) * 0.5, rig, isLeft, false);
    ctx.clip();

    ctx.fillStyle = '#111827';
    ctx.fillRect(-cw, -ch, cw * 2, ch * 2);

    // Outer glowing aperture ring
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(cw, ch) * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    // Inner HAL-9000 iris
    const irisR = Math.max(4, 9.5 * rig.pupilScale);
    const irisGrad = ctx.createRadialGradient(S.eyeLookX * 4, S.eyeLookY * 4, 1, S.eyeLookX * 4, S.eyeLookY * 4, irisR);
    irisGrad.addColorStop(0, '#ffffff');
    irisGrad.addColorStop(0.4, activeColor);
    irisGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(S.eyeLookX * 4, S.eyeLookY * 4, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/*
 * Dedicated True-Silhouette CX-ArtLab LED Eye Renderer:
 * Uses `buildEyeSilhouettePath` for both the outer neon glow and the clipped LED matrix,
 */
export function drawCXArtLabEye(ctx, S, rig, isLeft, activeColor) {
  const w = Math.max(8, rig.w);
  const h = Math.max(3.5, rig.h);
  const rad = Math.min(w / 2, h / 2, rig.radius);

  if (S.state === 'dizzy') {
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = S.eyeGlowBlur;
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const spin = S.time * 11 * (isLeft ? 1 : -1);
    for (let a = 0; a < Math.PI * 3.5; a += 0.22) {
      const r = a * 1.65 * Math.min(S.eyeWidthRatio, S.eyeHeightRatio);
      const px = Math.cos(a + spin) * r;
      const py = Math.sin(a + spin) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    return;
  }

  if (S.state === 'love') {
    const loveColor = S.autoStateColors ? '#f43f5e' : activeColor;
    ctx.shadowColor = loveColor;
    ctx.shadowBlur = S.eyeGlowBlur;
    ctx.fillStyle = loveColor;
    const pulse = (1.05 + Math.sin(S.time * 10) * 0.12) * Math.min(S.eyeWidthRatio, S.eyeHeightRatio);
    ctx.save();
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-16, -4, -16, -18, 0, -9);
    ctx.bezierCurveTo(16, -18, 16, -4, 0, 8);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (rig.cross > 0.5) {
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = S.eyeGlowBlur;
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    const s = 11 * Math.min(S.eyeWidthRatio, S.eyeHeightRatio);
    ctx.beginPath();
    ctx.moveTo(-s, -s); ctx.lineTo(s, s);
    ctx.moveTo(s, -s);  ctx.lineTo(-s, s);
    ctx.stroke();
    return;
  }

  if (rig.happyArch > 0.55) {
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = S.eyeGlowBlur;
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, 5);
    ctx.quadraticCurveTo(0, -h * 0.58, w * 0.48, 5);
    ctx.stroke();
    return;
  }

  if (S.state === 'sleep' && S.blinkProgress > 0.7) {
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = S.eyeGlowBlur * 0.7;
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -2);
    ctx.quadraticCurveTo(0, 7, w * 0.45, -2);
    ctx.stroke();
    return;
  }

  // 1. Outer Neon Glow Cast Directly From the Morphed Silhouette Path!
  ctx.save();
  ctx.shadowColor = activeColor;
  ctx.shadowBlur = S.eyeGlowBlur;
  ctx.fillStyle = activeColor;
  buildEyeSilhouettePath(ctx, w, h, rad, rig, isLeft, true);
  ctx.fill('evenodd');
  ctx.restore();

  // 2. Clipped LED Matrix Interior Using the Exact Same Silhouette Contour
  ctx.save();
  buildEyeSilhouettePath(ctx, w, h, rad, rig, isLeft, true);
  ctx.clip('evenodd');

  const ledGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  ledGrad.addColorStop(0, shadeColor(activeColor, 20));
  ledGrad.addColorStop(0.5, activeColor);
  ledGrad.addColorStop(1, shadeColor(activeColor, -12));
  ctx.fillStyle = ledGrad;
  ctx.fillRect(-w, -h, w * 2, h * 2);

  // Subtle horizontal LED scanline texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
  for (let py = -h; py < h; py += 3.5) {
    ctx.fillRect(-w, py, w * 2, 1);
  }

  // Upper luminous core highlight that shifts with gaze & expression
  const topEdgeY = -h / 2 + h * Math.min(0.75, rig.topLid);
  const visibleH = Math.max(4, (h / 2 - h * rig.bottomLid) - topEdgeY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  roundRectPath(
    ctx,
    -w * 0.28 + S.eyeLookX * 2,
    topEdgeY + visibleH * 0.14,
    w * 0.56,
    Math.max(2, visibleH * 0.24),
    4
  );
  ctx.fill();

  ctx.restore();
}
