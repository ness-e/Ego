#!/usr/bin/env node
/**
 * verify-extraction-provenance.mjs — PUERTA de procedencia del catálogo de
 * extracción de Ego (EGO-FIND-82).
 *
 * MODELO DE 2 PLANOS (no confundir)
 * --------------------------------
 * 1. CÓDIGO (`packages/**`): un fichero REALMENTE derivado (port literal)
 *    lleva cabecera `Adapted from <upstream> (<LICENCIA>), <ruta de origen>`.
 * 2. FICHA (`docs/extractions/*.md`): documento de análisis escrito por Ego.
 *    NO lleva cabecera `Adapted from` (sería atribución falsa) y sus filas de
 *    catálogo NO pueden afirmar derivación de código. Registra la PROCEDENCIA
 *    del upstream estudiado:
 *        | Licencia del origen | <LICENCIA> — <owner/repo> |
 *        | Commit verificado  | <short-sha>                  |
 *        | Ruta de origen     | `<fichero real del clon>`    |
 *
 * Comprobaciones por ficha (25):
 *   1. la fila `Licencia del origen` existe y declara upstream + licencia;
 *   2. el upstream corresponde a un clon real de `repos-referencia/`
 *      (mapeado por remote, no por nombre: `modelcontextprotocol/servers`
 *      vive en el clon `mcp-servers`);
 *   3. la licencia declarada coincide con el `LICENSE` real de ese clon;
 *   4. el commit declarado coincide con el HEAD del clon;
 *   5. la fila `Commit verificado` existe;
 *   6. la fila `Ruta de origen` existe y el fichero está en el clon;
 *   7. la ficha y su backlog comparten el mismo conjunto de IDs;
 *   8. NINGUNA fila de catálogo afirma derivación de código, salvo que el
 *      fichero de Ego citado lleve la cabecera canónica;
 *   9. NINGUNA fila afirma derivación de `khoj` (AGPL-3.0): decisión del
 *      owner en EGO-FIND-83 ("retirar todo el crédito a khoj").
 *
 * Salida: exit 0 = todo cuadra · exit 1 = hay discrepancias.
 *
 * Uso:
 *   node scripts/verify-extraction-provenance.mjs [--json]
 *   node scripts/verify-extraction-provenance.mjs --root <dir>
 *   node scripts/verify-extraction-provenance.mjs --sin-clones
 *
 * ── MODO DEGRADADO (`--sin-clones`) ─────────────────────────────────────────
 * En CI **no existen** los clones de `repos-referencia/` (es un checkout del
 * repo de Ego, no del upstream). Las comprobaciones 2, 3, 4 y 6 —las que
 * contrastan contra el clon real— no se pueden ejecutar ahí.
 *
 * Con `--sin-clones` la puerta degrada a **verificación estructural**: sigue
 * comprobando (1) la forma de la fila de procedencia, (7) la coherencia de IDs
 * entre ficha y backlog, (8) que ninguna fila afirme derivación sin cabecera
 * canónica y (9) que ninguna fila acredite a `khoj` (AGPL-3.0). Es decir: una
 * regresión real (cabecera mal formada, fichero no clasificado, crédito a AGPL)
 * **se sigue detectando en CI**.
 *
 * La salida dice SIEMPRE en qué modo corrió, para que nadie crea que la
 * verificación fuerte contra los clones se ejecutó en CI.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
/**
 * Modo degradado: no se contrasta contra los clones de `repos-referencia/`
 * (no existen en CI). Ver la cabecera del fichero.
 */
const SIN_CLONES = argv.includes("--sin-clones") || argv.includes("--offline");
const rootIdx = argv.indexOf("--root");
const ROOT = resolve(rootIdx >= 0 ? argv[rootIdx + 1] : join(HERE, ".."));
const EXTRACTIONS = join(ROOT, "docs", "extractions");
const REVIEW = join(ROOT, "docs", "review");
const CLONES = join(ROOT, "repos-referencia");

/** Repos cuyo crédito de derivación está retirado por decisión del owner (EGO-FIND-83). */
const NO_DERIVATION_CREDIT = new Set(["khoj"]);

const BACKLOG_SECTION = /^#{1,4}\s*\d*\.?\s*Cat.logo Detallado/i;
const FICHA_SECTION = /^#{1,4}\s*\d*\.?\s*Estado real verificado/i;
/**
 * Cabecera canonica de atribucion en CODIGO DERIVADO. Se aceptan las dos
 * formas que conviven en el repo (la del README 4.3 y la convencion por
 * paquete que el owner implanto y valida check-attribution.mjs):
 *   1. Adapted from <upstream> (<LIC>), <ruta de origen>
 *   2. ADAPTADO de <ruta> (<LIC>, <copyright>) - ver LICENSE.md
 */
