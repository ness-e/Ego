// hands.js — rig articulado de manos flotantes (5 dedos) y su dibujo.
// Puerto verbatim de avatar_studio_cx_artlab_mochi_2_0.html:
//   updateHandsRig (líneas 1753-2067), drawHands (líneas 3807-3818),
//   drawSingleHand (líneas 3820-4032).
// Contrato: updateHandsRig(S, dt) muta S; drawHands(ctx, S, targetLayer);
// drawSingleHand(ctx, S, hand, isLeft).
// `this.X` del original se lee como `S.X`; ayudantes desde ../render/helpers.js.

import { getStateAccentColor, hexToRgba, roundRectPath, shadeColor } from '../render/helpers.js';

/** Rig de manos: órbita base, alcance al cursor, spread en drag, switch por estado, muelles de retracción (líneas 1753-2067, literal). */
export function updateHandsRig(S, dt) {
    const t = S.time;
    const st = S.stateTimer;
    const breathY = Math.sin(t * 2.5) * 3.5;
    const rx = 84 * S.bodyWidthRatio;

    // 3D depth sorting of hands when head turns or spins!
    const turnBias = Math.sin(S.spinAngle) + S.headLookX * 0.35;

    const L = {
        x: -(rx + 26) + S.headLookX * 8,
        y: 20 + breathY + S.headLookY * 6,
        rot: -0.18 + Math.sin(t * 2.2) * 0.06,
        scale: 1.0 - turnBias * 0.08,
        pose: 'normal',
        layer: turnBias > 0.35 ? 'back' : 'front',
        fingerWave: Math.sin(t * 3) * 0.15
    };
    const R = {
        x: (rx + 26) + S.headLookX * 8,
        y: 20 + breathY + S.headLookY * 6,
        rot: 0.18 - Math.sin(t * 2.2) * 0.06,
        scale: 1.0 + turnBias * 0.08,
        pose: 'normal',
        layer: turnBias < -0.35 ? 'back' : 'front',
        fingerWave: Math.cos(t * 3) * 0.15
    };

    // Interactive Hand-Cursor Reach & Finger Wave when hovering near/over hands!
    if (!S.isDragging && S.handVisibility > 0.25) {
        const localPtrX = (S.pointerX - S.x) / S.globalScale;
        const localPtrY = (S.pointerY - S.y) / S.globalScale;
        const distL = Math.hypot(localPtrX - L.x, localPtrY - L.y);
        const distR = Math.hypot(localPtrX - R.x, localPtrY - R.y);
        if (distL < 95) {
            const pull = (1 - distL / 95) * 0.45;
            L.x += (localPtrX - L.x) * pull;
            L.y += (localPtrY - L.y) * pull - 4;
            L.rot = Math.atan2(localPtrY - L.y, localPtrX - L.x) * 0.32 - 0.28;
            L.pose = 'wave';
            L.scale = 1.12;
            L.layer = 'front';
            L.fingerWave = Math.sin(t * 16) * 0.75;
        }
        if (distR < 95) {
            const pull = (1 - distR / 95) * 0.45;
            R.x += (localPtrX - R.x) * pull;
            R.y += (localPtrY - R.y) * pull - 4;
            R.rot = Math.atan2(localPtrY - R.y, localPtrX - R.x) * 0.32 + 0.28;
            R.pose = 'wave';
            R.scale = 1.12;
            R.layer = 'front';
            R.fingerWave = Math.sin(t * 16) * 0.75;
        }
    }

    if (S.isDragging) {
        L.x = -(rx + 32) - S.dragStretchX * 40;
        L.y = 8 - S.dragStretchY * 40 + Math.sin(t * 20) * 4;
        L.rot = -0.6;
        L.pose = 'open';
        L.fingerWave = Math.sin(t * 24) * 0.8;

        R.x = (rx + 32) + S.dragStretchX * 40;
        R.y = 8 - S.dragStretchY * 40 + Math.cos(t * 20) * 4;
        R.rot = 0.6;
        R.pose = 'open';
        R.fingerWave = Math.cos(t * 24) * 0.8;
    } else {
        switch (S.state) {
            case 'talk':
                L.x = -(rx + 16) + Math.sin(t * 8) * 10;
                L.y = 14 + Math.cos(t * 8) * 8;
                L.rot = -0.35 + Math.sin(t * 8) * 0.25;
                L.pose = 'open';
                L.fingerWave = Math.sin(t * 12) * 0.55;

                R.x = (rx + 16) + Math.cos(t * 9) * 12;
                R.y = 10 + Math.sin(t * 9) * 10;
                R.rot = 0.35 - Math.cos(t * 9) * 0.25;
                R.pose = 'open';
                R.fingerWave = Math.cos(t * 12) * 0.55;
                break;

            case 'wave':
                L.x = -(rx + 22);
                L.y = 26 + breathY;
                L.rot = -0.25;
                R.x = (rx + 24) + Math.sin(t * 14) * 16;
                R.y = -38 + Math.abs(Math.cos(t * 14)) * 6;
                R.rot = 0.55 + Math.sin(t * 14) * 0.48;
                R.scale = 1.15;
                R.pose = 'wave';
                R.fingerWave = Math.sin(t * 18) * 0.85;
                break;

            case 'bored':
                L.x = -56;
                L.y = 38;
                L.rot = 0.55;
                L.pose = 'fist';
                R.x = rx + 20;
                R.y = 48 + Math.sin(t * 1.5) * 2;
                R.rot = 0.08;
                R.layer = 'back';
                break;

            case 'waiting':
                L.x = -76;
                L.y = 36;
                L.rot = 0.75;
                L.pose = 'open';
                L.fingerWave = Math.sin(t * 10) * 0.6;
                R.x = 34 + Math.sin(t * 7) * 3;
                R.y = 42 + Math.abs(Math.sin(t * 7)) * 5;
                R.rot = -0.45 + Math.sin(t * 7) * 0.12;
                R.pose = 'point';
                break;

            case 'input':
                L.x = -42 + Math.sin(t * 11) * 12;
                L.y = 44 + Math.sin(t * 32) * 8;
                L.rot = 0.4 + Math.sin(t * 32) * 0.18;
                L.pose = 'type';
                L.fingerWave = t * 28;

                R.x = 42 + Math.sin(t * 11) * 12;
                R.y = 44 + Math.cos(t * 32) * 8;
                R.rot = -0.4 + Math.cos(t * 32) * 0.18;
                R.pose = 'type';
                R.fingerWave = t * 28 + 1.5;
                break;

            case 'send':
                if (st < 0.18) {
                    L.x = -46; L.y = 32; L.rot = 0.6;
                    R.x = 46;  R.y = 32; R.rot = -0.6;
                } else {
                    L.x = -(rx + 8); L.y = -48; L.rot = -0.45; L.pose = 'open';
                    R.x = (rx + 8);  R.y = -48; R.rot = 0.45;  R.pose = 'open';
                }
                break;

            case 'success':
            case 'wake':
            case 'spin': {
                const pump = Math.sin(t * 12) * 8;
                L.x = -(rx + 14);
                L.y = -38 + pump;
                L.rot = -0.65 - Math.sin(t * 12) * 0.15;
                L.scale = 1.08;
                L.pose = 'thumbsup';

                R.x = (rx + 14);
                R.y = -38 - pump;
                R.rot = 0.65 + Math.sin(t * 12) * 0.15;
                R.scale = 1.08;
                R.pose = 'thumbsup';
                break;
            }

            case 'failure':
                L.x = -(rx + 10); L.y = 58; L.rot = 0.25; L.layer = 'back';
                R.x = (rx + 10);  R.y = 58; R.rot = -0.25; R.layer = 'back';
                break;

            case 'warning':
                L.x = -(rx + 6); L.y = 32; L.rot = 0.45; L.pose = 'fist';
                R.x = (rx + 14);
                R.y = -18 + Math.sin(t * 12) * 5;
                R.rot = 0.15 + Math.sin(t * 12) * 0.1;
                R.pose = 'point';
                break;

            case 'inspect':
                L.x = -56 + S.eyeLookX * 22;
                L.y = 24 + S.eyeLookY * 16;
                L.rot = 0.55;
                L.pose = 'grip';
                R.x = 42;
                R.y = 44 + Math.sin(t * 4) * 2;
                R.rot = -0.5;
                break;

            case 'blocked':
                L.x = -24;
                L.y = 18;
                L.rot = 0.78;
                L.scale = 1.08;
                L.pose = 'stop';

                R.x = 24;
                R.y = 18;
                R.rot = -0.78;
                R.scale = 1.08;
                R.pose = 'stop';
                break;

            case 'error':
                L.x = -82 + (Math.random() - 0.5) * 8;
                L.y = -36 + (Math.random() - 0.5) * 8;
                L.rot = -0.85;
                L.pose = 'open';

                R.x = 82 + (Math.random() - 0.5) * 8;
                R.y = -36 + (Math.random() - 0.5) * 8;
                R.rot = 0.85;
                R.pose = 'open';
                break;

            case 'surprise':
                L.x = -(rx + 14);
                L.y = -8 + Math.sin(t * 16) * 3;
                L.rot = -0.55;
                L.scale = 1.1;
                L.pose = 'open';

                R.x = (rx + 14);
                R.y = -8 + Math.sin(t * 16) * 3;
                R.rot = 0.55;
                R.scale = 1.1;
                R.pose = 'open';
                break;

            case 'sleep':
                L.x = 48;
                L.y = 34 + Math.sin(t * 1.4) * 2;
                L.rot = -0.45;
                R.x = 64;
                R.y = 38 + Math.sin(t * 1.4) * 2;
                R.rot = -0.35;
                break;

            case 'poke':
                L.x = -78;
                L.y = 10 + Math.sin(t * 22) * 6;
                L.rot = 0.5;
                L.scale = 1.12;
                L.pose = 'fist';

                R.x = 78;
                R.y = 4 - Math.sin(t * 22) * 6;
                R.rot = -0.5;
                R.scale = 1.12;
                R.pose = 'fist';
                break;

            case 'dizzy':
                L.x = -(rx + 18) + Math.cos(t * 9) * 16;
                L.y = 10 + Math.sin(t * 9) * 18;
                L.rot = t * 6;
                R.x = (rx + 18) + Math.cos(t * 9 + Math.PI) * 16;
                R.y = 10 + Math.sin(t * 9 + Math.PI) * 18;
                R.rot = -t * 6;
                break;

            case 'box':
                L.x = -(rx + 6); L.y = 12; L.rot = 0.25; L.pose = 'grip';
                R.x = (rx + 6);  R.y = 12; R.rot = -0.25; R.pose = 'grip';
                break;

            case 'listen':
                L.x = -(rx + 20); L.y = 26; L.rot = -0.2;
                R.x = (rx + 16);
                R.y = -12 + Math.sin(t * 6) * 2;
                R.rot = -0.45;
                R.scale = 1.1;
                R.pose = 'open';
                break;

            case 'love':
                L.x = -22;
                L.y = 38 + Math.sin(t * 8) * 3;
                L.rot = 0.65;
                R.x = 22;
                R.y = 38 + Math.sin(t * 8) * 3;
                R.rot = -0.65;
                break;
        }
    }

    const vis = S.handVisibility;
    const retractX = 0.35 + 0.65 * vis;
    const targetLX = L.x * retractX;
    const targetLY = L.y * vis + 18 * (1 - vis);
    const targetRX = R.x * retractX;
    const targetRY = R.y * vis + 18 * (1 - vis);

    const k = 0.26;
    const damp = 0.74;
    const dragLagX = -S.vx * 0.45;
    const dragLagY = -S.vy * 0.45;

    S.leftHand.vx = (S.leftHand.vx + (targetLX + dragLagX - S.leftHand.x) * k) * damp;
    S.leftHand.vy = (S.leftHand.vy + (targetLY + dragLagY - S.leftHand.y) * k) * damp;
    S.leftHand.x += S.leftHand.vx;
    S.leftHand.y += S.leftHand.vy;
    S.leftHand.vRot = (S.leftHand.vRot + (L.rot - S.leftHand.rot) * 0.25) * 0.75;
    S.leftHand.rot += S.leftHand.vRot;
    S.leftHand.scale = L.scale * S.handScaleConfig * Math.max(0.001, vis);
    S.leftHand.pose = L.pose;
    S.leftHand.layer = L.layer;
    S.leftHand.fingerWave = L.fingerWave || 0;

    S.rightHand.vx = (S.rightHand.vx + (targetRX + dragLagX - S.rightHand.x) * k) * damp;
    S.rightHand.vy = (S.rightHand.vy + (targetRY + dragLagY - S.rightHand.y) * k) * damp;
    S.rightHand.x += S.rightHand.vx;
    S.rightHand.y += S.rightHand.vy;
    S.rightHand.vRot = (S.rightHand.vRot + (R.rot - S.rightHand.rot) * 0.25) * 0.75;
    S.rightHand.rot += S.rightHand.vRot;
    S.rightHand.scale = R.scale * S.handScaleConfig * Math.max(0.001, vis);
    S.rightHand.pose = R.pose;
    S.rightHand.layer = R.layer;
    S.rightHand.fingerWave = R.fingerWave || 0;
}

