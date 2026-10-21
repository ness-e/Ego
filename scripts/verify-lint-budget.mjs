#!/usr/bin/env node
// scripts/verify-lint-budget.mjs — PUERTA del presupuesto de avisos de oxlint.
//
// POR QUÉ EXISTE (Ola 6, A7):
//   El ratchet de lint (`--max-warnings`) vivía **sólo** en el `package.json`.
//   Consecuencias medidas en la Ola 5:
//     · hubo que re-basarlo TRES veces en una ola (324 → 361 → 350) porque los
//       agentes añaden código con avisos más rápido de lo que se re-basea;
//     · **CI no lo aplicaba**: el paso de lint del job `verify` corría
//       `pnpm exec oxlint …` SIN `--max-warnings` → el ratchet era local-only
//       y en CI el presupuesto no restringía nada.
//
//   Aquí el presupuesto vive en UN fichero (`scripts/lint-budget.json`) que
//   leen tanto `pnpm lint` como CI, y la puerta hace que **sólo pueda bajar**.
//
// REGLAS (falla si alguna se incumple):
//   1. el recuento REAL de avisos no puede superar `maxWarnings`  → regresión;
//   2. `maxWarnings` no puede ser MAYOR que `previousMaxWarnings` sin
//      justificación: hace falta `raisedBecause` no vacío Y que el recuento real
//      también haya subido por encima del valor anterior → el ratchet no se
//      sube "por conveniencia";
//   3. si el recuento real queda por debajo del presupuesto, la puerta AVISA
//      de cuánto margen hay (para poder apretarlo) pero no falla.
//
// USO:
//   node scripts/verify-lint-budget.mjs              → mide, comprueba y aplica el
//                                                      tope al propio lint
//   node scripts/verify-lint-budget.mjs --json       → informe JSON
//   node scripts/verify-lint-budget.mjs --budget <f> → otro fichero de presupuesto
//   node scripts/verify-lint-budget.mjs --count <n>  → no medir: usar este
//                                                      recuento (sólo para el test)
//
// Códigos de salida: 0 = presupuesto respetado · 1 = regresión o subida sin justificar.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DEFAULT_BUDGET = join(ROOT, "scripts", "lint-budget.json");
const BUDGET_PATH = opt("--budget", DEFAULT_BUDGET);

/**
 * Decisión pura sobre el presupuesto. Se exporta para poder testearla sin
 * lanzar oxlint (ver scripts/test-verify-lint-budget.mjs).
 *
 * @param {{real:number, max:number, previous:number, raisedBecause?:string}} p
 * @returns {{ok:boolean, problems:string[], margin:number, raised:boolean}}
 */
export function evaluateBudget({ real, max, previous, raisedBecause = "" }) {
  const problems = [];
  // 1. regresión: el recuento real supera el presupuesto
  if (real > max) {
    problems.push(
      `REGRESIÓN: el recuento real (${real}) supera el presupuesto (${max}) → ` +
        `corrige ${real - max} aviso(s), o baja el presupuesto si son deuda ya pagada`,
    );
  }
  // 2. subida del presupuesto: sólo con justificación Y con el recuento real
  //    también por encima del valor anterior
  const raised = max > previous;
  if (raised) {
    if (!raisedBecause || !raisedBecause.trim()) {
      problems.push(
        `el presupuesto SUBIÓ de ${previous} a ${max} sin justificación: ` +
          `rellena "raisedBecause" en ${relative(ROOT, BUDGET_PATH)} o, mejor, baja el presupuesto`,
      );
    } else if (real <= previous) {
      problems.push(
        `el presupuesto subió de ${previous} a ${max} (justificado: "${raisedBecause.trim()}") ` +
          `pero el recuento real (${real}) NO lo justifica: no había avisos nuevos que absorber`,
      );
    }
  }
  return { ok: problems.length === 0, problems, margin: max - real, raised };
}

/** Corre oxlint con el tope del presupuesto y devuelve el recuento real. */
function measure(budget) {
  const args = [
    "exec",
    "oxlint",
    "--ignore-path",
    ".gitignore",
    ...budget.scope.split(" "),
    "--max-warnings",
    String(budget.maxWarnings),
  ];
  let out = "";
  let code = 0;
  try {
    out = execFileSync("pnpm", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 128 * 1024 * 1024,
      shell: process.platform === "win32",
    });
  } catch (err) {
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    code = err.status ?? 1;
  }
  const warnings = (out.match(/warning /g) || []).length;
  const errors = (out.match(/: error/g) || []).length;
  return { warnings, errors, lintExit: code };
}

function main() {
  if (!existsSync(BUDGET_PATH)) {
    console.error(`[verify-lint-budget] no existe el fichero de presupuesto: ${BUDGET_PATH}`);
    process.exit(2);
  }
  const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8"));
  for (const key of ["maxWarnings", "previousMaxWarnings"]) {
    if (typeof budget[key] !== "number") {
      console.error(`[verify-lint-budget] "${key}" falta o no es un número en ${BUDGET_PATH}`);
      process.exit(2);
    }
  }

  const forced = opt("--count", "");
  const measured =
    forced === "" ? measure(budget) : { warnings: Number(forced), errors: 0, lintExit: 0 };
  const real = measured.warnings;
  const verdict = evaluateBudget({
    real,
    max: budget.maxWarnings,
    previous: budget.previousMaxWarnings,
    raisedBecause: budget.raisedBecause ?? "",
  });

  const report = {
    ok: verdict.ok,
    real,
    max: budget.maxWarnings,
    previous: budget.previousMaxWarnings,
    margin: verdict.margin,
    raised: verdict.raised,
    problems: verdict.problems,
    budgetFile: relative(ROOT, BUDGET_PATH),
    countedAt: budget.countedAt ?? null,
  };

  if (has("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[verify-lint-budget] recuento real ${real} · presupuesto ${budget.maxWarnings} ` +
        `(anterior ${budget.previousMaxWarnings}) · margen ${verdict.margin}`,
    );
    if (verdict.raised) {
      console.log(
        `[verify-lint-budget] el presupuesto subió de ${budget.previousMaxWarnings} a ${budget.maxWarnings}` +
          (budget.raisedBecause ? ` (justificado: "${budget.raisedBecause}")` : " SIN justificar"),
      );
    }
    if (verdict.margin > 10) {
      console.log(
        `[verify-lint-budget] AVISO: quedan ${verdict.margin} avisos de margen; ` +
          `puedes BAJAR el presupuesto a ${real} y el gate seguirá en verde`,
      );
    }
    for (const p of verdict.problems) console.error(`[verify-lint-budget] ${p}`);
  }

  if (!verdict.ok) process.exit(1);
  if (!has("--json")) {
    console.log("[verify-lint-budget] OK: el presupuesto de avisos se respeta.");
  }
  process.exit(0);
}

// El módulo se importa desde el test → no ejecutar el flujo principal.
const EJECUCION_DIRECTA =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (EJECUCION_DIRECTA) main();