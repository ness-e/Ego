#!/usr/bin/env node
// scripts/capture-visuals.mjs — puerta de regresión visual del Robot Studio.
//
// Captura el motor canvas en un conjunto de variantes (preset + estado) con un
// fotograma determinista, y las compara contra una referencia.
//
// Por qué un script y no una captura manual: el motor dibuja sobre canvas 2D
// y el fotograma depende del reloj. Congelando el reloj y el RNG, y
// avanzando el motor a mano con un dt fijo, el estado dibujado es una función
// pura de (semilla, preset, estado).
//
// Por qué tolerancia de píxel y no igualdad de hash: el rasterizado de canvas
// no es idéntico entre sesiones de navegador, así que dos ejecuciones
// NORMALES de la misma versión difieren en ~1 % de píxeles. Fijarse en el hash
// daría falsos rojos; no mirar nada daría falsos verdes. La puerta mide el
// PORCENTAJE de píxeles distintos y falla solo si supera el umbral.
//
// Uso:
//   node scripts/capture-visuals.mjs --out captures/before
//   node scripts/capture-visuals.mjs --out captures/after --compare captures/before
//   node scripts/capture-visuals.mjs --out captures/after --compare captures/before --base http://127.0.0.1:5219
//
// Salida: 0 = sin regresión; 1 = regresión visual; 2 = error de uso.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');

/** Capturador: espera la SEÑAL del harness (`window.__egoAvatarReady`). */
const CAPTURE_SCRIPT = join(HERE, 'capture.py');
/** Comparador con tolerancia de píxel. */
const COMPARE_SCRIPT = join(HERE, 'compare-visuals.py');

/**
 * Porcentaje máximo de píxeles distintos admitido entre dos capturas.
 *
 * NO es la puerta principal: el rasterizado de canvas no es idéntico entre
 * sesiones de navegador, y se ha MEDIDO un ruido de hasta 12 % comparando
 * el MISMO código en dos sesiones distintas. La puerta que decide es
 * `compare-geometry.mjs` (traza de operaciones de canvas, determinista al
 * 100 %). Este umbral solo detects cambios de silueta grandes.
 */
const MAX_DIFF_PCT = 15.0;

/**
 * Variantes capturadas. Cada una ejercita una combinación distinta de
 * estilo de ojo, boca y accesorio, que es donde viven las ramas de geometria
 * que la decision D4 sustituye.
 */
const VARIANTS = [
  { preset: 'ego-nucleus', state: 'idle' },
  { preset: 'ego-cyber', state: 'idle' },
  { preset: 'ego-sentinel', state: 'idle' },
  { preset: 'ego-architect', state: 'idle' },
  { preset: 'cx-faithful', state: 'idle' },
  { preset: 'ego-nucleus', state: 'success' },
  { preset: 'ego-nucleus', state: 'error' },
  { preset: 'ego-cyber', state: 'waiting' },
];

function parseArgs(argv) {
  const out = { out: null, compare: null, base: 'http://127.0.0.1:5219', maxDiff: MAX_DIFF_PCT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out.out = resolve(argv[++i]);
    else if (a === '--compare') out.compare = resolve(argv[++i]);
    else if (a === '--base') out.base = argv[++i].replace(/\/$/, '');
    else if (a === '--max-diff') out.maxDiff = Number(argv[++i]);
  }
  return out;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Captura minima en bytes para un PNG 400x400 con contenido real.
 * Un lienzo en blanco se comprime a ~1-2 KB; uno con el avatar, a ~60 KB.
 * Sirve de guardia: una captura en blanco NO es un resultado valido (seria
 * un falso verde del gate visual).
 */
const MIN_PNG_BYTES = 8 * 1024;

function shoot(url, dest) {
  const res = spawnSync(
    'python',
    [CAPTURE_SCRIPT, url, dest, '--timeout', '20000', '--width', '520', '--height', '520'],
    { encoding: 'utf8' },
  );
  if (res.status !== 0 || !existsSync(dest)) {
    throw new Error(`captura fallida para ${url}\n${res.stdout || ''}${res.stderr || ''}`);
  }
  const bytes = statSync(dest).size;
  if (bytes < MIN_PNG_BYTES) {
    throw new Error(
      `captura VACIA para ${url}: ${bytes} bytes (< ${MIN_PNG_BYTES}). ` +
      'El avatar no se renderizo a tiempo; la captura no es valida.',
    );
  }
  return dest;
}

/** Compara dos capturas con tolerancia de pixel. */
function compare(refPath, candPath, maxDiff) {
  const res = spawnSync(
    'python',
    [COMPARE_SCRIPT, refPath, candPath, '--max-diff', String(maxDiff), '--label', candPath],
    { encoding: 'utf8' },
  );
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
  if (res.status === 0) console.log(out);
  else console.error(out);
  return res.status === 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    console.error('uso: node scripts/capture-visuals.mjs --out <dir> [--compare <refDir>] [--base <url>]');
    return 2;
  }
  if (!existsSync(CAPTURE_SCRIPT) || !existsSync(COMPARE_SCRIPT)) {
    console.error('faltan scripts/capture.py o scripts/compare-visuals.py');
    return 2;
  }

  mkdirSync(args.out, { recursive: true });
  const manifest = {};

  for (const v of VARIANTS) {
    const name = `${v.preset}--${v.state}.png`;
    const dest = join(args.out, name);
    const url = `${args.base}/captures/harness/capture.html?preset=${encodeURIComponent(v.preset)}&state=${encodeURIComponent(v.state)}`;
    shoot(url, dest);
    manifest[name] = sha256(dest);
    console.log(`  capturado ${name}  ${manifest[name].slice(0, 12)}`);
  }

  writeFileSync(join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\ncapturas en ${args.out} (${VARIANTS.length} variantes)`);

  if (!args.compare) {
    console.log('sin --compare: no se evalua deriva.');
    return 0;
  }

  const regressions = [];
  const missing = [];
  for (const v of VARIANTS) {
    const name = `${v.preset}--${v.state}.png`;
    const refPath = join(args.compare, name);
    const candPath = join(args.out, name);
    if (!existsSync(refPath)) {
      missing.push(`${name}: NUEVO (no estaba en la referencia)`);
      continue;
    }
    if (sha256(refPath) === sha256(candPath)) {
      console.log(`  IDENTICA ${name}`);
      continue;
    }
    if (!compare(refPath, candPath, args.maxDiff)) {
      regressions.push(name);
    }
  }
  for (const name of Object.keys(JSON.parse(readFileSync(join(args.compare, 'manifest.json'), 'utf8')))) {
    const candPath = join(args.out, name);
    if (!existsSync(candPath)) missing.push(`${name}: AUSENTE (estaba en la referencia)`);
  }

  if (missing.length) {
    console.error(`\nVARIANTES QUE NO CUADRAN (${missing.length}):`);
    for (const m of missing) console.error(`  ${m}`);
  }
  if (regressions.length === 0 && missing.length === 0) {
    console.log(
      `\nSIN REGRESION: ${VARIANTS.length}/${VARIANTS.length} capturas dentro de ` +
      `tolerancia (${args.maxDiff}% de pixeles distintos).`,
    );
    return 0;
  }
  console.error(`\nREGRESION VISUAL (${regressions.length}):`);
  for (const r of regressions) console.error(`  ${r}`);
  return 1;
}

process.exit(main());
