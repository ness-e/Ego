// shell.js — ensambla el SVG completo del avatar (se construye UNA vez; luego
// solo se mutan atributos — P4).
// Estructura del rig de agent-robot-avatar (core.js:259-290): cabeza plana +
// ojos recortados a la silueta + grupo de movimiento envolvente. La mirada
// nunca se sale de la cabeza (`headClip`, como el original).

import { el, group } from './builder.js';
import { bodyPath, bodyDefs, markingPath, tintLayer } from './body.js';
import { eyesLayer, eyesDefs } from './eyes.js';
import { auraLayer, appendageLayer, badgeLayer, particlesLayer } from './parts.js';

/**
 * @param {string} uid    ids únicos por avatar (derivable de la semilla)
 * @param {object} genome
 * @param {object} palette
 * @returns {string} SVG completo
 */
export function renderShell(uid, genome, palette) {
  const d = bodyPath(genome);
  return el(
    'svg',
    {
      viewBox: '0 0 240 240',
      class: 'avatar-svg',
      xmlns: 'http://www.w3.org/2000/svg',
      role: 'img',
      'aria-label': `avatar ${genome.seed}`,
    },
    [
      bodyDefs(uid, genome, palette, d),
      eyesDefs(uid),
      // clip de silueta para los ojos (la mirada nunca se sale de la cabeza)
      el(
        'clipPath',
        { id: `bodyclip-${uid}` },
        el('path', { d })
      ),
      auraLayer(uid),
      appendageLayer(genome),
      group({ class: 'motion-group' }, [
        group({ class: 'body-group' }, [
          el('path', { class: 'body', d, fill: palette.ink }),
          tintLayer(d),
          markingPath(uid, genome),
          group({ class: 'eyes-clip', 'clip-path': `url(#bodyclip-${uid})` }, [eyesLayer(uid, genome, palette)]),
        ]),
      ]),
      badgeLayer(),
      particlesLayer(),
    ].join('')
  );
}
