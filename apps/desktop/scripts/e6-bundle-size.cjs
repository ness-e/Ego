/**
 * E6 — Mide el tamaño del bundle construido (`out/`).
 */
const fs = require("node:fs");
const path = require("node:path");

const OUT = path.join(__dirname, "..", "out");
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}
const files = walk(OUT);
let total = 0;
const byKind = {};
for (const f of files) {
  const size = fs.statSync(f).size;
  total += size;
  const rel = path.relative(OUT, f).replace(/\\/g, "/");
  const kind = rel.startsWith("renderer/") ? "renderer" : rel.startsWith("main/") ? "main" : rel.startsWith("preload/") ? "preload" : "otros";
  byKind[kind] = (byKind[kind] || 0) + size;
}
const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`TOTAL out/: ${kb(total)} (${files.length} ficheros)`);
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(10)} ${kb(v)}`);
}
// Los chunks del main (los que importan el código movido).
const mainFiles = files.filter((f) => f.includes(`${path.sep}main${path.sep}`));
for (const f of mainFiles.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size).slice(0, 6)) {
  console.log(`  main: ${path.relative(OUT, f).replace(/\\/g, "/")} ${kb(fs.statSync(f).size)}`);
}
