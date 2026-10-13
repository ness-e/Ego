// scripts/ensure-fresh-dist.cjs — HIG-02: gate contra dist/ obsoleto.
// Contrato: los tests de apps/desktop y tests/e2e consumen packages/*/dist
// (main/exports -> dist). Si src/ es mas nuevo que dist/, el test corre
// contra codigo viejo en silencio (ya mordio 2 veces: knowledge-ipc,
// Bitemporal). Este script corre como `pretest`: detecta paquetes obsoletos
// por mtime y los reconstruye con su build canonico. Si un build falla,
// exit 1 en rojo (rama "falla en rojo" del contrato).
// Sin dependencias: solo node builtin. Estilo: verify-dist.cjs.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(WORKSPACE_ROOT, 'packages');
// Dirs nunca-fuente al caminar la raiz de un paquete sin src/ (caso memory:
// layout historico con fuentes en la raiz, decision F6T13/L06+L07).
const NON_SOURCE_DIRS = new Set(['dist', 'test', 'node_modules', '.git']);

function collectTsFiles(dir, out, isTopOfPkgRoot) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isTopOfPkgRoot && NON_SOURCE_DIRS.has(entry.name)) continue;
      collectTsFiles(abs, out, false);
    } else if (entry.name.endsWith('.ts')) {
      out.push(abs);
    }
  }
  return out;
}

// Raices fuente de un paquete: src/ si existe; si no, la raiz excluyendo
// no-fuentes (layout historico packages/memory).
function sourceFiles(pkgDir) {
  const srcDir = path.join(pkgDir, 'src');
  if (fs.existsSync(srcDir)) return collectTsFiles(srcDir, [], false);
  return collectTsFiles(pkgDir, [], true);
}

function newestMtimeMs(dir, extensions) {
  let newest = -1;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = newestMtimeMs(abs, extensions);
      if (nested > newest) newest = nested;
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      const stat = fs.statSync(abs);
      if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    }
  }
  return newest;
}

function readPkgName(pkgDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).name;
  } catch {
    return path.basename(pkgDir);
  }
}

function hasBuildScript(pkgDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    return Boolean(pkg.scripts && pkg.scripts.build);
  } catch {
    return false;
  }
}

// Senal pura y testeable: ¿el dist de este paquete esta obsoleto?
function isStale(pkgDir) {
  const distDir = path.join(pkgDir, 'dist');
  const sources = sourceFiles(pkgDir);
  if (sources.length === 0) return { stale: false, reason: 'sin fuentes .ts' };
  if (!fs.existsSync(distDir)) return { stale: true, reason: 'dist/ ausente' };
  let newestSrc = -1;
  for (const f of sources) {
    const m = fs.statSync(f).mtimeMs;
    if (m > newestSrc) newestSrc = m;
  }
  const newestDist = newestMtimeMs(distDir, ['.js', '.d.ts']);
  if (newestDist < 0) return { stale: true, reason: 'dist/ vacio' };
  if (newestSrc > newestDist) {
    return { stale: true, reason: `src/ mas nuevo que dist/ (${new Date(newestSrc).toISOString()})` };
  }
  return { stale: false, reason: 'al dia' };
}

function findStalePackages(packagesDir) {
  const dir = packagesDir || PACKAGES_DIR;
  const stale = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgDir = path.join(dir, entry.name);
    if (!hasBuildScript(pkgDir)) continue;
    const { stale: isSt, reason } = isStale(pkgDir);
    if (isSt) stale.push({ name: readPkgName(pkgDir), dir: pkgDir, reason });
  }
  return stale;
}

function rebuildPackage(pkg) {
  console.log(`[ensure-fresh-dist] obsoleto: ${pkg.name} (${pkg.reason}) -> reconstruyendo...`);
  const result = spawnSync('pnpm', ['--filter', pkg.name, 'build'], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`[ensure-fresh-dist] FAIL: build de ${pkg.name} fallo (exit ${result.status}). dist/ sigue obsoleto: abortar tests.`);
    return false;
  }
  const after = isStale(pkg.dir);
  if (after.stale) {
    console.error(`[ensure-fresh-dist] FAIL: ${pkg.name} sigue obsoleto tras el build (${after.reason}).`);
    return false;
  }
  console.log(`[ensure-fresh-dist] ok: ${pkg.name} reconstruido`);
  return true;
}

function main() {
  // Multi-pass: un paquete puede compilar contra el dist aun-obsoleto de
  // una dependencia (orden alfabetico != orden topologico). Repetir hasta
  // que no quede nada obsoleto o no haya progreso (max 3 pasadas).
  for (let pass = 1; pass <= 3; pass += 1) {
    const stale = findStalePackages();
    if (stale.length === 0) {
      console.log('[ensure-fresh-dist] ok: todos los dist/ al dia');
      return 0;
    }
    if (pass > 1 || stale.length > 1) console.log(`[ensure-fresh-dist] pasada ${pass}: ${stale.length} paquete(s) obsoleto(s)`);
    let failures = 0;
    for (const pkg of stale) {
      if (!rebuildPackage(pkg)) failures += 1;
    }
    if (failures === 0 && findStalePackages().length === 0) {
      console.log('[ensure-fresh-dist] TODOS LOS DIST AL DIA');
      return 0;
    }
  }
  const remaining = findStalePackages();
  if (remaining.length > 0) {
    console.error(`[ensure-fresh-dist] FAIL: ${remaining.length} paquete(s) con dist/ obsoleto sin poder reconstruir: ${remaining.map((p) => p.name).join(', ')}`);
    return 1;
  }
  console.log('[ensure-fresh-dist] TODOS LOS DIST AL DIA');
  return 0;
}

module.exports = { isStale, findStalePackages, newestMtimeMs, sourceFiles, WORKSPACE_ROOT };

if (require.main === module) {
  process.exit(main());
}
