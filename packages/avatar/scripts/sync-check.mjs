#!/usr/bin/env node
// scripts/sync-check.mjs — puerta de divergencia entre las copias del motor.
//
// Hay TRES copias del motor de avatar (decision del owner, 2026-10-19 — D5):
//
//   1. `repos-referencia/avatar/src`        upstream de referencia (NO tocar)
//   2. `packages/avatar/src`                el paquete `@ego/avatar` (CANONICO)
//   3. `apps/desktop/renderer/floating/vendor/avatar/`   copia vendorizada
//
// La copia 3 es la que el renderer carga de verdad (import literal), y la 2 es
// la que se empaqueta y documenta. Sin un mecanismo de verificacion, cualquier
// correccion aplicada a una se pierde silenciosamente en la otra: ese es el
// riesgo real de mantener las tres.
//
// Este script compara por SHA-256:
//
//   - paquete  vs vendorizada   -> si divergen, FALLA (es un gate)
//   - paquete  vs upstream       -> se INFORMA (el fork es esperado y esta
//                                    documentado en README/DESIGN)
//
// Uso:
//   node scripts/sync-check.mjs            verifica (exit 1 si hay drift)
//   node scripts/sync-check.mjs --write    copia paquete -> vendorizada
//   node scripts/sync-check.mjs --json     salida en JSON (para CI)

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');

const CANON = join(PKG, 'src');
const VENDOR = join(REPO, 'apps', 'desktop', 'renderer', 'floating', 'vendor', 'avatar');
const UPSTREAM = join(REPO, 'repos-referencia', 'avatar', 'src');

const write = process.argv.includes('--write');
const asJson = process.argv.includes('--json');

