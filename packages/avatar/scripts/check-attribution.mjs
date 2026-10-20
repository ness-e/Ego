#!/usr/bin/env node
// scripts/check-attribution.mjs — comprueba que la cadena de atribucion MIT
// es RESOLUBLE dentro del repositorio.
//
// El problema que resuelve: `repos-referencia/` esta en `.gitignore`, asi que
// las rutas que citan `LICENSE.md` y las cabeceras de `src/` apuntan a ficheros
// que un auditor que clone el repo NO tiene. La clausula MIT exige que el
// aviso de copyright sea resoluble.
//
// Que comprueba:
//   1. Que existen LICENSE, LICENSE.md y NOTICE en la raiz del paquete.
//   2. Que TODA ruta con forma `vendor/...` citada en LICENSE.md existe en
//      `vendor/` (las familias agent-robot-avatar, coucou/*, coucou-swift).
//   3. Que TODA ruta con forma `vendor/...` citada en las cabeceras de `src/`
//      existe en `vendor/`.
//   4. Que el corpus no se importa desde `src/` (0 imports).
//   5. Que la copia vendorizada lleva su `vendor/` y coincide por SHA-256.
//
// Uso: node scripts/check-attribution.mjs [--json]
// Salida: 0 = cadena resoluble; 1 = hay referencias colgando; 2 = error de uso.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');
const VENDORED = join(REPO, 'apps', 'desktop', 'renderer', 'floating', 'vendor', 'avatar');

const asJson = process.argv.includes('--json');

/** Ficheros que el paquete debe llevar en la raiz. */
const REQUIRED = ['LICENSE', 'LICENSE.md', 'NOTICE'];

/** Regex de una ruta de corpus: `vendor/<subtree>/<file>` con extension tipica. */
const VENDOR_PATH = /vendor\/[A-Za-z0-9_\-./]+?\.(?:js|ts|swift)/g;

/**
 * Las rutas de `LICENSE.md` no son ficheros sueltos sino familias:
 * `vendor/agent-robot-avatar/*.js`, `vendor/coucou/core/{anim,bridge}.ts`...
 * Este patron captura el token completo (con `*` y `{}`) para poder expandirlo.
 */
const VENDOR_FAMILY = /vendor\/[A-Za-z0-9_\-./{},*]+/g;

function walk(dir, filter) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, filter));
    else if (!filter || filter(full)) out.push(full);
  }
  return out;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Extrae las rutas de corpus citadas en un texto. */
function extract(text) {
  const found = new Set();
  for (const m of text.matchAll(VENDOR_PATH)) found.add(m[0]);
  return [...found];
}

/**
 * Expande una familia con llaves: `{a,b}` -> `a`, `b` (recursivo).
 */
function expandBraces(pattern) {
  const m = pattern.match(/\{([^{}]*)\}/);
  if (!m) return [pattern];
  const [full, inner] = m;
  const out = [];
  for (const alt of inner.split(',')) {
    for (const p of expandBraces(pattern.replace(full, alt))) out.push(p);
  }
  return out;
}

/**
 * Resuelve una familia de rutas a ficheros reales.
 * `vendor/agent-robot-avatar/*.js` -> los 16 ficheros que existen.
 * @returns {{pattern: string, files: string[], missing: string[]}}
 */
