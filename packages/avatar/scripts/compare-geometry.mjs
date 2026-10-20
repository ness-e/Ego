#!/usr/bin/env node
// scripts/compare-geometry.mjs — comparador DETERMINISTA de la geometria del studio.
//
// Por que no basta con comparar capturas: el rasterizado de canvas no es
// identico entre sesiones de navegador, asi que un diff de pixeles mezcla
// ruido con cambios reales. Aqui se comparan las LLAMADAS AL CONTEXTO: cada
// `arc`, `ellipse`, `fillRect`, `createLinearGradient`... queda registrado en
// una traza textual, y dos implementaciones se comparan traza contra traza.
//
// Es determinista al 100 %: la misma entrada produce siempre la misma traza.
//
// Uso:
//   node scripts/compare-geometry.mjs <srcA> <srcB> [--only body,ears]
//
// Salida: 0 = geometria identica; 1 = diferencias; 2 = error de uso.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');

/** Contexto de canvas que REGISTRA todas las operaciones. */
function recordingCtx(log) {
  const grad = (kind, args) => ({
    kind,
    args,
    stops: [],
    addColorStop(offset, color) { this.stops.push([offset, color]); },
  });
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
    lineJoin: 'miter', shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
    globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low', filter: 'none',
  };
  const rec = (name) => (...args) => { log.push(`${name}(${args.map(fmt).join(', ')})`); };
  const state = (name) => (...args) => {
    log.push(`${name}(${args.map(fmt).join(', ')})`);
    log.push(`  .${name} = ${args.map(fmt).join(', ')}`);
  };
  for (const n of ['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke', 'clip']) {
    ctx[n] = rec(n);
  }
  for (const n of ['translate', 'scale', 'rotate', 'setTransform']) {
    ctx[n] = state(n);
  }
  for (const n of ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'rect', 'fillRect', 'strokeRect', 'arcTo', 'setLineDash']) {
    ctx[n] = rec(n);
  }
  ctx.createLinearGradient = (...a) => { const g = grad('linear', a); log.push(`createLinearGradient(${a.map(fmt).join(', ')})`); return g; };
  ctx.createRadialGradient = (...a) => { const g = grad('radial', a); log.push(`createRadialGradient(${a.map(fmt).join(', ')})`); return g; };
  ctx.fillText = rec('fillText');
  return ctx;
}

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Estado fijo del avatar para el que se evalua la geometria. */
const BASE_STATE = {
  time: 0.5,
  bodyColor: '#141720',
  visorColor: '#06080e',
  eyeColor: '#f59e0b',
  accent: '#f59e0b',
  autoStateColors: true,
  eyeStyle: 'cx-led',
  mouthStyle: 'none',
  accessory: 'cx-antenna',
  variantMode: 'cx-faithful',
  showVisor: true,
  showSidePods: true,
  squircleN: 4.0,
  eyeSpacing: 28,
  eyeOffsetY: -2,
  eyeGlowBlur: 18,
  eyeWidthRatio: 1,
  eyeHeightRatio: 1,
  eyeLookX: 0,
  eyeLookY: 0,
  headLookX: 0,
  headLookY: 0,
  mouthOpen: 0,
  mouthWidth: 1,
  mouthScale: 1,
  mouthOffsetY: 24,
  accessoryScale: 1,
  accessoryOffsetY: 0,
  antennaAngle: 0,
  earPerk: 0,
  bodyHoverAmount: 0,
  pettingAmount: 0,
  globalScale: 1,
  x: 0,
  y: 0,
  pointerX: 0,
  pointerY: 0,
  leftPodHoverAmount: 0,
  rightPodHoverAmount: 0,
  spinAngle: 0,
  handsActiveTimer: 0,
  leftHand: null,
  rightHand: null,
  eyeRig: { w: 40, h: 24, radius: 6, pupilScale: 1, topLid: 0, slant: 0, cross: 0, happyArch: 0, ring: 0 },
  leftEye: { w: 40, h: 24, radius: 6, pupilScale: 1, topLid: 0, slant: 0, cross: 0, happyArch: 0, ring: 0 },
  rightEye: { w: 40, h: 24, radius: 6, pupilScale: 1, topLid: 0, slant: 0, cross: 0, happyArch: 0, ring: 0 },
};

/**
 * Combinaciones a comparar. Cada una cambia el estado o el estilo, que es
 * donde vive cada rama de la geometria.
 */
