// parts.js — aura, apéndice (identidad), insignia y partículas.

import { el, group } from './builder.js';
import { BODY, bodyRadii } from './body.js';

/** Aura radial detrás del cuerpo (genoma.aura × glow del estado). */
export function auraLayer(uid) {
  return el('circle', {
    class: 'aura',
    cx: BODY.cx,
    cy: BODY.cy,
    r: 106,
    fill: `url(#aura-${uid})`,
    opacity: '0',
  });
}

/**
 * Apéndice del genoma — anclado a la parte superior del cuerpo.
 * El runtime lo balancea con un muelle alrededor de data-anchor.
 */
export function appendageLayer(genome) {
  const { ry } = bodyRadii(genome);
  const topY = BODY.cy - ry;
  const cx = BODY.cx;
  const parts = [];

  switch (genome.appendage) {
    case 'antenna': {
      const tipY = topY - 30;
      parts.push(
        group({ class: 'appendage-part', 'data-anchor': `${cx} ${topY}` }, [
          el('path', {
            d: `M ${cx} ${topY} Q ${cx + 5} ${topY - 16} ${cx + 2} ${tipY}`,
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 5,
            'stroke-linecap': 'round',
          }),
          el('circle', { cx: cx + 2, cy: tipY - 4, r: 8, fill: 'currentColor', class: 'appendage-tip' }),
        ])
      );
      break;
    }
    case 'sprout': {
      const stemTop = topY - 24;
      parts.push(
        group({ class: 'appendage-part', 'data-anchor': `${cx} ${topY}` }, [
          el('path', {
            d: `M ${cx} ${topY} Q ${cx - 4} ${topY - 12} ${cx} ${stemTop}`,
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 4.5,
            'stroke-linecap': 'round',
          }),
          el('ellipse', {
            cx: cx - 8,
            cy: stemTop - 3,
            rx: 9,
            ry: 5.5,
            fill: 'currentColor',
            transform: `rotate(-28 ${cx - 8} ${stemTop - 3})`,
          }),
          el('ellipse', {
            cx: cx + 8,
            cy: stemTop - 5,
            rx: 9,
            ry: 5.5,
            fill: 'currentColor',
            transform: `rotate(24 ${cx + 8} ${stemTop - 5})`,
          }),
        ])
      );
      break;
    }
    case 'ears': {
      const { rx } = bodyRadii(genome);
      const earR = 22;
      for (const dir of [-1, 1]) {
        const bx = cx + dir * rx * 0.55;
        const by = topY + 6;
        parts.push(
          group({ class: 'appendage-part', 'data-anchor': `${bx} ${by}` }, [
            el('ellipse', {
              cx: bx + dir * 6,
              cy: by - earR * 0.7,
              rx: earR * 0.62,
              ry: earR,
              fill: 'currentColor',
              transform: `rotate(${dir * 16} ${bx} ${by})`,
            }),
          ])
        );
      }
      break;
    }
    default:
      break;
  }
  if (!parts.length) return '';
  return group({ class: 'appendage' }, parts);
}

/** Insignia superior-derecha (dots / bang / question / warn) con entrada por escala. */
export function badgeLayer() {
  return group(
    { class: 'badge', transform: 'translate(198 66) scale(0)', 'data-badge': '' },
    [
      el('circle', { class: 'badge-bg', r: 17, fill: '#fff' }),
      group({ class: 'badge-dots', visibility: 'hidden' }, [
        el('circle', { class: 'badge-dot', cx: -7, cy: 0, r: 3.2 }),
        el('circle', { class: 'badge-dot', cx: 0, cy: 0, r: 3.2 }),
        el('circle', { class: 'badge-dot', cx: 7, cy: 0, r: 3.2 }),
      ]),
      el('text', {
        class: 'badge-bang',
        y: 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': 24,
        'font-weight': 800,
        visibility: 'hidden',
      }, '!'),
      el('text', {
        class: 'badge-question',
        y: 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': 21,
        'font-weight': 800,
        visibility: 'hidden',
      }, '?'),
      // Aviso (warning): triángulo ⚠ dibujado con trazos propios — no es el
      // signo "!" de error ni el "?" de question. El triángulo va en contorno
      // para que la barra y el punto se lean como un "!", no como un borrón.
      group({ class: 'badge-warn', visibility: 'hidden' }, [
        el('path', {
          class: 'badge-warn-frame',
          d: 'M0 -9.5 L9.5 7.5 L-9.5 7.5 Z',
          fill: 'none',
          stroke: '#0b0d12',
          'stroke-width': '2.2',
          'stroke-linejoin': 'round',
        }),
        el('path', {
          class: 'badge-warn-bar',
          d: 'M0 -3.4 L0 1.6',
          fill: 'none',
          stroke: '#0b0d12',
          'stroke-width': '2.2',
          'stroke-linecap': 'round',
        }),
        el('circle', { class: 'badge-warn-dot', cx: 0, cy: 4.6, r: 1.25, fill: '#0b0d12' }),
      ]),
    ].join('')
  );
}

/** Grupo de partículas (vacío; el runtime añade chispas/corazones). */
export function particlesLayer() {
  return group({ class: 'particles' });
}
