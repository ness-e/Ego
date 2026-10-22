#!/usr/bin/env node
// scripts/check-attribution.mjs — PUERTA DE ATRIBUCIÓN DE `@ego/tools`.
//
// Es un DELEGADOR: la implementación vive en
// `packages/tool-call-repair/scripts/check-attribution.mjs` (una sola
// implementación para todos los paquetes de `packages/**` que no son
// `packages/avatar`, que tiene la suya). Copiarla aquí daría DOS
// implementaciones de la misma puerta que se pueden desincronizar sin que
// nadie se entere.
//
// Uso: node scripts/check-attribution.mjs [--root <dir>] [--json] [--check]
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { runGateCli } = await import(
  pathToFileURL(resolve(join(HERE, "..", "..", "tool-call-repair", "scripts", "check-attribution.mjs"))).href
);

runGateCli(process.argv.slice(2), { defaultRoot: resolve(join(HERE, "..")) });
