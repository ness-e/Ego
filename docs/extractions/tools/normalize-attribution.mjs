#!/usr/bin/env node
/**
 * normalize-attribution.mjs — Generador reproducible de la PROCEDENCIA del
 * upstream en el catálogo de extracción de Ego (EGO-FIND-82, corrección de la
 * Ola 8).
 *
 * MODELO DE 2 PLANOS (no confundir)
 * --------------------------------
 * 1. CÓDIGO (`packages/**`): sólo los ficheros **realmente derivados** (un
 *    port literal) llevan cabecera de fichero
 *    `Adapted from <upstream> (<LICENCIA>), <ruta de origen>`.
 *    Eso lo trabaja A6 (zona `packages/avatar/**`). Este script NO lo hace.
 *
 * 2. FICHA (`docs/extractions/*.md`): la ficha es un **documento de análisis
 *    escrito por Ego**, no una obra derivada del repo de referencia. Por tanto
 *    NO lleva cabecera `Adapted from` (sería una atribución falsa) ni las
 *    filas de catálogo pueden afirmar derivación de código. Lo que sí registra
 *    es la PROCEDENCIA del upstream estudiado:
 *        | Licencia del origen | <LICENCIA> — <owner/repo> |
 *        | Commit verificado  | <short-sha>                  |
 *        | Ruta de origen     | `<fichero real del clon>`    |
 *    y normaliza la fila `Repositorio Origen` a
 *        `repos-referencia/<slug>/` (upstream `<owner/repo>`, commit `<sha>`)
 *
 * Qué hace, por cada una de las 25 fichas:
 *   1. Deriva UPSTREAM del propio clon (`git config --get remote.origin.url`).
 *   2. Deriva la LICENCIA del `LICENSE`/`LICENSE.md`/`NOTICE` real del clon.
 *   3. Deriva el COMMIT real (`git rev-parse --short=7 HEAD`).
 *   4. Deriva la RUTA DE ORIGEN (fichero real del clon) desde la ficha.
 *   5. Elimina cualquier prefijo `Adapted from … — ` de las celdas de
 *      descripción/evidencia (RESTAURA el texto original: la atribución
 *      falsa que esta ola había introducido).
 *   6. Escribe las filas de procedencia DENTRO de la tabla de metadatos, sin
 *      línea en blanco que la parta, y normaliza `Repositorio Origen`.
 *
 * Reglas duras
 * ------------
 *   - NO inventa upstream, licencia, commit ni ruta: todo sale del clon real.
 *   - NO afirma derivación de código en ninguna fila de catálogo.
 *   - NO reescribe el contenido de las fichas: sólo toca la tabla de
 *     metadatos y quita el prefijo de atribución falsa.
 *   - Repara los `||` sin escapar dentro de una celda (rompen la tabla).
 *   - Es IDEMPOTENTE: la 2ª ejecución produce 0 cambios.
 *
 * Uso:
 *   node docs/extractions/tools/normalize-attribution.mjs           # aplica
 *   node docs/extractions/tools/normalize-attribution.mjs --check   # sólo informa
 *   node docs/extractions/tools/normalize-attribution.mjs --json    # informe JSON
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const EXTRACTIONS = join(ROOT, "docs", "extractions");
const REVIEW = join(ROOT, "docs", "review");
const CLONES = join(ROOT, "repos-referencia");

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes("--check");
const AS_JSON = argv.includes("--json");

const BACKLOG_SECTION = /^#{1,4}\s*\d*\.?\s*Cat.logo Detallado/i;
const FICHA_SECTION = /^#{1,4}\s*\d*\.?\s*Estado real verificado/i;

/** Prefijo de atribución falsa introducido en la Ola 8 (se elimina). */
const FALSE_ATTR = /`Adapted from [^`]*`\s*—\s*/g;

// ── utilidades ───────────────────────────────────────────────────────────────
const git = (dir, args) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 8e6 }).trim();
  } catch {
    return null;
  }
};

const listSlugs = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md")
      .map((e) => e.name.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
};

/** Divide una fila de tabla respetando los pipes escapados (`\|`). */
const splitRow = (line) => {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cur = "";
  let esc = false;
  for (const ch of inner) {
    if (esc) {
      cur += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      cur += ch;
      continue;
    }
    if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

const joinRow = (cells) => "| " + cells.join(" | ") + " |";

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};
const isDirPath = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Repara los `||` sin escapar dentro de una fila de tabla (la rompen). */
function repairStrayPipes(lines) {
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const fixed = lines[i].replace(/(?<!\\)\|\|/g, "\\|");
    if (fixed !== lines[i]) {
      lines[i] = fixed;
      n++;
    }
  }
  return n;
}

/** Localiza la tabla de catálogo (ficha: "Estado real verificado"; backlog: "Catálogo Detallado"). */
function findCatalog(lines, sectionRe) {
  const s = lines.findIndex((l) => sectionRe.test(l));
  if (s < 0) return null;
  const level = (lines[s].match(/^#+/) || ["#"])[0].length;
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      e = i;
      break;
    }
  }
  const block = lines.slice(s, e);
  for (let i = 1; i < block.length; i++) {
    const c = splitRow(block[i]) || [];
    if (!c.length || !c.every((x) => /^:?-+:?$/.test(x))) continue;
    const header = splitRow(block[i - 1]) || [];
    const stateIdx = header.findIndex((h) => /^Estado/i.test(h.replace(/[*`]/g, "")));
    if (stateIdx < 0) continue;
    const cols = header.length;
    const re = /^\|\s*`?[A-Z]+-\d+`?\s*\|/;
    const rows = [];
    for (let j = i + 1; j < block.length; j++) {
      if (!re.test(block[j])) break;
      if ((splitRow(block[j]) || []).length !== cols) break;
      rows.push(j);
    }
    if (rows.length) return { start: s, end: e, block, header, stateIdx, cols, rows };
  }
  return null;
}