const COMBOS = [
  { label: 'idle', state: { state: 'idle' } },
  { label: 'success', state: { state: 'success' } },
  { label: 'error', state: { state: 'error', autoStateColors: true } },
  { label: 'warning', state: { state: 'warning' } },
  { label: 'dizzy', state: { state: 'dizzy', eyeLookX: 0.2, eyeLookY: 0.1 } },
  { label: 'sleep', state: { state: 'sleep', eyeOffsetY: -2, eyeStyle: 'cx-led' } },
  { label: 'love', state: { state: 'love', mouthOpen: 0.4, pettingAmount: 0.5 } },
  { label: 'look-away', state: { state: 'idle', eyeLookX: 0.6, headLookX: 0.3, headLookY: -0.2 } },
  { label: 'blink', state: { state: 'idle', eyeRig: { ...BASE_STATE.eyeRig, topLid: 1 } } },
  { label: 'cross-eyed', state: { state: 'idle', eyeRig: { ...BASE_STATE.eyeRig, cross: 1 } } },
  { label: 'no-visor', state: { state: 'idle', showVisor: false } },
  { label: 'hover', state: { state: 'idle', bodyHoverAmount: 0.8, pointerX: 30, pointerY: -20 } },
  { label: 'mouth-led', state: { state: 'talk', mouthStyle: 'led-wave', mouthOpen: 0.7 } },
  { label: 'mouth-cat', state: { state: 'talk', mouthStyle: 'cat-kawaii', mouthOpen: 0.7 } },
  { label: 'mouth-vocoder', state: { state: 'talk', mouthStyle: 'vocoder', mouthOpen: 0.7 } },
  { label: 'mouth-pixel', state: { state: 'talk', mouthStyle: 'pixel-mouth', mouthOpen: 0.7 } },
  { label: 'eye-cyclops', state: { state: 'idle', eyeStyle: 'cyclops' } },
  { label: 'eye-pixel', state: { state: 'idle', eyeStyle: 'pixel' } },
  { label: 'eye-anime', state: { state: 'idle', eyeStyle: 'anime' } },
  { label: 'eye-heart', state: { state: 'love', eyeStyle: 'heart' } },
  { label: 'eye-zen', state: { state: 'idle', eyeStyle: 'zen-arc' } },
  { label: 'eye-terminal', state: { state: 'idle', eyeStyle: 'terminal' } },
  { label: 'eye-cyber', state: { state: 'idle', eyeStyle: 'cyber-visor' } },
  { label: 'acc-headphones', state: { state: 'idle', accessory: 'headphones' } },
  { label: 'acc-glasses', state: { state: 'idle', accessory: 'glasses' } },
  { label: 'acc-cat-ears', state: { state: 'idle', accessory: 'cat-ears' } },
  { label: 'acc-santa', state: { state: 'idle', accessory: 'santa' } },
  { label: 'acc-none', state: { state: 'idle', accessory: 'none' } },
];

/** Funciones de dibujo a comparar y como invocarlas. */
const CASES = [
  { name: 'body', mod: 'studio/render/body.js', fn: 'drawSquircleBody', args: (ctx, S) => [ctx, S, 84, 77.28, 4.0, 0, 1] },
  { name: 'ears', mod: 'studio/render/ears.js', fn: 'drawRobotEars3D', args: (ctx, S) => [ctx, S, 84, 77.28, 'front', 0, 1] },
  { name: 'ears-back', mod: 'studio/render/ears.js', fn: 'drawRobotEars3D', args: (ctx, S) => [ctx, S, 84, 77.28, 'back', 0.6, 0.8] },
  { name: 'mouth', mod: 'studio/render/mouth.js', fn: 'drawMouth', args: (ctx, S) => [ctx, S, 84, 77.28] },
  { name: 'accessory', mod: 'studio/render/accessories.js', fn: 'drawTopAccessory', args: (ctx, S) => [ctx, S, 84, 77.28, 0, 0] },
  { name: 'eyes', mod: 'studio/render/eyes.js', fn: 'drawEyes', args: (ctx, S) => [ctx, S, 84, 77.28] },
];

