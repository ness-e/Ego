// studio/render/particles.js — port verbatim de avatar_studio_cx_artlab_mochi_2_0.html:1079-1092, 1521-1528, 4086-4110.
// Contrato: (ctx, S, …) — S es el estado del avatar (sin importar la clase).
import { getStateAccentColor } from './overlays.js';
export function spawnParticles(S, type, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 2.5 + Math.random() * 4.5;
        S.particles.push({
            type,
            x: S.x + (Math.random() - 0.5) * 45 * S.globalScale,
            y: S.y - 25 * S.globalScale + (Math.random() - 0.5) * 45 * S.globalScale,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2.2,
            life: 1.0
        });
    }
}
export function updateParticles(S, dt) {
    // update(), paso 11 (1521-1528): integración + expiración.
    for (let i = S.particles.length - 1; i >= 0; i--) {
        const p = S.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 1.1;
        if (p.life <= 0) S.particles.splice(i, 1);
    }
}
export function drawParticles(ctx, S) {
    const accent = getStateAccentColor(S);
    for (const p of S.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        if (p.type === 'zzz') {
            ctx.fillStyle = accent;
            ctx.font = 'bold 18px "JetBrains Mono", monospace';
            ctx.fillText('Z', 0, 0);
        } else if (p.type === 'heart') {
            ctx.fillStyle = '#f43f5e';
            ctx.font = '18px sans-serif';
            ctx.fillText('❤', 0, 0);
        } else if (p.type === 'star') {
            ctx.fillStyle = accent;
            ctx.font = '18px sans-serif';
            ctx.fillText('✦', 0, 0);
        } else {
            ctx.fillStyle = accent;
            ctx.fillRect(-4, -4, 8, 8);
        }
        ctx.restore();
    }
}
