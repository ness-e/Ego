// studio/render/overlays.js — imagenes de estado del avatar studio.
// Contrato: (ctx, S, …) — S es el estado del avatar (sin importar la clase).
//
// El acento por estado vive en `../config.js` (fuente única): aquí sólo se
// reexporta para no romper los imports existentes.
import { roundRectPath, hexToRgba } from './helpers.js';
import { getStateAccentColor } from '../config.js';
export { getStateAccentColor };

export function drawStateOverlays(ctx, S, rx, ry) {
    const shiftX = S.eyeLookX * 24;
    const shiftY = S.eyeLookY * 18;
    const accent = getStateAccentColor(S);

    if (S.state === 'inspect') {
        const lx = -S.eyeSpacing + shiftX;
        const ly = S.eyeOffsetY + shiftY;
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        if (S.handVisibility > 0.2) {
            ctx.beginPath();
            ctx.moveTo(lx - 14, ly + 15);
            ctx.lineTo(S.leftHand.x + 4, S.leftHand.y - 4);
            ctx.stroke();
        }

        ctx.translate(lx, ly);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, 24 * S.eyeWidthRatio, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Laser scanline sweeping inside the magnifying loupe
        ctx.save();
        ctx.clip();
        const scanY = Math.sin(S.time * 6) * 20 * S.eyeWidthRatio;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-26, scanY);
        ctx.lineTo(26, scanY);
        ctx.stroke();
        ctx.restore();

        // Rotating HUD reticle ticks
        ctx.rotate(S.time * 1.5);
        ctx.lineWidth = 2;
        const rTick = 24 * S.eyeWidthRatio;
        ctx.beginPath();
        ctx.moveTo(-rTick - 4, 0); ctx.lineTo(-rTick + 3, 0);
        ctx.moveTo(rTick - 3, 0);  ctx.lineTo(rTick + 4, 0);
        ctx.moveTo(0, -rTick - 4); ctx.lineTo(0, -rTick + 3);
        ctx.moveTo(0, rTick - 3);  ctx.lineTo(0, rTick + 4);
        ctx.stroke();
        ctx.restore();
    } else if (S.state === 'dizzy') {
        // 3D Orbiting Halo of Stars around the head!
        ctx.save();
        for (let i = 0; i < 4; i++) {
            const angle = S.time * 4.5 + (i * Math.PI) / 2;
            const ox = Math.cos(angle) * (rx * 0.78);
            const oy = -ry * 0.88 + Math.sin(angle) * 12;
            const scale = 0.75 + (Math.sin(angle) + 1) * 0.25;
            ctx.save();
            ctx.translate(ox, oy);
            ctx.scale(scale, scale);
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 8;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✦', 0, 0);
            ctx.restore();
        }
        ctx.restore();
    } else if (S.state === 'error') {
        // Controlled RGB Chromatic Aberration Glitch Scanbars
        ctx.save();
        ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
        const gy1 = ((S.time * 190) % (ry * 1.4)) - ry * 0.7;
        ctx.fillRect(-rx * 0.7, gy1, rx * 1.4, 3);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fillRect(-rx * 0.65, -gy1 * 0.8, rx * 1.3, 2.5);
        ctx.restore();
    } else if (S.state === 'input') {
        ctx.save();
        ctx.translate(0, ry * 0.76);
        ctx.strokeStyle = hexToRgba(accent, 0.5);
        ctx.fillStyle = hexToRgba(accent, 0.14);
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, -64, -8, 128, 16, 6);
        ctx.fill();
        ctx.stroke();
        for (let k = -5; k <= 5; k++) {
            const activeKey = Math.sin(S.time * 32 + k * 1.7) > 0.65;
            ctx.fillStyle = activeKey ? accent : hexToRgba(accent, 0.25);
            ctx.fillRect(k * 10 - 3, -4, 6, 8);
        }
        ctx.restore();
    } else if (S.state === 'waiting') {
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const bounce = Math.sin(S.time * 7 - i * 0.9) * 5;
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(-16 + i * 16, -ry - 34 + bounce, 4.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    } else if (S.state === 'send') {
        // Vertical speed launch lines around body
        ctx.save();
        ctx.strokeStyle = hexToRgba(accent, 0.55);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = -2; i <= 2; i++) {
            if (i === 0) continue;
            const lx = i * (rx * 0.45);
            const ly = ((S.time * 260 + Math.abs(i) * 40) % 90) - 45;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx, ly + 22);
            ctx.stroke();
        }
        ctx.restore();
    } else if (S.state === 'warning' || S.state === 'blocked') {
        ctx.save();
        ctx.translate(rx - 6, -ry + 8);
        ctx.fillStyle = S.state === 'blocked' ? '#f43f5e' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090b10';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(S.state === 'blocked' ? '✕' : '!', 0, 1);
        ctx.restore();
    } else if (S.state === 'listen') {
        // Expanding sonar soundwaves around head
        ctx.save();
        const waveR = 14 + ((S.time * 45) % 36);
        const alpha = Math.max(0, 1 - (waveR - 14) / 36);
        ctx.strokeStyle = hexToRgba(accent, alpha * 0.65);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(rx + 8, -10, waveR, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-rx - 8, -10, waveR, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
        ctx.restore();
    } else if (S.state === 'poke') {
        ctx.save();
        const pulse = 1 + Math.sin(S.time * 20) * 0.15;
        ctx.translate(rx * 0.58, -ry * 0.58);
        ctx.scale(pulse, pulse);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(3, 10);
            ctx.quadraticCurveTo(3, 3, 10, 3);
            ctx.stroke();
        }
        ctx.restore();
    } else if (S.state === 'thinking') {
        // Procesando: un arco que gira. Va en la zona alta IZQUIERDA, libre de
        // la antena (centro) y del cartel de aviso (arriba a la derecha).
        ctx.save();
        ctx.translate(-rx * 0.55, -ry * 0.78);
        ctx.rotate(S.time * 2.2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0.4, Math.PI * 1.5);
        ctx.stroke();
        ctx.restore();
    } else if (S.state === 'approval') {
        // Tu turno: anillos concentricos que laten RODEANDO el cuerpo, para que
        // se lean fuera de la silueta. Distinto de 'listen' (arcos de sonar a
        // los lados) y de 'dizzy' (estrellas en orbita).
        ctx.save();
        for (let i = 0; i < 2; i++) {
            const t = (S.time * 0.9 + i * 0.5) % 1;
            ctx.strokeStyle = hexToRgba(accent, 0.6 * (1 - t));
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 58 + t * 38, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    } else if (S.state === 'question') {
        // Te pregunto: "?" en un disco. Misma familia que el cartel de aviso
        // pero con otro signo y otro color, para no confundirse con el.
        ctx.save();
        ctx.translate(rx - 6, -ry + 8);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090b10';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 1);
        ctx.restore();
    } else if (S.state === 'ratelimit') {
        // El proveedor nos frena: barras que se acortan (regulador de caudal),
        // ABAJO del cuerpo, donde no choca con la antena ni con el cartel.
        // No comparte imagen con 'bored'/'failure' (gota de sudor).
        ctx.save();
        ctx.translate(0, ry * 0.58);
        for (let i = 0; i < 3; i++) {
            const w = 30 - i * 8;
            ctx.fillStyle = hexToRgba(accent, 0.9 - i * 0.2);
            roundRectPath(ctx, -w / 2, -12 + i * 9, w, 5, 2.5);
            ctx.fill();
        }
        ctx.restore();
    } else if (S.state === 'failure' || S.state === 'bored') {
        ctx.save();
        const dropY = ((S.time * 18) % 24);
        ctx.translate(rx * 0.65, -ry * 0.35 + dropY);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(7, 2, 0, 8);
        ctx.quadraticCurveTo(-7, 2, 0, -8);
        ctx.fill();
        ctx.restore();
    }
}
