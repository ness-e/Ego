#!/usr/bin/env node
// scripts/audit-debt.mjs — T9 (EGO-FIND-66 parcial): mide la deuda técnica.
//
// POR QUÉ: hasta ahora la deuda (any, catch{}, I/O síncrono, disable
// huérfanos, transition-all, hex hardcodeados, god files, skips) sólo vivía
// en el informe de auditoría manual. Sin un contador mecánico, "bajar deuda"
// no es verificable y el endurecimiento del lint no tiene baseline.
//
// QUÉ MIDE (por fichero y global, separando PRODUCCIÓN de TEST):
//   any             → `any`/`as any`/`<any>` en posición de tipo
//   catchEmpty      → `catch { }` vacío (error tragado)
//   syncIo          → readFileSync/writeFileSync/execSync/existsSync/...
//   disable         → eslint-disable / oxlint-disable (incluye huérfanas)
//   transitionAll   → `transition-all` en CSS (deuda de rendimiento)
//   hardcodedHex    → colores hex literales en TS/TSX
//   godFiles        → ficheros > `--max-lines` líneas (por defecto 800)
//   skips           → describe.skip / it.skip / it.fails / describe.skipIf
//
// USO:
//   node scripts/audit-debt.mjs                     → informe legible
//   node scripts/audit-debt.mjs --json              → JSON por stdout
//   node scripts/audit-debt.mjs --out <file.json>   → escribe JSON
//   node scripts/audit-debt.mjs --baseline <file>   → compara con baseline
//   node scripts/audit-debt.mjs --write-baseline <file> → guarda baseline
//
// EXIT: 0 siempre (job INFORMATIVO). Con `--fail-on-regression` sale 1 si
// alguna métrica supera el baseline (para usarlo como gate futuro).
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const SCAN_DIRS = ["apps", "packages", "tests", "scripts", "eval"];
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  "release",
  "coverage",
  "playwright-report",
  "test-results",
  ".git",
  ".ego-worktrees",
  "repos-referencia",
  // Copia vendorizada del avatar: es duplicado byte-idéntico de
  // `packages/avatar/src` (decisión D5 del owner: se mantienen las tres
  // copias). Contarla duplicaría la deuda → se excluye y se reporta.
  "vendor",
]);
const MAX_LINES = Number(opt("--max-lines") ?? 800);

const RULES = {
  any: /:\s*any\b|<any>|\bas any\b/g,
  catchEmpty: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
  syncIo: /\b(readFileSync|writeFileSync|appendFileSync|existsSync|readdirSync|statSync|execSync|spawnSync|copyFileSync|mkdirSync|rmSync)\s*\(/g,
  disable: /\b(?:eslint-disable|oxlint-disable)\b/g,
  transitionAll: /transition-all/g,
  hardcodedHex: /#[0-9a-fA-F]{3,8}\b/g,
  skips: /\b(?:describe|it|test)\.(?:skip|fails|todo)\b|\bdescribe\.skipIf\b|\btest\.describe\.skip\b/g,
};

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (!CODE_EXT.has(ext)) continue;
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function isTestFile(rel) {
  return (
    /(^|[\\/])test[\\/]/.test(rel) ||
    /(^|[\\/])tests[\\/]/.test(rel) ||
    /\.test\.[cm]?[jt]sx?$/.test(rel) ||
    /\.spec\.[cm]?[jt]sx?$/.test(rel) ||
    /(^|[\\/])__tests__[\\/]/.test(rel)
  );
}

const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
files.sort();

const perFile = [];
const totals = {};
const totalsTest = {};
for (const key of Object.keys(RULES)) {
  totals[key] = 0;
  totalsTest[key] = 0;
}
let godFiles = 0;
let totalLines = 0;

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const content = readFileSync(abs, "utf8");
  const lines = content.split(/\r?\n/);
  totalLines += lines.length;
  const isTest = isTestFile(rel);
  const counts = {};
  for (const [key, re] of Object.entries(RULES)) {
    const matches = content.match(re);
    const n = matches ? matches.length : 0;
    counts[key] = n;
    totals[key] += n;
    if (isTest) totalsTest[key] += n;
  }
  const isGod = lines.length > MAX_LINES;
  if (isGod) godFiles += 1;
  const anyDebt = Object.entries(counts).some(([, n]) => n > 0) || isGod;
  if (anyDebt) {
    perFile.push({ file: rel, lines: lines.length, test: isTest, god: isGod, ...counts });
  }
}

perFile.sort((a, b) => {
  const score = (f) =>
    f.any * 3 + f.catchEmpty * 2 + f.disable * 2 + f.hardcodedHex + f.transitionAll * 0.5 + (f.god ? 5 : 0);
  return score(b) - score(a);
});

const report = {
  generatedAt: new Date().toISOString(),
  scanDirs: SCAN_DIRS,
  excludedDirs: [...SKIP_DIRS],
  maxLines: MAX_LINES,
  filesScanned: files.length,
  totalLines,
  totals,
  totalsTest,
  prod: Object.fromEntries(Object.keys(RULES).map((k) => [k, totals[k] - totalsTest[k]])),
  godFiles,
  topFiles: perFile.slice(0, 25),
  perFile,
};

// ── baseline ────────────────────────────────────────────────────────────────
const baselinePath = opt("--baseline");
const writeBaseline = opt("--write-baseline");
if (writeBaseline) {
  writeFileSync(writeBaseline, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[audit-debt] baseline escrito: ${writeBaseline}`);
}
if (baselinePath && existsSync(baselinePath)) {
  const base = JSON.parse(readFileSync(baselinePath, "utf8"));
  const regressions = [];
  for (const key of Object.keys(RULES)) {
    const delta = totals[key] - (base.totals?.[key] ?? 0);
    if (delta > 0) regressions.push(`${key}: +${delta} (base ${base.totals?.[key] ?? 0} → ${totals[key]})`);
  }
  report.baseline = { file: baselinePath, regressions };
  if (regressions.length > 0) {
    console.error(`[audit-debt] REGRESIONES vs baseline:`);
    for (const r of regressions) console.error(`  ${r}`);
    if (flag("--fail-on-regression")) process.exit(1);
  } else {
    console.log(`[audit-debt] sin regresiones vs baseline (${baselinePath})`);
  }
}

// ── salida ──────────────────────────────────────────────────────────────────
if (opt("--out")) {
  writeFileSync(opt("--out"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[audit-debt] JSON escrito: ${opt("--out")}`);
}
if (flag("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`[audit-debt] ficheros analizados: ${files.length} · líneas: ${totalLines}`);
  console.log(`[audit-debt] métrica            prod   test   total`);
  for (const key of Object.keys(RULES)) {
    const prod = totals[key] - totalsTest[key];
    console.log(
      `[audit-debt] ${key.padEnd(18)} ${String(prod).padStart(5)} ${String(totalsTest[key]).padStart(6)} ${String(totals[key]).padStart(7)}`,
    );
  }
  console.log(`[audit-debt] godFiles(>${MAX_LINES} líneas) ${godFiles}`);
  console.log("[audit-debt] top 10 ficheros por deuda:");
  for (const f of report.topFiles.slice(0, 10)) {
    console.log(
      `  ${f.file} [${f.test ? "test" : "prod"}] any=${f.any} catch={}=${f.catchEmpty} syncIO=${f.syncIo} disable=${f.disable} hex=${f.hardcodedHex} god=${f.god ? "Y" : "n"}`,
    );
  }
}
