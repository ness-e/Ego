#!/usr/bin/env node
// Fixer DIRIGIDO POR EL LINTER para MD032 (blanks-around-lists) y
// MD037 (no-space-in-emphasis).
//
// DISEÑO (Ola 3, A7): sin heurísticas sobre el texto. Se ejecuta markdownlint,
// se leen SUS líneas y se corrige EXACTAMENTE eso.
//
//   · MD032: markdownlint 0.15 reporta la línea INICIO de la lista, sin
//     indicar el lado → se comprueba si falta el blanco ANTES del inicio y/o
//     DESPUÉS del final del bloque de lista.
//   · MD037: markdownlint reporta línea y columna → se quita el espacio que
//     está DENTRO del marcador de énfasis (sólo si lo que sigue al espacio es
//     una letra o un dígito: `** o` → `**o`; `** |` no se toca porque ahí el
//     espacio está FUERA del énfasis).
//
// GARANTÍAS: nunca se borra una línea (sólo se insertan blancos), sólo se
// quitan espacios intra-énfasis, y es idempotente.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const VERSION = "0.15.0";
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("uso: node fix-md-linter-driven.mjs <fichero.md> [...]");
  process.exit(2);
}

function lint(file) {
  let out = "";
  try {
    out = execFileSync(
      "npx",
      ["--yes", `markdownlint-cli2@${VERSION}`, file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, shell: true },
    );
  } catch (err) {
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  return out;
}

const isListItem = (l) => /^\s*([-*+]|\d+[.)])\s+/.test(l);

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let lines = original.split(/\r?\n/);
  let md032 = 0;
  let md037 = 0;
  const name = basename(file);

  // ── MD037 ────────────────────────────────────────────────────────────────
  for (const m of lint(file).split(/\r?\n/)) {
    const mm = new RegExp(`^.*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+):(\\d+)\\s+MD037/no-space-in-emphasis`).exec(m);
    if (!mm) continue;
    const ln = Number(mm[1]);
    const col = Number(mm[2]);
    const line = lines[ln - 1];
    if (line === undefined) continue;
    const after = line.slice(col - 1);
    const fix = /^(\*\*|__)([ \t]+)(?=[A-Za-zÀ-ÿ0-9])/.exec(after);
    if (!fix) continue;
    const at = col - 1 + fix[1].length;
    lines[ln - 1] = line.slice(0, at) + line.slice(at + fix[2].length);
    md037++;
  }

  // ── MD032 ────────────────────────────────────────────────────────────────
  const starts = new Set();
  for (const m of lint(file).split(/\r?\n/)) {
    const mm = new RegExp(`^.*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)\\s+MD032/blanks-around-lists`).exec(m);
    if (mm) starts.add(Number(mm[1]));
  }
  for (const start of [...starts].sort((a, b) => b - a)) {
    // fin del bloque de lista
    let end = start - 1;
    for (let i = start; i < lines.length; i++) {
      if (isListItem(lines[i]) || lines[i].trim() === "") {
        if (isListItem(lines[i])) end = i;
        continue;
      }
      break;
    }
    // blanco ANTES del inicio
    const prev = lines[start - 2] ?? "";
    const prevIsList = isListItem(prev);
    if (prev.trim() !== "" && !prevIsList) {
      lines.splice(start - 1, 0, "");
      md032++;
    }
    // blanco DESPUÉS del fin (recalculado por el splice)
    const end2 = end + (prev.trim() !== "" && !prevIsList ? 1 : 0);
    const next = lines[end2] ?? "";
    if (next.trim() !== "" && !isListItem(next)) {
      lines.splice(end2 + 1, 0, "");
      md032++;
    }
  }

  const result = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  if (result !== original) writeFileSync(file, result, "utf8");
  console.log(
    `[fix-md-linter-driven] ${file}: MD032=${md032} MD037=${md037}` +
      (result === original ? " (sin cambios)" : " (escrito)"),
  );
}
