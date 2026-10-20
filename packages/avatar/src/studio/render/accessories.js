// accessories.js — accesorio superior de la cabeza.
//
// GEOMETRÍA PROPIA DE EGO. El catálogo de accesorios (antena, auriculares,
// gafas, gorros de ears, visores, corona, halo, brote) y sus medidas están
// definidos por Ego; los anclajes de la antena viven en ./geometry.js.
//
// Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT),
// líneas 3389-3805: se adapta el patrón (accesorio anclado sobre el casco que
// gira con `antennaAngle` y emite un anillo expansivo según el estado); la
// geometría, el catálogo y los nombres son propios.
// Contrato: drawTopAccessory(ctx, S, rx, ry, turnShiftX = 0, sinYaw = 0).

import { getStateAccentColor, hexToRgba, roundRectPath, shadeColor } from './helpers.js';

/** Dibuja el accesorio superior (líneas 3389-3805, literal). */
export function drawTopAccessory(ctx, S, rx, ry, turnShiftX = 0, sinYaw = 0) {
    ctx.save();
    const headShiftX = S.headLookX * 9 + turnShiftX * 0.45;
    const headShiftY = S.headLookY * 4 + S.accessoryOffsetY;
    const accent = getStateAccentColor(S);
    const perk = S.earPerk; // +1 perked up, -1 flattened/drooped

    ctx.translate(headShiftX, -ry * 0.90 + headShiftY);
    ctx.scale(S.accessoryScale, S.accessoryScale);

    if (S.accessory === 'cx-antenna' || S.accessory === 'cx-full-kit') {
        ctx.rotate(S.antennaAngle);

        ctx.fillStyle = shadeColor(S.bodyColor, -20);
        roundRectPath(ctx, -14, -4, 28, 10, 5);
        ctx.fill();

        const stemBend = S.antennaAngle * 34 - perk * 3;
        const stemHeight = -38 - perk * 5;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(stemBend * 0.6, stemHeight * 0.6, stemBend, stemHeight);
        ctx.stroke();

        const tipX = stemBend;
        const tipY = stemHeight - 4;
        const pulseR = 9 + (['waiting', 'input', 'warning', 'error', 'talk', 'listen'].includes(S.state)
            ? Math.sin(S.time * 16) * 2.5
            : S.bodyHoverAmount * 1.5);
        ctx.shadowColor = accent;
        ctx.shadowBlur = 18;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(tipX, tipY, Math.max(5, pulseR), 0, Math.PI * 2);
        ctx.fill();

        if (['waiting', 'listen', 'send', 'talk', 'warning'].includes(S.state) || S.bodyHoverAmount > 0.2) {
            const ringR = 10 + ((S.time * 38) % 22);
            const alpha = Math.max(0, 1 - (ringR - 10) / 22);
            ctx.strokeStyle = hexToRgba(accent, alpha * 0.75);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(tipX, tipY, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

    } else if (S.accessory === 'headphones') {
        ctx.save();
        ctx.translate(0, ry * 0.90);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, rx + 5, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();

        [-1, 1].forEach((side) => {
            ctx.save();
            ctx.translate(side * (rx + 7), -4 + S.headLookY * 5);
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2.8;
            roundRectPath(ctx, -10, -24, 20, 48, 9);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });
        ctx.restore();

    } else if (S.accessory === 'glasses') {
        const dropOffset = ['inspect', 'success', 'wave', 'bored'].includes(S.state) ? (ry * 0.85) : 10;
        ctx.translate(S.eyeLookX * 10, dropOffset);
        ctx.rotate(S.antennaAngle * 0.25);

        ctx.fillStyle = '#09090b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.fillRect(-52, -14, 44, 24);
        ctx.strokeRect(-52, -14, 44, 24);
        ctx.fillRect(8, -14, 44, 24);
        ctx.strokeRect(8, -14, 44, 24);
        ctx.fillRect(-8, -10, 16, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(-44, -9, 7, 13);
        ctx.fillRect(16, -9, 7, 13);

    } else if (S.accessory === 'santa') {
        ctx.rotate(S.antennaAngle * 0.45);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-38, 4);
        ctx.quadraticCurveTo(-6, -52, 40 + S.antennaAngle * 22, -22 - perk * 5);
        ctx.lineTo(32, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        roundRectPath(ctx, -42, -3, 84, 14, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(40 + S.antennaAngle * 22, -22 - perk * 5, 11, 0, Math.PI * 2);
        ctx.fill();

    } else if (S.accessory === 'cat-ears') {
        const twitchL = Math.sin(S.time * 5) > 0.92 ? -0.14 : S.antennaAngle * 0.45;
        const twitchR = Math.cos(S.time * 4.3) > 0.92 ? 0.14 : S.antennaAngle * 0.45;
        const stateFold = -perk * 0.24;

        [-1, 1].forEach((side) => {
            const earDepth = 1 + side * sinYaw * 0.18;
            ctx.save();
            ctx.translate(side * 44 - sinYaw * 6, 6);
            ctx.scale(earDepth, 1);
            ctx.rotate(side * (0.20 + stateFold) + (side < 0 ? twitchL : twitchR));

            // 3D Shaded Outer Cat Ear Shell
            const earGrad = ctx.createLinearGradient(-18, -36, 18, 12);
            earGrad.addColorStop(0, shadeColor(S.bodyColor, 26));
            earGrad.addColorStop(0.6, S.bodyColor);
            earGrad.addColorStop(1, shadeColor(S.bodyColor, -24));

            ctx.fillStyle = earGrad;
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-22, 12);
            ctx.quadraticCurveTo(-8, -34, 0, -40);
            ctx.quadraticCurveTo(8, -34, 22, 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 3D Recessed Inner Ear Cavity
            const innerColor = S.showVisor ? accent : '#fb7185';
            const innerGrad = ctx.createLinearGradient(0, -28, 0, 10);
            innerGrad.addColorStop(0, shadeColor(innerColor, -25));
            innerGrad.addColorStop(1, innerColor);
            ctx.fillStyle = innerGrad;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(-12, 9);
            ctx.quadraticCurveTo(-3, -22, 0, -27);
            ctx.quadraticCurveTo(3, -22, 12, 9);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });

    } else if (S.accessory === 'bunny-ears') {
        const stateFold = -perk * 0.30;
        [-1, 1].forEach((side) => {
            const earDepth = 1 + side * sinYaw * 0.16;
            ctx.save();
            ctx.translate(side * 28 - sinYaw * 5, 4);
            ctx.scale(earDepth, 1);
            ctx.rotate(side * (0.14 + stateFold) + S.antennaAngle * 0.65 + Math.sin(S.time * 3 + side) * 0.05);

            const earGrad = ctx.createRadialGradient(-4, -36, 2, 0, -28, 42);
            earGrad.addColorStop(0, shadeColor(S.bodyColor, 28));
            earGrad.addColorStop(0.65, S.bodyColor);
            earGrad.addColorStop(1, shadeColor(S.bodyColor, -24));

            ctx.fillStyle = earGrad;
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, -32, 14, 38, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = S.showVisor ? hexToRgba(accent, 0.78) : '#fda4af';
            ctx.beginPath();
            ctx.ellipse(0, -30, 7.5, 26, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

    } else if (S.accessory === 'fox-ears') {
        const stateFold = -perk * 0.24;
        [-1, 1].forEach((side) => {
            const earDepth = 1 + side * sinYaw * 0.18;
            ctx.save();
            ctx.translate(side * 44 - sinYaw * 6, 6);
            ctx.scale(earDepth, 1);
            ctx.rotate(side * (0.25 + stateFold) + S.antennaAngle * 0.5);

            const foxGrad = ctx.createLinearGradient(0, -44, 0, 12);
            foxGrad.addColorStop(0, '#c2410c');
            foxGrad.addColorStop(0.45, '#ea580c');
            foxGrad.addColorStop(1, '#9a3412');
            ctx.fillStyle = foxGrad;
            ctx.strokeStyle = 'rgba(255,255,255,0.24)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-22, 12);
            ctx.quadraticCurveTo(-6, -34, 0, -44);
            ctx.quadraticCurveTo(6, -34, 22, 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fff7ed';
            ctx.beginPath();
            ctx.moveTo(-8, -22);
            ctx.lineTo(0, -44);
            ctx.lineTo(8, -22);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.moveTo(-11, 8);
            ctx.lineTo(0, -22);
            ctx.lineTo(11, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });

    } else if (S.accessory === 'bear-ears') {
        [-1, 1].forEach((side) => {
            const earDepth = 1 + side * sinYaw * 0.18;
            ctx.save();
            ctx.translate(side * 48 - sinYaw * 6, 2 - perk * 3.5);
            ctx.scale(earDepth, 1);
            ctx.rotate(S.antennaAngle * 0.35 + side * (-perk * 0.12));

            const bearGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 22);
            bearGrad.addColorStop(0, shadeColor(S.bodyColor, 24));
            bearGrad.addColorStop(0.65, S.bodyColor);
            bearGrad.addColorStop(1, shadeColor(S.bodyColor, -26));

            ctx.fillStyle = bearGrad;
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = S.showVisor ? hexToRgba(accent, 0.68) : shadeColor(S.bodyColor, -18);
            ctx.beginPath();
            ctx.arc(0, 1, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

    } else if (S.accessory === 'aviator-glasses') {
        // Drops down over eyes on 'inspect' or 'bored', lifts onto forehead on 'surprise'
        const dropOffset = S.state === 'inspect' ? 28 : (S.state === 'surprise' ? -8 : 10);
        ctx.translate(0, dropOffset);
        ctx.rotate(S.antennaAngle * 0.3);

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-54, -2); ctx.lineTo(-64, 10);
        ctx.moveTo(54, -2);  ctx.lineTo(64, 10);
        ctx.moveTo(-12, -8); ctx.lineTo(12, -8);
        ctx.moveTo(-10, -3); ctx.lineTo(10, -3);
        ctx.stroke();

        [-1, 1].forEach((side) => {
            ctx.save();
            ctx.translate(side * 30, -4);

            const lensGrad = ctx.createLinearGradient(0, -14, 0, 14);
            lensGrad.addColorStop(0, '#0f172a');
            lensGrad.addColorStop(0.55, '#1e3a8a');
            lensGrad.addColorStop(1, S.autoStateColors ? accent : '#ec4899');

            ctx.fillStyle = lensGrad;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.8;
            roundRectPath(ctx, -23, -13, 46, 26, [8, 8, 16, 16]);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath();
            ctx.moveTo(-14, -10);
            ctx.lineTo(-6, -10);
            ctx.lineTo(-14, 8);
            ctx.lineTo(-19, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });

    } else if (S.accessory === 'cyber-goggles') {
        const dropOffset = S.state === 'inspect' ? 26 : 8;
        ctx.translate(0, dropOffset);
        ctx.rotate(S.antennaAngle * 0.3);

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        roundRectPath(ctx, -58, -8, 116, 14, 6);
        ctx.fill();
        ctx.stroke();

        [-1, 1].forEach((side) => {
            ctx.save();
            ctx.translate(side * 26, -1);

            ctx.fillStyle = '#334155';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = accent;
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#090d16';
            ctx.strokeStyle = accent;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(-4 + S.eyeLookX * 2, -4 + S.eyeLookY * 2, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

    } else if (S.accessory === 'witch') {
        ctx.rotate(S.antennaAngle * 0.45);
        ctx.fillStyle = '#1E1B4B';
        ctx.strokeStyle = '#4338CA';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 4, 52, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-32, 2);
        ctx.quadraticCurveTo(-6, -54, 18 + S.antennaAngle * 25, -60 - perk * 6);
        ctx.quadraticCurveTo(24, -28, 32, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = S.autoStateColors ? accent : '#F59E0B';
        ctx.fillRect(-24, -5, 48, 8);

    } else if (S.accessory === 'crown') {
        ctx.translate(0, -Math.max(0, perk) * 4);
        ctx.rotate(S.antennaAngle * 0.5);
        ctx.fillStyle = '#FACC15';
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-32, 4);
        ctx.lineTo(-38, -30);
        ctx.lineTo(-15, -12);
        ctx.lineTo(0, -36);
        ctx.lineTo(15, -12);
        ctx.lineTo(38, -30);
        ctx.lineTo(32, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // State-colored center jewel
        ctx.shadowColor = accent;
        ctx.shadowBlur = 10;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(0, -10, 4.5, 0, Math.PI * 2);
        ctx.fill();

    } else if (S.accessory === 'halo') {
        const floatY = Math.sin(S.time * 4) * 5 - perk * 5;
        ctx.translate(0, -20 + floatY);
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 44, 11, 0, 0, Math.PI * 2);
        ctx.stroke();

    } else if (S.accessory === 'sprout') {
        ctx.rotate(S.antennaAngle + (-perk * 0.12));
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.quadraticCurveTo(6, -24, 0, -36);
        ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(16, -34, 16, 9, -0.35 - perk * 0.15, 0, Math.PI * 2);
        ctx.ellipse(-14, -28, 12, 7, 0.4 + perk * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Blooms a tiny flower on success/love/wake!
        if (['success', 'love', 'wake', 'wave'].includes(S.state)) {
            ctx.fillStyle = '#fb7185';
            ctx.beginPath();
            ctx.arc(0, -40, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(0, -40, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}
