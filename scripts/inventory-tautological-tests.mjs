#!/usr/bin/env node
// scripts/inventory-tautological-tests.mjs — T8 (EGO-FIND-63): inventario de
// tests que afirman sobre TEXTO DE FUENTE.
//
// PATRÓN TAUTOLÓGICO (el que rompe sin cambio de comportamiento):
//   1. se lee un fichero de CÓDIGO con `readFileSync`/`readFile`,
//   2. el resultado se asigna a una variable,
//   3. y esa variable se usa en `expect(...).toContain(...)` / `.toMatch(...)`.
//
// NO es tautológico (y no se reporta):
//   · `expect(valorDeRuntime).toContain(...)` — comprueba COMPORTAMIENTO.
//   · `expect(cadenaLiteral).not.toContain(CANARIO)` — comprueba REDACCIÓN.
//   · `expect(artefactoDeBuild).toContain(...)` — comprueba el ARTEFACTO
//     (p.ej. el HTML que se empaqueta), que es un contrato de entrega.
//
// Salida: tabla por fichero con el nº de asserts de texto de fuente y la
// zona (A2/A3/A4/A7) a la que pertenece → alimenta el handoff.
//
// USO: node scripts/inventory-tautological-tests.mjs [--json]
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["packages", "apps", "tests"];
const SKIP = new Set(["node_modules", "dist", "out", "release", "coverage", "vendor", ".git"]);

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(join(dir, e.name), out);
    } else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/** Zona de propiedad (para el handoff). */
function zoneOf(rel) {
  if (rel.startsWith("tests/")) return "A7";
  if (rel.startsWith("apps/desktop/renderer/floating/vendor/")) return "A6";
  if (rel.startsWith("apps/")) return "A4";
  if (
    rel.startsWith("packages/memory/") ||
    rel.startsWith("packages/knowledge/") ||
    rel.startsWith("packages/runtime/") ||
    rel.startsWith("packages/models/") ||
    rel.startsWith("packages/decision/") ||
    rel.startsWith("packages/execution/") ||
    rel.startsWith("packages/events/") ||
    rel.startsWith("packages/security/") ||
    rel.startsWith("packages/tool-call-repair/")
  ) {
    return "A2";
  }
  return "A3";
}

const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
files.sort();

const findings = [];
for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const src = readFileSync(abs, "utf8");
  const lines = src.split(/\r?\n/);

  // 1. Variables asignadas a una lectura de fichero.
  const sourceVars = new Map(); // var -> { line, path }
  lines.forEach((line, i) => {
    const m = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:readFileSync|readFile)\s*\(/.exec(line);
    if (m) sourceVars.set(m[1], { line: i + 1, path: line.trim() });
  });
  if (sourceVars.size === 0) continue;

  // 2. Asserts sobre esas variables.
  let hits = 0;
  const detail = [];
  lines.forEach((line, i) => {
    for (const v of sourceVars.keys()) {
      if (new RegExp(`expect\\([^)]*\\b${v}\\b[^)]*\\)\\s*\\.\\s*(?:not\\.)?to(?:Contain|Match|Be)\\(`).test(line)) {
        hits += 1;
        detail.push({ line: i + 1, text: line.trim().slice(0, 120) });
      }
    }
  });
  if (hits > 0) {
    findings.push({ file: rel, zone: zoneOf(rel), hits, detail });
  }
}

findings.sort((a, b) => b.hits - a.hits);
const byZone = {};
for (const f of findings) byZone[f.zone] = (byZone[f.zone] ?? 0) + f.hits;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: findings.length, byZone, findings }, null, 2));
} else {
  console.log(`[inventory-tautological] ${findings.length} fichero(s) con asserts sobre texto de fuente`);
  console.log(`[inventory-tautological] asserts por zona: ${JSON.stringify(byZone)}`);
  for (const f of findings) {
    console.log(`\n${f.file}  [${f.zone}]  (${f.hits})`);
    for (const d of f.detail) console.log(`   ${d.line}: ${d.text}`);
  }
}
