#!/usr/bin/env node
/**
 * Sincroniza la matriz de compuertas de extracción de `docs/roadmap/Backlog.md`
 * con el catálogo canónico (`docs/review/backlog-*.md`), que es la fuente de
 * verdad de los estados.
 *
 * Hace dos cosas, en este orden:
 *   1. RENUMERA las filas de Fase 12 que usaban la numeración Ola 1
 *      (HERM-14 = packaging, HERM-15 = asarUnpack, HERM-16 = firma) por la
 *      numeración canónica de la ficha (HERM-16 = packaging/auto-update, que
 *      ya cubre `asarUnpack`; la firma digital no tiene compuerta de
 *      extracción: es una tarea pura de Ego, `DIST-04`).
 *   2. SINCRONIZA la columna "Estado" de las 80 filas de compuerta con el
 *      estado real de evidencia (el mismo criterio que normalizó las fichas en
 *      la auditoría del 2026-10-19: estado = evidencia verificada por grep, no
 *      memoria histórica de la compuerta).
 *
 * Conserva las anotaciones entre paréntesis de cada celda (BLOQUEOS del
 * owner, verificaciones, referencias a tareas).
 *
 * Uso: node scripts/sync-backlog-gates.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const REVIEW = join(ROOT, "docs", "review");
const BACKLOG = join(ROOT, "docs", "roadmap", "Backlog.md");

const CANON = {
  "✅ Completada": "✅ Completada",
  "🚫 Descartada": "🚫 Descartada (con justificación)",
  "🆕 Pendiente": "🆕 Pendiente",
  "⏳ Futura": "⏳ Futura (fase)",
};

// ── 1. estados canónicos desde los backlogs ──────────────────────────────────
const states = new Map();
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
    const key = Object.keys(CANON).find((k) => s.includes(k));
    if (key) states.set(m[1], CANON[key]);
  }
}

/**
 * Normaliza la celda de estado de una fila de compuerta:
 *   `TOKEN` | `TOKEN (nota)` | `TOKEN — nota` | `TOKEN (con justificación) — nota`
 * Conserva la anotación (BLOQUEOS del owner, verificaciones) sin duplicar
 * paréntesis cuando el propio token canónico ya los lleva.
 */
function normalizeStateCell(cell, canon) {
  let rest = cell.trim();
  if (rest.startsWith(canon)) {
    rest = rest.slice(canon.length).trim();
  } else {
    const base = canon.replace(/\s*\(.*\)\s*$/, "").trim();
    if (rest.startsWith(base)) rest = rest.slice(base.length).trim();
    else {
      for (const k of Object.keys(CANON)) {
        if (rest.startsWith(k)) { rest = rest.slice(k.length).trim(); break; }
      }
    }
  }
  // quita la envoltura de paréntesis solo si está balanceada
  if (rest.startsWith("(") && rest.endsWith(")")) {
    let depth = 0;
    let balanced = true;
    for (const ch of rest) {
      if (ch === "(") depth++;
      else if (ch === ")") { depth--; if (depth < 0) { balanced = false; break; } }
    }
    if (balanced && depth === 0) rest = rest.slice(1, -1).trim();
  }
  if (!rest) return ` ${canon} `;
  // colapsa separadores repetidos que pudieron累积 en pasadas anteriores
  rest = rest.replace(/(?:^|\s)[—–-](?:\s*[—–-])+\s*/g, " ").replace(/^\s+/, "");
  // no duplicar el separador si la anotación ya empieza por él
  if (/^[—–-]/.test(rest)) return ` ${canon} ${rest} `;
  return canon.includes("(") ? ` ${canon} — ${rest} ` : ` ${canon} (${rest}) `;
}

// ── 2. renumeración de las filas de empaquetado (Fase 12) ────────────────────
const lines = readFileSync(BACKLOG, "utf8").split(/\r?\n/);
const out = [];
let renumbered = 0;
let synced = 0;
let changed = 0;

const GATE_ROW = /^\|\s*`([A-Z0-9]{3,5}-\d+)`\s*\|\s*([a-z0-9-]+)\s*\|/;

for (let i = 0; i < lines.length; i++) {
  let l = lines[i];

  // --- renumeración: packaging (Ola 1 HERM-14) -> canónica HERM-16 ---------
  if (GATE_ROW.test(l) && /`HERM-14`/.test(l) && /empaquetado con/i.test(l)) {
    l = l.replace(/`HERM-14`/, "`HERM-16`");
    renumbered++;
  } else if (GATE_ROW.test(l) && /`HERM-15`/.test(l) && /asarUnpack/i.test(l)) {
    // se fusiona con la fila de packaging: mismo compuerta (HERM-16)
    l = l.replace(/`HERM-15`/, "`HERM-16`");
    renumbered++;
  } else if (GATE_ROW.test(l) && /`HERM-16`/.test(l) && /firmado digital/i.test(l)) {
    // la firma digital no tiene compuerta de extracción en la ficha canónica
    l = l.replace(/`HERM-16`/, "—");
    l = l.replace(
      /\|(\s*)\|(\s*📥[^|]*)\|/,
      "|$1Sin compuerta de extracción en la ficha canónica: tarea pura de Ego, bloqueada por certificados del owner (DIST-04).$2|",
    );
    renumbered++;
  }

  // --- renumeración también en las referencias "Compuerta:" de las filas ------
  // de tarea (DIST-01..04, DIST-10), que usaban la numeración Ola 1.
  if (/Compuertas?:/.test(l) && !GATE_ROW.test(l)) {
    const before = l;
    // packaging + asarUnpack -> HERM-16 ; la firma digital no tiene compuerta
    l = l.replace(/Compuerta: `HERM-1[45]`/g, "Compuerta: `HERM-16`");
    l = l.replace(/Compuerta: `HERM-16`/g, (m2, p1, offset, str) =>
      /firmado digital|Authenticode|Notary/i.test(str) ? "Compuerta: —" : m2);
    if (l !== before) { renumbered++; out.push(l); continue; }
  }

  // --- sincronización del estado con la evidencia real ----------------------
  const m = GATE_ROW.exec(l);
  if (m) {
    const id = m[1];
    const canon = states.get(id);
    if (canon) {
      const cells = l.split("|");
      const last = cells.length - 2; // última celda antes del cierre
      const before = cells[last];
      const after = normalizeStateCell(before, canon);
      if (after !== before) {
        cells[last] = after;
        l = cells.join("|");
        synced++;
        changed++;
      }
    } else {
      console.warn(`  aviso: ${id} no tiene estado canónico (no se toca)`);
    }
  }
  out.push(l);
}

writeFileSync(BACKLOG, out.join("\n"), "utf8");
console.log(
  `matriz de compuertas sincronizada: ${renumbered} fila(s) renumerada(s), ${synced} estado(s) sincronizado(s) sobre ${changed} fila(s) modificada(s)`,
);
