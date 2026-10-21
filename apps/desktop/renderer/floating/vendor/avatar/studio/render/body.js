// body.js — chasis del avatar (superelipse) y panel trasero del reactor.
//
// GEOMETRÍA PROPIA DE EGO. Las proporciones del chasis, del panel trasero y
// del reactor están en ./geometry.js; aquí solo se componen y se sombrean.
//
// Se eliminan las ramas de geometría "Mochi" (cuerpo blob con brillo superior
// y rebote inferior cálido) que heredaba el estudio: no son alcanzables con
// la configuración vigente de Ego y el producto no distribuye la identidad
// visual de Mochi.
//
// Adapted from ego-avatar-studio (licencia no declarada en el origen), repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
// líneas 2325-2353, 2358-2474, 4034-4084: se adapta el patrón (casco
// superelíptico con luz superior, rebote inferior de acento y foco de
// puntero); la geometría y los nombres son propios de Ego.
import { roundRectPath, hexToRgba, shadeColor, buildSquirclePath } from './helpers.js';
import { getStateAccentColor } from './overlays.js';
import { CHASSIS, BLUSH } from './geometry.js';

/** Chasis trasero: panel rehundido con reactor luminoso (se ve al girar). */
export function drawRearChassis3D(ctx, S, rx, ry, sinSpin, cosSpin) {
    const accent = getStateAccentColor(S);
    ctx.save();
    ctx.translate(-sinSpin * rx * 0.55, -S.headLookY * 8);
    ctx.scale(Math.max(0.15, Math.abs(cosSpin)), 1);

    // Panel trasero rehundido.
    ctx.fillStyle = shadeColor(S.bodyColor, -18);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    roundRectPath(
        ctx,
        -rx * CHASSIS.REAR_PANEL_W / 2,
        ry * CHASSIS.REAR_PANEL_Y,
        rx * CHASSIS.REAR_PANEL_W,
        ry * CHASSIS.REAR_PANEL_H,
        CHASSIS.REAR_PANEL_RADIUS,
    );
    ctx.fill();
    ctx.stroke();

    // Reactor: anillo luminoso con núcleo.
    ctx.shadowColor = accent;
    ctx.shadowBlur = CHASSIS.REACTOR_GLOW;
    ctx.strokeStyle = accent;
    ctx.lineWidth = CHASSIS.REACTOR_LINE_W;
    ctx.beginPath();
    ctx.arc(0, 0, CHASSIS.REACTOR_RING_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, CHASSIS.REACTOR_CORE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/**
 * Chasis principal: superelipse con degradado radial, brillo superior,
 * rebote inferior de acento y foco que sigue al puntero.
 */
export function drawSquircleBody(ctx, S, rx, ry, n, sinYaw = 0, cosYaw = 1) {
    buildSquirclePath(ctx, rx, ry, n);

    const accent = getStateAccentColor(S);
    const maxR = Math.max(rx, ry);

    const lightX = -rx * 0.30 + S.headLookX * 24 + sinYaw * 20;
    const lightY = -ry * 0.38 + S.headLookY * 18;

    const grad = ctx.createRadialGradient(lightX, lightY, maxR * 0.08, 0, 0, maxR * 1.32);
    grad.addColorStop(0, shadeColor(S.bodyColor, 30));
    grad.addColorStop(0.52, S.bodyColor);
    grad.addColorStop(0.88, shadeColor(S.bodyColor, -22));
    grad.addColorStop(1, shadeColor(S.bodyColor, -34));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Brillo superior: da volumen al casco.
    const topSheen = ctx.createLinearGradient(0, -ry, 0, -ry * 0.35);
    topSheen.addColorStop(0, 'rgba(255, 255, 255, 0.19)');
    topSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = topSheen;
    ctx.fillRect(-rx * 1.2, -ry * 1.1, rx * 2.4, ry * 0.8);

    // Rebote inferior: el acento del estado tiñe el suelo del chasis.
    const rimBounce = ctx.createLinearGradient(0, ry * 0.45, 0, ry * 1.05);
    rimBounce.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rimBounce.addColorStop(1, hexToRgba(accent, 0.24 + S.bodyHoverAmount * 0.12));
    ctx.fillStyle = rimBounce;
    ctx.fillRect(-rx * 1.2, ry * 0.4, rx * 2.4, ry * 0.7);

    // Foco del puntero sobre el chasis.
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

    // Contorno: se enciende con el estado o al pasar el puntero.
    ctx.strokeStyle = (S.autoStateColors && S.state !== 'idle') || S.bodyHoverAmount > 0.1
        ? hexToRgba(accent, 0.35 + S.bodyHoverAmount * 0.25)
        : 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    drawBlush(ctx, S);
}

/** Rubor: aparece en estados afectivos, solo si el cuerpo no lleva visor. */
function drawBlush(ctx, S) {
    const showBlush = ['success', 'wave', 'love', 'wake', 'talk'].includes(S.state) || S.pettingAmount > 0.2;
    if (!showBlush || S.showVisor) return;

    const cxShift = S.eyeLookX * 18;
    const cyShift = S.eyeLookY * 12;
    const cheekX = Math.max(BLUSH.MIN_OFFSET, S.eyeSpacing + BLUSH.OFFSET_FROM_EYES);
    const cheekY = BLUSH.Y + S.eyeOffsetY + cyShift;

    ctx.save();
    ctx.fillStyle = S.state === 'love' ? 'rgba(244, 63, 94, 0.48)' : 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-cheekX + cxShift, cheekY, BLUSH.RX, BLUSH.RY, -0.08, 0, Math.PI * 2);
    ctx.ellipse(cheekX + cxShift, cheekY, BLUSH.RX, BLUSH.RY, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Tres trazos por mejilla: el rubor se lee como "p Stores".
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = BLUSH.STROKE_W;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-cheekX - 3 + cxShift, cheekY - 2);
    ctx.lineTo(-cheekX + cxShift, cheekY + 2);
    ctx.moveTo(-cheekX + 2 + cxShift, cheekY - 2);
    ctx.lineTo(-cheekX + 5 + cxShift, cheekY + 2);
    ctx.moveTo(cheekX - 4 + cxShift, cheekY - 2);
    ctx.lineTo(cheekX - 1 + cxShift, cheekY + 2);
    ctx.moveTo(cheekX + 1 + cxShift, cheekY - 2);
    ctx.lineTo(cheekX + 4 + cxShift, cheekY + 2);
    ctx.stroke();
    ctx.restore();
}

/** Estado "caja": el avatar asoma los ojos por la tapa de un paquete. */
export function drawBoxBody(ctx, S, rx, ry) {
    ctx.save();
    ctx.fillStyle = '#D99B66';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 3;
    roundRectPath(ctx, -rx, -ry * 0.72, rx * 2, ry * 1.62, 16);
    ctx.fill();
    ctx.stroke();

    // Hueco superior oscuro por el que asoman los ojos.
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

    // Etiqueta del paquete.
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
