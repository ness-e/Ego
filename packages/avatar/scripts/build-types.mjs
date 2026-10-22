#!/usr/bin/env node
// scripts/build-types.mjs - completa la declaracion publica del paquete.
//
// PROBLEMA QUE RESUELVE: `index.d.ts` estaba escrito a mano y se quedo
// desfasado del barrel real (`src/index.js`): faltaban 82 de las 170
// exportaciones (y el estado `warning`). Una declaracion publica incompleta
// es peor que ninguna: promete una superficie que no existe.
//
// QUE HACE:
//   1. genera los `.d.ts` de cada modulo con `tsc --emitDeclarationOnly`
//      (los tipos salen del JSDoc del propio codigo: no se inventan);
//   2. compara el barrel real con lo declarado en `index.d.ts`;
//   3. anade en un bloque marcado las declaraciones que falten;
//   4. es IDEMPOTENTE: si ya estan, no toca nada.
//
// NO muta las declaraciones que ya existen: si el autor escribio una firma
// mejor que la inferida, se respeta. Lo que hace es **anadir** lo que falta.
//
// El parseo de los `.d.ts` usa el COMPILADOR de TypeScript (no un parser a
// mano): un JSDoc con una llave suelta desbalanceaba el conteo y se perdian
// declaraciones.
//
// Uso: node scripts/build-types.mjs [--check] [--json]
//   --check  solo informa (exit 1 si falta algo); no escribe.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const asJson = process.argv.includes('--json');
const check = process.argv.includes('--check');

/** Empieza el bloque generado (marcador de idempotencia). */
const MARK = '// ── Declaraciones completadas por scripts/build-types.mjs ──';
const MARK_END = '// ── fin del bloque generado ──';

/* ── 1. generar los .d.ts de cada modulo ────────────────────────────────── */

const tmp = mkdtempSync(join(tmpdir(), 'avatar-types-'));
execFileSync(
  'npx',
  [
    'tsc', 'src/index.js',
    '--allowJs', '--checkJs', 'false',
    '--declaration', '--emitDeclarationOnly',
    '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler',
    '--lib', 'ES2022,DOM,DOM.Iterable',
    '--outDir', tmp,
  ],
  { cwd: PKG, stdio: 'ignore', shell: process.platform === 'win32' },
);

/* ── 2. el mapa del barrel y lo declarado ──────────────────────────────── */

const barrelSrc = readFileSync(join(PKG, 'src', 'index.js'), 'utf8');
/** nombre -> modulo de origen */
const barrelMap = new Map();
for (const m of barrelSrc.matchAll(/export\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop()?.trim();
    if (name) barrelMap.set(name, m[2]);
  }
}

const dtsPath = join(PKG, 'index.d.ts');
let dts = readFileSync(dtsPath, 'utf8');
/** El .d.ts tal como esta, con su bloque gestionado incluido. */
const dtsCompleto = dts;

// El bloque gestionado se retira ANTES de medir: si no, sus propias
// declaraciones cuentan como "ya declaradas" y el bloque se vacia en la
// siguiente ejecucion.
{
  const ini = dts.indexOf(MARK);
  const fin = dts.indexOf(MARK_END);
  if (ini >= 0 && fin > ini) dts = dts.slice(0, ini) + dts.slice(fin + MARK_END.length);
}

/** Los nombres declarados (valores y tipos). */
function declaredNames(text) {
  const out = new Set();
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (n) out.add(n);
    }
  }
  for (const m of text.matchAll(/^\s*export\s+(?:async\s+)?(?:declare\s+)?(?:function|const|class|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
    out.add(m[1]);
  }
  return out;
}

// En modo --check se compara el .d.ts COMPLETO (con su bloque
// gestionado): si no, el bloque generado se contaria como "ya declarado" y
// la comprobacion nuncacouldria estar en verde.
const yaDeclarados = declaredNames(check ? dtsCompleto : dts);
const faltan = [...barrelMap.keys()].filter((k) => !yaDeclarados.has(k)).sort();

/* ── 3. extraer las declaraciones que faltan (con el parser de TypeScript) ── */

let ts;
try {
  ts = require('typescript');
} catch {
  console.error('no se encuentra `typescript` (lo necesita el parser de .d.ts)');
  rmSync(tmp, { recursive: true, force: true });
  process.exit(2);
}

/** Las declaraciones de un .d.ts, indexadas por el nombre que exportan. */
function blocksOf(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Map();
  for (const st of sf.statements) {
    let names = [];
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.push(d.name.text);
      }
    } else if (
      ts.isFunctionDeclaration(st) ||
      ts.isClassDeclaration(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isEnumDeclaration(st)
    ) {
      if (st.name && ts.isIdentifier(st.name)) names.push(st.name.text);
    }
    for (const n of names) {
      if (!out.has(n)) out.set(n, { block: st.getText(sf), kind: ts.SyntaxKind[st.kind] });
    }
  }
  return out;
}

