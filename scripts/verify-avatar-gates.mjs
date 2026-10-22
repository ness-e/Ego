#!/usr/bin/env node
// scripts/verify-avatar-gates.mjs — ENTRYPOINT DE CI del resto de puertas del
// motor de personaje que NO estaban cableadas.
//
// POR QUÉ UN DELEGADOR Y NO UNA COPIA:
//   Las implementaciones viven en `packages/avatar/scripts/` (zona de A6). Este
//   fichero no reimplementa nada: **delega** en cada puerta y propaga su código
//   de salida. Si A6 mueve una puerta, basta cambiar **una línea** aquí.
//
// PUERTAS QUE EJECUTA (en orden; si una falla, para ahí y propaga su exit):
//   1. `check-bridge.mjs`               → el CONTRATO del puente Ego↔studio (D4):
//                                         qué estados cruzan y cuáles no.
//   2. `check-upstream-divergence.mjs`  → coherencia del manifiesto
//                                         `upstream-divergence.json` (qué
//                                         ficheros del upstream se declararon
//                                         eliminados a mano).
//
// CI-SAFE SIN CLONES: `check-upstream-divergence` usa `repos-referencia/avatar`
// como referencia de solo lectura; si el clon no está (CI es un checkout de
// Ego), la puerta lo dice y verifica la coherencia INTERNA del manifiesto. Sin
// ese paso, la divergencia silenciosa respecto al upstream no se detectaría
// nunca en CI.
//
// USO:
//   node scripts/verify-avatar-gates.mjs           → ambas puertas
//   node scripts/verify-avatar-gates.mjs --json    → informe machine
//
// Códigos de salida: 0 = todas ok · 1 = alguna falla · 2 = falta una implementación.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "packages", "avatar");
const args = process.argv.slice(2);

const PUERTAS = [
  { nombre: "bridge:check", script: "check-bridge.mjs" },
  { nombre: "upstream:check", script: "check-upstream-divergence.mjs" },
];

for (const p of PUERTAS) {
  const impl = join(PKG, "scripts", p.script);
  if (!existsSync(impl)) {
    console.error(
      `[verify-avatar-gates] falta la implementación de ${p.nombre}: ${impl}\n` +
        "                     (la implementa A6 en packages/avatar/scripts/)",
    );
    process.exit(2);
  }
}

for (const p of PUERTAS) {
  const impl = join(PKG, "scripts", p.script);
  console.log(`\n=== ${p.nombre} (${p.script}) ===`);
  const res = spawnSync(process.execPath, [impl, ...args], {
    cwd: PKG,
    encoding: "utf8",
    windowsHide: true,
  });
  process.stdout.write(res.stdout ?? "");
  process.stderr.write(res.stderr ?? "");
  if ((res.status ?? 1) !== 0) {
    console.error(`[verify-avatar-gates] ${p.nombre} FALLÓ (exit ${res.status ?? 1})`);
    process.exit(res.status ?? 1);
  }
}
console.log("\n[verify-avatar-gates] todas las puertas del motor en verde.");
process.exit(0);
