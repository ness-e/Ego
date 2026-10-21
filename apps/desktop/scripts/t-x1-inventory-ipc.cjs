/** Inventario de canales IPC por dominio (para el criterio de división). */
const fs = require("node:fs");
const path = require("node:path");

const P = path.join(
  __dirname,
  "..",
  "src",
  "main",
  "ipc",
  "register-ipc.ts"
);
const L = fs.readFileSync(P, "utf8").split(/\r?\n/);
console.log("lineas:", L.length);

const byDomain = new Map();
L.forEach((line, i) => {
  const m = line.match(/ipcMain\.handle\(\s*["'`](ipc\.[a-zA-Z0-9.-]+)["'`]/);
  if (!m) return;
  const parts = m[1].split(".");
  const dom = parts[1] || "?";
  if (!byDomain.has(dom)) byDomain.set(dom, []);
  byDomain.get(dom).push({ n: i + 1, c: m[1] });
});

const rows = [...byDomain.entries()]
  .map(([d, v]) => [d, v.length, v[0].n, v[v.length - 1].n])
  .sort((a, b) => b[1] - a[1]);
console.log("dominio".padEnd(16) + "canales  primera   última");
for (const r of rows) {
  console.log(
    "  " +
      String(r[0]).padEnd(14) +
      String(r[1]).padStart(4) +
      "  " +
      String(r[2]).padStart(6) +
      "  " +
      String(r[3]).padStart(6)
  );
}
console.log(
  "total canales:",
  [...byDomain.values()].reduce((a, b) => a + b.length, 0)
);
console.log("\notros ipcMain.handle (sin prefijo ipc.):");
L.forEach((line, i) => {
  const m = line.match(/ipcMain\.handle\(\s*["'`]([^"'`]+)["'`]/);
  if (m && !m[1].startsWith("ipc.")) console.log(`  ${i + 1}: ${m[1]}`);
});
