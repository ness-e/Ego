import { describe, it, expect, vi, beforeEach } from "vitest";
import { DailyStatePersistence } from "../src/DailyStatePersistence.js";
import { DailyStateSummary } from "../src/types.js";

describe("DailyStatePersistence (DS-08 / COUC-09)", () => {
  let mockAdapter: any;
  let mockEventBus: any;
  const storeMap = new Map<string, unknown>();

  beforeEach(() => {
    storeMap.clear();
    mockAdapter = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        storeMap.set(`${item.namespace}:${item.key}`, item.payload);
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        const stored = storeMap.get(`${namespace}:${key}`);
        return stored === undefined ? null : { key, payload: stored, metadata: {} };
      }),
      list: vi.fn(async (namespace: string, limit?: number) => {
        const results: Array<{ key: string; payload: unknown }> = [];
        for (const [k, v] of storeMap.entries()) {
          if (k.startsWith(`${namespace}:`)) {
            const itemKey = k.split(":")[1];
            results.push({ key: itemKey, payload: v });
          }
        }
        return results;
      }),
    };

    mockEventBus = {
      emit: vi.fn(),
    };
  });

  const mockSummary: DailyStateSummary = {
    date: "2026-10-10",
    timestamp: 1728560000000,
    completedTasksCount: 5,
    pendingTasksCount: 2,
    pendingApprovalsCount: 0,
    decisionsCount: 3,
    quarantineAlertsCount: 0,
    totalTokensToday: 12500,
    estimatedCostUsd: 0.025,
    p99LatencyMs: 180,
    recentDecisions: [
      { id: "dec-1", title: "ADR-049 Daily State", timestamp: 1728560000000, subEgoId: "ego.architect" },
    ],
    suggestedGoals: [
      { id: "goal-1", title: "Cerrar Fase 08", priority: "high", reason: "Plan canónico en marcha" },
    ],
  };

  it("guarda snapshot con checksum SHA-256 e inmutabilidad en VantaDB", async () => {
    const persistence = new DailyStatePersistence(mockAdapter, { eventBus: mockEventBus });
    const record = await persistence.saveSnapshot(mockSummary, "journal-2026-10-10");

    expect(record.date).toBe("2026-10-10");
    expect(record.checksum).toHaveLength(64);
    expect(record.journalEntryId).toBe("journal-2026-10-10");

    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "system/snapshots/daily",
        key: "2026-10-10",
        metadata: expect.objectContaining({
          date: "2026-10-10",
          checksum: record.checksum,
        }),
      })
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      "daily.snapshot.saved",
      expect.objectContaining({ date: "2026-10-10" }),
      expect.objectContaining({ source: "DailyStatePersistence" })
    );
  });

  it("recupera un snapshot existente y valida su integridad", async () => {
    const persistence = new DailyStatePersistence(mockAdapter, { eventBus: mockEventBus });
    await persistence.saveSnapshot(mockSummary);

    const retrieved = await persistence.getSnapshot("2026-10-10");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.date).toBe("2026-10-10");
    expect(retrieved?.summary.completedTasksCount).toBe(5);

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      "daily.snapshot.restored",
      expect.objectContaining({ date: "2026-10-10" }),
      expect.objectContaining({ source: "DailyStatePersistence" })
    );
  });

  it("devuelve null cuando el snapshot no existe", async () => {
    const persistence = new DailyStatePersistence(mockAdapter);
    const retrieved = await persistence.getSnapshot("1999-01-01");
    expect(retrieved).toBeNull();
  });

  it("lista snapshots históricos ordenados cronológicamente descendente", async () => {
    const persistence = new DailyStatePersistence(mockAdapter);
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-08" });
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-10" });
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-09" });

    const list = await persistence.listSnapshots();
    expect(list).toHaveLength(3);
    expect(list[0].date).toBe("2026-10-10");
    expect(list[1].date).toBe("2026-10-09");
    expect(list[2].date).toBe("2026-10-08");
  });

  it("detecta correctamente si es el primer inicio del día (COUC-06)", async () => {
    const persistence = new DailyStatePersistence(mockAdapter);

    // Antes de guardar: es el primer inicio
    const isFirstBefore = await persistence.isFirstLaunchOfDay("2026-10-10");
    expect(isFirstBefore).toBe(true);

    // Guardar snapshot
    await persistence.saveSnapshot(mockSummary);

    // Después de guardar: ya no es el primer inicio
    const isFirstAfter = await persistence.isFirstLaunchOfDay("2026-10-10");
    expect(isFirstAfter).toBe(false);
  });
});
