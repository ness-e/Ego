import { describe, it, expect, vi } from "vitest";
import { BitemporalQueries } from "../src/BitemporalQueries.js";
import type { EgoMemoryAdapter } from "@ego/memory";

/**
 * F2T3 — Bitemporal completo (M12): cursor hasta agotar sobre 250+ registros,
 * preservación de `historical` y lectura de `state`/`is_latest` almacenados.
 *
 * El mock expone `getDb()` con paginación real por cursor (páginas de 100),
 * replicando el contrato `db.list({ namespace, limit, cursor })` del binding
 * nativo (ver `EgoMemoryAdapter.exportDump`, que ya pagina con cursor).
 * Los registros crudos usan metadata etiquetada (VDB-BUG-02).
 */

const tagged = (v: number | string | boolean): unknown => {
  if (typeof v === "number") return { Float: v };
  if (typeof v === "string") return { String: v };
  if (typeof v === "boolean") return { Bool: v };
  return v;
};

interface RawRecord {
  key: string;
  namespace: string;
  payload: string;
  metadata: Record<string, unknown>;
}

function buildStore(total: number, targetIndex: number): RawRecord[] {
  const store: RawRecord[] = [];
  for (let i = 0; i < total; i++) {
    store.push({
      key: `fact_${i}`,
      namespace: "kb/facts",
      payload: JSON.stringify({ n: i }),
      metadata: {
        fact_id: tagged(`fact_${i}`),
        subject: tagged("Stress"),
        predicate: tagged("relates_to"),
        object: tagged(`object_${i}`),
        confidence: tagged(0.9),
        temporal_scope: tagged("persistent"),
        source: tagged("test"),
        valid_at: tagged(1000),
        invalid_at: tagged(-1),
        state: tagged("active"),
        is_latest: tagged(true),
      },
    });
  }
  // Hecho objetivo más allá de la primera ventana (índice 250 de 260):
  // story histórica cerrada [1000, 2000) + scope historical + estado almacenado.
  store[targetIndex] = {
    key: `fact_${targetIndex}`,
    namespace: "kb/facts",
    payload: JSON.stringify({ n: targetIndex }),
    metadata: {
      fact_id: tagged(`fact_${targetIndex}`),
      subject: tagged("Arquitectura"),
      predicate: tagged("usa"),
      object: tagged("SQLite"),
      confidence: tagged(0.9),
      temporal_scope: tagged("historical"),
      source: tagged("historical"),
      valid_at: tagged(1000),
      invalid_at: tagged(2000),
      state: tagged("superseded"),
      is_latest: tagged(false),
      superseded_by: tagged("fact_new"),
    },
  };
  return store;
}

function mockAdapterWithCursor(store: RawRecord[]) {
  const listCalls: Array<{ namespace: string; limit: number; cursor?: string | number }> = [];
  const db = {
    list: vi.fn(
      async (input: { namespace: string; limit: number; cursor?: string | number }) => {
        listCalls.push(input);
        const start = typeof input.cursor === "number" ? input.cursor : 0;
        const slice = store.slice(start, start + input.limit);
        const next = start + input.limit < store.length ? start + input.limit : undefined;
        return {
          records: slice,
          ...(next !== undefined ? { next_cursor: next } : {}),
        };
      }
    ),
  };
  const adapter = {
    getDb: () => db,
    list: vi.fn(async () => {
      throw new Error("asOf debe paginar por cursor vía getDb, no por adapter.list");
    }),
  } as unknown as EgoMemoryAdapter;
  return { adapter, db, listCalls };
}

describe("F2T3 — BitemporalQueries con cursor (M12)", () => {
  it("recorre el namespace completo con cursor y encuentra hechos más allá de la primera página (250+ registros)", async () => {
    const TOTAL = 260;
    const TARGET = 250;
    const { adapter, db } = mockAdapterWithCursor(buildStore(TOTAL, TARGET));
    const bitemporal = new BitemporalQueries(adapter);

    const facts = await bitemporal.asOf(1500, { namespace: "kb/facts", limit: 500 });

    // El binding fue paginado con cursor hasta agotar (3 páginas de 100/100/60).
    expect(db.list).toHaveBeenCalledTimes(3);
    const withCursor = db.list.mock.calls.filter((c) => c[0].cursor !== undefined);
    expect(withCursor.length).toBe(2);

    const target = facts.find((f) => f.id === `fact_${TARGET}`);
    expect(target).toBeDefined();
    expect(target?.object).toBe("SQLite");
    expect(target?.validAt).toBe(1000);
  });

  it("preserva temporalScope historical en lugar de colapsarlo a persistent", async () => {
    const TOTAL = 260;
    const TARGET = 250;
    const { adapter } = mockAdapterWithCursor(buildStore(TOTAL, TARGET));
    const bitemporal = new BitemporalQueries(adapter);

    const facts = await bitemporal.asOf(1500, { namespace: "kb/facts", limit: 500 });
    const target = facts.find((f) => f.id === `fact_${TARGET}`);
    expect(target?.temporalScope).toBe("historical");
  });

  it("lee state/is_latest almacenados en lugar de derivarlos por fecha", async () => {
    const TOTAL = 260;
    const TARGET = 250;
    const { adapter } = mockAdapterWithCursor(buildStore(TOTAL, TARGET));
    const bitemporal = new BitemporalQueries(adapter);

    const facts = await bitemporal.asOf(1500, { namespace: "kb/facts", limit: 500 });
    const target = facts.find((f) => f.id === `fact_${TARGET}`);
    // Almacenado explícito, aunque la derivación por fecha diría otra cosa.
    expect(target?.state).toBe("superseded");
  });

  it("respeta el límite solicitado tras agotar el cursor", async () => {
    const TOTAL = 260;
    const TARGET = 250;
    const { adapter } = mockAdapterWithCursor(buildStore(TOTAL, TARGET));
    const bitemporal = new BitemporalQueries(adapter);

    const facts = await bitemporal.asOf(1500, { namespace: "kb/facts", limit: 10 });
    expect(facts.length).toBeLessThanOrEqual(10);
  });
});
