import { describe, it, expect, vi, afterEach } from "vitest";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * F2T6 / M07 — Los fallos del motor deben ser observables.
 * `list()->[]`, `delete()->false`, `searchMulti` parcial y `recall()->null`
 * mantienen su firma (20+ consumidores cross-paquete), pero NUNCA en silencio:
 * cada ruta de fallo emite un log estructurado vía `console.error`.
 */
function stubAdapter(stubDb: unknown): EgoMemoryAdapter {
  const a = new EgoMemoryAdapter(
    `/tmp/ego-gateway-stub-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  (a as unknown as { db: unknown }).db = stubDb;
  return a;
}

function failingDb(failingMethod: string): Record<string, () => Promise<never>> {
  const boom = async (): Promise<never> => {
    throw new Error("IO error: Disk full (inyectado)");
  };
  return {
    get: async () => null,
    list: async () => ({ records: [], next_cursor: undefined }),
    listNamespaces: async () => [],
    search: async () => [],
    delete: async () => true,
    [failingMethod]: boom,
  } as unknown as Record<string, () => Promise<never>>;
}

describe("F2T6/M07 — Errores del motor observables (sin silencio)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list() retorna [] ANTE fallo pero emite log estructurado", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = stubAdapter(failingDb("list"));

    const result = await adapter.list("kb/test", 10);

    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
    const firstCall = String(errSpy.mock.calls[0][0]);
    expect(firstCall).toContain("[EgoMemoryAdapter]");
    expect(firstCall).toContain("kb/test");
  });

  it("delete() retorna false ANTE fallo pero emite log estructurado", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = stubAdapter(failingDb("delete"));

    const result = await adapter.delete("kb/test", "doc:1");

    expect(result).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    const firstCall = String(errSpy.mock.calls[0][0]);
    expect(firstCall).toContain("[EgoMemoryAdapter]");
    expect(firstCall).toContain("doc:1");
  });

  it("searchMulti() degrada por namespace ANTE fallo pero emite log estructurado", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = stubAdapter(failingDb("search"));

    const result = await adapter.searchMulti(["kb/a"], "consulta", { topK: 5 });

    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
    const firstCall = String(errSpy.mock.calls[0][0]);
    expect(firstCall).toContain("[EgoMemoryAdapter]");
    expect(firstCall).toContain("kb/a");
  });

  it("recall() retorna null ANTE fallo pero emite log estructurado", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = stubAdapter(failingDb("get"));

    const result = await adapter.recall("doc:1", "kb/test");

    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    expect(String(errSpy.mock.calls[0][0])).toContain("[EgoMemoryAdapter]");
  });

  it("listSubEgos() retorna [] ANTE fallo pero emite log estructurado", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = stubAdapter(failingDb("list"));

    const result = await adapter.listSubEgos();

    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it("searchMulti() con texto vacío retorna [] sin invocar al motor (Workaround: VDB-BUG-05)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const searchMock = vi.fn(async () => []);
    const adapter = stubAdapter({
      listNamespaces: async () => ["kb/a"],
      search: searchMock,
    });

    const result = await adapter.searchMulti(["kb/a"], "   ", { topK: 5 });

    expect(result).toEqual([]);
    expect(searchMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    expect(String(errSpy.mock.calls[0][0])).toContain("VDB-BUG-05");
  });
});
