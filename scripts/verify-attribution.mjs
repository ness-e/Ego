#!/usr/bin/env node
// scripts/verify-attribution.mjs — ENTRYPOINT DE CI de la puerta de atribución.
//
// POR QUÉ ES UN DELEGADOR Y NO UNA COPIA:
//   Cada paquete tiene SU puerta en `packages/<pkg>/scripts/check-attribution.mjs`
//   (zona de los agentes que las escribieron). Copiar aquí el contenido daría
//   VARIAS implementaciones de la misma puerta, que se pueden desincronizar sin
//   que nadie se entere.
//
//   Este fichero NO reimplementa nada: **delega** en cada puerta y propaga su
//   código de salida. Si una puerta cambia de sitio o de nombre, basta cambiar
//   UNA línea (la tabla `PUERTAS` de aquí) — y el resto del repo sigue hablando
//   con un único ejecutable.
//
// QUÉ PUERTAS CUBRE (EGO-FIND-82, Ola 11):
//
//   · `packages/avatar`           → motor de personaje (implementación de A6).
//                                    Modo `--fix` / `--fix --apply`.
//   · `packages/tool-call-repair` → implementación GENÉRICA del plano 1 (código)
//                                    para los paquetes de `packages/**` que no
//                                    son avatar (de A2-bis).
//   · `packages/tools`            → delegador al anterior, con su propia raíz.
//   · `packages/ui-runtime`       → delegador al anterior, con su propia raíz.
//
//   Antes de la Ola 11, este delegador sólo cubría `packages/avatar`: las tres
//   puertas nuevas de A2-bis NO se ejecutaban en ningún pipeline.
//
// CI-SAFE SIN CLONES:
//   Las cuatro puertas usan `repos-referencia/<upstream>` como REFERENCIA de
//   solo lectura. Si el clon no está (CI es un checkout de Ego: no lo tiene),
//   la puerta lo anota como "no comprobable" y **sigue verificando** lo
//   verificable (cabeceras canónicas, cobertura del manifiesto, LICENSE.md,
//   NOTICE). Verificado: con el clon ausente las cuatro dan exit 0.
//
// USO:
//   node scripts/verify-attribution.mjs              → las 4 puertas
//   node scripts/verify-attribution.mjs --json       → informe machine
//   node scripts/verify-attribution.mjs --only tools → sólo una (diagnóstico)
//   node scripts/verify-attribution.mjs --fix        → propuesta de cabeceras
//   node scripts/verify-attribution.mjs --fix --apply → aplica (sólo avatar:
//                                                        las otras tres puertas
//                                                        NUNCA escriben)
//
// Códigos de salida: 0 = todo cuadra · 1 = alguna puerta falla · 2 = uso inválido.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Las puertas que cubre este delegador.
 *
 * `modo` describe qué puede hacer la puerta:
 *   · "fix"    → acepta `--fix` (propuesta) y `--fix --apply` (escribe).
 *   · "check"  → NUNCA escribe: su `--check` informa del PLAN de cabeceras
 *                pendientes y falla si el plan no está vacío.
 */
const PUERTAS = [
  {
    etiqueta: "avatar",
    impl: join("packages", "avatar", "scripts", "check-attribution.mjs"),
    cwd: join("packages", "avatar"),
    modo: "fix",
  },
  {
    etiqueta: "tool-call-repair",
    impl: join("packages", "tool-call-repair", "scripts", "check-attribution.mjs"),
    cwd: join("packages", "tool-call-repair"),
    modo: "check",
  },
  {
    etiqueta: "tools",
    impl: join("packages", "tools", "scripts", "check-attribution.mjs"),
    cwd: join("packages", "tools"),
    modo: "check",
  },
  {
    etiqueta: "ui-runtime",
    impl: join("packages", "ui-runtime", "scripts", "check-attribution.mjs"),
    cwd: join("packages", "ui-runtime"),
    modo: "check",
  },
];

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const fix = argv.includes("--fix");
const apply = fix && argv.includes("--apply");
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const rootIdx = argv.indexOf("--root");

if (onlyIdx >= 0 && !only) {
  console.error("[verify-attribution] --only necesita el nombre de un paquete");
  process.exit(2);
}
if (rootIdx >= 0 && !argv[rootIdx + 1]) {
  console.error("[verify-attribution] --root necesita un directorio");
  process.exit(2);
}
if (rootIdx >= 0 && !only) {
  console.error(
    "[verify-attribution] --root sólo tiene sentido con --only <paquete> " +
      "(cada puerta tiene su propia raíz; sin --only, --root sería ambiguo).",
  );
  process.exit(2);
}

let seleccion = PUERTAS;
if (only) {
  seleccion = PUERTAS.filter((p) => p.etiqueta === only);
  if (seleccion.length === 0) {
    console.error(
      `[verify-attribution] paquete desconocido: "${only}" (conocidos: ${PUERTAS.map((p) => p.etiqueta).join(", ")})`,
    );
    process.exit(2);
  }
}

/** Los argumentos que se pasan a cada puerta, según su modo. */
function argsPara(puerta) {
  const args = [];
  if (asJson) args.push("--json");
  if (puerta.modo === "fix") {
    if (fix) args.push("--fix");
    if (apply) args.push("--apply");
  } else {
    // Las puertas de paquete NUNCA escriben: su `--check` informa del plan.
    if (fix) args.push("--check");
  }
  if (rootIdx >= 0) args.push("--root", argv[rootIdx + 1]);
  return args;
}

/** Comprueba que la implementación existe ANTES de ejecutar nada. */
for (const p of seleccion) {
  const abs = join(ROOT, p.impl);
  if (!existsSync(abs)) {
    console.error(
      `[verify-attribution] no se encuentra la implementación de la puerta "${p.etiqueta}": ${abs}\n` +
        "                      (cada paquete implementa la suya en packages/<pkg>/scripts/check-attribution.mjs)",
    );
    process.exit(2);
  }
}

let fallidas = 0;
for (const p of seleccion) {
  const abs = join(ROOT, p.impl);
  const args = argsPara(p);
  if (!asJson) {
    console.log(`\n=== atribucion: ${p.etiqueta} (${p.impl}) ===`);
    if (fix && p.modo === "check") {
      console.log(
        "  nota: esta puerta NUNCA escribe; se ejecuta en modo --check (informa del plan).",
      );
    }
  }
  const res = spawnSync(process.execPath, [abs, ...args], {
    cwd: join(ROOT, p.cwd),
    encoding: "utf8",
    windowsHide: true,
  });
  process.stdout.write(res.stdout ?? "");
  process.stderr.write(res.stderr ?? "");
  const code = res.status ?? 1;
  if (code !== 0) {
    fallidas++;
    console.error(`[verify-attribution] la puerta "${p.etiqueta}" FALLÓ (exit ${code})`);
  }
}

if (fallidas > 0) {
  console.error(
    `\n[verify-attribution] ${fallidas} de ${seleccion.length} puerta(s) de atribución fallaron.`,
  );
  process.exit(1);
}
if (!asJson) {
  console.log(
    `\n[verify-attribution] ${seleccion.length} puerta(s) de atribución en verde ` +
      `(${seleccion.map((p) => p.etiqueta).join(", ")}).`,
  );
}
process.exit(0);
