#!/usr/bin/env node
// scripts/check-docs-lint.mjs — B4: gate de markdownlint con LÍNEA BASE.
//
// POR QUÉ NO UN GATE DE MARKDOWNLINT PURO:
//   El corpus de `docs/` (293 ficheros) arrastra **8 362 violaciones**
//   (MD013 line-length 4 565 · MD060 table-column-style 3 931 · MD022 1 211 ·
//   MD032 1 052 · …). Esas violaciones son PREEXISTENTES: el gate se añadió
//   después y nunca estuvo en verde → en la práctica el job `docs-lint`
//   estaba ROJO POR DISEÑO y nadie lo miraba.
//
//   Medido: el corpus NO tiene convención de longitud de línea (p90 = 189
//   chars, p99 = 478, máx = 1 252; 7 670 líneas > 120). Y `MD013: {tables:
//   false}` NO las reduce: las líneas largas están en prosa, blockquotes y
//   listas, no en tablas (medido: 4 565 → 4 565).
//
//   Por tanto, un gate "todo verde" exige o reescribir 293 ficheros de 4
//   agentes o desactivar 25 reglas (gate inútil). La salida correcta es un
//   gate DE REGRESIÓN: la línea base congela el estado actual y el gate
//   falla SÓLO ante violaciones NUEVAS (más por fichero y regla).
//
//   Es el mismo patrón que `scripts/audit-debt.mjs --baseline`.
//
// USO:
//   node scripts/check-docs-lint.mjs                       → gate (exit 1 si hay
//                                                             regresión)
//   node scripts/check-docs-lint.mjs --write-baseline       → regenera la base
//   node scripts/check-docs-lint.mjs --baseline <file>      → otra base
//
// VERSIÓN DEL LINTER: `markdownlint-cli2@0.15.0` (la MISMA que usa la action
// `DavidAnson/markdownlint-cli2-action@v18`). Se invoca con `npx --yes` a
// PROPÓSITO: instalarlo como devDependency mete en nuestro árbol
// `micromatch → braces@3.0.3`, que tiene un advisory HIGH **sin fix
// upstream** (`vulnerable=[<=3.0.3]`, `patched=[<0.0.0]`). Con `npx` el
// linter vive fuera de nuestro lockfile → el gate de seguridad sigue en
// 0 críticos / 0 altos.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const MARKDOWNLINT_VERSION = "0.15.0";
const GLOBS = opt("--globs", "docs/**/*.md");
const BASELINE_PATH = join(ROOT, opt("--baseline", "scripts/docs-lint-baseline.json"));
const WRITE_BASELINE = argv.includes("--write-baseline");

/** Ejecuta markdownlint y devuelve su salida (stdout+stderr). */
function runMarkdownlint() {
  try {
    return execFileSync(
      "npx",
      ["--yes", `markdownlint-cli2@${MARKDOWNLINT_VERSION}`, "--ignore-path", ".gitignore", GLOBS],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024,
        // En Windows `npx` es un shim `.cmd`: sin `shell` no es resoluble
        // por `execFileSync` (ENOENT).
        shell: process.platform === "win32" },
    );
  } catch (err) {
    // markdownlint-cli2 sale con código != 0 cuando HAY violaciones: la
    // salida sigue siendo texto parseable. Sólo es un error real si no hay
    // salida parseable.
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    if (!out.trim()) {
      console.error(`[check-docs-lint] markdownlint no pudo ejecutarse: ${err.message}`);
      process.exit(2);
    }
    return out;
  }
}

/**
 * Parsea la salida de markdownlint-cli2 al formato:
 *   `<fichero>:<línea>[:<col>] <REGLA>/<nombre> <mensaje>`
 * Devuelve un mapa `fichero -> { regla: nº }`.
 */
export function parseViolations(output) {
  const perFile = new Map();
  for (const line of output.split(/\r?\n/)) {
    const m = /^([^:\n]+):\d+(?::\d+)?\s+(MD\d+\/[a-z0-9-]+)\s/.exec(line);
    if (!m) continue;
    const file = m[1].trim();
    const rule = m[2];
    if (!perFile.has(file)) perFile.set(file, {});
    const rules = perFile.get(file);
    rules[rule] = (rules[rule] ?? 0) + 1;
  }
  return perFile;
}

const output = runMarkdownlint();
const current = parseViolations(output);

let totalCurrent = 0;
for (const rules of current.values()) {
  for (const n of Object.values(rules)) totalCurrent += n;
}

// ── escritura de la línea base ─────────────────────────────────────────────
if (WRITE_BASELINE) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    markdownlintVersion: MARKDOWNLINT_VERSION,
    globs: GLOBS,
    totalViolations: totalCurrent,
    files: Object.fromEntries([...current.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(
    `[check-docs-lint] línea base escrita: ${relative(ROOT, BASELINE_PATH)} (${totalCurrent} violaciones en ${current.size} ficheros)`,
  );
  process.exit(0);
}

// ── comparación ────────────────────────────────────────────────────────────
if (!existsSync(BASELINE_PATH)) {
  console.error(`[check-docs-lint] no existe la línea base: ${relative(ROOT, BASELINE_PATH)}`);
  console.error("[check-docs-lint] genérala con: node scripts/check-docs-lint.mjs --write-baseline");
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const baseFiles = baseline.files ?? {};

const regressions = [];
for (const [file, rules] of current) {
  const base = baseFiles[file] ?? {};
  for (const [rule, n] of Object.entries(rules)) {
    const before = base[rule] ?? 0;
    if (n > before) {
      regressions.push(`${file}: ${rule} ${before} → ${n} (+${n - before})`);
    }
  }
}
for (const file of Object.keys(baseFiles)) {
  if (!current.has(file)) continue; // reducciones: se permiten (el gate no bloquea)
}

console.log(`[check-docs-lint] markdownlint ${MARKDOWNLINT_VERSION} · ${GLOBS}`);
console.log(
  `[check-docs-lint] violaciones actuales: ${totalCurrent} en ${current.size} ficheros · base: ${baseline.totalViolations ?? "?"} en ${Object.keys(baseFiles).length} ficheros`,
);

if (regressions.length > 0) {
  console.error(`[check-docs-lint] REGRESIONES (${regressions.length}):`);
  for (const r of regressions) console.error(`  ${r}`);
  console.error(
    "[check-docs-lint] gate FALLIDO: se han introducido violaciones nuevas de markdownlint.\n" +
      "               Si son intencionadas, regenera la base: node scripts/check-docs-lint.mjs --write-baseline",
  );
  process.exit(1);
}
console.log("[check-docs-lint] gate OK: ninguna violación nueva respecto a la línea base");
process.exit(0);
