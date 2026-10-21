const fs = require("node:fs");
const path = require("node:path");
const dir = "apps/desktop/test";
const files = fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
const rows = [];
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const tmp = (s.match(/tmpdir\(\)/g) || []).length;
  const adapters = (s.match(/new EgoMemoryAdapter\(/g) || []).length;
  const mkdtemp = (s.match(/mkdtemp/g) || []).length;
  if (tmp || adapters || mkdtemp) rows.push([f, tmp, adapters, mkdtemp]);
}
rows.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
console.log("fichero".padEnd(40) + "tmpdir adapters mkdtemp");
for (const r of rows) {
  console.log(
    r[0].padEnd(40) + String(r[1]).padStart(6) + String(r[2]).padStart(8) + String(r[3]).padStart(7)
  );
}
console.log("---");
console.log(
  "ficheros con tmpdir:",
  rows.filter((r) => r[1] > 0).length,
  "| con adapters:",
  rows.filter((r) => r[2] > 0).length
);
