#!/usr/bin/env node
// scripts/check-no-verbatim.mjs — puerta de "no hay codigo verbatim del upstream".
//
// Por que existe: la decision D4 del owner (2026-10-19, ejecutada el 2026-10-21)
// es que **el motor de personaje de Ego no lleva codigo verbatim de los repos de
// referencia**: donde el port existia, se escribe geometria (o tablas, o
// sintesis) propia. La atribucion (plano 1) dice DE QUIEN es el codigo; esta
// puerta dice SI LO ES.
//
// El riesgo real es la **reversion silenciosa**: alguien "optimiza" un fichero
// y vuelve a pegar un trozo del original, o restaura un fichero entero desde el
// clon. Nada lo detectaria: los tests siguen verdes, la cabecera canonica
// sigue siendo correcta (el fichero sigue siendo derivado... o deja de serlo).
//
// Esta puerta mide el **residuo verbatim** con el mismo metodo de la Ola 8:
// shingles de 48 caracteres sobre el texto normalizado (sin comentarios,
// espacios colapsados). El residuo es la fraccion del fichero que sigue
// siendo texto del upstream, tomada como el MAXIMO sobre todas las fuentes
// de referencia:
//
//   - el clon de referencia `repos-referencia/avatar/src/**` (el port);
//   - el single-file `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html`;
//   - el corpus `vendor/**` del paquete (los originales MIT).
//
// El presupuesto vive en `provenance.manifest.json` (campo `verbatim`): por
// fichero, el residuo maximo admisible y por que. Un fichero con presupuesto
// 0 no puede conservar ni 48 caracteres del upstream.
//
// Uso:
//   node scripts/check-no-verbatim.mjs [--root <dir>] [--json] [--all]
//
//   --root <dir>  raiz del paquete a comprobar (por defecto, el propio). Es lo
//                 que permite ejercitar la puerta con fixtures.
//   --json        informe machine.
//   --all         incluye en el informe el residuo de TODOS los ficheros
//                 (no solo los que tienen presupuesto), para ver el mapa.
//
// Salida: 0 = sin residuo fuera de presupuesto; 1 = hay residuo; 2 = error de uso.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');
const REFERENCE_CLONE = join(REPO, 'repos-referencia', 'avatar');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const showAll = args.includes('--all');
const rootIdx = args.indexOf('--root');
if (rootIdx >= 0 && !args[rootIdx + 1]) {
  console.error('--root necesita un directorio');
  process.exit(2);
}
const ROOT = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : PKG;

/** Longitud del shingle (48 caracteres): el metodo de la Ola 8. */
const N = 48;

/** Normaliza: quita comentarios y colapsa espacios (el codigo, no la prosa). */
export function stripComments(text) {
  let out = '';
  let inBlock = false;
  let inStr = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; out += ' '; continue; }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\') { out += n ?? ''; i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; out += ' '; continue; }
    if (c === '/' && n === '/') {
      const prev = out[out.length - 1];
      if (prev !== ':') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    }
    out += c;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Conjunto de shingles de un texto normalizado. */
function shingles(normalized) {
  const set = new Set();
  for (let i = 0; i + N <= normalized.length; i++) set.add(normalized.slice(i, i + N));
  return set;
}

/** Fraccion de los shingles de `norm` que aparecen en `set`. */
function residue(norm, set) {
  const sh = shingles(norm);
  if (!sh.size) return 0;
  let hit = 0;
  for (const x of sh) if (set.has(x)) hit++;
  return hit / sh.size;
}

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

/* ── fuentes de referencia ───────────────────────────────────────────────── */

/**
 * Las referencias son los **upstreams verdaderos**, NO el clon de referencia.
 *
 * El clon `repos-referencia/avatar/` es el paquete de Ego de una iteracion
 * anterior: mezcla codigo PROPIO de Ego con ports de los upstreams. Medir
 * contra el clon no responderia a la pregunta de D4 ("¿queda codigo del
 * upstream?"), sino a otra ("¿queda codigo de la iteracion anterior?").
 * Por eso el clon NO es referencia: si lo fuera, un fichero con codigo
 * totalmente propio (p. ej. `runtime/poses.js` tras la sustitucion) seguira
 * dando residuo por sus funciones propias.
 *
 * Las referencias son, entonces:
 *   1. el corpus `vendor/**` del paquete (los originales MIT, byte a byte);
 *   2. el single-file `avatar_studio_cx_artlab_mochi_2_0.html` (origen del
 *      motor canvas), si el clon de referencia esta presente.
 */
const references = [];   // { label, set }

function addReference(label, text) {
  if (!text) return;
  const norm = stripComments(text);
  if (norm.length < N) return;
  references.push({ label, set: shingles(norm) });
}

