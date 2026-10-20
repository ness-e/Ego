#!/usr/bin/env node
// scripts/fix-md-headings.mjs — utilidad de A7 para normalizar los encabezados
// de un markdown al estilo `atx_closed` que exige `.markdownlint.json`
// (`"MD003": { "style": "atx_closed" }`).
//
// Sólo toca líneas que:
//   · están FUERA de un bloque de código delimitado, y
//   · empiezan por 1-6 `#` seguidos de texto y NO terminan ya en `#`.
//
// Es idempotente: volver a ejecutarlo sobre un fichero ya normalizado no
// cambia nada.
//
// Uso: node scripts/fix-md-headings.mjs <fichero.md> [más ficheros...]
import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("uso: node scripts/fix-md-headings.mjs <fichero.md> [...]");
  process.exit(2);
}

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const lines = original.split(/\r?\n/);
  const out = [];
  let inFence = false;
  let changed = 0;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (!inFence) {
      const m = /^(#{1,6}) (\S.*)$/.exec(line);
      if (m && !/\s#+\s*$/.test(line)) {
        out.push(`${m[1]} ${m[2]} ${m[1]}`);
        changed += 1;
        continue;
      }
    }
    out.push(line);
  }

  const next = out.join("\n");
  if (next !== original) {
    writeFileSync(file, next, "utf8");
    console.log(`[fix-md-headings] ${file}: ${changed} encabezado(s) normalizados`);
  } else {
    console.log(`[fix-md-headings] ${file}: sin cambios`);
  }
}
