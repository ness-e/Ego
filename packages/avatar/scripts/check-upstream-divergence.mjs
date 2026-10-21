#!/usr/bin/env node
// scripts/check-upstream-divergence.mjs — puerta de divergencia frente al upstream.
//
// `repos-referencia/avatar/` es una REFERENCIA DE SOLO LECTURA: está en
// `.gitignore` y no forma parte del repositorio. Este paquete (`@ego/avatar`)
// es un descendiente BIFURCADO suyo, no un espejo.
//
// El riesgo real de esa decisión es la **divergencia silenciosa**: alguien
// cambia un fichero del paquete, el upstream se queda atrás, y nadie sabe si
// el cambio es intencionado. Esta puerta lo hace explicito:
//
//   - un fichero que DIVERGE y no está declarado  -> FALLA (divergencia no declarada)
//   - un fichero declarado que YA NO diverge     -> FALLA (declaración obsoleta)
//   - un fichero declarado cuyo contenido cambia -> FALLA (hay que re-declarar)
//   - un fichero nuevo en el paquete sin declararse -> FALLA
//   - un fichero del upstream que desaparece sin declararse -> FALLA
//
// El manifiesto con las divergencias declaradas (y el motivo de cada una) vive
// en `upstream-divergence.json`, en el propio paquete.
//
// Uso:
//   node scripts/check-upstream-divergence.mjs            verifica (exit 1 si hay deriva)
//   node scripts/check-upstream-divergence.mjs --update   re-declara (imprime el cambio)
//   node scripts/check-upstream-divergence.mjs --json     informe machine
//
// Si el upstream NO está presente (clone limpio: está gitignored), la puerta
// lo dice y sale con 0: no es un fallo, es la ausencia de la referencia.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');
const MANIFEST_PATH = join(PKG, 'upstream-divergence.json');

const asJson = process.argv.includes('--json');
const update = process.argv.includes('--update');

function walk(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split('\\').join('/'));
  }
  return out.sort();
}

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const upstreamRoot = resolve(REPO, manifest.upstream.path);
const upstreamSrc = join(upstreamRoot, 'src');
const pkgSrc = join(PKG, 'src');

// --- El upstream no está (clone limpio: está gitignored) ---------------------
if (!existsSync(upstreamSrc)) {
  const msg = `upstream no presente en ${relative(REPO, upstreamRoot)} (referencia de solo lectura, gitignored): se omite la comparacion.`;
  if (asJson) {
    console.log(JSON.stringify({ ok: true, upstreamPresent: false, message: msg }, null, 2));
  } else {
    console.log(`  ${msg}`);
    console.log('  (el manifiesto de divergencias sigue vigente: upstream-divergence.json)');
  }
  process.exit(0);
}

const upFiles = new Set(walk(upstreamSrc));
const pkgFiles = walk(pkgSrc);

const divergen = [];
const identicos = [];
const nuevos = [];
const ausentes = [];

for (const f of pkgFiles) {
  const upPath = join(upstreamSrc, f);
  if (!upFiles.has(f)) { nuevos.push(f); continue; }
  const pkgHash = sha(join(pkgSrc, f));
  const upHash = sha(upPath);
  if (pkgHash === upHash) identicos.push(f);
  else divergen.push({ file: f, pkgHash, upHash });
}
for (const f of upFiles) if (!pkgFiles.includes(f)) ausentes.push(f);

const problems = [];
const declared = manifest.divergences || {};
const declaredNew = manifest.newFiles || {};
const declaredRemoved = manifest.removedFiles || {};

// (a) Divergencias no declaradas.
for (const d of divergen) {
  if (!declared[d.file]) {
    problems.push(`divergencia NO declarada: ${d.file} (upstream ${d.upHash.slice(0, 12)} / paquete ${d.pkgHash.slice(0, 12)})`);
  }
}