// 1) El single-file HTML (origen del motor canvas).
if (existsSync(REFERENCE_CLONE)) {
  const html = readIf(join(REFERENCE_CLONE, 'avatar_studio_cx_artlab_mochi_2_0.html'));
  if (html) addReference('vendor/ego-avatar-studio/avatar_studio_cx_artlab_mochi_2_0.html', html);
} else {
  console.error('  nota: el clon de referencia no esta presente; solo se mide contra el corpus vendor/.');
}

// 2) El corpus de atribucion del paquete (los originales MIT).
for (const f of walk(join(ROOT, 'vendor'))) {
  const t = readIf(join(ROOT, 'vendor', f));
  if (t) addReference(`vendor/${f}`, t);
}

/* ── manifiesto: el presupuesto ──────────────────────────────────────────── */

const manifestPath = join(ROOT, 'provenance.manifest.json');
if (!existsSync(manifestPath)) {
  console.error('no existe provenance.manifest.json (el presupuesto vive ahi)');
  process.exit(2);
}
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`provenance.manifest.json no parsea: ${e.message}`);
  process.exit(2);
}
const budgets = manifest.verbatim ?? {};

/* ── medicion ────────────────────────────────────────────────────────────── */

/** Residuo maximo de un fichero contra todas las referencias. */
function measure(absPath) {
  const text = readIf(absPath);
  if (text === null) return { residue: 0, source: null };
  const norm = stripComments(text);
  let best = { residue: 0, source: null };
  for (const r of references) {
    const v = residue(norm, r.set);
    if (v > best.residue) best = { residue: v, source: r.label };
  }
  return best;
}

const problems = [];
const report = [];

// (a) Los ficheros con presupuesto: el contrato de D4.
for (const [file, budget] of Object.entries(budgets)) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) {
    problems.push(`presupuesto de ${file}: el fichero no existe`);
    report.push({ file, budget: budget.maxResidue ?? 0, measured: null, source: null, ok: false });
    continue;
  }
  const m = measure(abs);
  const max = budget.maxResidue ?? 0;
  const ok = m.residue <= max;
  report.push({ file, budget: max, measured: Number(m.residue.toFixed(4)), source: m.source, ok });
  if (!ok) {
    problems.push(
      `residuo verbatim en ${file}: ${(m.residue * 100).toFixed(1)}% > presupuesto ${(max * 100).toFixed(1)}% ` +
        `(fuente mas cercana: ${m.source})`,
    );
  }
}

// (b) Informacion: el residuo de todos los ficheros (para ver el mapa).
if (showAll) {
  const all = [];
  for (const sub of ['src', 'tests', 'demo']) {
    for (const f of walk(join(ROOT, sub))) {
      if (!/\.(js|mjs|cjs|ts|tsx|html|css)$/.test(f)) continue;
      const rel = `${sub}/${f}`;
      const m = measure(join(ROOT, sub, f));
      all.push({ file: rel, measured: Number(m.residue.toFixed(4)), source: m.source });
    }
  }
  all.sort((a, b) => b.measured - a.measured);
  report.push(...all.map((x) => ({ ...x, informational: true })));
}

const result = {
  ok: problems.length === 0,
  root: ROOT,
  shingleLength: N,
  references: references.length,
  budgets: Object.keys(budgets).length,
  report,
  problems,
};

if (asJson) {
  console.info(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

console.info(
  `residuo verbatim: ${references.length} referencias, ${Object.keys(budgets).length} ficheros con presupuesto ` +
    `(shingles de ${N} caracteres)`,
);
for (const r of report.filter((x) => !x.informational)) {
  const mark = r.ok ? 'ok ' : 'FALLA';
  console.info(
    `  ${mark} ${r.file.padEnd(38)} medido=${String((r.measured * 100).toFixed(1) + '%').padStart(6)} ` +
      `presupuesto=${String((r.budget * 100).toFixed(1) + '%').padStart(5)}  ${r.source ?? ''}`,
  );
}
if (showAll) {
  console.info('  --- mapa completo (informativo) ---');
  for (const r of report.filter((x) => x.informational).slice(0, 25)) {
    console.info(`       ${String((r.measured * 100).toFixed(1) + '%').padStart(6)}  ${r.file.padEnd(38)} ${r.source ?? ''}`);
  }
}
if (result.ok) {
  console.info('  SIN RESIDUO VERBATIM fuera de presupuesto.');
  process.exit(0);
}
console.error(`  ${problems.length} PROBLEMA(S):`);
for (const p of problems) console.error(`    ${p}`);
process.exit(1);
