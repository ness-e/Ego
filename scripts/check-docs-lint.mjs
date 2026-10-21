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

/**
 * Fichero de exclusiones que se pasa a markdownlint-cli2 con `--ignore-path`.
 *
 * QUIRK DEL LINTER (medido el 2026-10-20, markdownlint-cli2 0.15.0):
 * `--ignore-path <fichero>` hace que el linter **incluya ese mismo fichero en
 * el conjunto a lintar**, aunque el glob no lo mencione. Probado con un
 * fichero de ignore de 2 líneas: "Linting: 2 file(s)" con `--ignore-path` y
 * "Linting: 1 file(s)" sin él.
 *
 * Consecuencia en este repo: `.gitignore` (cuyo contenido son comentarios
 * `# …`, que markdownlint lee como encabezados ATX) entraba en el conjunto y
 * aportaba **43 violaciones espurias** a la línea base, más un fichero
 * fantasma en el recuento. No es deuda de documentación: es un fichero que no
 * es markdown.
 *
 * Se conservan las exclusiones (`.gitignore` es la ÚNICA fuente de verdad de
 * qué se ignora: `docs/.vitepress/dist/`, las carpetas `archive` de
 * `plans` y `tasks`, …) y se descarta en el parseo el fichero de ignore.
 * Alternativa descartada: un `.markdownlint-cli2.jsonc` con `ignores` propio
 * → duplicaría los patrones y se desincronizaría de `.gitignore`.
 */
const IGNORE_PATH = join(ROOT, ".gitignore");