function resolveFamily(family) {
  const patterns = expandBraces(family);
  const files = [];
  const missing = [];
  for (const pat of patterns) {
    const abs = join(PKG, pat);
    if (pat.includes('*')) {
      const dir = dirname(abs);
      const base = relative(dir, abs);
      const rx = new RegExp('^' + base.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      const found = walk(dir).filter((f) => rx.test(relative(dir, f).split('\\').join('/')));
      if (found.length === 0) missing.push(pat);
      else files.push(...found);
    } else if (existsSync(abs) && statSync(abs).isFile()) {
      files.push(abs);
    } else {
      missing.push(pat);
    }
  }
  return { pattern: family, files, missing };
}

const problems = [];
const checked = [];

// 1) Ficheros legales obligatorios en la raiz del paquete.
for (const f of REQUIRED) {
  const p = join(PKG, f);
  if (!existsSync(p)) problems.push(`falta ${f} en la raiz del paquete`);
  else checked.push(f);
}

// 2) Familias de rutas citadas en LICENSE.md -> deben expandir a ficheros reales.
const licensePath = join(PKG, 'LICENSE.md');
let licenseFamilies = [];
let licenseFiles = 0;
if (!existsSync(licensePath)) {
  problems.push('no existe LICENSE.md');
} else {
  const text = readFileSync(licensePath, 'utf8');
  const families = new Set();
  for (const m of text.matchAll(VENDOR_FAMILY)) families.add(m[0]);
  licenseFamilies = [...families];
  for (const fam of licenseFamilies) {
    const r = resolveFamily(fam);
    licenseFiles += r.files.length;
    if (r.missing.length) {
      problems.push(`LICENSE.md cita ${fam} y no expande a ficheros reales: ${r.missing.join(', ')}`);
    }
    for (const f of r.files) checked.push(relative(PKG, f));
  }
}

// 3) Rutas citadas en las cabeceras de src/.
const srcRoutes = new Map();
for (const file of walk(join(PKG, 'src'), (f) => f.endsWith('.js'))) {
  for (const r of extract(readFileSync(file, 'utf8'))) {
    const p = join(PKG, r);
    srcRoutes.set(r, existsSync(p));
    if (!existsSync(p)) problems.push(`cabecera cita ${r} (${relative(PKG, file)}) y NO existe`);
    else checked.push(r);
  }
}

// 4) El corpus no se importa desde src/.
const imports = [];
for (const file of walk(join(PKG, 'src'), (f) => f.endsWith('.js'))) {
  const text = readFileSync(file, 'utf8');
  const m = text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g);
  for (const x of m) {
    if (x[1].includes('vendor/')) imports.push(`${relative(PKG, file)} -> ${x[1]}`);
  }
}
if (imports.length) {
  for (const i of imports) problems.push(`src/ importa el corpus de atribucion: ${i}`);
}

// 5) La copia vendorizada lleva su corpus y coincide.
let corpusFiles = 0;
let corpusMismatch = 0;
const corpusDir = join(PKG, 'vendor');
if (!existsSync(corpusDir)) {
  problems.push('no existe el corpus packages/avatar/vendor/');
} else {
  const files = walk(corpusDir);
  corpusFiles = files.length;
  for (const f of files) {
    const rel = relative(corpusDir, f);
    const vendoredFile = join(VENDORED, 'vendor', rel);
    if (!existsSync(vendoredFile)) {
      problems.push(`la copia vendorizada no lleva vendor/${rel}`);
      corpusMismatch++;
      continue;
    }
    if (sha256(f) !== sha256(vendoredFile)) {
      problems.push(`vendor/${rel} difiere entre el paquete y la copia vendorizada`);
      corpusMismatch++;
    }
  }
  for (const f of REQUIRED) {
    if (!existsSync(join(VENDORED, f))) problems.push(`la copia vendorizada no lleva ${f}`);
  }
}

const result = {
  ok: problems.length === 0,
  requiredFiles: REQUIRED.length,
  licenseFamilies: licenseFamilies.length,
  licenseFiles,
  sourceRoutes: srcRoutes.size,
  corpusFiles,
  corpusMismatch,
  checked: checked.length,
  problems,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

console.log(
  `atribucion: ${result.requiredFiles} ficheros legales, ` +
  `${result.licenseFamilies} familias en LICENSE.md -> ${licenseFiles} ficheros, ` +
  `${result.sourceRoutes} rutas en cabeceras, ${corpusFiles} ficheros de corpus`,
);
if (result.ok) {
  console.log('  CADENA MIT RESOLUBLE: toda ruta citada existe en el repositorio.');
  process.exit(0);
}
console.error(`  ${problems.length} PROBLEMA(S):`);
for (const p of problems) console.error(`    ${p}`);
process.exit(1);
