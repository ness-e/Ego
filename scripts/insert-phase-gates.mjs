#!/usr/bin/env node
/**
 * Inyecta en las "Matrices de Compuertas de Extracción e Inspección Previa" de
 * `docs/roadmap/Backlog.md` las compuertas de los repos de referencia que
 * todavía no estaban en ellas.
 *
 * De dónde sale el mapeo: de la columna "Relaciones Ego" (y, como respaldo,
 * de cualquier ID de tarea presente en la fila) de cada compuerta del catálogo
 * (`docs/review/backlog-<repo>.md`, tabla §2). Ese ID de tarea determina la
 * fase, y por tanto en qué matriz debe aparecer la compuerta.
 *
 * Es idempotente: una compuerta que ya está en la matriz de su fase no se
 * vuelve a insertar.
 *
 * Uso: node scripts/insert-phase-gates.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const REVIEW = join(ROOT, "docs", "review");
const BACKLOG = join(ROOT, "docs", "roadmap", "Backlog.md");
const DRY = process.argv.includes("--dry-run");

/** Prefijo de tarea de Ego -> fase. */
const FASE = {
  CORE: "01", ACT: "02", SUB: "03", CHAR: "03", CANV: "04", DEC: "05",
  KB: "06", TASK: "07", WIDG: "07", DS: "08", DOM: "09", REC: "10",
  SEC: "11", INT: "03", DIST: "12",
};
const TASK_RE = /\b(CORE|ACT|SUB|CHAR|CANV|DEC|KB|TASK|WIDG|DS|DOM|REC|SEC|INT|DIST)-(\d{2})\b/g;

/**
 * Backlogs cuyo nombre de fichero NO coincide con el slug de su ficha.
 * Sin este mapa, el inyector generaría enlaces rotos (`hermes.md` en vez de
 * `hermes-agent.md`).
 */
const FICHA_ALIAS = { hermes: "hermes-agent" };

/** Ficheros de ficha que existen de verdad en docs/extractions/. */
const FICHAS = new Set(
  readdirSync(join(ROOT, "docs", "extractions"))
    .filter((x) => x.endsWith(".md") && x !== "README.md")
    .map((x) => x.replace(/\.md$/, "")),
);

const DECISION = {
  ok: "📥 Ya asimilado y cableado (caller verificado)",
  pen: "📥 Asimilar y cablear — detalle en la ficha",
  dis: "🚫 Descartada — fundamento en la ficha",
  fut: "⏳ Diferida — destino en la ficha",
};

function slugFromFile(file) {
  return file.replace(/^backlog-/, "").replace(/\.md$/, "");
}

