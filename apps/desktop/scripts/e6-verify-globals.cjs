/**
 * E6 — Verificador del objetivo "0 `let` globales mutables fuera de
 * `app-context.ts`" en todo `src/main/**` + `src/main.ts`.
 */
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const files = [];
function collect(dir) {
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) collect(full);
    else if (e.endsWith(".ts") && !e.endsWith(".d.ts")) files.push(full);
  }
}
collect(SRC);

const rows = [];
for (const f of files) {
  const rel = path.relative(SRC, f).replace(/\\/g, "/");
  const L = fs.readFileSync(f, "utf8").split(/\r?\n/);
  L.forEach((l, i) => {
    // `let` a nivel de módulo (indentación 0).
    const m = l.match(/^(?:export\s+)?let\s+([A-Za-z_$][\w$]*)/);
    if (m) rows.push({ rel, line: i + 1, name: m[1] });
  });
}
console.log(`=== \`let\` globales mutables en src/** (${rows.length}) ===`);
const byFile = {};
for (const r of rows) (byFile[r.rel] = byFile[r.rel] || []).push(r);
for (const [rel, rs] of Object.entries(byFile)) {
  const tag = rel === "main/state/app-context.ts" ? "  [OK, es app-context]" : "  <-- FUERA";
  console.log(`${String(rs.length).padStart(3)}  ${rel}${tag}`);
  rs.forEach((r) => console.log(`        ${String(r.line).padStart(5)}  ${r.name}`));
}
