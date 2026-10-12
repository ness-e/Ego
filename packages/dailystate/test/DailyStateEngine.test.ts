import { describe, it, expect, vi, beforeEach } from "vitest";
import { DailyStateEngine } from "../src/DailyStateEngine.js";

describe("DailyStateEngine (DS-01 / COUC-06 / OCLW-07)", () => {
  let mockAdapter: any;
  let mockEventBus: any;
  const storeMap = new Map<string, Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>>();

  beforeEach(() => {
    storeMap.clear();
    mockAdapter = {
      list: vi.fn(async (namespace: string, limit?: number) => {
        return storeMap.get(namespace) || [];
      }),
      put: vi.fn(async () => {}),
      get: vi.fn(async () => null),
    };

    mockEventBus = {
      emit: vi.fn(),
    };
  });

  it("sintetiza el estado por defecto cuando no hay registros previos ($0 tokens)", async () => {
    const engine = new DailyStateEngine(mockAdapter, { eventBus: mockEventBus });
    const summary = await engine.synthesize({ date: "2026-10-10" });

    expect(summary.date).toBe("2026-10-10");
    expect(summary.completedTasksCount).toBe(0);
    expect(summary.pendingTasksCount).toBe(0);
    expect(summary.pendingApprovalsCount).toBe(0);
    expect(summary.decisionsCount).toBe(0);
    expect(summary.quarantineAlertsCount).toBe(0);
    expect(summary.totalTokensToday).toBe(0);
    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.recentDecisions).toEqual([]);
    expect(summary.suggestedGoals).toHaveLength(1);
    expect(summary.suggestedGoals[0].id).toBe("goal-general-plan");

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      "daily.state.synthesized",
      expect.objectContaining({
        date: "2026-10-10",
      }),
      expect.objectContaining({
        source: "DailyStateEngine",
      })
    );
  });

  it("recopila decisiones desde gov/audit y las ordena cronológicamente", async () => {
    storeMap.set("gov/audit", [
      {
        key: "dec-1",
        payload: { id: "dec-1", title: "Adoptar SQLite", timestamp: 1000, subEgoId: "ego.nucleus" },
      },
      {
        key: "dec-2",
        payload: { id: "dec-2", title: "Migrar a NativeVantaDB", timestamp: 2000, subEgoId: "ego.architect" },
      },
    ]);

    const engine = new DailyStateEngine(mockAdapter);
    const summary = await engine.synthesize({ date: "2026-10-10" });

    expect(summary.decisionsCount).toBe(2);
    expect(summary.recentDecisions).toHaveLength(2);
    expect(summary.recentDecisions[0].id).toBe("dec-2"); // Más reciente primero
    expect(summary.recentDecisions[1].id).toBe("dec-1");
  });

  it("recopila tareas completadas y pendientes", async () => {
    storeMap.set("tasks", [
      { key: "t1", payload: { id: "t1", status: "completed" } },
      { key: "t2", payload: { id: "t2", status: "done" } },
      { key: "t3", payload: { id: "t3", status: "in_progress" } },
      { key: "t4", payload: { id: "t4", status: "pending" } },
    ]);

    const engine = new DailyStateEngine(mockAdapter);
    const summary = await engine.synthesize({ date: "2026-10-10" });

    expect(summary.completedTasksCount).toBe(2);
    expect(summary.pendingTasksCount).toBe(2);
    expect(summary.suggestedGoals.some((g) => g.id === "goal-pending-tasks")).toBe(true);
  });

  it("prioriza alertas de cuarentena y aprobaciones pendientes como objetivos de alta prioridad", async () => {
    storeMap.set("quarantine/pending", [
      { key: "q1", payload: { id: "q1", reason: "Checksum mismatch" } },
    ]);
    storeMap.set("gov/approvals", [
      { key: "a1", payload: { id: "a1", action: "delete_database", resolved: false } },
    ]);

    const engine = new DailyStateEngine(mockAdapter);
    const summary = await engine.synthesize({ date: "2026-10-10" });

    expect(summary.quarantineAlertsCount).toBe(1);
    expect(summary.pendingApprovalsCount).toBe(1);

    const quarantineGoal = summary.suggestedGoals.find((g) => g.id === "goal-quarantine");
    const approvalGoal = summary.suggestedGoals.find((g) => g.id === "goal-approvals");

    expect(quarantineGoal?.priority).toBe("high");
    expect(approvalGoal?.priority).toBe("high");
  });

  it("acumula métricas de tokens, costos y latencia p99 desde metrics/telemetry", async () => {
    storeMap.set("metrics/telemetry", [
      {
        key: "m1",
        payload: { date: "2026-10-10", tokens: 1500, costUsd: 0.003, latencyMs: 120 },
      },
      {
        key: "m2",
        payload: { date: "2026-10-10", tokens: 2500, costUsd: 0.005, latencyMs: 340 },
      },
      {
        key: "m3_other_day",
        payload: { date: "2026-10-09", tokens: 50000, costUsd: 1.0, latencyMs: 999 },
      },
    ]);

    const engine = new DailyStateEngine(mockAdapter);
    const summary = await engine.synthesize({ date: "2026-10-10" });

    expect(summary.totalTokensToday).toBe(4000);
    expect(summary.estimatedCostUsd).toBe(0.008);
    expect(summary.p99LatencyMs).toBe(340);
  });

  it("usa metadata.ts/agent_id reales de gov/audit vía list() (anti-fallback C03-list)", async () => {
    const TS = 1728570000000;
    storeMap.set("gov/audit", [
      {
        key: "dec-meta-1",
        payload: { id: "dec-meta-1", title: "Decisión vía metadata" },
        metadata: { ts: TS, agent_id: "subego.meta" },
      },
    ]);

    const engine = new DailyStateEngine(mockAdapter);
    const summary = await engine.synthesize({ date: "2026-10-10" });

    expect(summary.decisionsCount).toBe(1);
    // Anti-fallback: con metadata tagged sin desenvolver, timestamp caería a
    // now (Date.now()) y subEgoId a "ego.nucleus".
    expect(summary.recentDecisions).toHaveLength(1);
    expect(summary.recentDecisions[0].timestamp).toBe(TS);
    expect(summary.recentDecisions[0].subEgoId).toBe("subego.meta");
    expect(summary.recentDecisions[0].subEgoId).not.toBe("ego.nucleus");
  });
});
