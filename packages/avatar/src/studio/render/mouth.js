// mouth.js — boca del avatar y articulación labial (lip-sync).
// Puerto verbatim de avatar_studio_cx_artlab_mochi_2_0.html:
//   drawMouth (líneas 3030-3206), update paso 6 (líneas 1410-1429).
// Contrato: drawMouth(ctx, S, rx, ry); updateMouth(S, dt) muta S.
// `this.X` del original se lee como `S.X`; ayudantes desde ./helpers.js.

import { getStateAccentColor, roundRectPath } from './helpers.js';

/** Articulación labial: sílabas a 24 Hz / 15.5 Hz, oscilación en listen, decaimiento (líneas 1410-1429, literal). */
export function updateMouth(S, dt) {
    if (S.talkTimer > 0) {
        S.talkTimer = Math.max(0, S.talkTimer - dt);
        S.isTalking = S.talkTimer > 0;
    } else if (S.state !== 'talk') {
        S.isTalking = false;
    }
    if (S.isTalking || S.state === 'talk') {
        const syllA = Math.max(0, Math.sin(S.time * 24));
        const syllB = Math.max(0, Math.cos(S.time * 15.5));
        const targetOpen = 0.2 + syllA * 0.65 + syllB * 0.25;
        S.mouthOpen += (targetOpen - S.mouthOpen) * 0.45;
        S.mouthWidth = 0.85 + Math.sin(S.time * 19) * 0.25;
    } else if (S.state === 'listen') {
        S.mouthOpen += (0.15 + Math.abs(Math.sin(S.time * 12)) * 0.2 - S.mouthOpen) * 0.3;
        S.mouthWidth = 1.0;
    } else {
        S.mouthOpen += (0 - S.mouthOpen) * 0.25;
        S.mouthWidth += (1 - S.mouthWidth) * 0.25;
    }
}

/** Dibuja la boca según mouthStyle y estado (líneas 3030-3206, literal). */
export function drawMouth(ctx, S, rx, ry) {
    ctx.save();
    const mx = S.eyeLookX * 20;
    const my = S.mouthOffsetY + S.eyeLookY * 15;
    ctx.translate(mx, my);
    ctx.scale(S.mouthScale, S.mouthScale);

    const activeColor = (S.eyeStyle === 'mochi-sphere' && !S.showVisor && !S.autoStateColors)
        ? '#181210'
        : getStateAccentColor(S);
    const open = S.mouthOpen;
    const t = S.time;

    if (S.mouthStyle !== 'mochi-cute' || S.showVisor) {
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = S.eyeGlowBlur * 0.6;
    }

    if (S.mouthStyle === 'led-wave') {
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';

        if (open > 0.08 || S.state === 'surprise') {
            const mw = (S.state === 'surprise' ? 14 : 24 * S.mouthWidth);
            const mh = (S.state === 'surprise' ? 15 : 4 + open * 16);
            roundRectPath(ctx, -mw / 2, -mh / 2, mw, mh, mh / 2);
            ctx.stroke();
        } else if (S.state === 'error' || S.state === 'dizzy') {
            // Wavy glitch / dizzy sine mouth
            ctx.beginPath();
            for (let x = -14; x <= 14; x += 2) {
                const y = Math.sin(x * 0.45 + t * 18) * 3.5;
                if (x === -14) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (['failure', 'blocked', 'poke', 'warning'].includes(S.state)) {
            ctx.beginPath();
            ctx.moveTo(-12, 5);
            ctx.quadraticCurveTo(0, -6, 12, 5);
            ctx.stroke();
        } else if (['bored', 'waiting', 'inspect', 'input'].includes(S.state)) {
            const shift = S.state === 'inspect' ? 3 : 0;
            ctx.beginPath();
            ctx.moveTo(-10 + shift, 1);
            ctx.lineTo(10 + shift, 1 - shift * 0.4);
            ctx.stroke();
        } else if (S.state === 'sleep') {
            const breathR = 3.5 + Math.sin(t * 1.6) * 1.5;
            ctx.beginPath();
            ctx.arc(0, 2, breathR, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const smileDepth = ['success', 'wake', 'wave', 'love', 'spin'].includes(S.state) ? 12 : 8;
            ctx.beginPath();
            ctx.moveTo(-13, -1);
            ctx.quadraticCurveTo(0, smileDepth, 13, -1);
            ctx.stroke();
        }
    } else if (S.mouthStyle === 'mochi-cute') {
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';

        if (open > 0.08 || S.state === 'surprise' || ['success', 'love'].includes(S.state)) {
            const rxM = S.state === 'surprise' ? 7.5 : (['success', 'love'].includes(S.state) && open <= 0.08 ? 10 : (8 + open * 4) * S.mouthWidth);
            const ryM = S.state === 'surprise' ? 8.5 : (['success', 'love'].includes(S.state) && open <= 0.08 ? 6.5 : 3 + open * 9);
            ctx.fillStyle = '#9f1239';
            ctx.beginPath();
            ctx.ellipse(0, 2, rxM, ryM, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.clip();
            ctx.fillStyle = '#fb7185';
            ctx.beginPath();
            ctx.ellipse(0, ryM * 0.55 + 2, rxM * 0.75, ryM * 0.65, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.stroke();
        } else if (S.state === 'dizzy' || S.state === 'error') {
            ctx.beginPath();
            for (let x = -10; x <= 10; x += 2) {
                const y = Math.sin(x * 0.5 + t * 15) * 3;
                if (x === -10) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (['failure', 'poke', 'blocked', 'warning'].includes(S.state)) {
            const quiver = S.state === 'failure' ? Math.sin(t * 25) * 0.8 : 0;
            ctx.beginPath();
            ctx.moveTo(-8, 4 + quiver);
            ctx.quadraticCurveTo(0, -3 + quiver, 8, 4 + quiver);
            ctx.stroke();
        } else if (S.state === 'sleep') {
            ctx.beginPath();
            ctx.arc(0, 2, 3 + Math.sin(t * 1.5) * 1.2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (['bored', 'waiting', 'inspect'].includes(S.state)) {
            ctx.beginPath();
            ctx.moveTo(-7, 2);
            ctx.lineTo(7, 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(0, -1, 8, 0.18 * Math.PI, 0.82 * Math.PI);
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
            // Angry/sad inverted cat mouth + tiny fang
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