async function traceOf(srcRoot, c, S) {
  const mod = await import(pathToFileURL(join(srcRoot, c.mod)).href);
  const fn = mod[c.fn];
  if (typeof fn !== 'function') throw new Error(`${c.fn} no existe en ${c.mod}`);
  const log = [];
  const ctx = recordingCtx(log);
  fn(...c.args(ctx, S));
  return log;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

  const recordTo = flag('--record');
  const checkAgainst = flag('--check');
  const srcA = positional[0];
  const srcB = positional[1];

  if (recordTo) {
    // Genera la traza golden a partir de un arbol de fuentes.
    if (!srcA) { console.error('uso: --record <golden.json> <src>'); return 2; }
    const root = resolve(srcA);
    const golden = {};
    for (const combo of COMBOS) {
      const S = { ...BASE_STATE, ...combo.state };
      for (const c of CASES) {
        golden[`${combo.label}/${c.name}`] = await traceOf(root, c, S);
      }
    }
    writeFileSync(recordTo, JSON.stringify(golden, null, 1) + '\n', 'utf8');
    console.log(`traza golden escrita en ${recordTo} (${Object.keys(golden).length} combinaciones).`);
    return 0;
  }

  if (checkAgainst) {
    // Compara el arbol actual contra una traza golden commiteada.
    if (!srcA) { console.error('uso: --check <golden.json> <src>'); return 2; }
    const root = resolve(srcA);
    const golden = JSON.parse(readFileSync(checkAgainst, 'utf8'));
    let diffs = 0;
    let total = 0;
    for (const combo of COMBOS) {
      const S = { ...BASE_STATE, ...combo.state };
      for (const c of CASES) {
        const key = `${combo.label}/${c.name}`;
        const expected = golden[key];
        total++;
        if (!expected) {
          diffs++;
          console.error(`  DIFF ${key}: no hay traza golden para esta combinacion`);
          continue;
        }
        const actual = await traceOf(root, c, S);
        const n = Math.max(expected.length, actual.length);
        const local = [];
        for (let i = 0; i < n; i++) {
          if (expected[i] !== actual[i]) {
            local.push({ i, a: expected[i], b: actual[i] });
            if (local.length >= 4) break;
          }
        }
        if (local.length === 0) {
          console.log(`  OK   ${key}: ${actual.length} operaciones identicas`);
        } else {
          diffs++;
          console.error(`  DIFF ${key}: ${local.length}+ diferencias (golden=${expected.length} ops, actual=${actual.length} ops)`);
          for (const d of local) {
            console.error(`     op#${d.i}`);
            console.error(`       golden: ${d.a ?? '(fin)'}`);
            console.error(`       actual: ${d.b ?? '(fin)'}`);
          }
        }
      }
    }
    if (diffs === 0) {
      console.log(`\nGEOMETRIA IDENTICA a la golden: ${total} combinaciones (${COMBOS.length} estados x ${CASES.length} modulos).`);
      return 0;
    }
    console.error(`\n${diffs} combinacion(es) con geometria distinta de ${total}.`);
    return 1;
  }

  // Modo directo: compara dos arboles de fuentes.
  if (!srcA || !srcB) {
    console.error(
      'uso:\n' +
      '  node scripts/compare-geometry.mjs <srcA> <srcB>      compara dos arboles\n' +
      '  node scripts/compare-geometry.mjs --record <f.json> <src>  genera la traza golden\n' +
      '  node scripts/compare-geometry.mjs --check <f.json> <src>   compara contra la golden',
    );
    return 2;
  }
  const rootA = resolve(srcA);
  const rootB = resolve(srcB);
  let diffs = 0;
  let total = 0;
  for (const combo of COMBOS) {
    const S = { ...BASE_STATE, ...combo.state };
    for (const c of CASES) {
      const ta = await traceOf(rootA, c, S);
      const tb = await traceOf(rootB, c, S);
      total++;
      const n = Math.max(ta.length, tb.length);
      const local = [];
      for (let i = 0; i < n; i++) {
        if (ta[i] !== tb[i]) {
          local.push({ i, a: ta[i], b: tb[i] });
          if (local.length >= 4) break;
        }
      }
      if (local.length === 0) {
        console.log(`  OK   ${combo.label}/${c.name}: ${ta.length} operaciones identicas`);
      } else {
        diffs++;
        console.error(`  DIFF ${combo.label}/${c.name}: ${local.length}+ diferencias (A=${ta.length} ops, B=${tb.length} ops)`);
        for (const d of local) {
          console.error(`     op#${d.i}`);
          console.error(`       A: ${d.a ?? '(fin)'}`);
          console.error(`       B: ${d.b ?? '(fin)'}`);
        }
      }
    }
  }
  if (diffs === 0) {
    console.log(`\nGEOMETRIA IDENTICA: ${total} combinaciones (${COMBOS.length} estados x ${CASES.length} modulos).`);
    return 0;
  }
  console.error(`\n${diffs} combinacion(es) con geometria distinta de ${total}.`);
  return 1;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(2); });
