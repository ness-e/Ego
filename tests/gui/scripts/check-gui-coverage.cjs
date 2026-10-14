// Gate estático de la suite GUI (T22) — corre con node pelado, sin
// dependencias: Playwright NO está instalado en este repo y `pnpm install`
// está prohibido por el handoff de campaña, así que el `playwright test`
// real lo corre el owner (ver README.md). Este gate verifica lo verificable
// sin Electron ni node_modules nuevos:
//   1. existen los 13 specs (01..13) y cada uno cita su ítem T10-Step-3;
//   2. cada spec tiene expects reales o skip honesto con motivo "Exige…"
//      (skip honesto > test falso);
//   3. playwright.config.ts apunta a 127.0.0.1:5173 y NO auto-levanta server;
//   4. package.json declara test:gui + dep @playwright/test para el owner;
//   5. (warn-only) probe HTTP al dev-server si está levantado.
const { readFileSync, existsSync, readdirSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { get } = require("node:http");

const root = join(__dirname, "..");
const failures = [];
const warnings = [];
const ok = (m) => console.log(`  PASS ${m}`);
const fail = (m) => failures.push(m);
const warn = (m) => warnings.push(m);

const specsDir = join(root, "specs");
const files = existsSync(specsDir) ? readdirSync(specsDir).sort() : [];
const expected = Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(2, "0"));

// 1. Los 13 specs.
for (const n of expected) {
  const f = files.find((x) => x.startsWith(`${n}-`) && x.endsWith(".spec.ts"));
  if (!f) fail(`falta spec ${n}-*.spec.ts`);
  else ok(`existe specs/${f}`);
}
// 2. Trazabilidad T10 + skips honestos.
for (const f of files.filter((x) => x.endsWith(".spec.ts"))) {
  const src = readFileSync(join(specsDir, f), "utf8");
  if (!src.includes("T10")) fail(`${f}: sin cita al ítem T10-Step-3`);
  const hasExpect = /await expect\(|expect\(/.test(src);
  const skips = (src.match(/test\.skip\(|describe\.skip\(/g) || []).length;
  const honestSkip = skips > 0 && /Exige/i.test(src);
  // Skip-only honesto (03-hitl, 11-byok): sin expects porque sin backend
  // no hay nada ejecutable; el motivo "Exige…" es el contrato.
  if (!hasExpect && !honestSkip) fail(`${f}: sin expects reales ni skip honesto`);
  if (skips > 0 && !honestSkip) fail(`${f}: tiene skip sin motivo "Exige…"`);
  if (skips === 0) warn(`${f}: sin skips — verificar que no requiera backend oculto`);
  // Filesystem, no Electron: ningún spec debe importar main/preload/VantaDB.
  if (/from ["'].*(preload|NativeVantaDB|vantadb\/native)/.test(src))
    fail(`${f}: importa código de main — prohibido en specs GUI`);
}
ok("trazabilidad T10 + skips con motivo verificados");

// 3. Config: baseURL fija, sin webServer auto-start.
const cfg = readFileSync(join(root, "playwright.config.ts"), "utf8");
if (!cfg.includes("http://127.0.0.1:5173")) fail("config: baseURL distinta de 127.0.0.1:5173");
else ok("config baseURL = http://127.0.0.1:5173");
if (/webServer\s*:/.test(cfg)) fail("config: tiene webServer — la suite nunca levanta procesos");
else ok("config sin webServer (el owner levanta `pnpm dev`)");

// 4. package.json declara el runner del owner.
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.scripts && pkg.scripts["test:gui"] !== "playwright test") fail("package.json: falta script test:gui");
else ok("script test:gui declarado");
if (!pkg.devDependencies || !pkg.devDependencies["@playwright/test"]) fail("package.json: falta devDep @playwright/test");
else ok("devDep @playwright/test declarada");
if (!pkg.scripts || pkg.scripts.test !== "node scripts/check-gui-coverage.cjs")
  fail("package.json: `test` debe ser solo el gate estático (sin deps)");
else ok("`test` = gate estático sin dependencias");

// 5. Probe al dev-server (warn-only: DOWN no es fail del gate).
get("http://127.0.0.1:5173/", (res) => {
  let n = 0;
  res.on("data", (c) => (n += c.length));
  res.on("end", () => {
    console.log(`  INFO dev-server 127.0.0.1:5173 -> HTTP ${res.statusCode} (${n} bytes)`);
    done(res.statusCode === 200 ? null : "dev-server responde pero no con 200");
  });
}).on("error", (e) => done(`dev-server DOWN (${(e && e.code) || e.message}) — specs pendientes de ejecución`));

function done(probeNote) {
  if (probeNote) warn(probeNote);
  for (const w of warnings) console.log(`  WARN ${w}`);
  if (failures.length) {
    for (const f of failures) console.log(`  FAIL ${f}`);
    process.exit(1);
  }
  console.log(`GATE GUI VERDE — ${files.length} specs, 0 fallos estáticos`);
}
