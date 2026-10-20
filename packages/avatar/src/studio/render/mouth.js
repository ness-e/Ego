// mouth.js — boca del avatar y articulación labial (lip-sync).
//
// GEOMETRÍA PROPIA DE EGO. La articulación (sílabas, escucha, decaimiento) y las
// métricas de cada estilo de boca están en ./geometry.js.
//
// Se elimina el estilo "mochi-cute" (boca felina con lengua): no figuraba en
// la enumeración vigente de estilos de boca de Ego y el producto no distribuye
// la identidad visual de Mochi.
//
// Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT),
// líneas 3030-3206 y 1410-1429: se adapta el patrón (boca por estados con
// sombra de acento y ledger); la geometría y los nombres son propios.

import { getStateAccentColor, roundRectPath } from './helpers.js';
import { MOUTH } from './geometry.js';

/**
 * Articulación labial.
 * Sílabas a 24 Hz / 15,5 Hz, oscilación en escucha y decaimiento al reposo.
 */
export function updateMouth(S, dt) {
    if (S.talkTimer > 0) {
        S.talkTimer = Math.max(0, S.talkTimer - dt);
        S.isTalking = S.talkTimer > 0;
    } else if (S.state !== 'talk') {
        S.isTalking = false;
    }
    if (S.isTalking || S.state === 'talk') {
        const syllA = Math.max(0, Math.sin(S.time * MOUTH.SYLLABLE_HZ));
        const syllB = Math.max(0, Math.cos(S.time * MOUTH.SYLLABLE_HZ_B));
        const targetOpen = 0.2 + syllA * 0.65 + syllB * 0.25;
        S.mouthOpen += (targetOpen - S.mouthOpen) * MOUTH.OPEN_SMOOTH;
        S.mouthWidth = 0.85 + Math.sin(S.time * MOUTH.WIDTH_HZ) * 0.25;
    } else if (S.state === 'listen') {
        S.mouthOpen += (0.15 + Math.abs(Math.sin(S.time * MOUTH.LISTEN_HZ)) * 0.2 - S.mouthOpen) * MOUTH.LISTEN_SMOOTH;
        S.mouthWidth = 1.0;
    } else {
        S.mouthOpen += (0 - S.mouthOpen) * MOUTH.DECAY_SMOOTH;
        S.mouthWidth += (1 - S.mouthWidth) * MOUTH.DECAY_SMOOTH;
    }
}

