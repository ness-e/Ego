#!/usr/bin/env node
// A5-S3: prueba en ROJO del gate de caller de producción.
//
// Construye un FIXTURE mínimo (docs/extractions + docs/review + packages/) y
// lo audita con `scripts/audit-extraction-gates.mjs --root <fixture>`:
//
//   CASO 1 (ROJO):   una fila ✅ Completada que cita un caller INEXISTENTE
//                     → el gate DEBE fallar.
//   CASO 2 (VERDE):  la misma fila pero con un caller REAL en packages/
//                     → el gate DEBE pasar.
//
// Uso: node a5-s3-test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const REPO = join(import.meta.dirname, "..").replace(/\\/g, "/") + "/";
const GATE = join(REPO, "scripts", "audit-extraction-gates.mjs");

const E = "✅"; // Completada
const D = "🚫"; // Descartada
const P = "🆕"; // Pendiente
const F = "⏳"; // Futura

function fixture(citation) {
  const root = mkdtempSync(join(tmpdir(), "a7-s3-"));
  mkdirSync(join(root, "docs", "extractions"), { recursive: true });
  mkdirSync(join(root, "docs", "review"), { recursive: true });
  mkdirSync(join(root, "packages", "memory"), { recursive: true });
  // un caller REAL de producción
  writeFileSync(
    join(root, "packages", "memory", "RealCaller.ts"),
    "export function realCaller(): string {\n  return 'hola';\n}\n",
    "utf8",
  );
  const row = `| \`DEMO-01\` | Patrón | ${E} Completada | ${citation} (caller) |`;
  const count = `**Recuento:** 1 \`${E} Completada\` · 0 \`${D} Descartada\` · 0 \`${P} Pendiente\` · 0 \`${F} Futura\` - **1 tareas**.`;
  writeFileSync(
    join(root, "docs", "extractions", "demo.md"),
    [
      "# Demo",
      "",
      "## 4. Estado real verificado (2026-10-21) ##",
      "",
      "| ID | Patrón | Estado | Evidencia / Fundamento |",
      "| --- | --- | :---: | --- |",
      row,
      "",
      count,
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(root, "docs", "review", "backlog-demo.md"),
    [
      "# Backlog demo",
      "",
      "## 2. Catálogo Detallado de Extracción ##",
      "",
      "| ID | Patrón | Estado | Evidencia / Fundamento |",
      "| --- | --- | :---: | --- |",
      row,
      "",
      count,
      "",
    ].join("\n"),
    "utf8",
  );
  return root;
}

function run(root) {
  // sin `shell`: la ruta del repo tiene espacios ("VantaDB Proyect") y con
  // shell:true las comillas se pierden → "Cannot find module 'C:\Users\Eros\VantaDB'".
  const r = spawnSync(process.execPath, [GATE, "--root", root], {
    cwd: REPO,
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

let failures = 0;

// ── CASO 1 (ROJO): caller inexistente → el gate DEBE fallar ────────────────
{
  const root = fixture("`packages/memory/NoExisteEnElRepo.ts:10`");
  const r = run(root);
  const ok = r.code === 1;
  if (!ok) failures++;
  console.log(`${ok ? "OK   " : "FALLO"} CASO 1 — ✅ Completada con caller INEXISTENTE → exit=${r.code} (esperado 1)`);
  const line = r.out.split(/\r?\n/).find((l) => l.includes("SIN caller"));
  if (line) console.log(`        ${line.trim().slice(0, 160)}`);
  rmSync(root, { recursive: true, force: true });
}

// ── CASO 2 (VERDE): caller real → el gate DEBE pasar ───────────────────────
{
  const root = fixture("`packages/memory/RealCaller.ts:1`");
  const r = run(root);
  const ok = r.code === 0;
  if (!ok) failures++;
  console.log(`${ok ? "OK   " : "FALLO"} CASO 2 — ✅ Completada con caller REAL → exit=${r.code} (esperado 0)`);
  const line = r.out.split(/\r?\n/).find((l) => l.includes("OK:") || l.includes("PROBLEMA"));
  if (line) console.log(`        ${line.trim().slice(0, 160)}`);
  if (!ok) {
    console.log("        --- salida completa del gate ---");
    for (const l of r.out.split(/\r?\n/)) {
      if (l.trim()) console.log(`        ${l.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 200)}`);
    }
  }
  rmSync(root, { recursive: true, force: true });
}

// ── CASO 3 (ROJO): la cita es sólo un comentario → el gate DEBE fallar ────
{
  const root = fixture("`packages/memory/SoloComentario.ts:1`");
  // crear el fichero pero con la línea citada siendo un comentario
  writeFileSync(
    join(root, "packages", "memory", "SoloComentario.ts"),
    "// esta línea es un comentario, no un caller\nexport const x = 1;\n",
    "utf8",
  );
  const r = run(root);
  const ok = r.code === 1;
  if (!ok) failures++;
  console.log(`${ok ? "OK   " : "FALLO"} CASO 3 — ✅ Completada cuyo caller es un COMENTARIO → exit=${r.code} (esperado 1)`);
  rmSync(root, { recursive: true, force: true });
}

console.log(`\n=== casos fallidos: ${failures} ===`);
process.exit(failures ? 1 : 0);
