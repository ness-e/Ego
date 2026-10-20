#!/usr/bin/env node
// scripts/build.mjs — build real del paquete @ego/avatar.
//
// Por qué este script y no un bundler: el paquete es ESM plano y sin
// dependencias, y su consumidor (el renderer de Electron) lo carga por
// import literal. Un bundle reescribiría las rutas y rompería el contrato de
// `import("./vendor/avatar/runtime/avatar-element.js")` del flotante.
//
// Qué hace, en cambio:
//   1. limpia `dist/`
//   2. copia `src/**` (js + d.ts) a `dist/` con la MISMA estructura
//   3. copia `index.d.ts` a `dist/index.d.ts`
//   4. escribe `dist/build-manifest.json` con el SHA-256 de cada fichero
//
// El manifiesto hace el build VERIFICABLE: dos builds del mismo árbol dan el
// mismo manifiesto, y cualquier cambio de contenido se ve en el diff.
//
// Uso: node scripts/build.mjs [--check]
//   --check  no escribe; solo verifica que `dist/` está al día (exit 1 si no).

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const SRC = join(PKG, 'src');
const DIST = join(PKG, 'dist');
const MANIFEST = 'build-manifest.json';

const checkOnly = process.argv.includes('--check');

/** Ficheros a copiar de `src/`, en orden estable. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split('\\').join('/'));
  }
  return out.sort();
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Huella del contenido de build (relpath -> sha256), sin el propio manifiesto. */
function fingerprint() {
  const files = walk(DIST).filter((f) => f !== MANIFEST);
  const out = {};
  for (const f of files) out[f] = sha256(join(DIST, f));
  return out;
}

function build() {
  if (!existsSync(SRC)) {
    console.error(`no existe el arbol de fuentes: ${SRC}`);
    return 2;
  }
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const files = walk(SRC);
  for (const f of files) {
    const dest = join(DIST, f);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(SRC, f), dest);
  }
  // La declaracion publica del paquete viaja con el build.
  cpSync(join(PKG, 'index.d.ts'), join(DIST, 'index.d.ts'));

  const fp = fingerprint();
  writeFileSync(join(DIST, MANIFEST), JSON.stringify(fp, null, 2) + '\n');
  console.log(`build: ${files.length + 1} ficheros -> dist/`);
  return 0;
}

function check() {
  if (!existsSync(DIST)) {
    console.error('dist/ no existe: ejecuta el build.');
    return 1;
  }
  const current = fingerprint();
  const expected = {};
  for (const f of walk(SRC)) expected[f] = sha256(join(SRC, f));
  expected['index.d.ts'] = sha256(join(PKG, 'index.d.ts'));

  const drift = [];
  for (const f of Object.keys(expected)) {
    if (!(f in current)) drift.push(`FALTA  ${f}`);
    else if (current[f] !== expected[f]) drift.push(`DIFIERE ${f}`);
  }
  for (const f of Object.keys(current)) {
    if (!(f in expected)) drift.push(`SOBRA  ${f}`);
  }
  if (drift.length === 0) {
    console.log(`build: dist/ al dia (${Object.keys(expected).length} ficheros).`);
    return 0;
  }
  console.error('build: dist/ desfasado:');
  for (const d of drift) console.error(`  ${d}`);
  return 1;
}

if (checkOnly) {
  process.exit(check());
}

// El build es idempotente: si `dist/` ya estaba al día, se regenera igual.
const code = build();
if (code !== 0) process.exit(code);
process.exit(check());
