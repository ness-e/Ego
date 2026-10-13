import { describe, it, expect, vi, afterEach } from "vitest";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import type { QuarantinedEventInfo } from "../EgoMemoryAdapter.js";
import { SessionCheckpointPolicy } from "../SessionCheckpointPolicy.js";
import { EgoMemoryLifecycle } from "../EgoMemoryLifecycle.js";

/**
 * SEC-09 follow-up (FIX-01 + FIX-02, aprobado por el owner).
 * Prueba la lectura vía cuarentena y el evento emitido:
 * - `setQuarantineSink` recibe `QuarantinedEventInfo` sin valores (FIX-02);
 * - `getWithQuarantine`/`listWithQuarantine` resuelven lo enrutado (FIX-01);
 * - `SessionCheckpointPolicy.loadCheckpoint` y
 *   `EgoMemoryLifecycle.loadMicroCheckpoint` leen vía cuarentena (FIX-01).
 * Solo canarios sintéticos sk-test-*. NUNCA secretos reales.
 */
const CANARY = "sk-test-sec09-fix01-canary";

interface StubHarness {
  adapter: EgoMemoryAdapter;
  store: Map<string, { payload: unknown; metadata: unknown }>;
}

function stubHarness(): StubHarness {
  const store = new Map<string, { payload: unknown; metadata: unknown }>();
  const db = {
    putBatch: async (recs: Array<{ namespace: string; key: string; payload: unknown; metadata: unknown }>) => {
      for (const r of recs) {
        store.set(`${r.namespace}:${r.key}`, { payload: r.payload, metadata: r.metadata });
      }
    },
    put: async (rec: { namespace: string; key: string; payload: unknown; metadata: unknown }) => {
      store.set(`${rec.namespace}:${rec.key}`, { payload: rec.payload, metadata: rec.metadata });
    },
    get: async ({ namespace, key }: { namespace: string; key: string }) => {
      const hit = store.get(`${namespace}:${key}`);
      return hit ? { key, payload: hit.payload, metadata: hit.metadata } : null;
    },
    list: async ({ namespace, limit }: { namespace: string; limit: number }) => ({
      records: [...store.entries()]
        .filter(([k]) => k.startsWith(`${namespace}:`))
        .slice(0, limit)
        .map(([k, v]) => ({ key: k.slice(namespace.length + 1), payload: v.payload, metadata: v.metadata })),
      next_cursor: undefined,
    }),
    listNamespaces: async () => [...new Set([...store.keys()].map((k) => k.split(":")[0]))],
    search: async () => [],
    delete: async ({ namespace, key }: { namespace: string; key: string }) =>
      store.delete(`${namespace}:${key}`),
    flush: async () => {},
  };
  const adapter = new EgoMemoryAdapter(`/tmp/ego-sec09-fix-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  (adapter as unknown as { db: unknown }).db = db;
  return { adapter, store };
}

describe("SEC-09 FIX-02 — sink de cuarentena (evento emitido, sin valores)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite el evento al enrutar un namespace sensible a cuarentena", async () => {
    const { adapter } = stubHarness();
    const seen: QuarantinedEventInfo[] = [];
    adapter.setQuarantineSink((info) => {
      seen.push(info);
    });

    const [report] = await adapter.putMulti([
      { namespace: "finance/transactions", key: "tx:fix", payload: { amount: 100, note: "pago" } },
    ]);
    expect(report.routedTo).toBe("quarantine");
    expect(seen).toHaveLength(1);
    expect(seen[0].namespace).toBe("finance/transactions");
    expect(seen[0].key).toBe("tx:fix");
    expect(seen[0].destinationNamespace).toBe("quarantine/pending");
    expect(seen[0].kind).toBe("sensitive_namespace");
    expect(JSON.stringify(seen[0])).not.toContain("pago");
  });

  it("emite el evento con reglas ante secretos, sin el valor en el aviso", async () => {
    const { adapter } = stubHarness();
    const seen: QuarantinedEventInfo[] = [];
    adapter.setQuarantineSink((info) => {
      seen.push(info);
    });

    const [report] = await adapter.putMulti([
      { namespace: "kb/docs", key: "doc:fix", payload: `mi clave es ${CANARY}` },
    ]);
    expect(report.routedTo).toBe("quarantine");
    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe("secret_detected");
    expect((seen[0].rules ?? []).join(",")).toMatch(/canary/);
    expect(JSON.stringify(seen)).not.toContain(CANARY);
    expect(seen[0].notice).not.toContain(CANARY);
  });

  it("un sink que lanza no rompe el routing (fire-and-forget defensivo)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { adapter } = stubHarness();
    adapter.setQuarantineSink(() => {
      throw new Error("sink roto");
    });

    const [report] = await adapter.putMulti([
      { namespace: "journal/entries", key: "j:fix", payload: "diario" },
    ]);
    expect(report.routedTo).toBe("quarantine");
    expect(await adapter.get("journal/entries", "j:fix")).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it("sin sink registrado el routing funciona igual (compatibilidad)", async () => {
    const { adapter } = stubHarness();
    const [report] = await adapter.putMulti([
      { namespace: "journal/entries", key: "j:nosink", payload: "diario" },
    ]);
    expect(report.routedTo).toBe("quarantine");
  });
});

describe("SEC-09 FIX-01 — lecturas quarantine-aware del adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getWithQuarantine resuelve vía cuarentena con marca explícita", async () => {
    const { adapter } = stubHarness();
    await adapter.put({ namespace: "finance/transactions", key: "tx:1", payload: { amount: 50 } });

    expect(await adapter.get("finance/transactions", "tx:1")).toBeNull();

    const hit = await adapter.getWithQuarantine("finance/transactions", "tx:1");
    expect(hit).not.toBeNull();
    expect(hit?.quarantined).toBe(true);
    expect(hit?.key).toBe("tx:1");
    expect(hit?.quarantineReason).toBe("sensitive_namespace_no_at_rest_encryption");
  });

  it("getWithQuarantine retorna live sin marca cuando el registro está en vivo", async () => {
    const { adapter } = stubHarness();
    await adapter.put({ namespace: "kb/docs", key: "k:live", payload: "hola" });

    const hit = await adapter.getWithQuarantine("kb/docs", "k:live");
    expect(hit?.quarantined).toBe(false);
    expect(hit?.payload).toBe("hola");
  });

  it("getWithQuarantine retorna null cuando no existe en ningún lado", async () => {
    const { adapter } = stubHarness();
    expect(await adapter.getWithQuarantine("kb/docs", "inexistente")).toBeNull();
  });

  it("listWithQuarantine fusiona live + cuarentena con marca por registro", async () => {
    const { adapter } = stubHarness();
    await adapter.put({ namespace: "kb/docs", key: "k:live", payload: "hola" });
    await adapter.put({ namespace: "finance/transactions", key: "tx:a", payload: { amount: 1 } });
    await adapter.put({ namespace: "finance/transactions", key: "tx:b", payload: { amount: 2 } });

    const finance = await adapter.listWithQuarantine("finance/transactions");
    expect(finance).toHaveLength(2);
    expect(finance.every((r) => r.quarantined)).toBe(true);
    expect(new Set(finance.map((r) => r.key))).toEqual(new Set(["tx:a", "tx:b"]));

    const kb = await adapter.listWithQuarantine("kb/docs");
    expect(kb).toHaveLength(1);
    expect(kb[0].quarantined).toBe(false);
  });

  it("SessionCheckpointPolicy.loadCheckpoint lee un snapshot en cuarentena con marca", async () => {
    const { adapter } = stubHarness();
    const policy = new SessionCheckpointPolicy(adapter, { checkpointIntervalTurns: 100 });
    const ts = Date.now();
    await adapter.quarantine(
      {
        namespace: "system/snapshots",
        key: "checkpoint:sess_q:manual",
        payload: {
          checkpointId: "manual",
          sessionId: "sess_q",
          turnId: "turn_9",
          turnCount: 9,
          timestamp: ts,
          summary: { note: "snapshot supervisado" },
        },
      },
      "sensitive_namespace_no_at_rest_encryption"
    );

    const loaded = await policy.loadCheckpoint("sess_q", "manual");
    expect(loaded).not.toBeNull();
    expect(loaded?.turnCount).toBe(9);
    expect(loaded?.quarantined).toBe(true);

    const listed = await policy.listCheckpoints("sess_q");
    expect(listed.some((c) => c.checkpointId === "manual" && c.quarantined)).toBe(true);
  });

  it("SessionCheckpointPolicy.loadCheckpoint retorna null ante ausencia o payload ilegible", async () => {
    const { adapter } = stubHarness();
    const policy = new SessionCheckpointPolicy(adapter, { checkpointIntervalTurns: 100 });
    expect(await policy.loadCheckpoint("nadie", "nada")).toBeNull();
  });

  it("EgoMemoryLifecycle.loadMicroCheckpoint lee vía cuarentena tras el retiro de system/checkpoints", async () => {
    const { adapter } = stubHarness();
    const lifecycle = new EgoMemoryLifecycle(adapter);

    const checkpointId = await lifecycle.createMicroCheckpoint("task_fix", { step: 3 });
    // Tras FIX-01 el enforcement ya no se difiere: el live queda vacío…
    expect(await adapter.get("system/checkpoints", checkpointId)).toBeNull();
    // …y la vía canónica de lectura lo resuelve con marca explícita.
    const loaded = await lifecycle.loadMicroCheckpoint(checkpointId);
    expect(loaded).not.toBeNull();
    expect(loaded?.taskId).toBe("task_fix");
    expect(loaded?.quarantined).toBe(true);
  });

  it("EgoMemoryLifecycle.loadMicroCheckpoint retorna null ante ausencia", async () => {
    const { adapter } = stubHarness();
    const lifecycle = new EgoMemoryLifecycle(adapter);
    expect(await lifecycle.loadMicroCheckpoint("chk_inexistente")).toBeNull();
  });
});
