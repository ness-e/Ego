/**
 * T2 (Ola 5) — Reindexa la lista blanca de `design-lint.cjs` por la HUELLA
 * del contenido infractor (en vez de por ID posicional / rango de líneas).
 *
 * El propio linter produce el bloque nuevo (`--prune`); este script lo
 * inyecta en el fichero, verificando que el bloque tiene la forma esperada.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const LINT = path.join(__dirname, "design-lint.cjs");

// 1) El linter imprime el bloque nuevo.
const out = execFileSync(process.execPath, [LINT, "--prune", "--quiet"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const start = out.indexOf("const WHITELIST = [");
if (start < 0) throw new Error("el linter no imprimió el bloque WHITELIST");
const end = out.indexOf("\n  ];", start);
if (end < 0) throw new Error("el bloque WHITELIST no está cerrado");
const block = out.slice(start, end + "\n  ];".length);

// 2) Se sustituye en el script.
let src = fs.readFileSync(LINT, "utf8");
const s = src.indexOf("const WHITELIST = [");
const e = src.indexOf("\n  ];", s);
if (s < 0 || e < 0) throw new Error("no se encontró el bloque WHITELIST original");
src = src.slice(0, s) + block + src.slice(e + "\n  ];".length);
fs.writeFileSync(LINT, src);

const fingerprints = (block.match(/hash: '/g) || []).length;
const entries = (block.match(/findingId: '/g) || []).length;
console.log(
  `WHITELIST reindexada: ${entries} entradas · ${fingerprints} huellas de contenido`
);
