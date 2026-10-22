#!/usr/bin/env node
// scripts/typecheck.mjs - el typecheck del paquete: el codigo Y los tests.
//
// POR QUE UN SCRIPT Y NO "tsc -p a && tsc -p b": el `&&` no sobrevive al
// shell de pnpm en Windows (da "Source provides no match for required
// element at position 2"). Aqui se ejecutan los dos proyectos en orden y el
// primero que falle para el script.
//
//   1. `tsconfig.json`        -> el codigo del motor (`src/**`), con checkJs.
//   2. `tsconfig.tests.json`  -> los tests: deben PARSEAR y sus IMPORTACIONES
//                                deben resolver (una puerta real: un test roto
//                                rompe el build), pero sin el tipado profundo
//                                de los dobles de prueba (ver el tsconfig).

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const require = createRequire(import.meta.url);

/** El binario de tsc, resuelto desde donde este el paquete (hoisted o local). */
function tscBin() {
  try {
    return require.resolve('typescript/bin/tsc');
  } catch {
    return join(PKG, 'node_modules', 'typescript', 'bin', 'tsc');
  }
}

const PROJECTS = ['tsconfig.json', 'tsconfig.tests.json'];

for (const project of PROJECTS) {
  const label = project === 'tsconfig.json' ? 'codigo' : 'tests';
  console.info(`[typecheck] ${label} (${project})…`);
  // Sin `shell: true`: con el (y con espacios en la ruta) cmd.exe rompe la
  // linea de comandos. Se invoca el binario de tsc con el propio node.
  const res = spawnSync(process.execPath, [tscBin(), '-p', join(PKG, project), '--noEmit'], {
    cwd: PKG,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    console.error(`[typecheck] FALLA el typecheck de ${label}`);
    process.exit(res.status ?? 1);
  }
}
console.info('[typecheck] OK (codigo y tests)');
