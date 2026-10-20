#!/usr/bin/env node
/**
 * Auditoría de compuertas del catálogo de extracción de Ego.
 *
 * Verifica, para cada repo de referencia con ficha en docs/extractions/:
 *   1. Que la tabla "Estado real verificado" de la ficha y la tabla "Catálogo
 *      Detallado" del backlog tienen el MISMO conjunto de IDs.
 *   2. Que cada fila cierra en exactamente uno de los 4 estados canónicos
 *      (✅ Completada · 🚫 Descartada · 🆕 Pendiente · ⏳ Futura) — 0 filas
 *      en el limbo (AGENTS.md §4).
 *      El estado se lee de la COLUMNA declarada como "Estado" en la cabecera
 *      de la tabla, nunca por coincidencia de texto en toda la fila (evita
 *      falsos positivos con frases como "no es `🆕 Pendiente`").
 *   3. Que el recuento declarado en la ficha y en el backlog coincide con las
 *      filas reales.
 *   4. Que los IDs son contiguos (1..N) sin huecos ni duplicados.
 *
 * Los repos heredados cuyo formato no se puede parsear se listan como
 * NO CANÓNICO (auditoría manual); no son error.
 *
 * Uso: node scripts/audit-extraction-gates.mjs
 * Exit 0 = todo coherente; exit 1 = hay discrepancias.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const EXTRACTIONS = join(ROOT, "docs", "extractions");
const REVIEW = join(ROOT, "docs", "review");

// slug de ficha -> slug de backlog (el catálogo heredado usa backlog-hermes.md)
const BACKLOG_ALIAS = { "hermes-agent": "hermes" };

const STATE_RE = { ok: /✅/, dis: /🚫/, pen: /🆕/, fut: /⏳/ };
const STATE_KEYS = ["ok", "dis", "pen", "fut"];
const STATE_LABEL = { ok: "✅ Completada", dis: "🚫 Descartada", pen: "🆕 Pendiente", fut: "⏳ Futura" };

const cells = (line) => {
  const t = line.trim();
  if (!t.startsWith("|")) return [];
  return t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
};

/** Sección de markdown: desde el encabezado que encaja con startRe hasta el
 *  siguiente encabezado de nivel IGUAL O SUPERIOR (no corta en subsecciones). */
function section(lines, startRe) {
  const s = lines.findIndex((l) => startRe.test(l));
  if (s < 0) return null;
  const startLevel = (lines[s].match(/^#+/) || ["#"])[0].length;
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= startLevel) { e = i; break; }
  }
  return lines.slice(s, e);
}

/**
 * Localiza en un bloque de líneas la tabla que contiene IDs con prefijo y
 * devuelve las filas con el estado leído de la columna "Estado".
 */