/** Dibuja las manos de la capa indicada (líneas 3807-3818, literal). */
export function drawHands(ctx, S, targetLayer) {
    if (S.handVisibility <= 0.03) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, S.handVisibility * 1.15);
    if (S.leftHand.layer === targetLayer) {
        drawSingleHand(ctx, S, S.leftHand, true);
    }
    if (S.rightHand.layer === targetLayer) {
        drawSingleHand(ctx, S, S.rightHand, false);
    }
    ctx.restore();
}

/** Dibuja una mano con su pose (líneas 3820-4032, literal). */
export function drawSingleHand(ctx, S, hand, isLeft) {
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(hand.rot);
    ctx.scale(hand.scale, hand.scale);

    const isRobotStyle = S.showVisor;
    const accent = getStateAccentColor(S);
    const dir = isLeft ? 1 : -1;
    const fWave = hand.fingerWave || 0;

    // Subtle magnetic energy tether between body and floating hand
    ctx.save();
    ctx.strokeStyle = hexToRgba(accent, 0.18);
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(dir * 12, 0);
    ctx.lineTo(dir * 26, 0);
    ctx.stroke();
    ctx.restore();

    const grad = ctx.createRadialGradient(-5, -6, 2, 0, 0, 26);
    grad.addColorStop(0, shadeColor(S.bodyColor, 32));
    grad.addColorStop(0.6, S.bodyColor);
    grad.addColorStop(1, shadeColor(S.bodyColor, -28));

    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.9;

    if (hand.pose === 'wave' || hand.pose === 'open' || hand.pose === 'stop') {
        // Palm base
        roundRectPath(ctx, -14, -13, 28, 27, 11);
        ctx.fill();
        ctx.stroke();

        // 4 Articulated Fingers (index, middle, ring, pinky) with independent wave & anatomical lengths!
        const fingerOffsets = [-9.5, -3.2, 3.2, 9.5];
        fingerOffsets.forEach((fx, idx) => {
            const baseLen = (idx === 1 || idx === 2) ? 12.5 : 10.0;
            const waveRot = Math.sin(fWave + idx * 0.55) * 0.14;
            const waveLift = Math.cos(fWave + idx * 0.55) * 1.5;
            ctx.save();
            ctx.translate(fx, -12 + waveLift);
            ctx.rotate(waveRot + (idx - 1.5) * 0.08);
            roundRectPath(ctx, -2.7, -baseLen, 5.4, baseLen + 2, 2.7);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });

        // Articulated Rotated Side Thumb
        const thumbX = isLeft ? 13.5 : -13.5;
        ctx.save();
        ctx.translate(thumbX, -2);
        ctx.rotate((isLeft ? 0.52 : -0.52) + Math.sin(fWave) * 0.12);
        roundRectPath(ctx, -3.2, -7, 6.4, 12, 3.2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Palm Center Node (LED repulsor on Robot, soft pink paw pad on Mochi)
        if (isRobotStyle) {
            ctx.save();
            ctx.shadowColor = accent;
            ctx.shadowBlur = 10;
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(0, 1.5, 4.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
            ctx.beginPath();
            ctx.ellipse(0, 2, 6, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

    } else if (hand.pose === 'type') {
        // Typing Hand with 4 Rapidly Tapping Articulated Fingers!
        roundRectPath(ctx, -14, -11, 28, 22, 10);
        ctx.fill();
        ctx.stroke();

        const fingerOffsets = [-9, -3, 3, 9];
        fingerOffsets.forEach((fx, idx) => {
            const tapY = Math.sin(fWave + idx * 1.6) * 4.5;
            ctx.save();
            ctx.translate(fx, 8 + Math.max(0, tapY));
            roundRectPath(ctx, -2.6, -2, 5.2, 10, 2.6);
            ctx.fill();
            ctx.stroke();
            if (tapY > 2.5 && isRobotStyle) {
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(0, 6.5, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });

    } else if (hand.pose === 'thumbsup') {
        // Fist palm
        roundRectPath(ctx, -13, -11, 26, 24, 10);
        ctx.fill();
        ctx.stroke();

        // 3 Curled fingers on the front of the fist
        for (let i = -1; i <= 1; i++) {
            roundRectPath(ctx, (isLeft ? -3 : 3) - 5, i * 6 - 3, 10, 5.2, 2.6);
            ctx.fill();
            ctx.stroke();
        }

        // Upward articulated thumb
        ctx.save();
        ctx.translate(isLeft ? 6 : -6, -15);
        roundRectPath(ctx, -4.5, -11, 9, 15, 4.5);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (isRobotStyle) {
            ctx.save();
            ctx.shadowColor = accent;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-7, 7);
            ctx.lineTo(7, 7);
            ctx.stroke();
            ctx.restore();
        }

    } else if (hand.pose === 'point') {
        roundRectPath(ctx, -13, -11, 26, 23, 10);
        ctx.fill();
        ctx.stroke();

        // Curled secondary fingers
        for (let i = 0; i < 2; i++) {
            roundRectPath(ctx, (i === 0 ? -8 : 3), -14, 5.5, 6, 2.8);
            ctx.fill();
            ctx.stroke();
        }

        // Extended Index Finger + Glowing Fingertip LED
        roundRectPath(ctx, -3.5, -24, 7, 16, 3.5);
        ctx.fill();
        ctx.stroke();

        if (isRobotStyle) {
            ctx.save();
            ctx.shadowColor = accent;
            ctx.shadowBlur = 8;
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(0, -21, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

    } else if (hand.pose === 'fist' || hand.pose === 'grip') {
        // Clenched Fist with 4 Visible Curled Knuckle Segments + Tucked Thumb
        roundRectPath(ctx, -15, -12, 30, 24, 10);
        ctx.fill();
        ctx.stroke();

        const knuckleX = [-8.5, -2.8, 2.8, 8.5];
        knuckleX.forEach((kx) => {
            roundRectPath(ctx, kx - 2.6, -14, 5.2, 8.5, 2.6);
            ctx.fill();
            ctx.stroke();
        });

        // Tucked thumb across front
        roundRectPath(ctx, -9, -4, 18, 5.5, 2.8);
        ctx.fill();
        ctx.stroke();

    } else {
        // Ergonomic Resting Hand with Articulated Side Thumb & Curved LED Strip
        roundRectPath(ctx, -14, -16, 28, 32, 13);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        const thumbSide = isLeft ? 11.5 : -11.5;
        ctx.translate(thumbSide, -2);
        ctx.rotate(isLeft ? 0.22 : -0.22);
        roundRectPath(ctx, -3.8, -6, 7.6, 12, 3.8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (isRobotStyle) {
            ctx.save();
            ctx.shadowColor = accent;
            ctx.shadowBlur = 10;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 6, 6, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
    }

    ctx.restore();
}