const CANON_HEADER =
  /Adapted from\s+[^\n]*\([^)]+\)\s*,|ADAPTADO de\s+[^\n]*\([^)]*\)[ \t]*\u2014[ \t]*ver LICENSE/i;

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

const listDirs = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

const git = (dir, args) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 8e6 }).trim();
  } catch {
    return null;
  }
};

/** SPDX-id de licencia leído del fichero real del clon. */
function detectLicense(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return "(sin clon)";
  }
  const file =
    entries.find((f) => /^licen[cs]e(\.md|\.txt)?$/i.test(f)) || entries.find((f) => /^notice/i.test(f));
  if (!file) return "(sin fichero de licencia)";
  const head = readFileSync(join(dir, file), "utf8").slice(0, 4000);
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(head)) return "AGPL-3.0";
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(head)) return "LGPL";
  if (/GNU GENERAL PUBLIC LICENSE[\s\S]{0,300}Version 3/i.test(head)) return "GPL-3.0";
  if (/Mozilla Public License[\s\S]{0,300}Version 2/i.test(head)) return "MPL-2.0";
  if (/Apache License[\s\S]{0,300}Version 2\.0/i.test(head)) return "Apache-2.0";
  if (/Permission is hereby granted, free of charge/i.test(head) && /MIT License/i.test(head)) return "MIT";
  if (/Redistribution and use in source and binary forms/i.test(head)) return "BSD-3-Clause";
  if (/Permission to use, copy, modify, and\/or distribute this software/i.test(head)) return "ISC";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(head)) return "GPL";
  return "(sin determinar)";
}

/** Upstream owner/repo de un clon, leído de su remote. */
function upstreamOf(dir) {
  const remote = git(dir, ["config", "--get", "remote.origin.url"]);
  if (!remote) return null;
  const m = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Mapa upstream -> slug del clon (el nombre del repo upstream puede diferir del slug). */
function cloneMap() {
  const map = new Map();
  for (const slug of listDirs(CLONES)) {
    const dir = join(CLONES, slug);
    const up = upstreamOf(dir);
    if (up) map.set(up, slug);
  }
  return map;
}

/**
 * Campo de la tabla de metadatos de una ficha, por nombre.
 * Soporta las DOS formas que usan las 25 fichas:
 *   - vertical:   | Campo | Valor |  +  | Licencia del origen | ... |
 *   - horizontal: | ... | Licencia del origen | ... |  +  una fila de datos
 */
function metaField(lines, name) {
  // vertical: el nombre esta en la primera celda
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const c = splitRow(lines[i]);
    if (!c || c.length < 2) continue;
    if (c[0].trim() === name) return { value: c[1], index: i };
  }
  // horizontal: el nombre esta en la cabecera de la tabla
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const header = splitRow(lines[i]);
    if (!header || header.length < 2) continue;
    const sep = splitRow(lines[i + 1] || "") || [];
    if (sep.length !== header.length || sep.length === 0) continue;
    if (!sep.every((x) => /^:?-+:?$/.test(x))) continue;
    const idx = header.findIndex((h) => h.trim() === name);
    if (idx < 0) continue;
    for (let j = i + 2; j < lines.length; j++) {
      const row = splitRow(lines[j]);
      if (!row || row.length !== header.length) break;
      const v2 = row[idx];
      if (v2 && v2.trim()) return { value: v2, index: j };
    }
    return null;
  }
  return null;
}

