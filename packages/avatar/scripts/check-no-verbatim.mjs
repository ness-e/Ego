#!/usr/bin/env node
// scripts/check-no-verbatim.mjs — puerta de la decision D4: CERO codigo
// verbatim del upstream en el codigo propio de Ego.
//
// POR QUE EXISTE: la decision D4 del owner (2026-10-21) es que el motor de
// personaje no lleva codigo verbatim de los repos de referencia. El riesgo
// real de esa decision es la **reversion silenciosa**: alguien "optimiza" un
// fichero, pega un trozo del original, o restaura un fichero entero desde el
// clon. Nada lo detectaria: los tests siguen verdes y la cabecera canonica
// sigue siendo correcta.
//
// QUE MIDE: el **residuo verbatim**, con el metodo de la Ola 8 (shingles de
// 48 caracteres sobre el texto normalizado, sin comentarios), comparado contra
// los upstreams VERDADEROS:
//
//   · el corpus `vendor/` del paquete (los originales MIT), y
//   · el single-file HTML del motor canvas (`avatar_studio_cx_artlab_mochi_2_0.html`).
//
// > **Por que NO se mide contra el clon de referencia**
// (`repos-referencia/avatar/`): ese clon es el paquete de Ego de una iteracion
// anterior y MEZCLA codigo propio con ports. Medir contra el responderia a
// "¿queda codigo de la iteracion anterior?", no a "¿queda codigo del
// upstream?" — y un fichero totalmente propio seguiria dando residuo por sus
// funciones propias.
//
// EL PRESUPUESTO vive en `provenance.manifest.json` y esta **en SHINGLES**, no
// en porcentaje: "1 shingle de 48 caracteres" es una coincidencia real, no un
// 100 %.
//
//   · un fichero **nativo** (codigo propio de Ego) tiene presupuesto **0**:
//     no puede conservar NI UN shingle del upstream;
//   · un fichero **derivado** (un port atribuido) tiene como presupuesto su
//     residuo declarado: si le crecen los prestamos, la puerta lo ve.
//
// COBERTURA COMPLETA: se mide **todo** fichero del paquete (src, tests, demo),
// no solo los listados a mano. La lista de ficheros medidos sale del
// manifiesto, que la puerta de atribucion obliga a mantener TOTAL.
//
// Y la espejo vendorizado (`apps/desktop/renderer/floating/vendor/avatar/`) se
// mide con el MISMO presupuesto: si el paquete esta limpio pero la copia no,
// el producto tiene lo mismo.
//
// ADEMAS: una puerta que no mide nada debe FALLAR, no pasar (si el manifiesto
// no trae presupuestos, o no hay ficheros que medir, la puerta dice que no
// esta midiendo y sale con 1).
//
// Uso:
//   node scripts/check-no-verbatim.mjs [--root <dir>] [--json] [--all]
//
//   --root <dir>  raiz del paquete a comprobar (por defecto, el propio).
//   --json        informe machine.
//   --all         incluye en el informe el residuo de los ficheros SIN
//                 presupuesto (informativo).
//
// Salida: 0 = sin residuo fuera de presupuesto; 1 = hay residuo, o la puerta
// no ha podido medir.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { N, MIN_RUN, stripComments, shingleSet, residueOf } from './verbatim-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');
const REFERENCE_CLONE = join(REPO, 'repos-referencia', 'avatar');
const VENDORED = join(REPO, 'apps', 'desktop', 'renderer', 'floating', 'avatar');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const showAll = args.includes('--all');
const rootIdx = args.indexOf('--root');
if (rootIdx >= 0 && !args[rootIdx + 1]) {
  console.error('--root necesita un directorio');
  process.exit(2);
}
const ROOT = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : PKG;

/** El metrico (shingles + rachas contiguas) vive en `verbatim-lib.mjs`. */

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

/* ── referencias: los upstreams verdaderos ─────────────────────────────── */

const references = [];   // { label, set }

function addReference(label, text) {
  if (!text) return;
  const norm = stripComments(text);
  if (norm.length < N) return;
  references.push({ label, set: shingleSet(norm) });
}

// 1) El single-file HTML (origen del motor canvas).
if (existsSync(REFERENCE_CLONE)) {
  addReference(
    'vendor/ego-avatar-studio/avatar_studio_cx_artlab_mochi_2_0.html',
    readIf(join(REFERENCE_CLONE, 'avatar_studio_cx_artlab_mochi_2_0.html')),
  );
} else {
  console.error('  nota: el clon de referencia no esta presente; el HTML no es comparable.');
}

// 2) El corpus de atribucion del paquete (los originales MIT).
for (const f of walk(join(ROOT, 'vendor'))) {
  addReference(`vendor/${f}`, readIf(join(ROOT, 'vendor', f)));
}

/* ── manifiesto: el presupuesto ─────────────────────────────────────────── */

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