function short(text, max = 78) {
  const t = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > 40 ? sp : max).trimEnd()}…`;
}

// ── 1. catálogo de compuertas ───────────────────────────────────────────────
const gates = [];
for (const f of readdirSync(REVIEW).filter((x) => /^backlog-.*\.md$/.test(x))) {
  const slug = slugFromFile(f);
  // la ficha puede tener otro nombre (p. ej. backlog-hermes.md -> hermes-agent.md)
  const ficha = FICHA_ALIAS[slug] ?? slug;
  if (!FICHAS.has(ficha)) { console.warn(`  aviso: sin ficha para ${f} (slug=${slug})`); continue; }
  const lines = readFileSync(join(REVIEW, f), "utf8").split(/\r?\n/);
  let inSec = false;
  for (const l of lines) {
    if (/^##\s*\d*\.?\s*Catálogo Detallado/i.test(l)) { inSec = true; continue; }
    if (inSec && /^##\s/.test(l)) break;
    if (!inSec) continue;
    const c = l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
    if (c.length < 10) continue;
    const m = /^`?([A-Z0-9]{3,5}-\d+)`?$/.exec(c[0]);
    if (!m) continue;
    const id = m[1];
    const st = /✅/.test(c[6]) ? "ok" : /🚫/.test(c[6]) ? "dis" : /🆕/.test(c[6]) ? "pen" : /⏳/.test(c[6]) ? "fut" : null;
    if (!st) continue;
    // IDs de tarea presentes en la fila, excluyendo el propio ID de la compuerta
    const row = c.join(" | ");
    const ids = new Set();
    for (const t of row.matchAll(TASK_RE)) {
      const tid = `${t[1]}-${t[2]}`;
      if (tid !== id) ids.add(tid);
    }
    const fases = [...new Set([...ids].map((t) => FASE[t.split("-")[0]]).filter(Boolean))];
    gates.push({ id, slug: ficha, patron: short(c[2]), tareas: [...ids].sort(), fases, st });
  }
}

// ── 2. compuertas ya presentes en Backlog.md ────────────────────────────────
const lines = readFileSync(BACKLOG, "utf8").split(/\r?\n/);
const already = new Set();
for (const l of lines) {
  const m = /^\|\s*`([A-Z0-9]{3,5}-\d+)`\s*\|\s*([a-z0-9-]+)\s*\|/.exec(l);
  if (m) already.add(m[1]);
}

// ── 3. inserción por fase ────────────────────────────────────────────────────
const HEAD = /^### .*Matriz de Compuertas de Extracción e Inspección Previa \(Fase (\d{2})\)/;
const out = [];
let current = null;
const inserted = [];
const unassigned = [];

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const h = HEAD.exec(l);
  if (h) { current = h[1]; out.push(l); continue; }

  // ¿estamos en la tabla de la matriz actual? (siguiente fila que empieza por |)
  if (current && /^\|/.test(l)) {
    out.push(l);
    // se comprueba si la SIGUIENTE línea sigue siendo de la tabla: si no, es el final
    const next = lines[i + 1];
    if (next !== undefined && !/^\|/.test(next)) {
      const rows = gates
        .filter((g) => g.fases.includes(current) && !already.has(g.id))
        .sort((a, b) => a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id));
      for (const g of rows) {
        const tareas = g.tareas.length ? g.tareas.map((t) => `\`${t}\``).join(", ") : "—";
        out.push(
          `| \`${g.id}\` | ${g.slug} | ${g.patron} | [\`${g.slug}.md\`](../extractions/${g.slug}.md) | ${tareas} | ${DECISION[g.st]} | ${g.st === "ok" ? "✅ Completada" : g.st === "dis" ? "🚫 Descartada (con justificación)" : g.st === "pen" ? "🆕 Pendiente" : "⏳ Futura (fase)"} |`,
        );
        inserted.push({ fase: current, ...g });
      }
    }
    continue;
  }
  if (current && l.trim() === "" && !/^\|/.test(lines[i + 1] ?? "")) current = null;
  out.push(l);
}

for (const g of gates) {
  if (!g.fases.length) unassigned.push(g);
}

if (DRY) {
  console.log(`[dry-run] se insertarían ${inserted.length} filas en ${new Set(inserted.map((r) => r.fase)).size} fases`);
  for (const r of inserted) console.log(`  Fase ${r.fase}  ${r.id.padEnd(8)} ${r.slug.padEnd(16)} ${r.patron.slice(0, 60)}`);
  if (unassigned.length) {
    console.log(`\n${unassigned.length} compuertas sin fase asignable (no se insertan):`);
    for (const g of unassigned) console.log(`  ${g.id} (${g.slug})`);
  }
} else {
  writeFileSync(BACKLOG, out.join("\n"), "utf8");
  console.log(`insertadas ${inserted.length} filas de compuerta en las matrices por fase`);
  for (const f of [...new Set(inserted.map((r) => r.fase))].sort()) {
    console.log(`  Fase ${f}: ${inserted.filter((r) => r.fase === f).length} filas nuevas`);
  }
  if (unassigned.length) {
    console.log(`\n${unassigned.length} compuertas sin fase asignable (no insertadas):`);
    for (const g of unassigned) console.log(`  ${g.id} (${g.slug}) — ${g.patron.slice(0, 60)}`);
  }
}
