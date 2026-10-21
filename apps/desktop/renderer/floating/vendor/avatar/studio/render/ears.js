// ears.js — vainas auditivas laterales 3D del robot.
//
// GEOMETRÍA PROPIA DE EGO. La vaina es un pód de cuatro piezas (collar de
// unión, cúpula acústica, cámara rehundida y núcleo LED) con sus medidas en
// ./geometry.js.
//
// Se elimina la variante "Mochi" (LED rosa fijo): no era alcanzable con la
// configuración vigente de Ego y el producto no distribuye la identidad
// visual de Mochi.
//
// Adapted from ego-avatar-studio (licencia no declarada en el origen), repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
// líneas 2245-2320: se adapta el patrón (pód de dos pasadas con profundidad
// 3D gobernada por el giro de cabeza); la geometría y los nombres son propios.

import { getStateAccentColor, hexToRgba, roundRectPath, shadeColor } from './helpers.js';
import { EAR_POD } from './geometry.js';

/** Estados en los que el LED de la vaina late con el audio o la alerta. */
const LED_ACTIVE_STATES = ['listen', 'talk', 'waiting', 'warning', 'error'];

/**
 * Dibuja las vainas auditivas.
 *
 * @param {'front'|'back'} pass pasada: frontal (visible) o trasera (al girar).
 */
export function drawRobotEars3D(ctx, S, rx, ry, pass, sinYaw = 0, cosYaw = 1) {
    const earBaseY = S.headLookY * 7 - S.earPerk * 2.5;
    const accent = getStateAccentColor(S);

    [-1, 1].forEach((side) => {
        // Profundidad 3D de esta vaina (+1 mira a cámara, -1 queda detrás).
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

        // 1. Collar de unión al chasis.
        const socketX = side < 0 ? EAR_POD.SOCKET.xLeft : EAR_POD.SOCKET.xRight;
        ctx.fillStyle = shadeColor(S.bodyColor, -28);
        roundRectPath(ctx, socketX, EAR_POD.SOCKET.y, EAR_POD.SOCKET.w, EAR_POD.SOCKET.h, EAR_POD.SOCKET.r);
        ctx.fill();

        // 2. Cúpula acústica con sombreado esférico.
        const domeGrad = ctx.createRadialGradient(
            side * -3, -8 + S.headLookY * 4, 2,
            0, 0, 26,
        );
        domeGrad.addColorStop(0, shadeColor(S.bodyColor, 28 + hoverAmt * 12));
        domeGrad.addColorStop(0.55, S.bodyColor);
        domeGrad.addColorStop(1, shadeColor(S.bodyColor, -32));

        ctx.fillStyle = domeGrad;
        ctx.strokeStyle = hoverAmt > 0.1
            ? hexToRgba(accent, 0.75)
            : 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 2;
        roundRectPath(ctx, EAR_POD.DOME.x, EAR_POD.DOME.y, EAR_POD.DOME.w, EAR_POD.DOME.h, EAR_POD.DOME.r);
        ctx.fill();
        ctx.stroke();

        // 3. Cámara acústica rehundida en la cara exterior.
        const depthShift = side * EAR_POD.DEPTH_SHIFT;
        ctx.fillStyle = '#070a12';
        roundRectPath(
            ctx,
            depthShift + EAR_POD.CHAMBER.x,
            EAR_POD.CHAMBER.y,
            EAR_POD.CHAMBER.w,
            EAR_POD.CHAMBER.h,
            EAR_POD.CHAMBER.r,
        );
        ctx.fill();

        // 4. Núcleo LED: late con el estado y con el audio.
        const ledColor = accent;
        ctx.save();
        ctx.shadowColor = ledColor;
        ctx.shadowBlur = 10 + hoverAmt * 8;
        ctx.fillStyle = ledColor;
        const isAudioActive = LED_ACTIVE_STATES.includes(S.state) || hoverAmt > 0.1;
        const pulseH = isAudioActive
            ? 8 + Math.abs(Math.sin(S.time * 16 + side * 1.4)) * EAR_POD.LED_PULSE_H
            : EAR_POD.LED_IDLE_H;
        roundRectPath(
            ctx,
            depthShift + EAR_POD.LED.x,
            -pulseH / 2,
            EAR_POD.LED.w,
            pulseH,
            EAR_POD.LED.r,
        );
        ctx.fill();
        ctx.restore();

        // 5. Anillo de onda al pasar el puntero por la vaina.
        if (hoverAmt > 0.05) {
            const waveR = EAR_POD.WAVE_R + ((S.time * 32) % EAR_POD.WAVE_GROWTH);
            ctx.strokeStyle = hexToRgba(ledColor, hoverAmt * 0.65 * (1 - (waveR - EAR_POD.WAVE_R) / EAR_POD.WAVE_GROWTH));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
                side * 4, 0, waveR,
                side > 0 ? -0.7 : Math.PI - 0.7,
                side > 0 ? 0.7 : Math.PI + 0.7,
            );
            ctx.stroke();
        }

        ctx.restore();
    });
}
