// visor.js — Visor interno del avatar studio (puerto verbatim del avatar studio).
// Fuente: repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
//   drawInnerVisor: líneas 2476-2563.
// Vanilla ESM, sin dependencias. `S` es el objeto plano de estado del avatar
// (nunca se importa la clase — evita ciclos). `ctx` solo se toca dentro.

import { roundRectPath, hexToRgba, shadeColor } from './helpers.js';
import { getStateAccentColor } from './eyes.js';

export function drawInnerVisor(ctx, S, rx, ry) {
  ctx.save();
  // 3D Spherical Surface Parallax & Subtle Perspective Foreshortening
  const vx = S.headLookX * 16;
  const vy = S.headLookY * 13;
  const perspectiveScaleX = 1 - Math.abs(S.headLookX) * 0.05;
  const perspectiveScaleY = 1 - Math.abs(S.headLookY) * 0.04;
  ctx.translate(vx, vy);
  ctx.scale(perspectiveScaleX, perspectiveScaleY);

  const vw = rx * 1.48 * S.visorWidthRatio;
  const vh = ry * 1.10 * S.visorHeightRatio;
  const vRad = S.visorCornerRadius;
  const accent = getStateAccentColor(S);

  // 3D Recessed Bezel Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  const visorGrad = ctx.createLinearGradient(0, -vh / 2, 0, vh / 2);
  visorGrad.addColorStop(0, shadeColor(S.visorColor, -14));
  visorGrad.addColorStop(1, shadeColor(S.visorColor, 16));

  ctx.fillStyle = visorGrad;
  roundRectPath(ctx, -vw / 2, -vh / 2, vw, vh, vRad);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = (S.autoStateColors && S.state !== 'idle') || S.bodyHoverAmount > 0.1
    ? hexToRgba(accent, 0.38 + S.bodyHoverAmount * 0.22)
    : 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2.2;
  roundRectPath(ctx, -vw / 2, -vh / 2, vw, vh, vRad);
  ctx.stroke();

  // CRT / OLED scanlines + ambient eye glow + dynamic 3D glass reflection
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
  for (let sy = -vh / 2; sy < vh / 2; sy += 4) {
    ctx.fillRect(-vw / 2, sy, vw, 1.2);
  }

  const glowIntensity = 0.22 + S.bodyHoverAmount * 0.08 + S.visorGlowBoost * 0.18;
  const screenGlow = ctx.createRadialGradient(
    S.eyeLookX * 20,
    S.eyeLookY * 14,
    4,
    S.eyeLookX * 20,
    S.eyeLookY * 14,
    Math.max(vw, vh) * 0.58
  );
  screenGlow.addColorStop(0, hexToRgba(accent, glowIntensity));
  screenGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = screenGlow;
  ctx.fillRect(-vw / 2, -vh / 2, vw, vh);

  // Rosy digital blush inside visor when happy/love/petted
  if (['success', 'wave', 'love', 'wake'].includes(S.state) || S.pettingAmount > 0.25) {
    const cheekX = Math.max(28, S.eyeSpacing + 10);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-cheekX + S.eyeLookX * 10, 18 + S.eyeOffsetY + S.eyeLookY * 6, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cheekX + S.eyeLookX * 10, 18 + S.eyeOffsetY + S.eyeLookY * 6, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sliding 3D Diagonal Glass Reflection (moves opposite to head tilt!)
  ctx.save();
  ctx.translate(-S.headLookX * 18, -S.headLookY * 10);
  ctx.rotate(-0.35);
  const glassGlint = ctx.createLinearGradient(-vw, -vh * 0.6, vw * 0.5, vh * 0.6);
  glassGlint.addColorStop(0, 'rgba(255, 255, 255, 0)');
  glassGlint.addColorStop(0.45, 'rgba(255, 255, 255, 0.055)');
  glassGlint.addColorStop(0.52, 'rgba(255, 255, 255, 0.015)');
  glassGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glassGlint;
  ctx.fillRect(-vw, -vh, vw * 2, vh * 2);
  ctx.restore();
  ctx.restore();

  // Top curved glass highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  roundRectPath(ctx, -vw * 0.44 - S.headLookX * 4, -vh * 0.45, vw * 0.88, vh * 0.28, Math.max(8, vRad * 0.6));
  ctx.fill();
  ctx.restore();
}
