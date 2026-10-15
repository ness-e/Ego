// tests/chaos/soak-nightly.test.ts
// STAB-11 — Soak nocturno: put/get/delete sostenidos contra DB REAL.
//
// Gate: SOLO corre con `EGO_SOAK=1` (nightly 02:00 UTC, 30min por defecto
// vía `EGO_SOAK_MINUTES`). En `verify`/`test:e2e` normal hace skip honesto
// (coste 0) — mismo patrón que `EGO_REAL_DB` (STAB-07).
// Escribe `soak-results/soak-summary.json` (artefacto nightly, gitignored).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { EgoMemoryAdapter } from "@ego/memory";

const SOAK = process.env.EGO_SOAK === "1";
const MINUTES = Math.max(1, Number(process.env.EGO_SOAK_MINUTES ?? "30") || 30);
// p95 generoso para runner compartido: el soak detecta DEGRADACIÓN y
// errores, no hace benchmark (sin regresión fina por ruido de runner).
const P95_BUDGET_MS = 5000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

describe.skipIf(!SOAK)("STAB-11 soak-nightly: memoria estable bajo carga sostenida", () => {
  const tmpDir = path.join(os.tmpdir(), `ego-soak-${Date.now()}`);
  let adapter: EgoMemoryAdapter | null = null;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);
  });

  afterAll(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
      adapter = null;
    }
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos en Windows
    }
  });

  it(
    `put/get/delete durante ${MINUTES}min sin errores ni degradación`,
    async () => {
      const lat: number[] = [];
      let ops = 0;
      let errors = 0;
      const deadline = Date.now() + MINUTES * 60_000;
      let i = 0;
      for (;;) {
        if (Date.now() >= deadline) break;
        const key = `soak-k-${i % 500}`;
        const t0 = performance.now();
        try {
          await adapter!.put({
            namespace: "soak",
            key,
            payload: { iter: i, at: new Date().toISOString() },
            metadata: { soak: true },
          });
          const rec = await adapter!.get("soak", key);
          expect(rec?.payload).toMatchObject({ iter: i });
          if (i % 25 === 0) await adapter!.delete("soak", key);
        } catch {
          errors += 1;
        }
        lat.push(performance.now() - t0);
        ops += 1;
        i += 1;
      }
      lat.sort((a, b) => a - b);
      const summary = {
        minutes: MINUTES,
        ops,
        errors,
        p50_ms: Math.round(percentile(lat, 50)),
        p95_ms: Math.round(percentile(lat, 95)),
        p99_ms: Math.round(percentile(lat, 99)),
        p95_budget_ms: P95_BUDGET_MS,
      };
      const here = path.dirname(fileURLToPath(import.meta.url));
      const outDir = path.join(here, "..", "soak-results");
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(
        path.join(outDir, "soak-summary.json"),
        JSON.stringify(summary, null, 2),
        "utf8",
      );
      expect(errors).toBe(0);
      expect(ops).toBeGreaterThan(0);
      expect(summary.p95_ms).toBeLessThan(P95_BUDGET_MS);
    },
    MINUTES * 60_000 + 120_000,
  );
});
