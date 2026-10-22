#!/usr/bin/env node
// scripts/verify-no-verbatim.mjs — ENTRYPOINT DE CI de la puerta de "no verbatim".
//
// POR QUÉ ES UN DELEGADOR Y NO UNA COPIA:
//   La implementación (y su test) viven en
//   `packages/avatar/scripts/check-no-verbatim.mjs`, que es zona de A6. Copiarlo
//   aquí daría DOS implementaciones de la misma puerta, que se pueden
//   desincronizar sin que nadie se entere. Este fichero NO reimplementa nada:
//   **delega** y le pasa los argumentos tal cual.
//
//   La puerta verifica la decisión **D4**: el motor de personaje NO conserva
//   código verbatim del upstream. Es lo que `EGO-FIND-106`.signaló: sin este
//   paso en CI, la decisión D4 no se verificaba en ningún pipeline.
//
// CI-SAFE SIN CLONES: la puerta usa `repos-referencia/avatar` como REFERENCIA
// de solo lectura. Si el clon no está (CI es un checkout de Ego: no lo tiene),
// lo dice ("nota: el clon de referencia no esta presente; solo se mide contra
// el corpus vendor/") y **sigue midiendo** contra el corpus `vendor/` del
// propio paquete, que sí está en el repo → en CI la puerta es útil y no
// necesita clones.
//
// USO:
//   node scripts/verify-no-verbatim.mjs            → verificación
//   node scripts/verify-no-verbatim.mjs --json     → informe machine
//   node scripts/verify-no-verbatim.mjs --all      → incluye el residuo de todos
//                                                    los ficheros
//
// Códigos de salida: los de la puerta delegada (0 = ok · 1 = hay verbatim).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMPLEMENTACION = join(ROOT, "packages", "avatar", "scripts", "check-no-verbatim.mjs");

if (!existsSync(IMPLEMENTACION)) {
  console.error(
    `[verify-no-verbatim] no se encuentra la implementación de la puerta: ${IMPLEMENTACION}\n` +
      "                   (la implementa A6 en packages/avatar/scripts/check-no-verbatim.mjs)",
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const res = spawnSync(process.execPath, [IMPLEMENTACION, ...args], {
  cwd: join(ROOT, "packages", "avatar"),
  encoding: "utf8",
  windowsHide: true,
});
process.stdout.write(res.stdout ?? "");
process.stderr.write(res.stderr ?? "");
process.exit(res.status ?? 1);