/** Ficheros relativos de un arbol (rutas con '/'). */
function walk(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
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

/** Mapa relpath -> sha256 de un arbol. */
function fingerprint(dir) {
  const out = {};
  for (const rel of walk(dir)) out[rel] = sha256(join(dir, rel));
  return out;
}

/**
 * Ficheros legales que acompañan a la copia vendorizada en su raiz. No son
 * parte de `src/`, pero DEBEN ser identicos a los del paquete: si divergen,
 * una copia lleva la licencia y la otra no (el incumplimiento que D5 cierra).
 */
const SIDECAR = ['LICENSE', 'LICENSE.md', 'NOTICE'];

/**
 * Subarboles que se comparan aparte del codigo: no son codigo de runtime,
 * pero forman parte del contrato legal y deben ser identicos en las dos
 * copias. `vendor/` es el corpus de atribucion (solo lectura).
 */
const SUBTREES = ['vendor'];

/** Compara dos mapas y devuelve las diferencias. */
function diff(a, b) {
  const missing = [];
  const differing = [];
  const extra = [];
  for (const f of Object.keys(a)) {
    if (!(f in b)) missing.push(f);
    else if (a[f] !== b[f]) differing.push(f);
  }
  for (const f of Object.keys(b)) {
    if (!(f in a)) extra.push(f);
  }
  return { missing, differing, extra };
}

function describe(label, d) {
  const lines = [];
  for (const f of d.missing) lines.push(`  ${label}: FALTA     ${f}`);
  for (const f of d.differing) lines.push(`  ${label}: DIFIERE   ${f}`);
  for (const f of d.extra) lines.push(`  ${label}: SOBRA     ${f}`);
  return lines;
}

if (write) {
  if (!existsSync(CANON)) {
    console.error(`no existe el arbol canonico: ${CANON}`);
    process.exit(2);
  }
  // Reemplazo limpio: la vendorizada debe ser una copia EXACTA del paquete.
  rmSync(VENDOR, { recursive: true, force: true });
  mkdirSync(VENDOR, { recursive: true });
  for (const rel of walk(CANON)) {
    const dest = join(VENDOR, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(CANON, rel), dest);
  }
  // Los ficheros legales viajan con la copia vendorizada.
  for (const legal of SIDECAR) {
    const src = join(PKG, legal);
    if (existsSync(src)) cpSync(src, join(VENDOR, legal));
  }
  // Y el corpus de atribucion (subarboles, no codigo de runtime).
  for (const sub of SUBTREES) {
    const src = join(PKG, sub);
    if (!existsSync(src)) continue;
    for (const rel of walk(src)) {
      const dest = join(VENDOR, sub, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(src, rel), dest);
    }
  }
  console.log(`sync: ${walk(CANON).length} ficheros copiados a ${relative(REPO, VENDOR)}`);
  process.exit(0);
}

if (!existsSync(CANON)) {
  console.error(`no existe el arbol canonico: ${CANON}`);
  process.exit(2);
}
if (!existsSync(VENDOR)) {
  console.error(`no existe la copia vendorizada: ${VENDOR}`);
  process.exit(1);
}

const canon = fingerprint(CANON);
const vendorAll = fingerprint(VENDOR);
/** Un fichero del arbol de codigo: ni sidecar ni dentro de un subarbol. */
const isCodeFile = (f) => !SIDECAR.includes(f) && !SUBTREES.some((s) => f === s || f.startsWith(`${s}/`));
// Los ficheros legales y los subarboles no forman parte del arbol de codigo:
// se comparan aparte.
const vendor = Object.fromEntries(Object.entries(vendorAll).filter(([f]) => isCodeFile(f)));
const drift = diff(canon, vendor);

// Los sidecars deben existir en AMBAS Copies y ser identicos.
const sidecarDrift = [];
for (const f of SIDECAR) {
  const pkgPath = join(PKG, f);
  const vendorPath = join(VENDOR, f);
  if (!existsSync(pkgPath)) { sidecarDrift.push(`paquete: FALTA ${f}`); continue; }
  if (!existsSync(vendorPath)) { sidecarDrift.push(`vendor:  FALTA ${f}`); continue; }
  if (sha256(pkgPath) !== sha256(vendorPath)) sidecarDrift.push(`vendor:  DIFIERE ${f}`);
}
for (const f of Object.keys(vendorAll)) {
  if (isCodeFile(f)) continue;
  if (SIDECAR.includes(f) || SUBTREES.some((s) => f === s || f.startsWith(`${s}/`))) continue;
  sidecarDrift.push(`vendor:  SOBRA ${f}`);
}

// Los subarboles (corpus de atribucion) deben existir en AMBAS copias e ser
// identicos: son el contrato legal de la distribucion.
let subtreeFiles = 0;
for (const sub of SUBTREES) {
  const pkgPath = join(PKG, sub);
  const vendorPath = join(VENDOR, sub);
  if (!existsSync(pkgPath)) { sidecarDrift.push(`paquete: FALTA ${sub}/`); continue; }
  if (!existsSync(vendorPath)) { sidecarDrift.push(`vendor:  FALTA ${sub}/`); continue; }
  const a = fingerprint(pkgPath);
  const b = fingerprint(vendorPath);
  subtreeFiles += Object.keys(a).length;
  const d = diff(a, b);
  for (const f of d.missing) sidecarDrift.push(`vendor:  FALTA ${sub}/${f}`);
  for (const f of d.differing) sidecarDrift.push(`vendor:  DIFIERE ${sub}/${f}`);
  for (const f of d.extra) sidecarDrift.push(`vendor:  SOBRA ${sub}/${f}`);
}

const upstream = existsSync(UPSTREAM) ? fingerprint(UPSTREAM) : null;
const fork = upstream ? diff(upstream, canon) : null;

const result = {
  canon: relative(REPO, CANON),
  vendor: relative(REPO, VENDOR),
  files: Object.keys(canon).length,
  drift: { missing: drift.missing.length, differing: drift.differing.length, extra: drift.extra.length },
  sidecarDrift: sidecarDrift.length,
  subtreeFiles,
  forkVsUpstream: fork
    ? { missing: fork.missing.length, differing: fork.differing.length, extra: fork.extra.length }
    : null,
  ok:
    drift.missing.length === 0 &&
    drift.differing.length === 0 &&
    drift.extra.length === 0 &&
    sidecarDrift.length === 0,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

console.log(`sync-check: ${result.files} ficheros en el arbol canonico`);
if (upstream) {
  console.log(
    `  fork frente al upstream: ${fork.differing.length} divergentes, ` +
    `${fork.extra.length} propios, ${fork.missing.length} ausentes ` +
    `(declarados en upstream-divergence.json; los vigila ` +
    `scripts/check-upstream-divergence.mjs)`,
  );
  if (fork.differing.length || fork.extra.length || fork.missing.length) {
    for (const line of describe('upstream->canon', fork)) console.log(line);
  }
}
if (result.ok) {
  console.log('  SIN DRIFT: la copia vendorizada es identica al paquete (SHA-256).');
  process.exit(0);
}
console.error('  DRIFT DETECTADO entre el paquete y la copia vendorizada:');
for (const line of describe('canon->vendor', drift)) console.error(line);
for (const line of sidecarDrift) console.error(`  legal:  ${line}`);
console.error('  Ejecuta `node scripts/sync-check.mjs --write` para realinear.');
process.exit(1);
