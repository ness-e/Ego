// ears.js — vainas auditivas laterales 3D del robot.
// Puerto verbatim de avatar_studio_cx_artlab_mochi_2_0.html:
//   drawRobotEars3D (líneas 2245-2320).
// Contrato: drawRobotEars3D(ctx, S, rx, ry, pass, sinYaw = 0, cosYaw = 1).
// `this.X` del original se lee como `S.X`; ayudantes desde ./helpers.js.

import { getStateAccentColor, hexToRgba, roundRectPath, shadeColor } from './helpers.js';

/** Dibuja las vainas auditivas del pase 'back' o 'front' (líneas 2245-2320, literal). */
export function drawRobotEars3D(ctx, S, rx, ry, pass, sinYaw = 0, cosYaw = 1) {
    const earBaseY = S.headLookY * 7 - S.earPerk * 2.5;
    const accent = getStateAccentColor(S);
    const isMochi = (S.variantMode === 'coucou-mochi' || S.eyeStyle === 'mochi-sphere') && !S.showVisor;

    [-1, 1].forEach((side) => {
        // 3D depth of this ear pod (+1 = rotated toward camera, -1 = rotated away behind head)
        const depth = side * sinYaw;
        const isFrontEar = depth >= -0.05;
        if ((pass === 'front' && !isFrontEar) || (pass === 'back' && isFrontEar)) return;

        const hoverAmt = side < 0 ? S.leftPodHoverAmount : S.rightPodHoverAmount;
        const podScale = 1 + hoverAmt * 0.12 + depth * 0.08;
        const earX = side * (rx - 1) - sinYaw * 10;
        const profileWidth = Math.max(0.58, 1 - Math.abs(sinYaw) * 0.28);

        ctx.save();
        ctx.translate(earX, earBaseY);
        ctx.rotate(side * (S.earPerk * 0.06 + hoverAmt * 0.08));
        ctx.scale(profileWidth * podScale, podScale);

        // 1. Inner 3D Chassis Socket Collar (connects flush to the head)
        ctx.fillStyle = shadeColor(S.bodyColor, -28);
        roundRectPath(ctx, side < 0 ? -4 : -10, -21, 14, 42, 6);
        ctx.fill();

        // 2. Main 3D Acoustic Dome Housing with Spherical Shading
        const domeGrad = ctx.createRadialGradient(
            side * -3, -8 + S.headLookY * 4, 2,
            0, 0, 26
        );
        domeGrad.addColorStop(0, shadeColor(S.bodyColor, 28 + hoverAmt * 12));
        domeGrad.addColorStop(0.55, S.bodyColor);
        domeGrad.addColorStop(1, shadeColor(S.bodyColor, -32));

        ctx.fillStyle = domeGrad;
        ctx.strokeStyle = hoverAmt > 0.1
            ? hexToRgba(accent, 0.75)
            : 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 2;
        roundRectPath(ctx, -10, -19, 20, 38, 9);
        ctx.fill();
        ctx.stroke();

        // 3. Recessed Dark Acoustic Chamber on the outer face of the pod
        ctx.fillStyle = '#070a12';
        roundRectPath(ctx, side * 2 - 4.5, -13, 9, 26, 4.5);
        ctx.fill();

        // 4. Glowing State & Audio-Reactive LED Equalizer Core inside the Pod
        const ledColor = isMochi ? '#fb7185' : accent;
        ctx.save();
        ctx.shadowColor = ledColor;
        ctx.shadowBlur = 10 + hoverAmt * 8;
        ctx.fillStyle = ledColor;
        const isAudioActive = ['listen', 'talk', 'waiting', 'warning', 'error'].includes(S.state) || hoverAmt > 0.1;
        const pulseH = isAudioActive
            ? 8 + Math.abs(Math.sin(S.time * 16 + side * 1.4)) * 14
            : 14;
        roundRectPath(ctx, side * 2 - 2.5, -pulseH / 2, 5, pulseH, 2.5);
        ctx.fill();
        ctx.restore();

        // 5. Interactive Acoustic Soundwave Ring when hovering over the ear pod!
        if (hoverAmt > 0.05) {
            const waveR = 16 + ((S.time * 32) % 14);
            ctx.strokeStyle = hexToRgba(ledColor, hoverAmt * 0.65 * (1 - (waveR - 16) / 14));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(side * 4, 0, waveR, side > 0 ? -0.7 : Math.PI - 0.7, side > 0 ? 0.7 : Math.PI + 0.7);
            ctx.stroke();
        }

        ctx.restore();
    });
}
