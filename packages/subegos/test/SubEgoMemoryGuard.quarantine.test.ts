import { describe, it, expect, vi } from "vitest";
import type { EgoMemoryAdapter, EgoPut } from "@ego/memory";
import { EgoMemoryAdapter as RealAdapter } from "@ego/memory";
import { SubEgoMemoryGuard } from "../src/SubEgoMemoryGuard.js";

/**
 * SEC-09 FIX-01 — SubEgoMemoryGuard quarantine-aware.
 * Tras el retiro de `egos/` del diferimiento, lo escrito va a
 * `quarantine/pending` y `get/recall/searchMulti` lo resuelven con marca
 * explícita (`metadata.quarantined:true` + motivo).
 */
function stubBackedAdapter(): RealAdapter {
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
  const adapter = new RealAdapter(`/tmp/ego-guard-fix-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  (adapter as unknown as { db: unknown }).db = db;
  return adapter;
}

describe("SubEgoMemoryGuard quarantine-aware (SEC-09 FIX-01)", () => {
  it("get resuelve vía cuarentena con marca explícita tras el retiro de egos/", async () => {
    const storage = stubBackedAdapter();
    const guard = new SubEgoMemoryGuard(storage, { callerSubEgoId: "ego.probador" });

    await guard.put({
      namespace: "egos/ego.probador/notas",
      key: "n1",
      payload: { text: "nota privada" },
    });

    // El live queda vacío (enforcement activo)…
    expect(await storage.get("egos/ego.probador/notas", "n1")).toBeNull();

    // …pero el guard lo resuelve con marca explícita.
    const found = (await guard.get("egos/ego.probador/notas", "n1")) as {
      payload?: unknown;
      metadata?: Record<string, unknown>;
    };
    expect(found).not.toBeNull();
    expect(found.metadata?.["quarantined"]).toBe(true);
    expect(typeof found.metadata?.["quarantine_reason"]).toBe("string");
  });

  it("get retorna null cuando no existe en live ni en cuarentena", async () => {
    const storage = stubBackedAdapter();
    const guard = new SubEgoMemoryGuard(storage, { callerSubEgoId: "ego.probador" });
    expect(await guard.get("egos/ego.probador/notas", "inexistente")).toBeNull();
  });

  it("get conserva el aislamiento: el estado ajeno sigue denegado sin tocar cuarentena", async () => {
    const getSpy = vi.fn(async () => null);
    const fake = {
      get: getSpy,
      list: vi.fn(async () => ({ records: [] })),
      searchMulti: vi.fn(async () => []),
      recall: vi.fn(async () => null),
    } as unknown as EgoMemoryAdapter;
    const guard = new SubEgoMemoryGuard(fake, { callerSubEgoId: "ego.a" });
    await expect(guard.get("egos/ego.b/privado", "x")).rejects.toThrow();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("recall resuelve vía cuarentena para claves exactas ausentes en live", async () => {
    const storage = stubBackedAdapter();
    const guard = new SubEgoMemoryGuard(storage, { callerSubEgoId: "ego.probador" });
    await guard.put({
      namespace: "egos/ego.probador/notas",
      key: "clave-1",
      payload: { text: "recuerdo" },
    });

    const found = (await guard.recall("clave-1", "egos/ego.probador/notas")) as {
      metadata?: Record<string, unknown>;
    } | null;
    expect(found).not.toBeNull();
    expect(found?.metadata?.["quarantined"]).toBe(true);
  });

  it("searchMulti fusiona hits live + cuarentena filtrados por namespace y marcados", async () => {
    const liveHit = {
      record: { namespace: "egos/ego.probador/notas", key: "live-1", payload: "a", metadata: {} },
      score: 0.9,
    };
    const quarantineHitMatch = {
      // Hit crudo del binding: metadata etiquetada sin desenvolver.
      record: {
        namespace: "quarantine/pending",
        key: "egos/ego.probador/notas:q-1",
        payload: "b",
        metadata: {
          original_namespace: { String: "egos/ego.probador/notas" },
          original_key: { String: "q-1" },
          quarantine_reason: { String: "sensitive_namespace_no_at_rest_encryption" },
        },
      },
      score: 0.8,
    };
    const quarantineHitOther = {
      record: {
        namespace: "quarantine/pending",
        key: "finance/transactions:tx",
        payload: "c",
        metadata: {
          original_namespace: { String: "finance/transactions" },
          quarantine_reason: { String: "sensitive_namespace_no_at_rest_encryption" },
        },
      },
      score: 0.7,
    };
    const searchMulti = vi.fn(async (namespaces: string[]) => {
      if (namespaces.includes("quarantine/pending")) return [quarantineHitMatch, quarantineHitOther];
      return [liveHit];
    });
    const fake = {
      put: vi.fn(async (item: EgoPut) => ({ item })),
      putMulti: vi.fn(async (items: EgoPut[]) => items),
      get: vi.fn(async () => null),
      list: vi.fn(async () => ({ records: [] })),
      searchMulti,
      recall: vi.fn(async () => null),
      delete: vi.fn(async () => true),
    } as unknown as EgoMemoryAdapter;

    const guard = new SubEgoMemoryGuard(fake, { callerSubEgoId: "ego.probador" });
    const hits = (await guard.searchMulti(["egos/ego.probador/notas"], "nota")) as Array<{
      record: { key: string; metadata?: Record<string, unknown> };
      score: number;
    }>;
    expect(hits).toHaveLength(2);
    const marked = hits.find((h) => h.record.key === "egos/ego.probador/notas:q-1");
    expect(marked?.record.metadata?.["quarantined"]).toBe(true);
    // El hit de otro dominio no se filtra.
    expect(hits.some((h) => h.record.key === "finance/transactions:tx")).toBe(false);
  });
});
