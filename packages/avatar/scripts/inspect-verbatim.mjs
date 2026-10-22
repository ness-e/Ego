#!/usr/bin/env node
// scripts/inspect-verbatim.mjs — QUE shingles comparte un fichero con el
// upstream (y con cual de las referencias).
//
// Es la lupa de la puerta `check-no-verbatim.mjs`: la puerta dice CUANTOS
// shingles sobran; esta dice cuales son (y en que racha), para que el arreglo
// sea surgical.
//
// Uso:
//   node scripts/inspect-verbatim.mjs src/render/body.js
//   node scripts/inspect-verbatim.mjs src/render/body.js --limit 20
//   node scripts/inspect-verbatim.mjs --all            (el mapa completo)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MIN_RUN, stripComments, shingleList, shingleSet, residueOf } from './verbatim-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');
const CLONE = join(REPO, 'repos-referencia', 'avatar');

function readIf(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function walk(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split('\\').join('/'));
  }
  return out;
}

const refs = [];
function addRef(label, text) {
  if (!text) return;
  const norm = stripComments(text);
  if (norm.length < 48) return;
  refs.push({ label, set: shingleSet(norm) });
}
if (existsSync(CLONE)) {
  addRef('HTML/mochi', readIf(join(CLONE, 'avatar_studio_cx_artlab_mochi_2_0.html')));
}
for (const f of walk(join(PKG, 'vendor'))) addRef(`vendor/${f}`, readIf(join(PKG, 'vendor', f)));

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 12;
const all = args.includes('--all');

function inspect(rel) {
  const text = readIf(join(PKG, rel));
  if (text === null) {
    console.error(`  no existe: ${rel}`);
    return;
  }
  const norm = stripComments(text);
  const m = residueOf(norm, refs);
  console.info(`\n${rel}`);
  console.info(`  shingles: ${shingleList(norm).length} · coincidentes (en rachas de >= ${MIN_RUN}): ${m.count}`);
  let n = 0;
  for (const run of m.runs) {
    if (n++ >= limit) break;
    console.info(`   [${m.source}] ${JSON.stringify(run.text.slice(0, 200))}`);
  }
  if (m.runs.length > limit) console.info(`   ... (+${m.runs.length - limit} mas)`);
}

if (all) {
  console.info('=== mapa de residuo por fichero (shingles en rachas) ===');
  const files = [];
  for (const sub of ['src', 'tests', 'demo']) {
    for (const f of walk(join(PKG, sub))) {
      if (/\.(js|mjs|cjs|ts|tsx|html|css)$/.test(f)) files.push(`${sub}/${f}`);
    }
  }
  const rows = [];
  for (const f of files.sort()) {
    const norm = stripComments(readIf(join(PKG, f)));
    rows.push({ f, max: residueOf(norm, refs).count });
  }
  rows.sort((a, b) => b.max - a.max);
  for (const r of rows) console.info(`  ${String(r.max).padStart(5)}  ${r.f}`);
} else {
  const targets = args.filter((a, i) => !a.startsWith('--') && i !== limitIdx + 1);
  for (const rel of targets) inspect(rel);
}
