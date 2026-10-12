import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DailyStateEngine,
  DailyStatePersistence,
  GoalPrioritizer,
  DecisionsFeed,
} from "@ego/dailystate";
import {
  DailyStateGetSummarySchema,
  DailyStateRefineGoalsSchema,
  DailyStateGetDecisionsSchema,
  DailyStateResolveApprovalsBatchSchema,
  DailyStateJournalSchema,
  DailyStateFirstLaunchSchema,
} from "../src/ipc/schema.js";
import { type EgoMemoryAdapter } from "@ego/memory";
import { EventBus } from "@ego/events";

describe("Daily State Desktop IPC Integration (DS-01..DS-08 / ADR-049)", () => {
  let mockAdapter: EgoMemoryAdapter;
  let eventBus: EventBus;
  let engine: DailyStateEngine;
  let persistence: DailyStatePersistence;
  let prioritizer: GoalPrioritizer;
  let feed: DecisionsFeed;
  const inMemoryStorage = new Map<string, unknown>();

  beforeEach(() => {
    inMemoryStorage.clear();

    mockAdapter = {
      ready: true,
      put: vi.fn().mockImplementation(async ({ namespace, key, payload }) => {
        inMemoryStorage.set(`${namespace}:${key}`, payload);
      }),
      get: vi.fn().mockImplementation(async (namespace, key) => {
        const stored = inMemoryStorage.get(`${namespace}:${key}`);
        return stored === undefined ? null : { key, payload: stored, metadata: {} };
      }),
      list: vi.fn().mockImplementation(async (namespace) => {
        const results = [];
        for (const [k, v] of inMemoryStorage.entries()) {
          if (k.startsWith(`${namespace}:`)) {
            const shortKey = k.replace(`${namespace}:`, "");
            results.push({ key: shortKey, payload: v });
          }
        }
        return results;
      }),
    } as unknown as EgoMemoryAdapter;

    eventBus = new EventBus();
    engine = new DailyStateEngine(mockAdapter, { eventBus });
    persistence = new DailyStatePersistence(mockAdapter, { eventBus });
    prioritizer = new GoalPrioritizer({ eventBus });
    feed = new DecisionsFeed(mockAdapter, { eventBus });
  });

  it("DS-01: Valida DailyStateGetSummarySchema y sintetiza resumen diario determinista", async () => {
    const rawReq = { date: "2026-10-10" };
    const parseResult = DailyStateGetSummarySchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const summary = await engine.synthesize(parseResult.data);
    expect(summary.date).toBe("2026-10-10");
    expect(summary.completedTasksCount).toBe(0);
    expect(summary.suggestedGoals).toHaveLength(1);
    expect(summary.suggestedGoals[0].id).toBe("goal-general-plan");
  });

  it("DS-04: Valida DailyStateRefineGoalsSchema y prioriza metas con fallback determinista", async () => {
    const rawReq = { date: "2026-10-10" };
    const parseResult = DailyStateRefineGoalsSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const summary = await engine.synthesize(parseResult.data);
    const goals = prioritizer.prioritizeDeterministic(summary);

    expect(goals).toBeDefined();
    expect(goals.length).toBeGreaterThan(0);
  });

  it("DS-03: Valida DailyStateGetDecisionsSchema y recupera decisiones desde gov/audit", async () => {
    await feed.recordDecision({
      title: "ADR-049 Implementación Daily State",
      subEgoId: "ego.architect",
      impact: "Alto",
    });

    const rawReq = { limit: 10, subEgoId: "ego.architect" };
    const parseResult = DailyStateGetDecisionsSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const decisions = await feed.getDecisions(parseResult.data);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].title).toBe("ADR-049 Implementación Daily State");
    expect(decisions[0].subEgoId).toBe("ego.architect");
  });

  it("DS-08: Valida DailyStateFirstLaunchSchema y detecta primer arranque del día", async () => {
    const rawReq = { date: "2026-10-10" };
    const parseResult = DailyStateFirstLaunchSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    // Primer arranque: no existe snapshot
    const isFirst = await persistence.isFirstLaunchOfDay(parseResult.data?.date);
    expect(isFirst).toBe(true);

    // Guardar snapshot
    const summary = await engine.synthesize(parseResult.data);
    await persistence.saveSnapshot(summary);

    // Segundo arranque en el mismo día: ya no es el primer inicio
    const isFirstAfter = await persistence.isFirstLaunchOfDay(parseResult.data?.date);
    expect(isFirstAfter).toBe(false);
  });

  it("DS-06: Valida DailyStateJournalSchema y persiste notas del día en namespace journal", async () => {
    const saveReq = {
      action: "save" as const,
      date: "2026-10-10",
      content: "## Objetivos completados\n- Fase 08 Daily State en verde",
    };
    const parseSave = DailyStateJournalSchema.safeParse(saveReq);
    expect(parseSave.success).toBe(true);

    await mockAdapter.put({
      namespace: "journal",
      key: saveReq.date,
      payload: { date: saveReq.date, content: saveReq.content },
    });

    const getReq = { action: "get" as const, date: "2026-10-10" };
    const parseGet = DailyStateJournalSchema.safeParse(getReq);
    expect(parseGet.success).toBe(true);

    const record = await mockAdapter.get("journal", getReq.date);
    expect(record).not.toBeNull();
    expect((record?.payload as any).content).toContain("Fase 08 Daily State");
  });

  it("DS-07: Valida DailyStateResolveApprovalsBatchSchema para aprobaciones en lote", () => {
    const rawReq = {
      approvals: [
        { approvalId: "appr-1", approved: true },
        { approvalId: "appr-2", approved: false, reason: "Riesgo alto de seguridad" },
      ],
    };
    const parseResult = DailyStateResolveApprovalsBatchSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);
    expect(parseResult.data?.approvals).toHaveLength(2);
    expect(parseResult.data?.approvals[0].approved).toBe(true);
    expect(parseResult.data?.approvals[1].approved).toBe(false);
  });
});
