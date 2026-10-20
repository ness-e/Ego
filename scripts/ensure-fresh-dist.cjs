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
// T9 (A7): los paquetes JavaScript (p.ej. `packages/avatar`, motor del
// personaje) NO tienen fuentes `.ts`: sin esta extension el gate los daba
// por "sin fuentes .ts" → nunca se consideraban obsoletos → sus `dist/`
// podían quedar obsoletos en silencio (el mismo fallo que ya había mordido dos
// veces con knowledge-ipc y Bitemporal).
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function collectTsFiles(dir, out, isTopOfPkgRoot) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isTopOfPkgRoot && NON_SOURCE_DIRS.has(entry.name)) continue;
      collectTsFiles(abs, out, false);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
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

function readPkgJson(pkgDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function hasBuildScript(pkgDir) {
  const pkg = readPkgJson(pkgDir);
  return Boolean(pkg && pkg.scripts && pkg.scripts.build);
}

/**
 * T9 (A7): orden de construcción TOPOLÓGICO.
 *
 * Antes los paquetes se reconstruían en orden ALFABÉTICO (`dailystate` antes
 * que `decision`, `runtime` antes que `subegos`...), así que un paquete
 * podía compilarse contra el `dist/` de una dependencia aún obsoleto. El
 * script lo compensaba con 3 pasadas "a ojo"; esto lo hace determinista.
 *
 * Kahn: nodos = paquetes con script `build`; aristas = dependencia
 * `workspace:*` entre paquetes del workspace. Desempate alfabético entre
 * nodos empatados (mismo rango) → orden estable y reproducible.
 */
function buildOrder(packagesDir) {
  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(packagesDir, e.name));

  const byName = new Map();
  for (const dir of dirs) {
    const pkg = readPkgJson(dir);
    if (!pkg || !pkg.name) continue;
    byName.set(pkg.name, { dir, name: pkg.name, deps: new Set() });
  }

  for (const node of byName.values()) {
    const pkg = readPkgJson(node.dir);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const dep of Object.keys(deps)) {
      if (dep.startsWith('@ego/') && byName.has(dep)) node.deps.add(dep);
    }
  }

  const remaining = new Map();
  for (const node of byName.values()) {
    remaining.set(node.name, new Set([...node.deps].filter((d) => d !== node.name)));
  }

  const ordered = [];
  const done = new Set();
  while (ordered.length < byName.size) {
    // Candidatos: sin dependencias pendientes. Empate → alfabético.
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.size === 0 && !done.has(deps))
      .map(([name]) => name)
      .filter((name) => !done.has(name))
      .sort();
    if (ready.length === 0) {
      // Ciclo: se rompe por nombre para no bloquear el gate (fail-closed
      // aguas abajo: el build fallará si el ciclo es real).
      const fallback = [...remaining.keys()].filter((n) => !done.has(n)).sort();
      if (fallback.length === 0) break;
      ordered.push(fallback[0]);
      done.add(fallback[0]);
      continue;
    }
    for (const name of ready) {
      ordered.push(name);
      done.add(name);
    }
    // Se descuentan las dependencias ya construidas.
    for (const [name, deps] of remaining) {
      if (done.has(name)) continue;
      for (const d of deps) {
        if (done.has(d)) deps.delete(d);
      }
    }
  }

  return ordered.map((name) => byName.get(name));
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
  // Orden topológico (dependencias primero): un paquete nunca se compila
  // contra el `dist/` obsoleto de una dependencia.
  for (const node of buildOrder(dir)) {
    if (!hasBuildScript(node.dir)) continue;
    const { stale: isSt, reason } = isStale(node.dir);
    if (isSt) stale.push({ name: readPkgName(node.dir), dir: node.dir, reason });
  }
  return stale;
}