function tableRows(block, prefix) {
  const re = new RegExp(`^\\|\\s*\`?${prefix}-(\\d+)\`?\\s*\\|`);
  const hits = block.map((l, i) => ({ l, i })).filter(({ l }) => re.test(l));
  if (hits.length === 0) return null;

  // la cabecera de la tabla es la fila con "---" más cercana por encima
  let header = null;
  for (const h of hits) {
    for (let j = h.i - 1; j >= 0; j--) {
      const c = cells(block[j]);
      if (c.length && c.some((x) => /^-+$/.test(x) || /^:?-+:?$/.test(x))) {
        header = cells(block[j - 1] ?? block[j]);
        break;
      }
      if (c.length && !c.every((x) => x === "")) { header = c; break; }
    }
    if (header) break;
  }
  let stateIdx = header ? header.findIndex((h) => /^Estado/i.test(h.replace(/[*`]/g, ""))) : -1;
  if (stateIdx < 0) stateIdx = 2; // layout canónico de la ficha: ID | Patrón | Estado | ...

  const out = [];
  for (const h of hits) {
    const c = cells(h.l);
    const raw = c[stateIdx] ?? "";
    const head = raw.replace(/^[*`\s]+/, "");
    let state = null;
    for (const k of STATE_KEYS) if (STATE_RE[k].test(head)) { state = k; break; }
    out.push({ id: Number(re.exec(h.l)[1]), state, line: h.l });
  }
  return { rows: out, stateIdx, header };
}

const tally = (rows) => {
  const c = { ok: 0, dis: 0, pen: 0, fut: 0, none: 0 };
  for (const r of rows) { if (r.state === null) c.none++; else c[r.state]++; }
  return c;
};
const fmt = (c) => `${c.ok}/${c.dis}/${c.pen}/${c.fut}`;

/** Recuento declarado en una línea con 4 pares número+estado. */
function parseDeclaredLine(line) {
  if (!line) return null;
  const m = [...line.matchAll(/(\d+)\s*`?\s*(?:✅|🚫|🆕|⏳)/g)];
  if (m.length < 4) return null;
  return `${m[0][1]}/${m[1][1]}/${m[2][1]}/${m[3][1]}`;
}

/** Recuento declarado en una TABLA "| ✅ | 🚫 | 🆕 | ⏳ | Total |" + fila numérica. */
function parseCountTable(lines) {
  const heads = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^\|/.test(l) && /✅/.test(l) && /🚫/.test(l) && /🆕/.test(l) && /⏳/.test(l));
  for (const h of heads) {
    for (let i = h.i + 1; i < Math.min(h.i + 4, lines.length); i++) {
      const c = cells(lines[i]);
      if (c.length >= 4 && c.slice(0, 4).every((x) => /^\d+$/.test(x.replace(/[*`]/g, "")))) {
        const v = c.slice(0, 4).map((x) => x.replace(/[*`]/g, ""));
        return `${v[0]}/${v[1]}/${v[2]}/${v[3]}`;
      }
    }
  }
  return null;
}

/** Recuento declarado: busca en todo el documento tabla o línea. */
function declaredCount(lines) {
  const t = parseCountTable(lines);
  if (t) return t;
  for (const l of lines) {
    if (/recuento/i.test(l)) {
      const d = parseDeclaredLine(l);
      if (d) return d;
    }
  }
  return null;
}

const fichas = readdirSync(EXTRACTIONS)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .sort();

const problems = [];
const warnings = [];
const rows = [];
let legacy = 0;
let totalRows = 0;

for (const ficha of fichas) {
  const slug = ficha.replace(/\.md$/, "");
  const backlogSlug = BACKLOG_ALIAS[slug] ?? slug;
  const backlogPath = join(REVIEW, `backlog-${backlogSlug}.md`);
  if (!existsSync(backlogPath)) {
    problems.push(`${slug}: SIN backlog (docs/review/backlog-${backlogSlug}.md ausente)`);
    continue;
  }
  const fl = readFileSync(join(EXTRACTIONS, ficha), "utf8").split(/\r?\n/);
  const bl = readFileSync(backlogPath, "utf8").split(/\r?\n/);

  const fSec = section(fl, /^#{1,4}\s*\d*\.?\s*Estado real verificado/i);
  const bSec = section(bl, /^#{1,4}\s*\d*\.?\s*Catálogo Detallado/i);
  if (!fSec || !bSec) {
    legacy++;
    rows.push({ slug, canonical: false, note: "sección de estado/catálogo no detectada" });
    continue;
  }

  const probe = fSec.find((l) => /^\|\s*`?[A-Z0-9]+-\d+/.test(l));
  const prefix = probe ? /`?([A-Z0-9]+)-\d+/.exec(probe)[1] : null;
  if (!prefix) {
    legacy++;
    rows.push({ slug, canonical: false, note: "prefijo de IDs no deducible" });
    continue;
  }

  const F = tableRows(fSec, prefix);
  const B = tableRows(bSec, prefix);
  if (!F || !B) {
    legacy++;
    rows.push({ slug, canonical: false, note: `tabla no canónica (ficha=${F ? F.rows.length : 0}, backlog=${B ? B.rows.length : 0} filas)` });
    continue;
  }

  const fc = tally(F.rows);
  const bc = tally(B.rows);
  const fIds = F.rows.map((r) => r.id).sort((a, b) => a - b);
  const bIds = B.rows.map((r) => r.id).sort((a, b) => a - b);
  const sameSet = fIds.join(",") === bIds.join(",");

  const n = fIds.length;
  const contiguous = fIds.join(",") === Array.from({ length: n }, (_, i) => i + 1).join(",");
  const dupes = [...new Set(fIds.filter((v, i) => fIds.indexOf(v) !== i))];

  const stateMismatches = [];
  for (const r of F.rows) {
    const o = B.rows.find((x) => x.id === r.id);
    if (!o) { stateMismatches.push(`${prefix}-${r.id}: ausente en backlog`); continue; }
    if (o.state !== r.state) {
      stateMismatches.push(`${prefix}-${r.id}: ficha=${r.state ?? "SIN ESTADO"} backlog=${o.state ?? "SIN ESTADO"}`);
    }
  }

  const fDecl = declaredCount(fl);
  const bDecl = declaredCount(bl);
  const noEstado = fc.none + bc.none;

  if (!sameSet) problems.push(`${slug}: conjuntos de IDs distintos ficha=[${fIds}] backlog=[${bIds}]`);
  if (!contiguous) problems.push(`${slug}: IDs no contiguos -> ${fIds.join(",")}`);
  if (dupes.length) problems.push(`${slug}: IDs duplicados -> ${dupes.join(",")}`);
  if (noEstado) problems.push(`${slug}: ${noEstado} fila(s) sin estado canónico (en el limbo)`);
  if (stateMismatches.length) problems.push(`${slug}: estado distinto entre ficha y backlog -> ${stateMismatches.join(" | ")}`);
  if (fDecl !== fmt(fc)) problems.push(`${slug}: recuento de la FICHA no coincide -> declarado=${fDecl ?? "NO DECLARADO"} real=${fmt(fc)}`);
  if (bDecl !== fmt(bc)) problems.push(`${slug}: recuento del BACKLOG no coincide -> declarado=${bDecl ?? "NO DECLARADO"} real=${fmt(bc)}`);

  totalRows += n;
  rows.push({
    slug, prefix, canonical: true, n, fc, fDecl, bDecl,
    ok: sameSet && contiguous && noEstado === 0 && stateMismatches.length === 0 && fDecl === fmt(fc) && bDecl === fmt(bc),
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("slug", 18) + pad("pref", 6) + pad("n", 4) + pad("real ✅/🚫/🆕/⏳", 18) + pad("ficha", 12) + pad("backlog", 12) + "estado");
for (const r of rows) {
  if (!r.canonical) { console.log(pad(r.slug, 18) + pad("-", 6) + pad("-", 4) + pad("-", 18) + pad("-", 12) + pad("-", 12) + "NO CANÓNICO (" + r.note + ")"); continue; }
  console.log(
    pad(r.slug, 18) + pad(r.prefix, 6) + pad(r.n, 4) + pad(fmt(r.fc), 18) +
    pad(r.fDecl ?? "-", 12) + pad(r.bDecl ?? "-", 12) + (r.ok ? "OK" : "REVISAR")
  );
}
const can = rows.filter((r) => r.canonical);
const tot = can.reduce((a, r) => ({ ok: a.ok + r.fc.ok, dis: a.dis + r.fc.dis, pen: a.pen + r.fc.pen, fut: a.fut + r.fc.fut }), { ok: 0, dis: 0, pen: 0, fut: 0 });
console.log(`\nAuditados (formato canónico): ${can.length} repos · ${totalRows} tareas`);
console.log(`Recuento agregado: ✅${tot.ok} · 🚫${tot.dis} · 🆕${tot.pen} · ⏳${tot.fut} · en el limbo=0`);
console.log(`No canónicos (auditoría manual): ${legacy}`);

if (warnings.length) {
  console.log(`\n${warnings.length} AVISO(S):`);
  for (const w of warnings) console.log("  - " + w);
}
if (problems.length) {
  console.log(`\n${problems.length} PROBLEMA(S):`);
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
console.log("\nOK: 0 filas en el limbo, recuentos y estados coherentes entre ficha y backlog.");
