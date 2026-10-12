import { describe, it, expect, vi } from "vitest";
import { ProjectMemoryGraph } from "../src/ProjectMemoryGraph.js";
import type { EgoMemoryAdapter } from "@ego/memory";

/**
 * F2T5 Slice 1 (M10) — ProjectMemoryGraph: batch putMulti+flush + cursor.
 *
 * - `recordEngineeringTrace` debe escribir traza + refs en un solo `putMulti`
 *   con barrera `flush` (no N+1 puts sin durabilidad).
 * - `explainArtifact` debe paginar `proj/file_traces` con cursor hasta agotar
 *   (no ventana fija de 10) y coincidir por clave exacta de ref.
 */

const TRACE_FILE = (i: number): string => `packages/app/src/mod_${i}.ts`;

function refKey(file: string, traceId: string): string {
  return `ref:${Buffer.from(file).toString("hex")}:${traceId}`;
}

interface CursorStoreEntry {
  key: string;
  payload: string;
  metadata: Record<string, unknown>;
}

function buildRefStore(total: number): CursorStoreEntry[] {
  const store: CursorStoreEntry[] = [];
  for (let i = 0; i < total; i++) {
    const file = TRACE_FILE(i);
    store.push({
      key: refKey(file, `trace_${i}`),
      payload: `trace_${i}`,
      metadata: {},
    });
  }
  return store;
}

/** Mock con cursor real por páginas + putMulti/flush espiables. */
function mockAdapterWithCursor(store: CursorStoreEntry[]) {
  const dbList = vi.fn(
    async (input: { namespace: string; limit: number; cursor?: string | number }) => {
      const start = typeof input.cursor === "number" ? input.cursor : 0;
      const slice = store.slice(start, start + input.limit);
      const next = start + input.limit < store.length ? start + input.limit : undefined;
      return {
        records: slice,
        ...(next !== undefined ? { next_cursor: next } : {}),
      };
    }
  );
  const adapter = {
    put: vi.fn(async () => undefined),
    putMulti: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
    get: vi.fn(async (namespace: string, key: string) => ({
      key,
      payload: `Traza ${key}`,
      metadata: {
        decision_id: `dec_${key}`,
        commit_hash: "abc123",
        affected_files_json: JSON.stringify([TRACE_FILE(Number(key.split("_")[1]))]),
        test_files_json: JSON.stringify([]),
        outcome: "ok",
      },
    })),
    list: vi.fn(async () => {
      throw new Error("explainArtifact debe paginar por cursor vía getDb, no por adapter.list");
    }),
    getDb: () => ({ list: dbList }),
  } as unknown as EgoMemoryAdapter;
  return { adapter, dbList };
}

/** Mock legacy sin getDb: `list` respeta `limit` como el adapter real. */
function mockLegacyAdapter(store: CursorStoreEntry[]) {
  const adapter = {
    put: vi.fn(async () => undefined),
    putMulti: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
    get: vi.fn(async (namespace: string, key: string) => ({
      key,
      payload: `Traza ${key}`,
      metadata: {
        decision_id: `dec_${key}`,
        commit_hash: "abc123",
        affected_files_json: JSON.stringify([TRACE_FILE(Number(key.split("_")[1]))]),
        test_files_json: JSON.stringify([]),
        outcome: "ok",
      },
    })),
    list: vi.fn(async (_namespace: string, limit: number) => store.slice(0, limit)),
  } as unknown as EgoMemoryAdapter;
  return adapter;
}

describe("F2T5 Slice 1 (M10) — ProjectMemoryGraph batch + cursor", () => {
  it("recordEngineeringTrace escribe traza + refs en un solo putMulti con flush", async () => {
    const { adapter } = mockAdapterWithCursor([]);
    const graph = new ProjectMemoryGraph(adapter);

    await graph.recordEngineeringTrace({
      id: "trace_batch",
      decisionId: "dec_batch",
      commitHash: "deadbee",
      affectedFiles: ["a.ts", "b.ts", "c.ts"],
      testFiles: ["a.test.ts"],
      outcome: "ok",
      timestamp: 1000,
    });

    const putMulti = vi.mocked(
      (adapter as unknown as { putMulti: (...args: unknown[]) => Promise<void> }).putMulti
    );
    expect(putMulti).toHaveBeenCalledTimes(1);
    const batch = putMulti.mock.calls[0][0] as Array<{ namespace: string; key: string }>;
    expect(batch).toHaveLength(4);
    expect(batch.filter((r) => r.namespace === "proj/traces").map((r) => r.key)).toEqual([
      "trace_batch",
    ]);
    expect(batch.filter((r) => r.namespace === "proj/file_traces")).toHaveLength(3);

    const flush = vi.mocked(
      (adapter as unknown as { flush: () => Promise<void> }).flush
    );
    expect(flush).toHaveBeenCalledTimes(1);

    const put = vi.mocked(
      (adapter as unknown as { put: (...args: unknown[]) => Promise<void> }).put
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("explainArtifact encuentra refs más allá de la primera ventana vía cursor", async () => {
    const store = buildRefStore(120);
    const { adapter, dbList } = mockAdapterWithCursor(store);
    const graph = new ProjectMemoryGraph(adapter);

    // Objetivo en la 2ª página (índice 105, páginas de 100).
    const explanation = await graph.explainArtifact(TRACE_FILE(105));

    expect(dbList.mock.calls.length).toBeGreaterThan(1);
    expect(explanation).not.toBeNull();
    expect(explanation?.traceId).toBe("trace_105");
    expect(explanation?.decisionId).toBe("dec_trace_105");
  });

  it("explainArtifact pagina con fallback incremental cuando no hay getDb", async () => {
    const store = buildRefStore(12);
    const adapter = mockLegacyAdapter(store);
    const graph = new ProjectMemoryGraph(adapter);

    const explanation = await graph.explainArtifact(TRACE_FILE(11));

    expect(explanation).not.toBeNull();
    expect(explanation?.traceId).toBe("trace_11");
  });

  it("explainArtifact no confunde un archivo con otro que extiende su prefijo hex", async () => {
    const store: CursorStoreEntry[] = [
      { key: refKey("abC", "trace_wrong"), payload: "trace_wrong", metadata: {} },
      { key: refKey("ab", "trace_right"), payload: "trace_right", metadata: {} },
    ];
    const get = vi.fn(async (_namespace: string, key: string) => ({
      key,
      payload: `Traza ${key}`,
      metadata: {
        decision_id: `dec_${key}`,
        commit_hash: "",
        affected_files_json: JSON.stringify([]),
        test_files_json: JSON.stringify([]),
        outcome: "ok",
      },
    }));
    const adapter = {
      put: vi.fn(async () => undefined),
      putMulti: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
      get,
      list: vi.fn(async (_namespace: string, limit: number) => store.slice(0, limit)),
    } as unknown as EgoMemoryAdapter;
    const graph = new ProjectMemoryGraph(adapter);

    const explanation = await graph.explainArtifact("ab");
    expect(explanation).not.toBeNull();
    expect(explanation?.traceId).toBe("trace_right");
  });
});
