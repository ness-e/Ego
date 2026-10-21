#!/usr/bin/env node
/**
 * Verifica que la matriz de compuertas de extracción de `docs/roadmap/Backlog.md`
 * es COHERENTE con el catálogo canónico (`docs/review/backlog-*.md`), que es la
 * fuente de verdad de los estados.
 *
 * Comprueba, para cada fila de compuerta de Backlog.md:
 *   1. que el ID existe en el catálogo (la numeración sigue a la ficha canónica);
 *   2. que el token de estado del INICIO de la celda coincide con el estado
 *      canónico (✅ / 🚫 / 🆕 / ⏳).
 *
 * El token se lee del INICIO de la celda a propósito: las anotaciones de la
 * celda contienen referencias a tareas ya completadas (`SEC-04 ✅`), que no son
 * el estado de la compuerta.
 *
 * Uso: node scripts/verify-backlog-gates.mjs
 * Exit 0 = coherente; exit 1 = hay discrepancias.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const REVIEW = join(ROOT, "docs", "review");
const BACKLOG = join(ROOT, "docs", "roadmap", "Backlog.md");

const TOKEN = { ok: "✅", dis: "🚫", pen: "🆕", fut: "⏳" };

// ── estados canónicos desde los backlogs ─────────────────────────────────────
const canon = new Map();
for (const f of readdirSync(REVIEW).filter((x) => /^backlog-.*\.md$/.test(x))) {
  const lines = readFileSync(join(REVIEW, f), "utf8").split(/\r?\n/);
  let inSec = false;
  for (const l of lines) {
    if (/^##\s*\d*\.?\s*Catálogo Detallado/i.test(l)) { inSec = true; continue; }
    if (inSec && /^##\s/.test(l)) break;
    if (!inSec) continue;
    const c = l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
    if (c.length < 7) continue;
    const m = /^`?([A-Z0-9]{3,5}-\d+)`?$/.exec(c[0]);
    if (!m) continue;
    const s = c[6];
    const key = Object.keys(TOKEN).find((k) => s.includes(TOKEN[k]));
    if (key) canon.set(m[1], key);
  }
}

// ── matriz de compuertas de Backlog.md ───────────────────────────────────────
const lines = readFileSync(BACKLOG, "utf8").split(/\r?\n/);
const GATE = /^\|\s*`([A-Z0-9]{3,5}-\d+)`\s*\|\s*([a-z0-9-]+)\s*\|/;
let ok = 0;
const bad = [];
const unknown = [];

for (const l of lines) {
  const m = GATE.exec(l);
  if (!m) continue;
  const [, id] = m;
  const want = canon.get(id);
  const cells = l.split("|").map((x) => x.trim());
  const cell = cells[cells.length - 2];
  const got = Object.keys(TOKEN).find((k) => cell.startsWith(TOKEN[k]));
  if (!want) { unknown.push(`${id}: no existe en el catálogo canónico`); continue; }
  if (got === want) ok++;
  else bad.push(`${id}: Backlog=${got ?? "sin token"} · catálogo=${want} · celda=[${cell.slice(0, 70)}]`);
}

console.log(`filas de compuerta coherentes con el catálogo canónico: ${ok}`);
if (unknown.length) {
  console.log(`\nIDs sin entrada en el catálogo (${unknown.length}):`);
  for (const u of unknown) console.log("  - " + u);
}
if (bad.length) {
  console.log(`\nDISCREPANCIAS (${bad.length}):`);
  for (const b of bad) console.log("  - " + b);
  process.exit(1);
}
console.log("OK: la matriz de compuertas de Backlog.md coincide con el catálogo canónico.");
