#!/usr/bin/env node
// scripts/fix-md-structure.mjs — fixer DIRIGIDO POR EL LINTER para las
// reglas de estructura del markdown: MD003 (setext → atx), MD004 (estilo de
// viñeta) y MD012 (blancos consecutivos).
//
// DISEÑO (Ola 3, A7): sin heurísticas. Se ejecuta markdownlint, se leen SUS
// líneas y se corrige EXACTAMENTE eso.
//
//   Formato del informe de markdownlint-cli2 (medido):
//     MD003 → `file:línea MD003/heading-style ... [Expected: atx; Actual: setext]`
//     MD004 → `file:línea:columna MD004/ul-style ... [Expected: dash; Actual: asterisk]`
//     MD012 → `file:línea MD012/no-multiple-blanks ... [Expected: 1; Actual: 2]`
//
// GARANTÍAS:
//   · MD003: el TEXTO del encabezado se conserva literalmente; sólo cambia
//     el marcador (subrayado/línea de `=` → `##`/`#`).
//   · MD004: sólo cambia el carácter de la viñeta.
//   · MD012: sólo se borran líneas en blanco.
//   · Nunca se borra texto. Idempotente.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const VERSION = "0.15.0";
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("uso: node fix-md-structure.mjs <fichero.md> [...]");
  process.exit(2);
}

