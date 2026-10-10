import { describe, it, expect, beforeEach } from "vitest";
import { AnalyticsDomain } from "../src/analytics/AnalyticsDomain.js";

describe("AnalyticsDomain (DOM-04)", () => {
  let analytics: AnalyticsDomain;

  beforeEach(() => {
    analytics = new AnalyticsDomain();
  });

  it("debe generar series temporales de tokens y costos aptas para Recharts", async () => {
    const series = await analytics.getTokensUsageSeries(7);
    expect(series.length).toBe(7);

    for (const p of series) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.totalTokens).toBe(p.inputTokens + p.outputTokens);
      expect(p.costUsd).toBeGreaterThanOrEqual(0);
    }
  });

  it("debe calcular la distribución de modelos con porcentajes acumulativos", async () => {
    const dist = await analytics.getModelDistribution();
    expect(dist.length).toBeGreaterThan(0);

    const totalPct = dist.reduce((sum, d) => sum + d.percentage, 0);
    expect(Math.round(totalPct)).toBe(100);
  });

  it("debe obtener métricas de almacenamiento por namespace", async () => {
    const stats = await analytics.getNamespaceStats();
    expect(stats.length).toBeGreaterThanOrEqual(5);

    const eng = stats.find((s) => s.namespace.includes("engineering"));
    expect(eng).toBeDefined();
    expect(eng?.recordCount).toBeGreaterThan(0);
  });

  it("debe exportar un dataset a CSV escapando valores correctamente", () => {
    const data = [
      { id: "1", name: "Reporte A", tokens: 1500 },
      { id: "2", name: 'Reporte con "comillas"', tokens: 2300 },
    ];

    const csv = analytics.exportDatasetToCsv(data, [
      { key: "id", header: "ID" },
      { key: "name", header: "Nombre" },
      { key: "tokens", header: "Tokens" },
    ]);

    expect(csv).toContain('"ID","Nombre","Tokens"');
    expect(csv).toContain('"1","Reporte A","1500"');
    expect(csv).toContain('""comillas""');
  });
});
