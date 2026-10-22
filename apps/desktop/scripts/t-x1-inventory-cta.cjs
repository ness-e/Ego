/**
 * Ola 10 · EGO-FIND-100 — Inventario de los CTA: qué variante usa cada
 * `Button` "grande" (los que la auditoría ve como acciones primarias).
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..");
const RENDERER = path.join(ROOT, "apps", "desktop", "renderer");

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.includes(path.join("floating", "vendor"))) continue;
      walk(full, acc);
      continue;
    }
    if (/\.tsx$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const rows = [];
for (const file of walk(RENDERER)) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/<Button\b/.test(line)) return;
    const window = lines.slice(i, i + 12).join("\n");
    const variant = window.match(/variant=\{?"([^"]+)"\}?/);
    const size = window.match(/size=\{?"([^"]+)"\}?/);
    // La etiqueta: la primera línea con texto tras el `<Button`.
    const label = lines
      .slice(i + 1, i + 12)
      .map((l) => l.trim())
      .find((l) => l.length > 2 && !l.startsWith("<") && !l.startsWith("{") && !l.startsWith("}") && !l.includes("=>") && !/^[a-z]+=/.test(l));
    rows.push({
      file: path.relative(RENDERER, file).replace(/\\/g, "/"),
      line: i + 1,
      variant: variant ? variant[1] : "(default primary)",
      size: size ? size[1] : "(default md)",
      label: (label ?? "").slice(0, 42),
    });
  });
}

const big = rows.filter((r) => r.size === "lg" || (r.size === "md" && r.variant === "secondary" && r.label.length > 0));
console.log("=== CTA 'grandes' (size lg/md) por variante ===");
const byVariant = new Map();
for (const r of big) {
  if (!byVariant.has(r.variant)) byVariant.set(r.variant, []);
  byVariant.get(r.variant).push(r);
}
for (const [v, list] of byVariant) {
  console.log(`  ${v} (${list.length})`);
  for (const r of list.slice(0, 8)) {
    console.log(`     ${r.file}:${r.line}  size=${r.size}  "${r.label}"`);
  }
}
console.log(`\ntotal Buttons en el renderer: ${rows.length}`);
