/**
 * T7 (Ola 1b) — Copia el corpus legal de atribución MIT al artefacto.
 *
 * PROBLEMA
 * A6 replicó el corpus de atribución MIT (`agent-robot-avatar/`,
 * `coucou/`, `coucou-swift/`) dentro del espejo vendorizado del motor de
 * personaje (`renderer/floating/vendor/avatar/vendor/`). Es material legal
 * de SOLO LECTURA: no es código de runtime, no se importa y por eso
 * **nadie lo emitía** → la atribución MIT no viajaba en la app
 * distribuida, que es justo lo que la licencia exige.
 *
 * SOLUCIÓN
 * Tras el build de electron-vite, se copia el material legal al árbol
 * emitido, conservando la estructura relativa que cita `LICENSE.md`
 * (`vendor/<familia>/…`):
 *
 *   renderer/floating/vendor/avatar/LICENSE      → out/attribution/avatar/LICENSE
 *   renderer/floating/vendor/avatar/LICENSE.md    → out/attribution/avatar/LICENSE.md
 *   renderer/floating/vendor/avatar/NOTICE       → out/attribution/avatar/NOTICE
 *   renderer/floating/vendor/avatar/vendor/**     → out/attribution/avatar/vendor/**
 *
 * El destino es `out/attribution/`, **fuera** del árbol de runtime del
 * renderer (`out/renderer/`): el corpus no se compila, no se empaqueta en
 * el bundle de JS y no se typecheckea — es material legal de solo lectura
 * que debe ACOMPAÑAR a la app distribuida para que la cadena MIT sea
 * resoluble en ella.
 *
 * `electron-builder.config.cjs` ya empaqueta `out/**`, así que el corpus
 * viaja dentro del ASAR de la app distribuida.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "renderer", "floating", "vendor", "avatar");
const OUT = path.join(ROOT, "out", "attribution", "avatar");

/** Ficheros legales (texto) que deben viajar. */
const LEGAL_FILES = ["LICENSE", "LICENSE.md", "NOTICE"];
/** Subdirectorio del corpus de atribución. */
const CORPUS_DIR = "vendor";

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dst);
    }
  }
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[copy-avatar-attribution] no existe el origen: ${SRC}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(SRC, CORPUS_DIR))) {
    console.error(
      `[copy-avatar-attribution] el corpus legal no está en ${path.join(SRC, CORPUS_DIR)}`
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  let files = 0;
  for (const name of LEGAL_FILES) {
    const src = path.join(SRC, name);
    if (!fs.existsSync(src)) {
      console.warn(`[copy-avatar-attribution] falta ${name} (se omite)`);
      continue;
    }
    fs.copyFileSync(src, path.join(OUT, name));
    files++;
  }
  // El corpus completo (código de terceros atribuido, solo lectura).
  copyDir(path.join(SRC, CORPUS_DIR), path.join(OUT, CORPUS_DIR));
  const corpusFiles = fs
    .readdirSync(path.join(OUT, CORPUS_DIR), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile()).length;

  console.log(
    `[copy-avatar-attribution] ${files} ficheros legales + ${corpusFiles} del corpus → ${path.relative(ROOT, OUT)}`
  );
}

main();
