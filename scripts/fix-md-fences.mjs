#!/usr/bin/env node
// scripts/fix-md-fences.mjs — utilidad de A7 para normalizar los bloques de
// código de un markdown: les pone el lenguaje que exige `.markdownlint.json`
// (`"MD040": "Fenced code blocks should have a language specified"`).
//
// Sólo toca la LÍNEA DE APERTURA de un bloque (la que no tiene lenguaje) y
// respeta los bloques ya cerrados. Es idempotente.
//
// Uso: node scripts/fix-md-fences.mjs <fichero.md> [más ficheros...]
import { readFileSync, writeFileSync } from "node:fs";

/** Lenguaje por defecto para bloques sin lenguaje. */
const DEFAULT_LANG = "text";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("uso: node scripts/fix-md-fences.mjs <fichero.md> [...]");
  process.exit(2);
}

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const lines = original.split(/\r?\n/);
  const out = [];
  let inFence = false;
  let changed = 0;
  let pendingBlank = false;

  for (const line of lines) {
    const m = /^(`{3,})(.*)$/.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const ticks = m[1];
    const info = m[2].trim();

    if (!inFence) {
      // Apertura: necesita lenguaje + línea en blanco antes (MD031).
      if (info === "") {
        out.push(`${ticks}${DEFAULT_LANG}`);
        changed += 1;
      } else {
        out.push(line);
      }
      if (out.length > 0 && out[out.length - 1].trim() !== "") {
        out.splice(out.length - 1, 0, "");
        changed += 1;
      }
      inFence = true;
    } else {
      // Cierre: línea en blanco después (MD031).
      out.push(line);
      inFence = false;
      pendingBlank = true;
      continue;
    }
    pendingBlank = false;
  }

  // Segunda pasada: insertar línea en blanco tras cada cierre.
  const spaced = [];
  let fenceClosed = false;
  for (const line of out) {
    if (fenceClosed) {
      if (line.trim() !== "") {
        spaced.push("");
        changed += 1;
      }
      fenceClosed = false;
    }
    spaced.push(line);
    if (/^`{3,}\s*$/.test(line)) fenceClosed = true;
  }

  // Tercera pasada: colapsar líneas en blanco consecutivas (MD012).
  const collapsed = [];
  for (const line of spaced) {
    if (line.trim() === "" && collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === "") {
      continue;
    }
    collapsed.push(line);
  }

  const next = collapsed.join("\n");
  if (next !== original) {
    writeFileSync(file, next, "utf8");
    console.log(`[fix-md-fences] ${file}: ${changed} ajuste(s) (lenguaje de bloque + líneas en blanco alrededor)`);
  } else {
    console.log(`[fix-md-fences] ${file}: sin cambios`);
  }
}
