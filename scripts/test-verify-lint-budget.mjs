#!/usr/bin/env node
// scripts/test-verify-lint-budget.mjs — TDD de la puerta del presupuesto de lint.
//
// Casos (todos contra la FUNCIÓN pura `evaluateBudget` y contra el BINARIO, con
// `--count` para no lanzar oxlint en cada caso):
//
//   1. presupuesto respetado (recuento real = presupuesto)      → exit 0
//   2. REGRESIÓN: presupuesto por debajo del recuento real       → exit 1
//   3. SUBIDA sin justificar: `maxWarnings` inflado             → exit 1
//   4. SUBIDA justificada + recuento real también por encima     → exit 0
//   5. presupuesto tightened (max < previous)                   → exit 0
//
// Uso: node scripts/test-verify-lint-budget.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const GATE = join(HERE, "verify-lint-budget.mjs");
const { evaluateBudget } = await import(
  new URL("./verify-lint-budget.mjs", import.meta.url).href
);

let failures = 0;

/** Ejecuta el gate con un presupuesto y un recuento forzados. */
function runGate(budget, count) {
  const dir = mkdtempSync(join(tmpdir(), "a7-budget-"));
  const file = join(dir, "budget.json");
  writeFileSync(file, JSON.stringify(budget, null, 2), "utf8");
  let code = 0;
  let out = "";
  try {
    out = execFileSync(
      process.execPath,
      [GATE, "--budget", file, "--count", String(count)],
      { cwd: ROOT, encoding: "utf8" },
    );
  } catch (err) {
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    code = err.status ?? 1;
  }
  rmSync(dir, { recursive: true, force: true });
  return { code, out };
}

const B = (max, previous, raisedBecause = "") => ({
  maxWarnings: max,
  previousMaxWarnings: previous,
  raisedBecause,
});

const CASES = [
  {
    name: "1. presupuesto respetado (real == presupuesto)",
    budget: B(350, 350),
    count: 350,
    expect: 0,
  },
  {
    name: "2. REGRESIÓN: presupuesto por debajo del recuento real",
    budget: B(300, 300),
    count: 317,
    expect: 1,
  },
  {
    name: "3. SUBIDA sin justificar: maxWarnings inflado",
    budget: B(999, 350),
    count: 317,
    expect: 1,
  },
  {
    name: "4. SUBIDA justificada Y el recuento real también subió",
    budget: B(400, 350, "código nuevo de A2 con avisos nuevos"),
    count: 380,
    expect: 0,
  },
  {
    name: "5. presupuesto APRETADO (max < previous)",
    budget: B(300, 350),
    count: 290,
    expect: 0,
  },
];

console.log("=== TDD de la puerta del presupuesto de lint ===\n");
for (const c of CASES) {
  // (a) la función pura
  const pure = evaluateBudget({
    real: c.count,
    max: c.budget.maxWarnings,
    previous: c.budget.previousMaxWarnings,
    raisedBecause: c.budget.raisedBecause,
  });
  const pureOk = pure.ok === (c.expect === 0);
  // (b) el binario (exit code real)
  const r = runGate(c.budget, c.count);
  const binOk = r.code === c.expect;
  const ok = pureOk && binOk;
  if (!ok) failures++;
  console.log(`${ok ? "OK   " : "FALLO"} ${c.name}`);
  console.log(`        función=${pure.ok ? "ok" : "KO"} · binario exit=${r.code} (esperado ${c.expect})`);
  if (!ok) {
    for (const l of r.out.split(/\r?\n/)) {
      if (l.trim()) console.log(`        ${l.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 170)}`);
    }
  }
}
console.log(`\n=== casos fallidos: ${failures} ===`);
process.exit(failures ? 1 : 0);
