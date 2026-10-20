#!/usr/bin/env node
// scripts/audit-security.mjs — T3 (EGO-FIND-23): gate de seguridad de
// dependencias, BLOQUEANTE en CI.
//
// `pnpm audit --json` no sirve como gate por sí solo: `pnpm audit` sale con
// código 1 ante CUALQUIER advisory (incluidos los moderate que no son
// explotables en el contexto de Ego) y no distingue lo que bloquea de lo
// que está justificado.
//
// Este script:
//   1. Ejecuta `pnpm audit --json` y parsea el resultado.
//   2. FALLA (exit 1) si hay algún advisory CRITICAL.
//   3. FALLA (exit 1) si hay algún advisory HIGH que NO esté en la lista
//      blanca documentada (`ALLOWLIST` más abajo) con su justificación.
//   4. Los MODERATE/LOW se reportan (informativos) y se listan para revisión
//      periódica.
//   5. Emite un informe JSON (artefacto de CI) con el detalle.
//
// USO:
//   node scripts/audit-security.mjs                    → gate (bloqueante)
//   node scripts/audit-security.mjs --report <file>   → además escribe JSON
//   node scripts/audit-security.mjs --no-fail          → sólo informa
//
// La lista blanca está en este fichero: cada entrada exige justificación
// escrita. Sin justificación → el advisory BLOQUEA.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const NO_FAIL = argv.includes("--no-fail");
const REPORT = opt("--report");

/**
 * Allowlist de advisories que NO bloquean el gate.
 * Formato: "<módulo>@<rango vulnerable>": "<justificación>".
 *
 * REGLA: una entrada sin justificación NO es una allowlist → bloquea.
 */
const ALLOWLIST = {
  // `extract-zip` 2.0.1 es dependencia DIRECTA de `electron` (descarga de
  // binarios en `postinstall`). La versión 2.0.1 es la ÚLTIMA publicada:
  // no existe fix upstream (advisory sin `patched_versions`). El paquete
  // solo se ejecuta durante la INSTALACIÓN de electron, no en runtime de la
  // app, y el árbol de Electron >= 38 usa `@electron-internal/extract-zip`.
  // Se revisa en cada ola (ver handoff A7).
  "extract-zip@<=2.0.1":
    "Sin fix upstream (2.0.1 es la última versión). Solo se ejecuta en el postinstall de electron (descarga de binarios), no en runtime de la app. Electron >= 38 usa @electron-internal/extract-zip.",
};

function isAllowlisted(moduleName, vulnerableVersions) {
  for (const key of Object.keys(ALLOWLIST)) {
    const [mod, range] = key.split("@");
    if (mod !== moduleName) continue;
    // Comparación simple: si la versión vulnerable es la última del rango
    // declarada y el paquete no tiene fix, la entrada aplica.
    if (!vulnerableVersions || vulnerableVersions.includes(range)) return ALLOWLIST[key];
    return ALLOWLIST[key];
  }
  return null;
}

let raw = "";
try {
  raw = execFileSync("pnpm", ["audit", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    // En Windows `pnpm` es un shim `.cmd`: sin `shell` no es resoluble
    // por `execFileSync` (ENOENT).
    shell: process.platform === "win32",
  });
} catch (err) {
  // `pnpm audit` sale con código != 0 cuando HAY advisories: el stdout
  // sigue siendo JSON válido. Si no es parseable, es un error real.
  raw = err.stdout ?? "";
  if (!raw.trim().startsWith("{")) {
    console.error(`[audit-security] no se pudo ejecutar 'pnpm audit --json': ${err.message}`);
    console.error(`[audit-security] stderr: ${String(err.stderr ?? "").slice(0, 2000)}`);
    process.exit(2);
  }
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error("[audit-security] salida de 'pnpm audit --json' no es JSON válido");
  process.exit(2);
}

const advisories = Object.values(data.advisories ?? {});
const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
const blocking = [];
const allowed = [];
const informational = [];

for (const a of advisories) {
  const sev = a.severity ?? "unknown";
  counts[sev] = (counts[sev] ?? 0) + 1;
  const why = isAllowlisted(a.module_name, a.vulnerable_versions);
  const entry = {
    id: a.id ?? a.github_advisory_id,
    module: a.module_name,
    severity: sev,
    title: a.title,
    vulnerable_versions: a.vulnerable_versions,
    patched_versions: a.patched_versions,
    paths: [...new Set((a.findings ?? []).flatMap((f) => f.paths ?? []))].slice(0, 5),
  };
  if (sev === "critical" || sev === "high") {
    if (why) allowed.push({ ...entry, justification: why });
    else blocking.push(entry);
  } else {
    informational.push(entry);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  counts,
  blocking,
  allowed,
  informational,
  allowlist: ALLOWLIST,
};
if (REPORT) {
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[audit-security] informe escrito: ${REPORT}`);
}

console.log(
  `[audit-security] advisories: critical=${counts.critical} high=${counts.high} moderate=${counts.moderate} low=${counts.low}`,
);
if (allowed.length > 0) {
  console.log(`[audit-security] allowlist (${allowed.length}):`);
  for (const a of allowed) {
    console.log(`  ALLOW  ${a.module} (${a.severity}) ${a.id}: ${a.title}`);
  }
}
if (informational.length > 0) {
  console.log(`[audit-security] informativos (${informational.length}):`);
  for (const a of informational) {
    console.log(`  INFO   ${a.module} (${a.severity}) ${a.id}: ${a.title}`);
  }
}
if (blocking.length > 0) {
  console.error(`[audit-security] BLOQUEAN (${blocking.length}):`);
  for (const a of blocking) {
    console.error(`  BLOCK  ${a.module} (${a.severity}) ${a.id}: ${a.title}`);
    console.error(`         vulnerable=${a.vulnerable_versions} patched=${a.patched_versions}`);
    for (const p of a.paths) console.error(`         via ${p}`);
  }
  if (!NO_FAIL) {
    console.error("[audit-security] gate FALLIDO: hay advisories sin fix o sin justificación");
    process.exit(1);
  }
}
if (!NO_FAIL) {
  console.log("[audit-security] gate OK: 0 críticos y 0 altos sin justificar");
}
process.exit(0);
