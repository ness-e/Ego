#!/usr/bin/env node
// scripts/export-telemetry.mjs — T10 (EGO-FIND-74): exportador de telemetría.
//
// `packages/decision/src/Telemetry.ts` mantiene 500 muestras EN RAM: se
// pierden al reiniciar y nunca se exportan. Este script consume los JSONL
// que deja el sink rotado (`scripts/telemetry-sink.mjs`) y produce:
//
//   · un resumen agregado (p50/p90/p99 de latencia, ratio de cumplimiento
//     del presupuesto de 150 ms, nº de muestras, errores);
//   · una exportación JSON con las muestras crudas (para analysis offline).
//
// USO:
//   node scripts/export-telemetry.mjs                       → resumen legible
//   node scripts/export-telemetry.mjs --dir logs/telemetry  → otro directorio
//   node scripts/export-telemetry.mjs --out tel.json        → vuelca JSON
//   node scripts/export-telemetry.mjs --stdout              → JSON por stdout
//
// Códigos de salida: 0 ok · 1 error de uso · 2 directorio ilegible.
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DIR = opt("--dir", join(ROOT, "logs", "telemetry"));
const OUT = opt("--out", null);
const AS_JSON = argv.includes("--stdout");
const BUDGET_MS = Number(opt("--budget-ms", "150"));

if (!existsSync(DIR)) {
  console.error(`[export-telemetry] no existe el directorio de telemetría: ${DIR}`);
  console.error("[export-telemetry] ¿se ha ejecutado alguna vez el app con el sink inyectado?");
  process.exit(2);
}

/** Lee los JSONL y extrae las muestras de latencia de decisión. */
function readSamples(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
  const samples = [];
  const events = [];
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      events.push(obj);
      // La telemetría de decisión se identifica por sus campos característicos.
      if (typeof obj.totalDecisionMs === "number") {
        samples.push({
          ts: obj.ts ?? obj.timestamp ?? null,
          runId: obj.runId ?? null,
          intentId: obj.intentId ?? null,
          classifyMs: obj.classifyMs ?? null,
          subEgoSelectMs: obj.subEgoSelectMs ?? null,
          preconditionsMs: obj.preconditionsMs ?? null,
          totalDecisionMs: obj.totalDecisionMs,
          decidedBy: obj.decidedBy ?? null,
          withinBudget: obj.withinBudget ?? obj.totalDecisionMs <= BUDGET_MS,
          correlationId: obj.correlationId ?? null,
        });
      }
    }
  }
  return { samples, events, files };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

const { samples, events, files } = readSamples(DIR);
const latencies = samples.map((s) => s.totalDecisionMs).sort((a, b) => a - b);
const within = samples.filter((s) => s.withinBudget).length;

const summary = {
  generatedAt: new Date().toISOString(),
  dir: DIR,
  files: files.length,
  events: events.length,
  samples: samples.length,
  budgetMs: BUDGET_MS,
  p50Ms: percentile(latencies, 0.5),
  p90Ms: percentile(latencies, 0.9),
  p99Ms: percentile(latencies, 0.99),
  maxMs: latencies.length ? latencies[latencies.length - 1] : 0,
  budgetComplianceRatio: samples.length ? Math.round((within / samples.length) * 100) / 100 : 1,
  withCorrelationId: samples.filter((s) => s.correlationId).length,
};

const report = { summary, samples };

if (OUT) {
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[export-telemetry] JSON escrito: ${OUT}`);
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`[export-telemetry] dir: ${DIR}`);
  console.log(`[export-telemetry] ficheros=${summary.files} eventos=${summary.events} muestras=${summary.samples}`);
  console.log(
    `[export-telemetry] latencia decisión (ms): p50=${summary.p50Ms} p90=${summary.p90Ms} p99=${summary.p99Ms} max=${summary.maxMs}`,
  );
  console.log(
    `[export-telemetry] cumplimiento del presupuesto (${BUDGET_MS} ms): ${Math.round(summary.budgetComplianceRatio * 100)}%`,
  );
  console.log(
    `[export-telemetry] muestras con correlationId: ${summary.withCorrelationId}/${summary.samples}`,
  );
}