/** Dibuja la boca según `mouthStyle` y el estado. */
export function drawMouth(ctx, S, rx, ry) {
    ctx.save();
    const mx = S.eyeLookX * 20;
    const my = S.mouthOffsetY + S.eyeLookY * 15;
    ctx.translate(mx, my);
    ctx.scale(S.mouthScale, S.mouthScale);

    const activeColor = getStateAccentColor(S);
    const open = S.mouthOpen;
    const t = S.time;

    // Halo de estado: envuelve la boca sea cual sea su estilo.
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = S.eyeGlowBlur * 0.6;

    // Estilo por defecto de Ego: una barra de LED que late y se deforma.
    if (S.mouthStyle === 'led-wave') {
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.lineWidth = MOUTH.LED_WAVE_W;
        ctx.lineCap = 'round';

        if (open > 0.08 || S.state === 'surprise') {
            const mw = S.state === 'surprise' ? MOUTH.SURPRISE_W : MOUTH.OPEN_W * S.mouthWidth;
            const mh = S.state === 'surprise' ? MOUTH.SURPRISE_H : MOUTH.OPEN_MIN_H + open * MOUTH.OPEN_H_GAIN;
            roundRectPath(ctx, -mw / 2, -mh / 2, mw, mh, mh / 2);
            ctx.stroke();
        } else if (S.state === 'error' || S.state === 'dizzy') {
            // Onda de desajuste.
            ctx.beginPath();
            for (let x = -MOUTH.ERROR_WAVE_W; x <= MOUTH.ERROR_WAVE_W; x += MOUTH.ERROR_WAVE_STEP) {
                const y = Math.sin(x * 0.45 + t * 18) * 3.5;
                if (x === -MOUTH.ERROR_WAVE_W) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (['failure', 'blocked', 'poke', 'warning'].includes(S.state)) {
            // Ceño fruncido.
            ctx.beginPath();
            ctx.moveTo(-MOUTH.FROWN_W, 5);
            ctx.quadraticCurveTo(0, -6, MOUTH.FROWN_W, 5);
            ctx.stroke();
        } else if (['bored', 'waiting', 'inspect', 'input'].includes(S.state)) {
            // Boca plana, ligeramente ladeada al inspeccionar.
            const shift = S.state === 'inspect' ? 3 : 0;
            ctx.beginPath();
            ctx.moveTo(-MOUTH.FLAT_W + shift, 1);
            ctx.lineTo(MOUTH.FLAT_W + shift, 1 - shift * 0.4);
            ctx.stroke();
        } else if (S.state === 'sleep') {
            // Respiración lenta.
            const breathR = 3.5 + Math.sin(t * 1.6) * 1.5;
            ctx.beginPath();
            ctx.arc(0, 2, breathR, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Sonrisa: más profunda en los estados afirmativos.
            const happy = ['success', 'wake', 'wave', 'love', 'spin'].includes(S.state);
            const smileDepth = happy ? MOUTH.SMILE_DEPTH_HAPPY : MOUTH.SMILE_DEPTH;
            ctx.beginPath();
            ctx.moveTo(-MOUTH.SMILE_W, -1);
            ctx.quadraticCurveTo(0, smileDepth, MOUTH.SMILE_W, -1);
            ctx.stroke();
        }
    } else if (S.mouthStyle === 'cat-kawaii') {
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (open > 0.12 || S.state === 'surprise') {
            const drop = S.state === 'surprise' ? 12 : 5 + open * 16;
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(-11, -1);
            ctx.quadraticCurveTo(-5, 4, 0, -1);
            ctx.quadraticCurveTo(5, 4, 11, -1);
            ctx.quadraticCurveTo(0, drop, -11, -1);
            ctx.fill();
            ctx.stroke();
        } else if (['failure', 'error', 'poke', 'blocked'].includes(S.state)) {
            // Boca felina invertida (enfado) con uncolmillo.
            ctx.beginPath();
            ctx.moveTo(-11, 4);
            ctx.quadraticCurveTo(-5, -2, 0, 2);
            ctx.quadraticCurveTo(5, -2, 11, 4);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(-12, -1);
            ctx.quadraticCurveTo(-6, 6, 0, 0);
            ctx.quadraticCurveTo(6, 6, 12, -1);
            ctx.stroke();
        }
    } else if (S.mouthStyle === 'vocoder') {
        ctx.fillStyle = activeColor;
        for (let i = -3; i <= 3; i++) {
            let wave = 3.5;
            if (open > 0.05 || S.state === 'listen') {
                wave = 4 + Math.abs(Math.sin(t * 28 + i * 1.1)) * (16 * Math.max(0.25, open));
            } else if (['success', 'wave', 'love', 'wake'].includes(S.state)) {
                wave = 8 - Math.abs(i) * 1.2 + Math.sin(t * 10 + i) * 1.5;
            } else if (['error', 'warning', 'poke'].includes(S.state)) {
                wave = 3 + ((Math.floor(t * 20) + i) % 2) * 9;
            } else if (S.state === 'surprise') {
                wave = 12 - Math.abs(i) * 2.2;
            }
            roundRectPath(ctx, i * 5.5 - 1.8, -wave / 2, 3.6, Math.max(2.5, wave), 1.8);
            ctx.fill();
        }
    } else if (S.mouthStyle === 'pixel-mouth') {
        ctx.fillStyle = activeColor;
        if (open > 0.12 || S.state === 'surprise') {
            const h = S.state === 'surprise' ? 12 : Math.round(4 + open * 11);
            ctx.fillRect(-10, -2, 20, h);
            ctx.fillStyle = S.showVisor ? S.visorColor : '#09090b';
            ctx.fillRect(-6, 1, 12, Math.max(2, h - 6));
        } else if (['failure', 'error', 'poke', 'blocked'].includes(S.state)) {
            ctx.fillRect(-8, -2, 16, 4);
            ctx.fillRect(-12, 2, 4, 4);
            ctx.fillRect(8, 2, 4, 4);
        } else if (['bored', 'waiting', 'inspect'].includes(S.state)) {
            ctx.fillRect(-9, 0, 18, 4);
        } else {
            ctx.fillRect(-8, 1, 16, 4);
            ctx.fillRect(-12, -3, 4, 4);
            ctx.fillRect(8, -3, 4, 4);
        }
    }

    ctx.restore();
}
