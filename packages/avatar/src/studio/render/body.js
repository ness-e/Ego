// studio/render/body.js — port verbatim de avatar_studio_cx_artlab_mochi_2_0.html:2325-2353, 2358-2474, 4034-4084.
// Contrato: (ctx, S, …) — S es el estado del avatar (sin importar la clase).
import { roundRectPath, hexToRgba, shadeColor, buildSquirclePath } from './helpers.js';
import { getStateAccentColor } from './overlays.js';
export function drawRearChassis3D(ctx, S, rx, ry, sinSpin, cosSpin) {
    const accent = getStateAccentColor(S);
    ctx.save();
    ctx.translate(-sinSpin * rx * 0.55, -S.headLookY * 8);
    ctx.scale(Math.max(0.15, Math.abs(cosSpin)), 1);

    // Rear recessed power core panel
    ctx.fillStyle = shadeColor(S.bodyColor, -18);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -rx * 0.48, -ry * 0.38, rx * 0.96, ry * 0.76, 18);
    ctx.fill();
    ctx.stroke();

    // Glowing CX-ArtLab / Mochi Rear Reactor Ring
    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
export function drawSquircleBody(ctx, S, rx, ry, n, sinYaw = 0, cosYaw = 1) {
    buildSquirclePath(ctx, rx, ry, n);

    const isMochi = (S.variantMode === 'coucou-mochi' || S.eyeStyle === 'mochi-sphere');
    const accent = getStateAccentColor(S);
    const maxR = Math.max(rx, ry);

    const lightX = -rx * 0.30 + S.headLookX * 24 + sinYaw * 20;
    const lightY = -ry * 0.38 + S.headLookY * 18;

    if (isMochi) {
        const grad = ctx.createRadialGradient(lightX, lightY, maxR * 0.06, 0, ry * 0.12, maxR * 1.28);
        grad.addColorStop(0, shadeColor(S.bodyColor, 38));
        grad.addColorStop(0.46, S.bodyColor);
        grad.addColorStop(0.84, shadeColor(S.bodyColor, -15));
        grad.addColorStop(1, shadeColor(S.bodyColor, -30));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.save();
        ctx.clip();
        const topGlow = ctx.createRadialGradient(
            S.headLookX * 14,
            -ry * 0.64 + S.headLookY * 10,
            4,
            S.headLookX * 14,
            -ry * 0.64 + S.headLookY * 10,
            maxR * 0.70
        );
        topGlow.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
        topGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = topGlow;
        ctx.fillRect(-rx * 1.4, -ry * 1.4, rx * 2.8, ry * 2.8);

        const bottomBounce = ctx.createLinearGradient(0, ry * 0.35, 0, ry);
        bottomBounce.addColorStop(0, 'rgba(255, 190, 160, 0)');
        bottomBounce.addColorStop(1, 'rgba(255, 220, 200, 0.28)');
        ctx.fillStyle = bottomBounce;
        ctx.fillRect(-rx * 1.2, ry * 0.25, rx * 2.4, ry * 0.85);
        ctx.restore();

        ctx.strokeStyle = S.autoStateColors && S.state !== 'idle'
            ? hexToRgba(accent, 0.48)
            : 'rgba(255, 255, 255, 0.34)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
    } else {
        const grad = ctx.createRadialGradient(lightX, lightY, maxR * 0.08, 0, 0, maxR * 1.32);
        grad.addColorStop(0, shadeColor(S.bodyColor, 30));
        grad.addColorStop(0.52, S.bodyColor);
        grad.addColorStop(0.88, shadeColor(S.bodyColor, -22));
        grad.addColorStop(1, shadeColor(S.bodyColor, -34));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.save();
        ctx.clip();
        const topSheen = ctx.createLinearGradient(0, -ry, 0, -ry * 0.35);
        topSheen.addColorStop(0, 'rgba(255, 255, 255, 0.19)');
        topSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = topSheen;
        ctx.fillRect(-rx * 1.2, -ry * 1.1, rx * 2.4, ry * 0.8);

        const rimBounce = ctx.createLinearGradient(0, ry * 0.45, 0, ry * 1.05);
        rimBounce.addColorStop(0, 'rgba(0, 0, 0, 0)');
        rimBounce.addColorStop(1, hexToRgba(accent, 0.24 + S.bodyHoverAmount * 0.12));
        ctx.fillStyle = rimBounce;
        ctx.fillRect(-rx * 1.2, ry * 0.4, rx * 2.4, ry * 0.7);

        // Interactive 3D Cursor Spotlight on the Chassis when hovering!
        if (S.bodyHoverAmount > 0.02) {
            const localPtrX = (S.pointerX - S.x) / S.globalScale;
            const localPtrY = (S.pointerY - S.y) / S.globalScale;
            const spotGrad = ctx.createRadialGradient(localPtrX, localPtrY, 2, localPtrX, localPtrY, maxR * 0.75);
            spotGrad.addColorStop(0, hexToRgba(accent, 0.16 * S.bodyHoverAmount));
            spotGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = spotGrad;
            ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
        }
        ctx.restore();

        ctx.strokeStyle = (S.autoStateColors && S.state !== 'idle') || S.bodyHoverAmount > 0.1
            ? hexToRgba(accent, 0.35 + S.bodyHoverAmount * 0.25)
            : 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
    }

    // Rosy cheeks on happy/love/wave/petting or Mochi mode
    const showBlush = isMochi || ['success', 'wave', 'love', 'wake', 'talk'].includes(S.state) || S.pettingAmount > 0.2;
    if (showBlush && !S.showVisor) {
        const cxShift = S.eyeLookX * 18;
        const cyShift = S.eyeLookY * 12;
        const cheekX = Math.max(26, S.eyeSpacing + 11);
        ctx.save();
        ctx.fillStyle = S.state === 'love' ? 'rgba(244, 63, 94, 0.48)' : 'rgba(244, 63, 94, 0.35)';
        ctx.beginPath();
        ctx.ellipse(-cheekX + cxShift, 16 + S.eyeOffsetY + cyShift, 13, 7, -0.08, 0, Math.PI * 2);
        ctx.ellipse(cheekX + cxShift, 16 + S.eyeOffsetY + cyShift, 13, 7, 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-cheekX - 3 + cxShift, 14 + S.eyeOffsetY + cyShift);
        ctx.lineTo(-cheekX + cxShift, 18 + S.eyeOffsetY + cyShift);
        ctx.moveTo(-cheekX + 2 + cxShift, 14 + S.eyeOffsetY + cyShift);
        ctx.lineTo(-cheekX + 5 + cxShift, 18 + S.eyeOffsetY + cyShift);
        ctx.moveTo(cheekX - 4 + cxShift, 14 + S.eyeOffsetY + cyShift);
        ctx.lineTo(cheekX - 1 + cxShift, 18 + S.eyeOffsetY + cyShift);
        ctx.moveTo(cheekX + 1 + cxShift, 14 + S.eyeOffsetY + cyShift);
        ctx.lineTo(cheekX + 4 + cxShift, 18 + S.eyeOffsetY + cyShift);
        ctx.stroke();
        ctx.restore();
    }
}
export function drawBoxBody(ctx, S, rx, ry) {
    ctx.save();
    ctx.fillStyle = '#D99B66';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 3;
    roundRectPath(ctx, -rx, -ry * 0.72, rx * 2, ry * 1.62, 16);
    ctx.fill();
    ctx.stroke();

    // Dark interior gap at top of box with avatar's glowing eyes peeking out!
    ctx.fillStyle = '#18120c';
    roundRectPath(ctx, -rx * 0.86, -ry * 0.70, rx * 1.72, 26, 8);
    ctx.fill();

    const peekColor = getStateAccentColor(S);
    ctx.save();
    ctx.shadowColor = peekColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = peekColor;
    const peekX = S.eyeLookX * 14;
    roundRectPath(ctx, -26 + peekX - 8, -ry * 0.62, 16, 9, 4);
    ctx.fill();
    roundRectPath(ctx, 26 + peekX - 8, -ry * 0.62, 16, 9, 4);
    ctx.fill();
    ctx.restore();

    // Shipping label on front of parcel
    ctx.fillStyle = '#fef3c7';
    roundRectPath(ctx, -rx * 0.55, -ry * 0.15, rx * 0.65, ry * 0.45, 6);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-rx * 0.48, -ry * 0.05, rx * 0.45, 4);
    ctx.fillRect(-rx * 0.48, ry * 0.08, rx * 0.32, 4);

    const flap = Math.sin(S.time * 10) * 0.18;
    ctx.fillStyle = '#E6B17E';
    ctx.save();
    ctx.translate(-rx, -ry * 0.72);
    ctx.rotate(-0.45 + flap);
    ctx.fillRect(0, -20, rx * 0.95, 20);
    ctx.strokeRect(0, -20, rx * 0.95, 20);
    ctx.restore();

    ctx.save();
    ctx.translate(rx, -ry * 0.72);
    ctx.rotate(0.45 - flap);
    ctx.fillRect(-rx * 0.95, -20, rx * 0.95, 20);
    ctx.strokeRect(-rx * 0.95, -20, rx * 0.95, 20);
    ctx.restore();
    ctx.restore();
}
