#!/usr/bin/env node
/**
 * scripts/lint-staged-oxlint.mjs — linteo por lotes de los ficheros staged.
 *
 * Lo invoca el hook `pre-commit` a través de `.lintstagedrc.mjs`. Existe por
 * **dos** razones, ambas en Windows:
 *
 * 1. **Límite de longitud de la línea de comandos.** `cmd.exe` admite 8191
 *    caracteres. Con ~97 ficheros `.js` staged, `oxlint <97 rutas>` no cabe →
 *    *"La línea de comandos es demasiado larga"* y el commit se rechaza sin
 *    lintear nada. Aquí la lista **no** viaja por la línea de comandos: se lee
 *    de git y se invoca oxlint en **lotes de 25**.
 *
 * 2. **"No files found to lint".** `.oxlintrc.json` ignora las copias vendorizadas
 *    (`packages/avatar/vendor/**` y `apps/desktop/renderer/floating/vendor/**`).
 *    Si se le pasan solo rutas ignoradas, oxlint no encuentra nada que lintear y
 *    sale con código 1 → el commit se rechaza. Aquí se filtran esas rutas antes
 *    de invocar oxlint, y un lote que se queda vacío no se invoca.
 *
 * El binario se invoca con `node <bin>` y `shell: false` → sin `cmd.exe`, sin
 * límite de longitud. Si un lote falla, el script sale con código 1 y
 * lint-staged revierte el staging: **el commit no se hace**.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/** Copias espejo de codigo de terceros: no se lintean (ver `.oxlintrc.json`). */
const IGNORED_PREFIXES = [
  "packages/avatar/vendor/",
  "apps/desktop/renderer/floating/vendor/",
];

const LINTABLE = /\.(ts|tsx|js|mjs|cjs)$/;
const BATCH_SIZE = 25;

function stagedFiles() {
  const res = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });
  if (res.error || res.status !== 0) return [];
  return res.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function oxlintBin() {
  // pnpm no enlaza el paquete en node_modules/oxlint: se resuelve por el
  // `package.json` del paquete y se sube a su `bin/oxlint` (un fichero JS que
  // se invoca con `node`, sin pasar por cmd.exe).
  const require = createRequire(join(ROOT, "package.json"));
  try {
    const pkg = require.resolve("oxlint/package.json");
    const bin = join(dirname(pkg), "bin", "oxlint");
    if (existsSync(bin)) return { bin, viaNode: true };
  } catch {
    /* cae al candidato de abajo */
  }
  const shim = join(ROOT, "node_modules", ".bin", "oxlint");
  if (existsSync(shim)) return { bin: shim, viaNode: false };
  return null;
}

const targets = stagedFiles().filter(
  (f) => LINTABLE.test(f) && !IGNORED_PREFIXES.some((p) => f.startsWith(p)),
);

if (targets.length === 0) {
  console.log("[lint-staged] sin ficheros que lintear");
  process.exit(0);
}

const bin = oxlintBin();
if (!bin) {
  console.error("[lint-staged] no se encuentra el binario de oxlint");
  process.exit(1);
}

const failed = [];
for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = targets.slice(i, i + BATCH_SIZE);
  const args = ["--ignore-path", ".gitignore", ...batch];
  const res = bin.viaNode
    ? spawnSync(process.execPath, [bin.bin, ...args], {
        cwd: ROOT,
        stdio: "inherit",
        shell: false,
      })
    : spawnSync(bin.bin, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (res.error) {
    console.error(`[lint-staged] ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    failed.push({ lote: i / BATCH_SIZE + 1, status: res.status });
  }
}

if (failed.length > 0) {
  const detail = failed.map((f) => `lote ${f.lote} (exit ${f.status})`).join(", ");
  console.error(`[lint-staged] oxlint fallo en ${failed.length} lote(s): ${detail}`);
  process.exit(1);
}

console.log(`[lint-staged] oxlint OK (${targets.length} ficheros)`);
