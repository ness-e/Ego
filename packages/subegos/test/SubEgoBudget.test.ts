import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EgoMemoryAdapter } from "@ego/memory";
import {
  SubEgoBudgetTracker,
  SubEgoBudgetExceededError,
  calculateTokenCost,
  type SubEgoUsageMetrics
} from "../src/SubEgoBudget.js";
import type { SubEgoBudget } from "../src/types.js";

describe("SubEgoBudget — Límites de Presupuesto y Cuotas de Consumo (SUB-09)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;
  let tracker: SubEgoBudgetTracker;

  const defaultBudget: SubEgoBudget = {
    maxTokensPerCall: 4000,
    maxDailyCostUsd: 1.0,
    requiresApprovalAboveUsd: 0.1
  };

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ego-budget-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    tracker = new SubEgoBudgetTracker(adapter);
  });

  afterEach(async () => {
    try {
      if (adapter && adapter.ready) {
        await adapter.close();
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar errores de cleanup en Windows
    }
  });

  describe("1. Cálculo de Costos y Funciones de Utilidad", () => {
    it("debe calcular el costo de tokens con precisión para modelos conocidos", () => {
      // 10,000 input, 2,000 output en gpt-4o ($2.5/M in, $10.0/M out)
      // 10,000 * 0.0000025 = 0.025
      // 2,000 * 0.000010 = 0.02
      // Total = 0.045
      const cost = calculateTokenCost(10000, 2000, "gpt-4o");
      expect(cost).toBeCloseTo(0.045, 4);
    });

    it("debe calcular costo 0 para mock-core", () => {
      const cost = calculateTokenCost(50000, 50000, "mock-core");
      expect(cost).toBe(0);
    });
  });

  describe("2. Validación Previa (checkTurnBudget)", () => {
    it("debe permitir la ejecución si la estimación está dentro de los límites", async () => {
      const check = await tracker.checkTurnBudget("ego.analyst", 2000, defaultBudget);
      expect(check.allowed).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    it("debe rechazar la ejecución si la estimación excede maxTokensPerCall", async () => {
      const check = await tracker.checkTurnBudget("ego.analyst", 5000, defaultBudget);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/supera el límite por turno/);
    });

    it("debe detectar si una acción amerita aprobación humana HITL por costo", () => {
      expect(tracker.needsApprovalForCost("ego.analyst", 0.05, defaultBudget)).toBe(false);
      expect(tracker.needsApprovalForCost("ego.analyst", 0.15, defaultBudget)).toBe(true);
    });
  });

  describe("3. Registro de Uso e Interrupción por Exceso de Cuota", () => {
    it("debe acumular tokens y costes por turno correctamente", async () => {
      const metrics = await tracker.recordTurnUsage(
        "ego.analyst",
        { inputTokens: 1000, outputTokens: 500, model: "gpt-4o" },
        defaultBudget
      );

      expect(metrics.currentSessionTotalTokens).toBe(1500);
      expect(metrics.dailyTotalTokens).toBe(1500);
      expect(metrics.lifetimeTotalTokens).toBe(1500);
      expect(metrics.dailyCostUsd).toBeGreaterThan(0);
    });

    it("debe lanzar SubEgoBudgetExceededError si un solo turno supera maxTokensPerCall", async () => {
      await expect(
        tracker.recordTurnUsage(
          "ego.analyst",
          { inputTokens: 3000, outputTokens: 2000, model: "gpt-4o" }, // Total 5000 > 4000
          defaultBudget
        )
      ).rejects.toThrow(SubEgoBudgetExceededError);
    });

    it("debe lanzar SubEgoBudgetExceededError si el gasto diario acumulado supera maxDailyCostUsd", async () => {
      const tightBudget: SubEgoBudget = {
        maxTokensPerCall: 10000,
        maxDailyCostUsd: 0.02, // Permite el primer turno ($0.0135) pero no el segundo ($0.027)
        requiresApprovalAboveUsd: 0.05
      };

      // Registrar primer turno que consume $0.0135
      await tracker.recordTurnUsage(
        "ego.tight",
        { inputTokens: 2000, outputTokens: 500, model: "claude-3-5-sonnet" },
        tightBudget
      );

      // Segundo turno que empuja el total a $0.027 > $0.02
      await expect(
        tracker.recordTurnUsage(
          "ego.tight",
          { inputTokens: 2000, outputTokens: 500, model: "claude-3-5-sonnet" },
          tightBudget
        )
      ).rejects.toThrow(SubEgoBudgetExceededError);
    });
  });

  describe("4. Reseteo Diario y Persistencia en VantaDB", () => {
    it("debe resetear los contadores diarios manteniendo los totales de por vida", async () => {
      await tracker.recordTurnUsage(
        "ego.reset_test",
        { inputTokens: 1000, outputTokens: 500, model: "gpt-4o" },
        defaultBudget
      );

      await tracker.resetDailyUsage("ego.reset_test");
      const metrics = await tracker.getMetrics("ego.reset_test");

      expect(metrics.dailyTotalTokens).toBe(0);
      expect(metrics.dailyCostUsd).toBe(0);
      expect(metrics.lifetimeTotalTokens).toBe(1500);
    });

    it("debe persistir las métricas en VantaDB y recuperarlas tras reiniciar la instancia", async () => {
      await tracker.recordTurnUsage(
        "ego.persist_test",
        { inputTokens: 2000, outputTokens: 1000, model: "gpt-4o" },
        defaultBudget
      );

      // Simular reinicio
      await adapter.close();
      const secondAdapter = new EgoMemoryAdapter(tmpDir);
      await secondAdapter.init();

      const secondTracker = new SubEgoBudgetTracker(secondAdapter);
      const restored = await secondTracker.getMetrics("ego.persist_test");

      expect(restored.dailyTotalTokens).toBe(3000);
      expect(restored.lifetimeTotalTokens).toBe(3000);
      expect(restored.dailyCostUsd).toBeGreaterThan(0);

      await secondAdapter.close();
    });
  });
});