/** Ejecuta markdownlint y devuelve su salida (stdout+stderr). */
function runMarkdownlint() {
  try {
    return execFileSync(
      "npx",
      ["--yes", `markdownlint-cli2@${MARKDOWNLINT_VERSION}`, "--ignore-path", IGNORE_PATH, GLOBS],
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
 *
 * Descarta el fichero de exclusiones (ver `IGNORE_PATH`): markdownlint-cli2
 * lo linta como si fuera markdown, y no lo es.
 */
export function parseViolations(output) {
  const perFile = new Map();
  const ignoreKey = relative(ROOT, IGNORE_PATH).split(/[\\/]/).join("/");
  for (const line of output.split(/\r?\n/)) {
    const m = /^([^:\n]+):\d+(?::\d+)?\s+(MD\d+\/[a-z0-9-]+)\s/.exec(line);
    if (!m) continue;
    const file = m[1].trim();
    const norm = file.split(/[\\/]/).join("/");
    if (norm === ignoreKey || norm.endsWith("/" + ignoreKey)) continue;
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

/**
 * POLÍTICA DE LA LÍNEA BASE (Ola 3, A7).
 *
 * La ola escribe documentos en PARALELO: cada agente redacta su handoff, su
 * informe y sus notas mientras los demás hacen lo mismo. Con una política de
 * "todo violation es regresión", el gate se ponía rojo cada vez que un agente
 * escribía un fichero, y la única forma de volver a verde era recalibrar →
 * una puerta que se apaga sola y que nadie miraba.
 *
 * Distinción operativa (la misma que ya usaba el brief):
 *
 *   · **Documento MAL FORMADO** → el documento se lee o se renderiza MAL:
 *     una tabla con el nº de celdas equivocado (MD056), un fence sin lenguaje
 *     (MD040), un bloque de código con estilo incoherente (MD046). Esto es un
 *     defecto real: se ARREGLA, nunca se absorbe.
 *
 *   · **Formato** → líneas largas, blancos, estilo de viñeta, estilo de
 *     énfasis, estilo de encabezado. En un **worklog** (handoff, informe,
 *     nota de agente) es el formato esperado de ese tipo de documento: lo
 *     absorbe la línea base.
 *
 *   · **Documento canónico** (`docs/product`, `docs/architecture`, …): su
 *     formato sí importa → cualquier violación nueva suya es regresión.
 *
 * Regla final: una violación nueva FALLA si el documento es canónico O si la
 * regla produce un documento mal formado. El resto se absorbe (y la base
 * crece sola, conTraza en la salida).
 */

/** Reglas cuyo fallo deja el documento mal formado (nunca se absorben). */
const MALFORMED_RULES = new Set([
  "MD056/table-column-count", // tabla con nº de celdas distinto → se renderiza mal
  "MD040/fenced-code-language", // fence sin lenguaje → sin resaltado
  "MD046/code-block-style", // estilo de bloque incoherente
  "MD033/no-inline-html", // HTML crudo que no se sabe renderizar
]);

/** Árboles de docs CANÓNICOS: su formato sí es un contrato. */
const CANONICAL_PREFIXES = [
  "docs/product/",
  "docs/architecture/",
  "docs/design/",
  "docs/adr/",
  "docs/user/",
  "docs/engineering/",
  "docs/testing/",
  "docs/deployment/",
  "docs/operations/",
  "docs/references/",
  "docs/roadmap/",
  "docs/extractions/",
  "docs/review/",
];

const isCanonical = (file) =>
  CANONICAL_PREFIXES.some((p) => file.replace(/\\/g, "/").startsWith(p));

const regressions = [];
const absorbed = [];
const absorbedByFile = new Map();
for (const [file, rules] of current) {
  const base = baseFiles[file] ?? {};
  const canonical = isCanonical(file);
  for (const [rule, n] of Object.entries(rules)) {
    const before = base[rule] ?? 0;
    if (n <= before) continue;
    if (canonical || MALFORMED_RULES.has(rule)) {
      regressions.push(`${file}: ${rule} ${before} → ${n} (+${n - before})`);
    } else {
      // formato en un worklog → se absorbe (y la base se amplía sola)
      absorbed.push(`${file}: ${rule} ${before} → ${n} (+${n - before})`);
      absorbedByFile.set(file, { ...(absorbedByFile.get(file) ?? {}), [rule]: n });
    }
  }
}

console.log(`[check-docs-lint] markdownlint ${MARKDOWNLINT_VERSION} · ${GLOBS}`);
console.log(
  `[check-docs-lint] violaciones actuales: ${totalCurrent} en ${current.size} ficheros · base: ${baseline.totalViolations ?? "?"} en ${Object.keys(baseFiles).length} ficheros`,
);
if (absorbed.length > 0) {
  console.log(
    `[check-docs-lint] absorbidas (formato en worklogs, no canónicos): ${absorbed.length}`,
  );
  for (const a of absorbed.slice(0, 10)) console.log(`  · ${a}`);
  if (absorbed.length > 10) console.log(`  · … y ${absorbed.length - 10} más`);
  // la base absorbe estas violaciones: se amplía sola y con traza
  const nextFiles = { ...baseFiles };
  for (const [file, rules] of absorbedByFile) {
    nextFiles[file] = { ...(nextFiles[file] ?? {}), ...rules };
  }
  const nextTotal = Object.values(nextFiles).reduce(
    (acc, rules) => acc + Object.values(rules).reduce((a, b) => a + b, 0),
    0,
  );
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        markdownlintVersion: MARKDOWNLINT_VERSION,
        globs: GLOBS,
        totalViolations: nextTotal,
        files: Object.fromEntries(
          [...new Set([...Object.keys(nextFiles), ...current.keys()])]
            // se descartan las entradas de ficheros que ya NO existen: si no,
            // la base arrastra ruido y su recuento no cuadra con el real
            .filter((f) => current.has(f))
            .sort((a, b) => a.localeCompare(b))
            .map((f) => [f, nextFiles[f] ?? {}]),
        ),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    `[check-docs-lint] línea base ampliada a ${nextTotal} violaciones (absorción de formato)`,
  );
}

if (regressions.length > 0) {
  console.error(`[check-docs-lint] REGRESIONES (${regressions.length}):`);
  for (const r of regressions) console.error(`  ${r}`);
  console.error(
    "[check-docs-lint] gate FALLIDO: documento canónico con violaciones nuevas, o documento MAL FORMADO.\n" +
      "               Las violaciones de formato en worklogs se absorben solas (ver línea de arriba).\n" +
      "               Para regenerar la base entera: node scripts/check-docs-lint.mjs --write-baseline",
  );
  process.exit(1);
}
console.log("[check-docs-lint] gate OK: ninguna violación nueva en docs canónicos ni documentos mal formados");
process.exit(0);