function rebuildPackage(pkg) {
  console.log(`[ensure-fresh-dist] obsoleto: ${pkg.name} (${pkg.reason}) -> reconstruyendo...`);
  // Ola 1b (A7): el build se invoca DIRECTAMENTE (sin `pnpm --filter ... build`).
  //
  // Por qué: `pnpm --filter X build` provoca un re-enlazado del workspace
  // (pnpm rehace los shims de `node_modules/.bin`). Ese re-enlazado ocurre
  // EN MEDIO de la suite (`pretest` corre mientras los otros paquetes
  // ejecutan sus tests) y provocaba fallos ESPURIOS:
  //   ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "vitest" not found
  // en paquetes que SÍ tienen el shim (medido 3 veces en 6 ejecuciones).
  //
  // Invocando el script de build del paquete directamente, con su
  // `node_modules/.bin` en el PATH, no hay re-enlazado y el build es más
  // rápido (no arranca el cliente de pnpm).
  const pkgJson = readPkgJson(pkg.dir);
  const buildScript = pkgJson && pkgJson.scripts && pkgJson.scripts.build;
  if (!buildScript) {
    console.error(`[ensure-fresh-dist] FAIL: ${pkg.name} no tiene script 'build'`);
    return false;
  }
  const binDirs = [
    path.join(pkg.dir, 'node_modules', '.bin'),
    path.join(WORKSPACE_ROOT, 'node_modules', '.bin'),
  ];
  const pathSep = process.platform === 'win32' ? ';' : ':';
  const env = {
    ...process.env,
    PATH: `${binDirs.join(pathSep)}${pathSep}${process.env.PATH ?? ''}`,
  };
  const result = spawnSync(buildScript, {
    cwd: pkg.dir,
    stdio: 'inherit',
    shell: true,
    env,
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

/**
 * Lock de archivo exclusivo: sólo una instancia puede reconstruir a la vez.
 * El `pretest` de varios paquetes puede correr en paralelo.
 */
function acquireLock(lockPath) {
  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // ya liberado
  }
}

/** Espera a que la otra instancia libere el lock. */
function waitForLock(lockPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!fs.existsSync(lockPath)) return true;
    // Lock huérfano (la otra instancia murió): se puede romper.
    try {
      const pid = Number(fs.readFileSync(lockPath, 'utf8').trim());
      if (Number.isFinite(pid) && pid > 0) {
        process.kill(pid, 0); // lanza si el proceso ya no existe
      } else {
        return true;
      }
    } catch (err) {
      if (err && err.code === 'ESRCH') {
        // El dueño del lock ya no existe → lock huérfano.
        releaseLock(lockPath);
        return true;
      }
    }
    sleepSync(250);
  }
  return false;
}

/** Espera síncrona (sin dependencias externas). */
function sleepSync(ms) {
  const shared = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(shared), 0, 0, ms);
}

function main() {
  // Ola 1b (A7): el gate se ejecuta como `pretest` de VARIOS paquetes
  // (`apps/desktop` y `tests`), y pnpm puede lanzarlos EN PARALELO. Dos
  // instancias simultáneas rebuilding el mismo paquete se pisan (una ve el
  // `dist/` a medio construir → "sigue obsoleto" → exit 1, falso positivo).
  //
  // Se serializa con un lock de archivo exclusivo (`wx`): la segunda
  // instancia espera a que la primera termine y luego RE-COMPRUEBA la
  // frescura (si la otra ya reconstruyó, no hay nada que hacer).
  const lockPath = path.join(WORKSPACE_ROOT, 'node_modules', '.cache', 'ensure-fresh-dist.lock');
  if (!acquireLock(lockPath)) {
    console.log('[ensure-fresh-dist] otra instancia está reconstruyendo; esperando...');
    const waited = waitForLock(lockPath, 120_000);
    if (!waited) {
      console.error('[ensure-fresh-dist] FAIL: no se pudo obtener el lock (otra实例 hangs).');
      process.exit(1);
    }
    console.log('[ensure-fresh-dist] la otra instancia terminó; re-comprobando frescura.');
    const pending = findStalePackages();
    if (pending.length === 0) {
      console.log('[ensure-fresh-dist] ok: todos los dist/ al dia (reconstruido por la otra instancia)');
      return 0;
    }
    // La otra instancia no cubrió estos paquetes: seguimos.
    console.log(`[ensure-fresh-dist] ${pending.length} paquete(s) siguen obsoletos tras la espera.`);
  }

  try {
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
  } finally {
    releaseLock(lockPath);
  }
}

module.exports = { isStale, findStalePackages, newestMtimeMs, sourceFiles, buildOrder, WORKSPACE_ROOT };

if (require.main === module) {
  process.exit(main());
}