// (b) Declaraciones obsoletas (el fichero ya no diverge).
for (const f of Object.keys(declared)) {
  if (!divergen.some((d) => d.file === f)) {
    if (upFiles.has(f) && pkgFiles.includes(f)) {
      problems.push(`declaracion obsoleta: ${f} ya NO diverge del upstream (identico)`);
    } else if (!pkgFiles.includes(f)) {
      problems.push(`declaracion obsoleta: ${f} ya no existe en el paquete`);
    } else {
      problems.push(`declaracion obsoleta: ${f} ya no diverge del upstream`);
    }
  }
}

// (c) El contenido aprobado de un fichero declarado ha cambiado.
for (const d of divergen) {
  const decl = declared[d.file];
  if (!decl) continue;
  if (decl.sha256 && decl.sha256 !== d.pkgHash) {
    problems.push(`contenido aprobado cambiado: ${d.file} (manifesto ${String(decl.sha256).slice(0, 12)} / actual ${d.pkgHash.slice(0, 12)}) — re-declara con --update`);
  }
}

// (d) Ficheros nuevos del paquete sin declarar.
for (const f of nuevos) {
  if (!declaredNew[f]) problems.push(`fichero nuevo NO declarado: ${f}`);
}

// (e) Ficheros del upstream que desaparecen sin declararse.
for (const f of ausentes) {
  if (!declaredRemoved[f]) problems.push(`fichero del upstream eliminado NO declarado: ${f}`);
}

// (f) Ficheros declarados como nuevos que ya no son nuevos.
for (const f of Object.keys(declaredNew)) {
  if (upFiles.has(f)) problems.push(`declaracion obsoleta: ${f} ya existe en el upstream`);
}
for (const f of Object.keys(declaredRemoved)) {
  if (!ausentes.includes(f)) problems.push(`declaracion obsoleta: ${f} ya no esta ausente del paquete`);
}

// --- Re-declarar -------------------------------------------------------------
if (update) {
  const before = JSON.stringify(manifest.divergences);
  for (const d of divergen) {
    if (!manifest.divergences[d.file]) {
      manifest.divergences[d.file] = { kind: 'feature', reason: 'SIN MOTIVO — completar antes de comitear.' };
    }
    manifest.divergences[d.file].sha256 = d.pkgHash;
  }
  for (const f of nuevos) {
    if (!manifest.newFiles[f]) {
      manifest.newFiles[f] = { kind: 'feature', reason: 'SIN MOTIVO — completar antes de comitear.' };
    }
    manifest.newFiles[f].sha256 = sha(join(pkgSrc, f));
  }
  for (const f of ausentes) {
    if (!manifest.removedFiles[f]) {
      manifest.removedFiles[f] = { kind: 'feature', reason: 'SIN MOTIVO — completar antes de comitear.' };
    }
  }
  const after = JSON.stringify(manifest.divergences);
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`manifiesto re-declarado: ${divergen.length} divergencias, ${nuevos.length} nuevos, ${ausentes.length} eliminados`);
  if (before !== after) console.log('  (el contenido de las divergencias cambio: revisa el diff del manifiesto)');
  process.exit(0);
}

const result = {
  ok: problems.length === 0,
  upstreamPresent: true,
  upstream: relative(REPO, upstreamRoot),
  files: { total: pkgFiles.length, identical: identicos.length, diverging: divergen.length, new: nuevos.length, removed: ausentes.length },
  declared: { divergences: Object.keys(declared).length, newFiles: Object.keys(declaredNew).length, removedFiles: Object.keys(declaredRemoved).length },
  problems,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

console.log(`upstream ${relative(REPO, upstreamRoot)}: ${pkgFiles.length} ficheros en el paquete | ` +
  `identicos=${identicos.length} divergen=${divergen.length} (declaradas ${Object.keys(declared).length}) | ` +
  `nuevos=${nuevos.length} (declarados ${Object.keys(declaredNew).length}) | ` +
  `eliminados=${ausentes.length}`);
if (result.ok) {
  console.log('  SIN DIVERGENCIA NO DECLARADA: cada diferencia con el upstream esta justificada en upstream-divergence.json.');
  process.exit(0);
}
console.error(`  ${problems.length} PROBLEMA(S):`);
for (const p of problems) console.error(`    ${p}`);
process.exit(1);