/** Detecta la tabla de metadatos inicial de una ficha (la primera del documento). */
function findMetadataTable(lines) {
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const c = splitRow(lines[i]);
    if (!c || c.length < 2) continue;
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    const sep = splitRow(lines[i + 1] || "") || [];
    if (sep.length === c.length && sep.length > 0 && sep.every((x) => /^:?-+:?$/.test(x))) {
      return { headerIdx: i, sepIdx: i + 1, cols: c.length, header: c, dataStart: i + 2 };
    }
  }
  return null;
}

/**
 * Índice de la primera línea que ya no pertenece a la tabla de metadatos.
 * REPARA además las tablas partidas: si tras un hueco (línea en blanco) vuelve
 * una fila de tabla, la re-une (una fila huérfana tras un hueco hace que la
 * tabla no se renderice).
 */
function metadataEnd(lines, meta, onRepair) {
  let i = meta.dataStart;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith("|")) {
      i++;
      continue;
    }
    if (l.trim() === "" && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
      lines.splice(i, 1);
      if (onRepair) onRepair();
      continue;
    }
    break;
  }
  return i;
}

/** Detecta el SPDX-id de licencia leyendo el fichero de licencia real del clon. */
function detectLicense(dir) {
  const entries = readdirSync(dir);
  const file =
    entries.find((f) => /^licen[cs]e(\.md|\.txt)?$/i.test(f)) || entries.find((f) => /^notice/i.test(f));
  if (!file) return { license: "(sin determinar)", file: null };
  const head = readFileSync(join(dir, file), "utf8").slice(0, 4000);
  let license = "(sin determinar)";
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(head)) license = "AGPL-3.0";
  else if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(head)) license = "LGPL";
  else if (/GNU GENERAL PUBLIC LICENSE[\s\S]{0,300}Version 3/i.test(head)) license = "GPL-3.0";
  else if (/Mozilla Public License[\s\S]{0,300}Version 2/i.test(head)) license = "MPL-2.0";
  else if (/Apache License[\s\S]{0,300}Version 2\.0/i.test(head)) license = "Apache-2.0";
  else if (/Permission is hereby granted, free of charge/i.test(head) && /MIT License/i.test(head)) license = "MIT";
  else if (/Redistribution and use in source and binary forms/i.test(head)) license = "BSD-3-Clause";
  else if (/Permission to use, copy, modify, and\/or distribute this software/i.test(head)) license = "ISC";
  else if (/GNU GENERAL PUBLIC LICENSE/i.test(head)) license = "GPL";
  return { license, file };
}