/** Tipos de TypeScript que no son declaraciones del paquete. */
const CONTINUAS = new Set([
  'Readonly', 'Record', 'Array', 'Promise', 'Function', 'Object', 'String', 'Number', 'Boolean',
  'Partial', 'Omit', 'Pick', 'Required', 'ReturnType', 'Parameters', 'InstanceType', 'HTMLElement',
  'AudioContext', 'CanvasRenderingContext2D', 'OscillatorType', 'CanvasGradient', 'CanvasLineCap',
  'typeof', 'globalThis', 'Uint8Array', 'ArrayBuffer', 'Float32Array', 'Int16Array', 'Set', 'Map',
]);

const modCache = new Map();
function modBlocks(rel) {
  if (modCache.has(rel)) return modCache.get(rel);
  // El .d.ts generado puede no existir si el paquete ya trae uno escrito a mano.
  // Se PREFIERE el .d.ts escrito a mano en el paquete (es la verdad del autor)
  // sobre el generado: si el paquete trae uno, el generado es un stub.
  const file = [join(PKG, 'src', `${rel}.d.ts`), join(tmp, `${rel}.d.ts`)].find((f) => existsSync(f));
  const blocks = file ? blocksOf(file) : new Map();
  modCache.set(rel, blocks);
  return blocks;
}

const nuevos = [];
const sinBloque = [];
for (const name of faltan) {
  const mod = barrelMap.get(name);
  const rel = mod.replace(/^\.\//, '').replace(/\.js$/, '');
  const block = modBlocks(rel).get(name);
  if (!block) { sinBloque.push(`${name} (${mod})`); continue; }
  nuevos.push({ name, mod, block: block.block });
}

/* ── 4. escribir (o solo informar) ──────────────────────────────────────── */

const resultado = {
  ok: faltan.length === 0 && sinBloque.length === 0,
  exportado: barrelMap.size,
  declarados: yaDeclarados.size,
  faltan: faltan.length,
  anadidos: nuevos.length,
  sinBloque,
  escrito: false,
};

if (faltan.length === 0) {
  rmSync(tmp, { recursive: true, force: true });
  if (asJson) { console.log(JSON.stringify(resultado, null, 2)); process.exit(0); }
  console.log(`  index.d.ts: superficie completa (${barrelMap.size} exportaciones declaradas)`);
  process.exit(0);
}

if (check) {
  rmSync(tmp, { recursive: true, force: true });
  if (asJson) { console.log(JSON.stringify(resultado, null, 2)); process.exit(resultado.ok ? 0 : 1); }
  console.error(`  index.d.ts: faltan ${faltan.length} declaraciones${sinBloque.length ? ` (${sinBloque.length} sin bloque: ${sinBloque.join(', ')})` : ''}`);
  process.exit(1);
}

// Los tipos que las declaraciones nuevas REFERENCIAN (p. ej. `EyeBobCfg`) y
// que el .d.ts no declara: tambien hay que llevarlos, o el fichero no compila.
const yaEnElBloque = new Set(nuevos.map((n) => n.name));
const tiposReferenciados = new Set();
for (const n of nuevos) {
  for (const t of n.block.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
    const name = t[1];
    if (CONTINUAS.has(name)) continue;
    if (/^[A-Z0-9_]+$/.test(name)) continue;   // constantes en MAYUSCULAS
    if (yaDeclarados.has(name) || yaEnElBloque.has(name) || tiposReferenciados.has(name)) continue;
    tiposReferenciados.add(name);
  }
}
for (const name of tiposReferenciados) {
  let found = null;
  for (const [rel, blocks] of modCache) {
    if (blocks.has(name)) { found = { rel, block: blocks.get(name).block }; break; }
  }
  if (!found) {
    console.error(`  aviso: el tipo ${name} se usa pero no se encuentra en ningun modulo`);
    continue;
  }
  nuevos.push({ name, mod: `./${found.rel}.js`, block: found.block });
  yaEnElBloque.add(name);
}

const porModulo = new Map();
for (const n of nuevos) {
  if (!porModulo.has(n.mod)) porModulo.set(n.mod, []);
  porModulo.get(n.mod).push(n);
}

const bloque = [
  MARK,
  '// (las declaraciones que faltaban del barrel real; el test',
  '//  `tests/public-surface.test.js` falla si esto y el barrel divergen)',
  '',
];
for (const [mod, list] of porModulo) {
  bloque.push(`// ---- ${mod} ----`);
  for (const n of list) bloque.push(n.block);
  bloque.push('');
}
bloque.push(MARK_END);

dts = dts.replace(/\s*$/, '\n') + '\n' + bloque.join('\n');
writeFileSync(dtsPath, dts, 'utf8');
resultado.escrito = true;
rmSync(tmp, { recursive: true, force: true });

if (asJson) { console.log(JSON.stringify(resultado, null, 2)); process.exit(0); }
console.log(`  index.d.ts: ${nuevos.length} declaraciones anadidas (${sinBloque.length} sin bloque)`);
if (sinBloque.length) console.log(`  SIN BLOQUE: ${sinBloque.join(', ')}`);
