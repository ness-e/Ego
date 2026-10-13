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

  it("detecta correctamente si es el primer inicio del día (COUC-06)", async () => {    const persistence = new DailyStatePersistence(mockAdapter);

    // Antes de guardar: es el primer inicio
    const isFirstBefore = await persistence.isFirstLaunchOfDay("2026-10-10");
    expect(isFirstBefore).toBe(true);

    // Guardar snapshot
    await persistence.saveSnapshot(mockSummary);

    // Después de guardar: ya no es el primer inicio
    const isFirstAfter = await persistence.isFirstLaunchOfDay("2026-10-10");
    expect(isFirstAfter).toBe(false);
  });

  it("fail-closed (H15): retorna null y emite system.alert ante checksum manipulado", async () => {
    const persistence = new DailyStatePersistence(mockAdapter, { eventBus: mockEventBus });
    await persistence.saveSnapshot(mockSummary);
    mockEventBus.emit.mockClear();

    // Manipular el payload almacenado (atacante / corrupción en disco)
    const stored = await mockAdapter.list("system/snapshots/daily");
    expect(stored).toHaveLength(1);
    (stored[0].payload as { summary: DailyStateSummary }).summary.completedTasksCount = 999;

    const retrieved = await persistence.getSnapshot("2026-10-10");

    // Fail-closed: NUNCA retorna el registro manipulado
    expect(retrieved).toBeNull();

    // Alerta estructurada (no solo warn decorativo)
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      "system.alert",
      expect.objectContaining({ code: "DAILY_CHECKSUM_MISMATCH" }),
      expect.objectContaining({ source: "DailyStatePersistence" })
    );

    // Y NO emite restored sobre datos corruptos
    const restoredCalls = mockEventBus.emit.mock.calls.filter(
      (c: unknown[]) => c[0] === "daily.snapshot.restored"
    );
    expect(restoredCalls).toHaveLength(0);
  });

  it("fail-closed (H15): listSnapshots omite registros con checksum inválido", async () => {
    const persistence = new DailyStatePersistence(mockAdapter, { eventBus: mockEventBus });
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-10" });
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-09" });

    const stored = await mockAdapter.list("system/snapshots/daily");
    const tampered = stored.find(
      (r: { payload: { date: string } }) => r.payload.date === "2026-10-09"
    );
    (tampered.payload as { summary: DailyStateSummary }).summary.pendingTasksCount = 4242;

    const list = await persistence.listSnapshots();
    expect(list.map((s) => s.date)).toEqual(["2026-10-10"]);
  });
});

describe("DailyStatePersistence quarantine-aware (HIG-04 / SEC-09)", () => {
  const NS = "system/snapshots/daily";
  const QNS = "quarantine/pending";
  const qkey = (date: string) => `${NS}:${date}`;
  const ORIGINAL_META = {
    original_namespace: NS,
    quarantine_reason: "sensitive_namespace_no_at_rest_encryption",
  };

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
    recentDecisions: [],
    suggestedGoals: [],
  };

  /**
   * Mock que emula el enforcement SEC-09 ACTIVO (diferimiento retirado):
   * `put` enruta a `quarantine/pending` con `original_namespace` /
   * `original_key`, mientras `get`/`list` en el namespace lógico solo ven
   * live. Un lector solo-live queda ciego; el lector quarantine-aware no.
   */
  function enforcingAdapter() {
    const live = new Map<string, { payload: unknown; metadata: unknown }>();
    const pending = new Map<string, { payload: unknown; metadata: unknown }>();
    return {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        if (item.namespace === NS || item.namespace.startsWith(`${NS}/`)) {
          pending.set(`${QNS}:${qkey(item.key)}`, {
            payload: item.payload,
            metadata: { ...ORIGINAL_META, original_key: item.key },
          });
          return;
        }
        live.set(`${item.namespace}:${item.key}`, { payload: item.payload, metadata: {} });
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        const hit = live.get(`${namespace}:${key}`) ?? pending.get(`${namespace}:${key}`);
        return hit === undefined ? null : { key, payload: hit.payload, metadata: hit.metadata };
      }),
      list: vi.fn(async (namespace: string, limit?: number) => {
        const source = namespace === QNS ? pending : live;
        const out: Array<{ key: string; payload: unknown; metadata: unknown }> = [];
        for (const [k, v] of source.entries()) {
          if (k.startsWith(`${namespace}:`)) {
            out.push({ key: k.slice(namespace.length + 1), payload: v.payload, metadata: v.metadata });
          }
        }
        return out.slice(0, limit);
      }),
    };
  }

  it("cold-reboot vía cuarentena: getSnapshot resuelve un snapshot enrutado a quarantine/pending", async () => {
    const adapter = enforcingAdapter();
    const writer = new DailyStatePersistence(adapter);
    const saved = await writer.saveSnapshot(mockSummary);

    // El enforcement activo deja el namespace lógico vacío (live ciego)…
    expect(await adapter.get(NS, "2026-10-10")).toBeNull();

    // …pero una instancia fresca (cold-reboot) lo recupera vía cuarentena.
    const rebooted = new DailyStatePersistence(adapter);
    const retrieved = await rebooted.getSnapshot("2026-10-10");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.checksum).toBe(saved.checksum);
    expect(retrieved?.summary.completedTasksCount).toBe(5);
  });

  it("cold-reboot vía cuarentena: listSnapshots fusiona live + cuarentena ordenados", async () => {
    const adapter = enforcingAdapter();
    const persistence = new DailyStatePersistence(adapter);
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-09" });
    await persistence.saveSnapshot({ ...mockSummary, date: "2026-10-10" });

    const list = await persistence.listSnapshots();
    expect(list.map((s) => s.date)).toEqual(["2026-10-10", "2026-10-09"]);
  });

  it("cold-reboot vía cuarentena: isFirstLaunchOfDay es false con snapshot en cuarentena", async () => {
    const adapter = enforcingAdapter();
    const persistence = new DailyStatePersistence(adapter);
    expect(await persistence.isFirstLaunchOfDay("2026-10-10")).toBe(true);
    await persistence.saveSnapshot(mockSummary);
    expect(await persistence.isFirstLaunchOfDay("2026-10-10")).toBe(false);
  });

  it("fail-closed en cuarentena: checksum manipulado en quarantine/pending retorna null", async () => {
    const adapter = enforcingAdapter();
    const mockEventBus = { emit: vi.fn() };
    const persistence = new DailyStatePersistence(adapter, { eventBus: mockEventBus });
    await persistence.saveSnapshot(mockSummary);

    const pending = await adapter.list(QNS, 100);
    expect(pending).toHaveLength(1);
    (pending[0].payload as { summary: DailyStateSummary }).summary.completedTasksCount = 999;

    expect(await persistence.getSnapshot("2026-10-10")).toBeNull();
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      "system.alert",
      expect.objectContaining({ code: "DAILY_CHECKSUM_MISMATCH" }),
      expect.objectContaining({ source: "DailyStatePersistence" })
    );
  });
});