function lint(file) {
  let out = "";
  try {
    out = execFileSync(
      "npx",
      ["--yes", `markdownlint-cli2@${VERSION}`, file],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
        shell: true,
      },
    );
  } catch (err) {
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  return out.replace(/\x1b\[[0-9;]*m/g, "");
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reMD003 = (n) =>
  new RegExp(
    `^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD003/heading-style.*Actual: (setext|atx_closed)\\]`,
  );
const reMD004 = (n) =>
  new RegExp(
    `^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD004/ul-style.*\\[Expected: (\\w+); Actual: (\\w+)\\]`,
  );
const reMD012 = (n) =>
  new RegExp(`^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD012/no-multiple-blanks`);
const reMD022 = (n) =>
  new RegExp(
    `^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD022/blanks-around-headings.*(Above|Below)\\]`,
  );
const reMD031 = (n) =>
  new RegExp(
    `^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD031/blanks-around-fences.*(Above|Below)\\]`,
  );
const reMD032 = (n) =>
  new RegExp(`^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD032/blanks-around-lists`);
const reMD028 = (n) =>
  new RegExp(`^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD028/no-blanks-blockquote`);
const reMD049 = (n) =>
  new RegExp(
    `^.*${esc(n)}:(\\d+)(?::\\d+)?\\s+MD049/emphasis-style.*\\[Expected: (\\w+); Actual: (\\w+)\\]`,
  );

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const name = basename(file);
  let lines = original.split(/\r?\n/);
  let md003 = 0;
  let md004 = 0;
  let md012 = 0;
  let md022 = 0;
  let md031 = 0;
  let md032 = 0;
  let md028 = 0;
  let md049 = 0;

  // ── MD003: normalizar al estilo `atx` ──────────────────────────────────
  //   · setext (subrayado / `===`) → `##` / `#`
  //   · atx_closed (`## Título ##`) → `## Título`
  for (let k = 0; k < 80; k++) {
    let hit = null;
    for (const m of lint(file).split(/\r?\n/)) {
      const mm = reMD003(name).exec(m);
      if (mm) {
        hit = { line: Number(mm[1]), actual: mm[2] };
        break;
      }
    }
    if (hit === null) break;
    const i = hit.line - 1;
    if (i < 0 || i >= lines.length) break;
    if (hit.actual === "setext") {
      if (i + 1 >= lines.length) break;
      const text = lines[i];
      const marker = lines[i + 1];
      if (
        !/^\s*(=+|-+)\s*$/.test(marker) ||
        text.trim() === "" ||
        /^#{1,6}\s/.test(text)
      )
        break;
      const level = marker.trim().startsWith("=") ? 1 : 2;
      lines[i] = `${"#".repeat(level)} ${text.trim()}`;
      lines.splice(i + 1, 1);
    } else {
      // atx_closed → atx: quitar el cierre `#` (y su espacio previo)
      const closed = /^(#{1,6})\s+(.*?)\s+#+\s*$/.exec(lines[i]);
      if (!closed) break;
      lines[i] = `${closed[1]} ${closed[2]}`;
    }
    md003++;
  }

  // ── MD022 / MD031 / MD032: blancos alrededor ───────────────────────────
  // Cada uno dice LÍNEA y LADO (Above/Below). Se inserta un blanco en ese
  // punto si no lo hay. Sólo se INSERTAN líneas: nunca se borra texto.
  const blankRules = [
    { name: "MD022", re: reMD022, counter: "md022" },
    { name: "MD031", re: reMD031, counter: "md031" },
  ];
  for (const rule of blankRules) {
    for (let k = 0; k < 80; k++) {
      let hit = null;
      for (const m of lint(file).split(/\r?\n/)) {
        const mm = rule.re(name).exec(m);
        if (mm) {
          hit = { line: Number(mm[1]), side: /Below/.test(mm[2]) ? "below" : "above" };
          break;
        }
      }
      if (!hit) break;
      const i = hit.line - 1; // 0-based
      const at = hit.side === "above" ? i : i + 1;
      const near = lines[at] ?? "";
      if (near.trim() === "") break; // ya hay blanco
      lines.splice(at, 0, "");
      if (rule.counter === "md022") md022++;
      else md031++;
    }
  }
  // MD032 (blancos alrededor de listas): el linter no dice el lado → se
  // comprueban los dos: si falta el de arriba se inserta arriba; si falta el
  // de abajo, se inserta abajo (después del FINAL del bloque de lista).
  for (let k = 0; k < 80; k++) {
    let hit = null;
    for (const m of lint(file).split(/\r?\n/)) {
      const mm = reMD032(name).exec(m);
      if (mm) {
        hit = Number(mm[1]);
        break;
      }
    }
    if (hit === null) break;
    const i = hit - 1;
    if (i < 0 || i >= lines.length) break;
    if (!/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) break;
    // arriba
    if ((lines[i - 1] ?? "").trim() !== "") {
      lines.splice(i, 0, "");
      md032++;
      continue;
    }
    // abajo: fin del bloque de lista
    let end = i;
    for (let j = i; j < lines.length; j++) {
      if (/^\s*([-*+]|\d+[.)])\s+/.test(lines[j])) end = j;
      else if (lines[j].trim() === "") continue;
      else break;
    }
    if ((lines[end + 1] ?? "").trim() === "") break;
    lines.splice(end + 1, 0, "");
    md032++;
  }

  // ── MD004: unificar el estilo de viñeta ────────────────────────────────
  for (let k = 0; k < 400; k++) {
    let hit = null;
    for (const m of lint(file).split(/\r?\n/)) {
      const mm = reMD004(name).exec(m);
      if (mm) {
        hit = { line: Number(mm[1]), expected: mm[2], actual: mm[3] };
        break;
      }
    }
    if (!hit) break;
    const i = hit.line - 1;
    if (i < 0 || i >= lines.length) break;
    const pm = /^(\s*)([-*_])(\s+)(.*)$/.exec(lines[i]);
    if (!pm || pm[2] !== hit.actual) break;
    lines[i] = `${pm[1]}${hit.expected}${pm[3]}${pm[4]}`;
    md004++;
  }

  // ── MD012: blancos consecutivos ──────────────────────────────────────────
  for (let k = 0; k < 60; k++) {
    let hit = null;
    for (const m of lint(file).split(/\r?\n/)) {
      const mm = reMD012(name).exec(m);
      if (mm) {
        hit = Number(mm[1]);
        break;
      }
    }
    if (hit === null) break;
    // markdownlint apunta a la línea en blanco sobrante: se busca el par de
    // blancos consecutivos alrededor y se elimina UNO.
    const i = hit - 1;
    let removed = false;
    for (const cand of [i, i - 1]) {
      if (cand < 1 || cand >= lines.length) continue;
      if (lines[cand].trim() === "" && lines[cand - 1].trim() === "") {
        lines.splice(cand, 1);
        md012++;
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }

  // ── MD028: línea en blanco DENTRO de un blockquote ───────────────────────
  for (let k = 0; k < 80; k++) {
    let hit = null;
    for (const m of lint(file).split(/\r?\n/)) {
      const mm = reMD028(name).exec(m);
      if (mm) {
        hit = Number(mm[1]);
        break;
      }
    }
    if (hit === null) break;
    const i = hit - 1;
    if (i < 0 || i >= lines.length) break;
    if (lines[i].trim() !== "") break; // no es la línea en blanco
    lines.splice(i, 1);
    md028++;
  }

  // ── MD049: estilo de énfasis (`_x_` → `*x*`) ─────────────────────────────
  for (let k = 0; k < 80; k++) {
    let hit = null;
    for (const m of lint(file).split(/\r?\n/)) {
      const mm = reMD049(name).exec(m);
      if (mm) {
        hit = { line: Number(mm[1]), expected: mm[2], actual: mm[3] };
        break;
      }
    }
    if (!hit) break;
    const i = hit.line - 1;
    if (i < 0 || i >= lines.length) break;
    const line = lines[i];
    const re =
      hit.actual === "underscore"
        ? /(^|[^\\])_([^_\n]+)_/g
        : /(^|[^*])\*([^*\n]+)\*(?!\*)/g;
    let changed = false;
    const next = line.replace(re, (m, pre, inner) => {
      changed = true;
      return `${pre}${hit.expected === "asterisk" ? "*" : "_"}${inner}${hit.expected === "asterisk" ? "*" : "_"}`;
    });
    if (!changed) break;
    lines[i] = next;
    md049++;
  }

  const result = lines.join("\n");
  if (result !== original) writeFileSync(file, result, "utf8");
  console.log(
    `[fix-md-structure] ${file}: MD003=${md003} MD004=${md004} MD012=${md012} MD022=${md022} MD031=${md031} MD032=${md032} MD028=${md028} MD049=${md049}` +
      (result === original ? " (sin cambios)" : " (escrito)"),
  );
}