/** Upstream owner/repo desde el remote del clon. */
function detectUpstream(dir) {
  const remote = git(dir, ["config", "--get", "remote.origin.url"]);
  if (!remote) return null;
  const m = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Upstream declarado por la propia ficha (último recurso, nunca inventado). */
function detectUpstreamFromFicha(fichaText) {
  const m = fichaText.match(/Adapted from\s+([A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+)/);
  if (m) return m[1];
  const r = fichaText.match(/\b([A-Za-z0-9_.\-]+)\/([A-Za-z0-9_.\-]+)\b/);
  return r ? `${r[1]}/${r[2]}` : null;
}

/** Candidatas a ruta de origen declaradas en "Ubicación en fuente: ...". */
function declaredOriginCandidates(fichaText) {
  const out = [];
  const re = /Ubicaci[oó]n en fuente:([^\n]+)/gi;
  let m;
  while ((m = re.exec(fichaText)) !== null) {
    for (const raw of m[1].split(/[`,;]|\sy\b|\so\b/i)) {
      const p = raw.trim().replace(/^\*+/, "").replace(/^`|`$/g, "").replace(/\/+$/, "");
      if (p && !p.includes(" ") && p.includes("/")) out.push(p);
    }
  }
  return out;
}

/** Candidatas a ruta de origen de la columna "Archivo <Upstream>" del backlog. */
function backlogOriginCandidates(backlogText) {
  const out = [];
  const lines = backlogText.split(/\r?\n/);
  const cat = findCatalog(lines, BACKLOG_SECTION);
  if (!cat) return out;
  for (const rel of cat.rows) {
    const cells = splitRow(lines[cat.start + rel]);
    if (!cells || cells.length !== cat.cols) continue;
    for (const p of pathCandidates(cells[3] ?? "")) out.push(p);
  }
  return out;
}

/** Rutas con aspecto de fichero citadas en un texto. */
function pathCandidates(text) {
  const out = [];
  const re = /(?:^|[\s`("'\[])((?:[A-Za-z0-9_.\-]+\/)+[A-Za-z0-9_.\-]+\.[A-Za-z0-9]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1].replace(/\/+$/, ""));
  return out;
}

/** Normaliza una ruta candidata: quita prefijo de clon, rangos de línea y barra final. */
function cleanCandidate(c, slug) {
  let s = c.trim().replace(/^`|`$/g, "");
  s = s.replace(new RegExp("^repos-referencia/" + esc(slug) + "/"), "");
  s = s.replace(/:\d+(-\d+)?$/, "");
  s = s.replace(/\/+$/, "");
  return s;
}

/** Primer fichero real dentro de un directorio (determinista). */
function firstFileIn(dir, cloneDir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.shift();
    let entries = [];
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries.sort((x, y) => x.name.localeCompare(y.name))) {
      const child = join(cur, e.name);
      if (e.isFile()) {
        if (/\.(ts|tsx|js|mjs|cjs|py|rs|go|md|json|ya?ml)$/i.test(e.name)) {
          return child.slice(cloneDir.length + 1).replace(/\\/g, "/");
        }
      } else if (e.isDirectory() && !e.name.startsWith(".")) {
        stack.push(child);
      }
    }
  }
  return null;
}

/** Primera ruta que existe REALMENTE como fichero en el clon. */
function resolveOrigin(cloneDir, candidates, slug) {
  for (const c of candidates) {
    const clean = cleanCandidate(c, slug);
    if (!clean || clean.includes("..") || clean.startsWith("/")) continue;
    const abs = join(cloneDir, clean);
    if (isFile(abs)) return clean;
    if (isDirPath(abs)) {
      const f = firstFileIn(abs, cloneDir);
      if (f) return f;
    }
  }
  return null;
}

// ── ejecución ────────────────────────────────────────────────────────────────
const slugs = listSlugs(EXTRACTIONS);
if (slugs.length !== 25) {
  console.error(`[normalize-attribution] se esperaban 25 fichas y hay ${slugs.length}`);
}

const report = { fichas: [], unresolved: [], errors: [] };
let changed = 0;
let falseAttrsRemoved = 0;
let pipesRepaired = 0;

for (const slug of slugs) {
  const cloneDir = join(CLONES, slug);
  const fichaPath = join(EXTRACTIONS, slug + ".md");
  const backlogName = slug === "hermes-agent" ? "hermes" : slug;
  const backlogPath = join(REVIEW, "backlog-" + backlogName + ".md");
  let fichaText = readFileSync(fichaPath, "utf8");

  if (!existsSync(cloneDir)) {
    report.errors.push(`${slug}: no existe repos-referencia/${slug}`);
    continue;
  }

  // 1) upstream
  let upstream = detectUpstream(cloneDir);
  let upstreamSource = "remote";
  if (!upstream) {
    upstream = detectUpstreamFromFicha(fichaText);
    upstreamSource = "ficha";
    if (!upstream) {
      report.unresolved.push(`${slug}: sin remote y sin upstream declarable en la ficha`);
      continue;
    }
    report.unresolved.push(`${slug}: upstream tomado de la propia ficha (${upstream}); el clon no tiene remote`);
  }

  // 2) licencia
  const { license, file: licFile } = detectLicense(cloneDir);
  if (license === "(sin determinar)") {
    report.unresolved.push(`${slug}: licencia no determinable en ${licFile ?? "(sin fichero)"}`);
  }

  // 3) commit real
  const head = git(cloneDir, ["rev-parse", "--short=7", "HEAD"]);
  if (!head) {
    report.unresolved.push(`${slug}: no se puede leer el HEAD del clon`);
    continue;
  }

  // 4) ruta de origen (fichero real del clon)
  const backlogText = existsSync(backlogPath) ? readFileSync(backlogPath, "utf8") : "";
  const candidates = [
    ...declaredOriginCandidates(fichaText),
    ...backlogOriginCandidates(backlogText),
    ...pathCandidates(fichaText),
  ];
  let origin = resolveOrigin(cloneDir, candidates, slug);
  if (!origin) {
    const licInClone = readdirSync(cloneDir).find((f) => /^licen[cs]e/i.test(f));
    origin = licInClone ?? null;
    if (!origin) {
      report.unresolved.push(`${slug}: ninguna ruta de origen resoluble`);
      continue;
    }
    report.unresolved.push(`${slug}: ruta de origen resuelta con el LICENSE del clon (${origin})`);
  }

  // ── A) reparar `||` sin escapar (rompen la tabla) ──
  const lines = fichaText.split(/\r?\n/);
  pipesRepaired += repairStrayPipes(lines);

  // ── B) quitar la atribución falsa de las celdas de descripción ──
  const cat = findCatalog(lines, FICHA_SECTION);
  if (cat) {
    for (const rel of cat.rows) {
      const i = cat.start + rel;
      const cells = splitRow(lines[i]);
      if (!cells || cells.length !== cat.cols) continue;
      const before = cells[cat.stateIdx + 1];
      const after = before.replace(FALSE_ATTR, "");
      if (after !== before) {
        cells[cat.stateIdx + 1] = after;
        lines[i] = joinRow(cells);
        falseAttrsRemoved++;
        changed++;
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    FALSE_ATTR.lastIndex = 0;
    if (!FALSE_ATTR.test(lines[i])) continue;
    FALSE_ATTR.lastIndex = 0;
    lines[i] = lines[i].replace(FALSE_ATTR, "");
    falseAttrsRemoved++;
    changed++;
  }
  FALSE_ATTR.lastIndex = 0;

  // ── C) quitar la fila legacy "Atribución" (introducida por la Ola 8) ──
  for (let i = 0; i < lines.length; i++) {
    if (!/^\|\s*Atribuci[oó]n\s*\|/.test(lines[i])) continue;
    lines.splice(i, 1);
    // y la línea en blanco que la separaba (para no partir la tabla)
    if (lines[i] !== undefined && lines[i].trim() === "") lines.splice(i, 1);
    changed++;
    break;
  }

  // ── D) tabla de metadatos: filas de procedencia, dentro y sin partir ──
  const wantLic = `${license} — ${upstream}`;
  const wantCommit = head;
  const wantOrigin = `\`${origin}\``;

  let meta = findMetadataTable(lines);
  if (!meta) {
    // la ficha no tiene tabla de metadatos: se crea una mínima bien formada
    const block = [
      "| Campo | Valor |",
      "|---|---|",
      `| Licencia del origen | ${wantLic} |`,
      `| Commit verificado | ${wantCommit} |`,
      `| Ruta de origen | ${wantOrigin} |`,
      "",
    ];
    const h1 = lines.findIndex((l) => /^#\s/.test(l));
    const at = h1 >= 0 ? h1 + 1 : 0;
    lines.splice(at, 0, ...block);
    changed++;
    meta = findMetadataTable(lines);
  } else {
    const end = metadataEnd(lines, meta, () => {
      changed++;
    });
    const hasRow = (name) => {
      for (let i = meta.dataStart; i < end; i++) {
        const c = splitRow(lines[i]);
        if (c && c.length === meta.cols && c[0].trim() === name) return true;
      }
      return false;
    };
    if (meta.cols === 2) {
      // vertical: se añaden filas dentro de la tabla
      const insert = [];
      if (!hasRow("Licencia del origen")) insert.push(`| Licencia del origen | ${wantLic} |`);
      if (!hasRow("Commit verificado")) insert.push(`| Commit verificado | ${wantCommit} |`);
      if (!hasRow("Ruta de origen")) insert.push(`| Ruta de origen | ${wantOrigin} |`);
      if (insert.length) {
        lines.splice(end, 0, ...insert);
        changed++;
      }
    } else {
      // horizontal: se amplían cabecera, separador y fila de datos
      const header = lines[meta.headerIdx];
      const sep = lines[meta.sepIdx];
      const hc = splitRow(header);
      const sc = splitRow(sep);
      const dc = splitRow(lines[meta.dataStart]);
      if (hc && sc && dc && hc.length === meta.cols && sc.length === meta.cols && dc.length === meta.cols) {
        const addCols = [];
        if (!hc.some((h) => h.trim() === "Licencia del origen")) addCols.push("Licencia del origen");
        if (!hc.some((h) => h.trim() === "Commit verificado")) addCols.push("Commit verificado");
        if (!hc.some((h) => h.trim() === "Ruta de origen")) addCols.push("Ruta de origen");
        if (addCols.length) {
          const values = addCols.map((c) =>
            c === "Licencia del origen" ? wantLic : c === "Commit verificado" ? wantCommit : wantOrigin,
          );
          lines[meta.headerIdx] = joinRow([...hc, ...addCols]);
          lines[meta.sepIdx] = joinRow([...sc, ...addCols.map(() => "---")]);
          lines[meta.dataStart] = joinRow([...dc, ...values]);
          changed++;
        }
      }
    }
  }

  // ── E) normalizar la fila "Repositorio Origen" ──
  {
    const m2 = findMetadataTable(lines);
    if (m2) {
      const end2 = metadataEnd(lines, m2, () => {
        changed++;
      });
      for (let i = m2.dataStart; i < end2; i++) {
        const c = splitRow(lines[i]);
        if (!c || c.length !== m2.cols) break;
        const idx = c.findIndex((x) => /repos-referencia\//.test(x));
        if (idx < 0) continue;
        const want = `\`repos-referencia/${slug}/\` (upstream \`${upstream}\`, commit \`${head}\`, origen \`${origin}\`)`;
        if (c[idx] !== want) {
          c[idx] = want;
          lines[i] = joinRow(c);
          changed++;
        }
        break;
      }
    }
  }

  // ── F) higiene de la tabla de metadatos: una linea en blanco antes y
  //         exactamente una despues (MD022 / MD058 / MD012) ──
  {
    const m3 = findMetadataTable(lines);
    if (m3) {
      const end3 = metadataEnd(lines, m3, () => {
        changed++;
      });
      // (1) colapsar los huecos posteriores a la tabla a exactamente uno
      let e = end3;
      while (e < lines.length && lines[e].trim() === "") e++;
      if (e - end3 > 1) {
        lines.splice(end3, e - end3, "");
        changed++;
      }
      // (2) (despues, para no desplazar los indices) una linea en blanco antes
      const hdr = findMetadataTable(lines);
      if (hdr && hdr.headerIdx > 0 && lines[hdr.headerIdx - 1].trim() !== "") {
        lines.splice(hdr.headerIdx, 0, "");
        changed++;
      }
    }
  }

  if (!CHECK_ONLY) writeFileSync(fichaPath, lines.join("\n"), "utf8");

  // ── F) quitar la atribución falsa del backlog ──
  if (existsSync(backlogPath)) {
    const bl = readFileSync(backlogPath, "utf8").split(/\r?\n/);
    pipesRepaired += repairStrayPipes(bl);
    const bcat = findCatalog(bl, BACKLOG_SECTION);
    if (bcat) {
      for (const rel of bcat.rows) {
        const i = bcat.start + rel;
        const cells = splitRow(bl[i]);
        if (!cells || cells.length !== bcat.cols) continue;
        const before = cells[bcat.stateIdx + 1];
        const after = before.replace(FALSE_ATTR, "");
        if (after !== before) {
          cells[bcat.stateIdx + 1] = after;
          bl[i] = joinRow(cells);
          falseAttrsRemoved++;
          changed++;
        }
      }
    }
    if (!CHECK_ONLY) writeFileSync(backlogPath, bl.join("\n"), "utf8");
  }

  report.fichas.push({ slug, upstream, upstreamSource, license, commit: head, origin });
}

// ── salida ───────────────────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(JSON.stringify({ changed, falseAttrsRemoved, pipesRepaired, ...report }, null, 2));
} else {
  console.log(
    `fichas procesadas: ${report.fichas.length} · cambios: ${changed} · prefijos de atribución falsa eliminados: ${falseAttrsRemoved} · pipes sueltos reparados: ${pipesRepaired}`,
  );
  console.log("");
  console.log(
    "slug".padEnd(20) + "upstream".padEnd(38) + "licencia".padEnd(14) + "commit".padEnd(10) + "origen",
  );
  for (const f of report.fichas) {
    console.log(
      f.slug.padEnd(20) + f.upstream.padEnd(38) + f.license.padEnd(14) + f.commit.padEnd(10) + String(f.origin).slice(0, 44),
    );
  }
  if (report.unresolved.length) {
    console.log("\nNO RESUELTOS (requieren decisión humana):");
    for (const u of report.unresolved) console.log("  - " + u);
  }
  if (report.errors.length) {
    console.log("\nERRORES:");
    for (const e of report.errors) console.log("  - " + e);
  }
}
process.exit(report.errors.length ? 1 : 0);