/**
 * El presupuesto: por fichero, el numero MAXIMO de shingles del upstream que
 * puede conservar. Viene del manifiesto:
 *   · `native`   → 0 (codigo propio: ni un shingle);
 *   · `derived` → el residuo declarado (su valor en el momento de declararse:
 *     si le crecen los prestamos, la puerta lo ve).
 */
const budgets = new Map();
for (const d of manifest.derived ?? []) {
  const b = d.verbatim?.maxShingles;
  budgets.set(d.path, Number.isFinite(b) ? b : null);
}
for (const n of manifest.native ?? []) {
  const b = n.verbatim?.maxShingles;
  budgets.set(n.path, Number.isFinite(b) ? b : null);
}

if (budgets.size === 0) {
  console.error(
    'el manifiesto no declara ningun presupuesto de residuo: la puerta no mediria nada. ' +
      'Ejecuta `node scripts/measure-verbatim.mjs` para declararlos.',
  );
  process.exit(1);
}

/* ── medicion ───────────────────────────────────────────────────────────── */

/** Los shingles del fichero que coinciden con alguna referencia. */
function matchingShingles(absPath) {
  const text = readIf(absPath);
  if (text === null) return { count: 0, source: null };
  const norm = stripComments(text);
  if (norm.length < N) return { count: 0, source: null };
  const m = residueOf(norm, references);
  return { count: m.count, source: m.source };
}

/** Los ficheros de codigo del paquete (src, tests, demo). */
function codeFiles(root) {
  const out = [];
  for (const sub of ['src', 'tests', 'demo']) {
    for (const f of walk(join(root, sub))) {
      if (/\.(js|mjs|cjs|ts|tsx|html|css)$/.test(f)) out.push(`${sub}/${f}`);
    }
  }
  return out.sort();
}

const problems = [];
const report = [];

const enDisco = codeFiles(ROOT);
let medidos = 0;

for (const file of enDisco) {
  const budget = budgets.get(file);
  if (budget === undefined) {
    problems.push(`fichero SIN clasificar en el manifiesto (sin presupuesto): ${file}`);
    continue;
  }
  const m = matchingShingles(join(ROOT, file));
  medidos++;
  const ok = m.count <= budget;
  report.push({ file, budget, measured: m.count, source: m.source, ok });
  if (!ok) {
    problems.push(
      `residuo verbatim en ${file}: ${m.count} shingles > presupuesto ${budget}` +
        (m.source ? ` (fuente mas cercana: ${m.source})` : ''),
    );
  }
}

// Los ficheros del manifiesto que no existen en disco (solo los de CODIGO:
// el manifiesto tambien clasifica datos, como el golden, que no se miden).
const CODE_FILE = /\.(js|mjs|cjs|ts|tsx|html|css)$/;
for (const file of budgets.keys()) {
  if (!CODE_FILE.test(file)) continue;
  if (!enDisco.includes(file)) {
    problems.push(`el manifiesto declara presupuesto de ${file}, pero ese fichero no existe`);
  }
}

// El espejo vendorizado: mismo presupuesto (el producto tiene lo mismo).
if (ROOT === PKG && existsSync(VENDORED)) {
  for (const file of codeFiles(VENDORED)) {
    const budget = budgets.get(file);
    if (budget === undefined) continue;   // el espejo no lleva tests/demo
    const m = matchingShingles(join(VENDORED, file));
    medidos++;
    const ok = m.count <= budget;
    report.push({ file: `vendorizado:${file}`, budget, measured: m.count, source: m.source, ok });
    if (!ok) {
      problems.push(
        `residuo verbatim en la COPIA VENDORIZADA ${file}: ${m.count} shingles > presupuesto ${budget}`,
      );
    }
  }
}

// Una puerta que no mide nada NO es una puerta.
if (medidos === 0) {
  problems.push('la puerta no ha medido NINGUN fichero: no es una puerta');
}

const resultado = {
  ok: problems.length === 0,
  root: ROOT,
  shingleLength: N,
  references: references.length,
  budgets: budgets.size,
  medidos,
  report,
  problems,
};

if (asJson) {
  console.info(JSON.stringify(resultado, null, 2));
  process.exit(resultado.ok ? 0 : 1);
}

console.info(
  `residuo verbatim: ${references.length} referencias, ${budgets.size} ficheros con presupuesto, ` +
    `${medidos} medidos (shingles de ${N} caracteres, rachas de >= ${MIN_RUN})`,
);
for (const r of report.filter((x) => !x.file.startsWith('vendorizado:'))) {
  const mark = r.ok ? 'ok ' : 'FALLA';
  console.info(
    `  ${mark} ${r.file.padEnd(38)} medido=${String(r.measured).padStart(4)} ` +
      `presupuesto=${String(r.budget).padStart(4)}  ${r.source ?? ''}`,
  );
}
if (resultado.ok) {
  console.info('  SIN RESIDUO VERBATIM fuera de presupuesto.');
  process.exit(0);
}
console.error(`  ${problems.length} PROBLEMA(S):`);
for (const p of problems) console.error(`    ${p}`);
process.exit(1);
