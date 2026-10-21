#!/usr/bin/env node
// scripts/verify-attribution.mjs — ENTRYPOINT DE CI de la puerta de atribución.
//
// POR QUÉ ES UN DELEGADOR Y NO UNA COPIA:
//   La implementación (y su test) viven en `packages/avatar/scripts/check-attribution.mjs`,
//   que es zona de A6 y que su paquete invoca como
//   `pnpm --filter @ego/avatar attribution:check`. A6 lo reescribió y sigue
//   trabajando en él. Copiarlo aquí daría DOS implementaciones de la misma
//   puerta que se pueden desincronizar sin que nadie se entere.
//
//   Este fichero NO reimplementa nada: **delega** en la implementación de A6 y
//   le pasa los argumentos tal cual. Si algún día la puerta cambia de sitio,
//   basta con cambiar UNA línea (aquí) — y el resto del repo sigue hablando con
//   un único ejecutable.
//
//   La puerta YA es_ci-safe sin necesidad de clones: contrasta el
//   `provenance.manifest.json` del propio paquete (86 ficheros: 63 derivados +
//   23 nativos) y sólo mira `repos-referencia/avatar` SI existe (en CI no
//   existe → lo anota como "no comprobable", no falla).
//
// USO:
//   node scripts/verify-attribution.mjs            → verificación completa
//   node scripts/verify-attribution.mjs --fix      → reescribe las cabeceras
//   node scripts/verify-attribution.mjs --json     → informe JSON
//
// Códigos de salida: los de la puerta delegada (0 = todo cuadra · 1 = problemas).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMPLEMENTACION = join(ROOT, "packages", "avatar", "scripts", "check-attribution.mjs");

if (!existsSync(IMPLEMENTACION)) {
  console.error(
    `[verify-attribution] no se encuentra la implementación de la puerta: ${IMPLEMENTACION}\n` +
      "               (la implementa A6 en packages/avatar/scripts/check-attribution.mjs)",
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
