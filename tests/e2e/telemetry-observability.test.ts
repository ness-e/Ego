// tests/e2e/telemetry-observability.test.ts
//
// T10 (EGO-FIND-74) — contrato de los scripts de observabilidad de A7:
//   · `scripts/telemetry-sink.mjs`  → sink de disco ROTADO (JSONL)
//   · `scripts/export-telemetry.mjs` → exportador + agregador
//   · `scripts/correlation.mjs`     → helper de `correlationId`
//
// Estos scripts son la parte de A7 de la observabilidad (el resto —inyectar el
// sink en `packages/events` y `packages/decision`— es handoff a A2; ver
// `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A7.md`).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  createRotatingFileSink,
  listTelemetryFiles,
  activeFileName,
} from "../../scripts/telemetry-sink.mjs";
import {
  newCorrelationId,
  childCorrelationId,
  withCorrelation,
  readCorrelationId,
  isCorrelationId,
  CORRELATION_HEADER,
} from "../../scripts/correlation.mjs";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

describe("T10 · correlationId (helper para A2)", () => {
  it("newCorrelationId es opaco, único y con la forma canónica", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toBe(b);
    expect(isCorrelationId(a)).toBe(true);
    expect(isCorrelationId(a)).toBe(true);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("childCorrelationId es DETERMINISTA (mismo padre+span → mismo id)", () => {
    const parent = newCorrelationId();
    const a = childCorrelationId(parent, "tool:fs_read_file");
    const b = childCorrelationId(parent, "tool:fs_read_file");
    expect(a).toBe(b);
    expect(isCorrelationId(a)).toBe(true);
  });

  it("spans distintos producen ids distintos", () => {
    const parent = newCorrelationId();
    expect(childCorrelationId(parent, "tool:a")).not.toBe(childCorrelationId(parent, "tool:b"));
    expect(childCorrelationId(parent, "tool:a")).not.toBe(
      childCorrelationId(newCorrelationId(), "tool:a"),
    );
  });

  it("withCorrelation no muta el payload original", () => {
    const original = { a: 1 };
    const enriched = withCorrelation(original, newCorrelationId());
    expect(enriched).not.toBe(original);
    expect(original).toEqual({ a: 1 });
    expect(readCorrelationId(enriched)).toBeTruthy();
    expect(readCorrelationId(original)).toBeNull();
  });

  it("el header de correlación está definido", () => {
    expect(CORRELATION_HEADER).toBe("x-ego-correlation-id");
  });
});

describe("T10 · sink de disco rotado", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ego-telemetry-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("escribe JSONL (una línea por evento, JSON compacto)", () => {
    const sink = createRotatingFileSink({ dir });
    sink.write(JSON.stringify({ ts: "2026-01-01T00:00:00Z", totalDecisionMs: 42 }));
    const file = sink.file();
    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).totalDecisionMs).toBe(42);
  });

  it("un texto no-JSON se envuelve en un evento con timestamp", () => {
    const sink = createRotatingFileSink({ dir });
    sink.write("mensaje suelto");
    const obj = JSON.parse(readFileSync(sink.file(), "utf8").trim());
    expect(typeof obj.ts).toBe("string");
    expect(obj.message).toBe("mensaje suelto");
  });

  it("rota al superar maxBytes y conserva como máximo maxFiles", () => {
    const sink = createRotatingFileSink({ dir, maxBytes: 200, maxFiles: 2 });
    for (let i = 0; i < 20; i += 1) {
      sink.write(JSON.stringify({ i, payload: "x".repeat(50) }));
    }
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    // Activo + rotados (maxFiles=2 → como mucho .1 y .2).
    expect(files.length).toBeGreaterThan(1);
    expect(files.length).toBeLessThanOrEqual(3);
    expect(listTelemetryFiles(dir).length).toBe(files.length);
  });

  it("el nombre del fichero activo incluye la fecha (UTC)", () => {
    expect(activeFileName("telemetry", new Date("2026-03-04T10:00:00Z"))).toBe(
      "telemetry-20260304.jsonl",
    );
  });
});

describe("T10 · export-telemetry (CLI)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ego-telemetry-export-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("agrega latencias y calcula el cumplimiento del presupuesto", () => {
    const file = join(dir, "telemetry-20260101.jsonl");
    const rows = [50, 80, 120, 200, 90].map((totalDecisionMs, i) =>
      JSON.stringify({
        ts: `2026-01-01T00:00:0${i}Z`,
        runId: `run-${i}`,
        intentId: `intent-${i}`,
        totalDecisionMs,
        classifyMs: 10,
        subEgoSelectMs: 5,
        preconditionsMs: 5,
        decidedBy: "deterministic_rule",
        withinBudget: totalDecisionMs <= 150,
        correlationId: newCorrelationId(),
      }),
    );
    writeFileSync(file, `${rows.join("\n")}\n`, "utf8");

    const out = join(dir, "out.json");
    execFileSync(
      process.execPath,
      [join(REPO_ROOT, "scripts", "export-telemetry.mjs"), "--dir", dir, "--out", out, "--stdout"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    const report = JSON.parse(readFileSync(out, "utf8"));
    expect(report.summary.samples).toBe(5);
    expect(report.summary.p50Ms).toBe(90);
    expect(report.summary.maxMs).toBe(200);
    // 4 de 5 dentro del presupuesto de 150 ms.
    expect(report.summary.budgetComplianceRatio).toBe(0.8);
    expect(report.summary.withCorrelationId).toBe(5);
  });

  it("sale con código 2 si el directorio de telemetría no existe", () => {
    let code = 0;
    try {
      execFileSync(
        process.execPath,
        [join(REPO_ROOT, "scripts", "export-telemetry.mjs"), "--dir", join(dir, "nope")],
        { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" },
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      code = typeof status === "number" ? status : -1;
    }
    expect(code).toBe(2);
    expect(existsSync(join(dir, "nope"))).toBe(false);
  });
});