/** IDs de la tabla de catálogo de un documento. */
function catalogIds(lines, sectionRe) {
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
  const ids = [];
  const re = /^\|\s*`?([A-Z]+-\d+)`?\s*\|/;
  for (let i = s; i < e; i++) {
    const m = re.exec(lines[i]);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** Filas del catálogo que afirman derivación de código, con el fichero de Ego citado. */
function derivationClaims(lines, sectionRe) {
  const s = lines.findIndex((l) => sectionRe.test(l));
  if (s < 0) return [];
  const level = (lines[s].match(/^#+/) || ["#"])[0].length;
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      e = i;
      break;
    }
  }
  const claims = [];
  const re = /^\|\s*`?([A-Z]+-\d+)`?\s*\|/;
  for (let i = s; i < e; i++) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    if (!/Adapted from/.test(lines[i])) continue;
    const cells = splitRow(lines[i]) || [];
    const text = cells.join(" ");
    const files = [...text.matchAll(/`?((?:packages|apps)\/[A-Za-z0-9_.-/]+\.(?:ts|tsx|js|mjs))`?/g)].map(
      (x) => x[1],
    );
    claims.push({ id: m[1], line: i, files: [...new Set(files)], upstream: (text.match(/Adapted from\s+([^\s(]+)/) || [])[1] });
  }
  return claims;
}

// ── verificación ─────────────────────────────────────────────────────────────
const problems = [];
const rows = [];
const clones = cloneMap();

for (const slug of listSlugs(EXTRACTIONS)) {
  const fichaPath = join(EXTRACTIONS, slug + ".md");
  const backlogName = slug === "hermes-agent" ? "hermes" : slug;
  const backlogPath = join(REVIEW, "backlog-" + backlogName + ".md");
  const fichaText = readFileSync(fichaPath, "utf8");
  const fichaLines = fichaText.split(/\r?\n/);
  const ps = [];
  const add = (m) => ps.push(m);

  // 1) fila de procedencia
  const lic = metaField(fichaLines, "Licencia del origen");
  const commit = metaField(fichaLines, "Commit verificado");
  const origin = metaField(fichaLines, "Ruta de origen");
  if (!lic) add("procedencia-ausente: falta la fila 'Licencia del origen'");
  if (!commit) add("commit-ausente: falta la fila 'Commit verificado'");
  if (!origin) add("ruta-ausente: falta la fila 'Ruta de origen'");

  let upstream = null;
  let license = null;
  if (lic) {
    const m = lic.value.match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/);
    if (!m) add("procedencia-malformada: 'Licencia del origen' no declara upstream");
    else {
      upstream = m[1];
      const lm = lic.value.match(/^([A-Za-z0-9_.-]+)\s+—/);
      license = lm ? lm[1] : null;
      if (!license) add("procedencia-malformada: 'Licencia del origen' no declara licencia");
    }
  }

  // 2-5) CONTRASTE CONTRA EL CLON (omitido en modo degradado: en CI no hay
  //      clones de `repos-referencia/`). Lo que NO depende del clon (la forma
  //      de la fila de procedencia, los IDs ficha↔backlog y el crédito a
  //      `khoj`/cabecera canónica) se comprueba SIEMPRE.
  const cloneSlug = upstream && !SIN_CLONES ? clones.get(upstream) : null;
  if (upstream && !cloneSlug && !SIN_CLONES) {
    add(`upstream-inexistente: ${upstream} no corresponde a ningún clon de repos-referencia/`);
  }
  const cloneDir = cloneSlug ? join(CLONES, cloneSlug) : null;

  // 3) la licencia coincide con el LICENSE real del clon
  if (cloneDir) {
    const realLicense = detectLicense(cloneDir);
    if (license && realLicense !== license) {
      add(`licencia-distinta: la ficha declara ${license}, el LICENSE real del clon dice ${realLicense}`);
    }
  }

  // 4) el commit coincide con el HEAD del clon
  if (cloneDir && commit) {
    const head = (git(cloneDir, ["rev-parse", "--short=7", "HEAD"]) || "").toLowerCase();
    const cited = commit.value.trim().replace(/`/g, "").toLowerCase();
    if (!head) add("commit-desfasado: no se puede leer el HEAD del clon");
    else if (!cited.startsWith(head) && !head.startsWith(cited)) {
      add(`commit-desfasado: la ficha cita ${cited.slice(0, 7)}, el clon está en ${head}`);
    }
  }

  // 5) la ruta de origen existe en el clon
  if (cloneDir && origin) {
    const rel = origin.value.trim().replace(/`/g, "");
    if (!isFile(join(cloneDir, rel))) {
      add(`ruta-inexistente: ${rel} no está en repos-referencia/${cloneSlug}/`);
    }
  }

  // 6) ficha y backlog comparten el mismo conjunto de IDs
  if (existsSync(backlogPath)) {
    const fIds = catalogIds(fichaLines, FICHA_SECTION);
    const bIds = catalogIds(readFileSync(backlogPath, "utf8").split(/\r?\n/), BACKLOG_SECTION);
    if (!fIds || !bIds) {
      add("ids-discrepantes: no se encontró la tabla de catálogo");
    } else {
      const fs2 = new Set(fIds);
      const bs2 = new Set(bIds);
      const onlyF = fIds.filter((i) => !bs2.has(i));
      const onlyB = bIds.filter((i) => !fs2.has(i));
      if (onlyF.length || onlyB.length) {
        add(`ids-discrepantes: sólo en la ficha [${onlyF.join(", ")}] · sólo en el backlog [${onlyB.join(", ")}]`);
      }
    }
  } else {
    add(`backlog-ausente: no existe docs/review/backlog-${backlogName}.md`);
  }

  // 7) ninguna fila de catálogo afirma derivación de código sin cabecera canónica
  //    en el fichero de Ego citado (el único caso legítimo es un port literal).
  const backlogLines = existsSync(backlogPath) ? readFileSync(backlogPath, "utf8").split(/\r?\n/) : [];
  // la misma fila aparece en la ficha y en su backlog: es UNA afirmacion, no dos
  const seen = new Set();
  const claims = [...derivationClaims(fichaLines, FICHA_SECTION), ...derivationClaims(backlogLines, BACKLOG_SECTION)].filter(
    (c) => {
      const key = c.id + "|" + (c.upstream ?? "") + "|" + c.files.join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  );
  for (const claim of claims) {
    if (NO_DERIVATION_CREDIT.has(slug) || (claim.upstream && NO_DERIVATION_CREDIT.has(String(claim.upstream).split("/")[1]))) {
      add(`credito-retirado: ${claim.id} afirma derivación de ${claim.upstream} (EGO-FIND-83 la retiró)`);
      continue;
    }
    const conCabecera = claim.files.filter((f) => {
      const abs = join(ROOT, f);
      if (!isFile(abs)) return false;
      const head = readFileSync(abs, "utf8").split(/\r?\n/).slice(0, 12).join("\n");
      return CANON_HEADER.test(head);
    });
    if (!conCabecera.length) {
      add(
        `derivacion-sin-cabecera: ${claim.id} afirma derivación de código pero ninguno de los ficheros citados [${claim.files.join(", ") || "nenhum"}] lleva la cabecera canónica`,
      );
    }
  }

  rows.push({ slug, upstream, license, clone: cloneSlug, commit: commit?.value?.trim(), origin: origin?.value?.trim(), ok: ps.length === 0 });
  for (const p of ps) problems.push(`${slug}: ${p}`);
}

// ── salida ───────────────────────────────────────────────────────────────────
const MODO = SIN_CLONES ? "degradado (sin clones)" : "completo (con clones)";
if (AS_JSON) {
  console.log(
    JSON.stringify(
      { mode: MODO, sinClones: SIN_CLONES, checked: rows.length, failures: problems.length, rows, problems },
      null,
      2,
    ),
  );
} else {
  console.log(`modo: ${MODO}`);
  if (SIN_CLONES) {
    console.log(
      "AVISO: modo degradado — NO se ha contrastado contra los clones de repos-referencia/:\n" +
        "      upstream, licencia real, commit y ruta de origen NO se verifican aquí.\n" +
        "      Para la verificación fuerte: node scripts/verify-extraction-provenance.mjs (con clones).",
    );
  } else if (!existsSync(CLONES)) {
    console.log(
      `AVISO: no existe ${CLONES} (¿clones no clonados?): las comprobaciones 2-5 no se pueden verificar.`,
    );
  }
  console.log(
    "slug".padEnd(20) + "upstream".padEnd(38) + "licencia".padEnd(14) + "clon".padEnd(20) + "commit".padEnd(10) + "estado",
  );
  for (const r of rows) {
    console.log(
      r.slug.padEnd(20) +
        String(r.upstream ?? "-").padEnd(38) +
        String(r.license ?? "-").padEnd(14) +
        String(r.clone ?? "-").padEnd(20) +
        String(r.commit ?? "-").slice(0, 8).padEnd(10) +
        (r.ok ? "OK" : "FALLA"),
    );
  }
  console.log("");
  if (problems.length === 0) {
    console.log(
      SIN_CLONES
        ? `OK: ${rows.length} fichas con procedencia VERIFICADA ESTRUCTURALMENTE (forma, IDs ficha↔backlog, cabecera canónica y sin crédito a khoj). Sin contraste contra clones.`
        : `OK: ${rows.length} fichas con procedencia verificada (upstream, licencia, commit, ruta de origen e IDs).`,
    );
  } else {
    console.log(`FALLA: ${problems.length} discrepancia(s) en ${rows.length} fichas (modo ${MODO}):`);
    for (const p of problems) console.log("  - " + p);
  }
}
process.exit(problems.length ? 1 : 0);
