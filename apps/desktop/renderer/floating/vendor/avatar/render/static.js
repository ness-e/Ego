// static.js — SVG estático SIN DOM (para miniaturas, tests y export en Node).
// Mismo determinismo que el elemento vivo: misma semilla ⇒ mismo string.
// Añadido: pose por hash djb2 de la semilla (port de vendor/coucou-swift/MochiStill.swift -
// superficies sin animación eligen pose establecida por hash, no siempre idle).
// Adapted from coucou-swift (MIT), vendor/coucou-swift/MochiStill.swift

import { generateGenome } from '../core/genome.js';
import { buildPalette } from '../core/palette.js';
import { uidFor } from '../core/prng.js';
import { eyeGeometry } from './eyes.js';
import { renderShell } from './shell.js';
import { STATES, EMOTES } from '../runtime/states.js';
import { POSES } from '../runtime/poses.js';

/** djb2 (port de vendor/coucou-swift/MochiStill.swift: hash = 5381; h = h·33 + c). */
export function djb2(str) {
  let h = 5381;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Pose estable por semilla (para widgets/sin animación) — devuelve nombre. */
export function poseForSeed(seed) {
  const names = Object.keys(POSES);
  return names[djb2(seed) % names.length];
}

/**
 * Genera el SVG de un avatar en un estado dado (sin animación).
 * @param {string} seed
 * @param {{state?: string, emote?: string, pose?: string}} [opts]
 *   pose: nombre de pose o 'hash' (selección determinista djb2)
 * @returns {string} SVG completo
 */
export function staticSVG(seed, opts = {}) {
  const genome = generateGenome(seed);
  const palette = buildPalette(genome);
  const uid = uidFor(seed);
  const stateName = STATES[opts.state] ? opts.state : 'idle';
  const cfg = STATES[stateName];
  const emote = opts.emote && EMOTES[opts.emote] ? EMOTES[opts.emote] : null;
  let poseName = emote?.pose || cfg.pose;
  if (opts.pose === 'hash') {
    const names = Object.keys(POSES);
    poseName = names[djb2(`${seed}::${stateName}`) % names.length];
  } else if (opts.pose && POSES[opts.pose]) {
    poseName = opts.pose;
  }
  const pose = POSES[poseName] || POSES.idle;
  const geo = eyeGeometry(genome);

  let svg = renderShell(uid, genome, palette);

  // tinte de estado
  if (cfg.tint) {
    svg = svg.replace(
      'class="tint"',
      `class="tint" style="fill:${cfg.tint}" opacity="${cfg.tintStrength}"`
    );
  }
  // glow
  const glow = (genome.aura * cfg.glow).toFixed(3);
  svg = svg.replace(/class="aura"/, `class="aura" opacity="${glow}"`);
  // insignia: dots (3) · dot (1) · bang · question · warn — visibilidad explícita
  if (cfg.badge) {
    svg = svg.replace('scale(0)', 'scale(1)');
    const setVis = (cls, vis) => {
      svg = svg.replace(
        // El lookbehind `(?![-\w])` evita que `badge-warn` coincida con
        // `badge-warn-frame` (prefijo compartido): sin el, el replace
        // corromperia el class de los hijos.
        new RegExp(`class="${cls}"(?![-\\w])( visibility="(hidden|visible)")?`),
        `class="${cls}" visibility="${vis}"`
      );
    };
    setVis('badge-dots', cfg.badge === 'dots' || cfg.badge === 'dot' ? 'visible' : 'hidden');
    setVis('badge-bang', cfg.badge === 'bang' ? 'visible' : 'hidden');
    setVis('badge-question', cfg.badge === 'question' ? 'visible' : 'hidden');
    setVis('badge-warn', cfg.badge === 'warn' ? 'visible' : 'hidden');
    if (cfg.badge === 'dot') {
      // solo el primer punto visible
      let seen = 0;
      svg = svg.replace(/class="badge-dot"/g, () => (++seen === 1 ? 'class="badge-dot"' : 'class="badge-dot" visibility="hidden"'));
    }
  }
  // ojos (pose estática): elipse blanca + párpados según números de pose ARA.
  // rx = p.w/2 y ry = p.h/2 escalados por el gen `scale` (idle 54/58 → 27/29).
  // La elipse y la barra son simétricas (reemplazo global); los párpados
  // pueden diferir por lado (topAL/topAR en sad/angry: reemplazo secuencial
  // L y luego R, que es el orden del markup).
  const sx = geo.rx / 27;
  const sy = geo.ry / 29;
  const isInput = poseName === 'input';
  for (const side of ['L', 'R']) {
    const x = side === 'L' ? geo.left : geo.right;
    const gRe = new RegExp(`<g class="eye eye-${side}" data-side="${side}" transform="translate\\([^"]+\\)"`);
    svg = svg.replace(gRe, `<g class="eye eye-${side}" data-side="${side}" transform="translate(${x} ${geo.y})"`);
  }
  const baseRe = /(<ellipse class="eye-base" cx="0" cy="0" )rx="[^"]+" ry="[^"]+" fill="#fff"/g;
  const topRe = /(<rect class="eye-top" x="-70" )y="[^"]+"( width="140" height="90" fill="[^"]+")/;
  const bottomRe = /(<rect class="eye-bottom" x="-70" )y="[^"]+"( width="140" height="90" fill="[^"]+")/;
  const inputRe = /(<rect class="eye-input" x="-6" y="-39" width="12" height="78" rx="3" fill="#fff" )opacity="0"/g;
  if (isInput) {
    svg = svg.replace(baseRe, '$1rx="0" ry="0" fill="#fff" opacity="0"');
    svg = svg.replace(inputRe, '$1opacity="1"');
    svg = svg.replace(topRe, `$1y="${pose.topY - 90}"$2`);
    svg = svg.replace(topRe, `$1y="${pose.topY - 90}"$2`);
    svg = svg.replace(bottomRe, `$1y="${pose.bottomY}"$2`);
    svg = svg.replace(bottomRe, `$1y="${pose.bottomY}"$2`);
  } else {
    const rx = ((pose.w / 2) * sx).toFixed(2);
    const ry = ((pose.h / 2) * sy).toFixed(2);
    svg = svg.replace(baseRe, `$1rx="${rx}" ry="${ry}" fill="#fff"`);
    svg = svg.replace(topRe, `$1y="${pose.topY - 90}"$2 transform="rotate(${pose.topAL} 0 ${pose.topY})"`);
    svg = svg.replace(topRe, `$1y="${pose.topY - 90}"$2 transform="rotate(${pose.topAR} 0 ${pose.topY})"`);
    svg = svg.replace(bottomRe, `$1y="${pose.bottomY}"$2 transform="rotate(${pose.bottomAL} 0 ${pose.bottomY})"`);
    svg = svg.replace(bottomRe, `$1y="${pose.bottomY}"$2 transform="rotate(${pose.bottomAR} 0 ${pose.bottomY})"`);
  }
  return svg;
}
