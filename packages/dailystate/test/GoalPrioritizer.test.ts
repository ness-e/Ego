import { describe, it, expect, vi } from "vitest";
import { GoalPrioritizer } from "../src/GoalPrioritizer.js";
import { DailyStateSummary } from "../src/types.js";

describe("GoalPrioritizer (DS-04)", () => {
  const baseSummary: DailyStateSummary = {
    date: "2026-10-10",
    timestamp: 1728560000000,
    completedTasksCount: 0,
    pendingTasksCount: 0,
    pendingApprovalsCount: 0,
    decisionsCount: 0,
    quarantineAlertsCount: 0,
    totalTokensToday: 0,
    estimatedCostUsd: 0,
    p99LatencyMs: 0,
    recentDecisions: [],
    suggestedGoals: [],
  };

  it("genera meta por defecto si no hay pendientes ni alertas ($0 tokens)", () => {
    const prioritizer = new GoalPrioritizer();
    const goals = prioritizer.prioritizeDeterministic(baseSummary);

    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe("goal-general-plan");
    expect(goals[0].priority).toBe("normal");
  });

  it("prioriza alertas de cuarentena y HITL con prioridad 'high'", () => {
    const prioritizer = new GoalPrioritizer();
    const goals = prioritizer.prioritizeDeterministic({
      ...baseSummary,
      quarantineAlertsCount: 2,
      pendingApprovalsCount: 1,
      pendingTasksCount: 3,
    });

    expect(goals).toHaveLength(3);
    const quarantine = goals.find((g) => g.id === "goal-quarantine");
    const approvals = goals.find((g) => g.id === "goal-approvals");
    const tasks = goals.find((g) => g.id === "goal-pending-tasks");

    expect(quarantine?.priority).toBe("high");
    expect(approvals?.priority).toBe("high");
    expect(tasks?.priority).toBe("normal");
  });

  it("refina con IA bajo demanda si el router está disponible", async () => {
    const mockRouter: any = {
      generateText: vi.fn(async () => ({
        text: JSON.stringify([
          {
            id: "goal-ai-1",
            title: "Desplegar release v0.8",
            priority: "high",
            reason: "Todos los quality gates están en verde",
          },
        ]),
      })),
    };

    const prioritizer = new GoalPrioritizer();
    const goals = await prioritizer.refineWithAI(baseSummary, mockRouter);

    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe("goal-ai-1");
    expect(goals[0].title).toBe("Desplegar release v0.8");
    expect(mockRouter.generateText).toHaveBeenCalled();
  });

  it("degrada a determinista si el router de IA falla o genera respuesta inválida", async () => {
    const mockRouter: any = {
      generateText: vi.fn(async () => {
        throw new Error("API rate limit exceeded");
      }),
    };

    const prioritizer = new GoalPrioritizer();
    const goals = await prioritizer.refineWithAI(baseSummary, mockRouter);

    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe("goal-general-plan");
  });
});
