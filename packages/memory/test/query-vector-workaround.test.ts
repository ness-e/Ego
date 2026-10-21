import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * T3 (A2-bis) — El workaround `query_vector: []` (`VDB-REQ-02`) está RETIRADO.
 *
 * Hecho medido (2026-10-21, sonda sobre el árbol instalado, `vantadb@0.9.0`):
 * - `search({namespace, text_query, top_k})` **sin** `query_vector` → OK (1 hit).
 * - `search({namespace, text_query: "", ...})` → **error** (`text_query` vacío es
 *   falsy ⇒ exige un vector **no vacío**); y `query_vector: []` **también**
 *   falla ⇒ el guard de `VDB-BUG-05` sigue siendo **necesario** (no se retira).
 *
 * Por tanto: se retira el **workaround**, no la limitación (`VDB-REQ-10`
 * persiste: el fast path sigue siendo BM25 léxico, sin embeddings).
 */

interface SearchRequestLike {
  namespace: string;
  text_query?: string;
  query_vector?: number[];
  top_k?: number;
}

describe("T3 — retirada del workaround `query_vector: []` (VDB-REQ-02 RESUELTO)", () => {
  let dir: string;
  let adapter: EgoMemoryAdapter;
  const requests: SearchRequestLike[] = [];

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-t3-"));
    adapter = new EgoMemoryAdapter(path.join(dir, "store.vdb"));
    await adapter.init();
    await adapter.put({ namespace: "kb/docs", key: "k1", payload: "el zorro rojo salta" });

    // Espía sobre la llamada real: el adaptador envía la petición al binding.
    const real = (adapter as unknown as { db: Record<string, unknown> }).db;
    const originalSearch = (real as { search: (r: SearchRequestLike) => Promise<unknown> }).search;
    (real as { search: unknown }).search = (r: SearchRequestLike) => {
      requests.push({ ...r });
      return originalSearch.call(real, r);
    };
  });

  afterAll(async () => {
    await adapter.close?.();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("searchMulti NO envía `query_vector` (el workaround está retirado)", async () => {
    requests.length = 0;
    const hits = await adapter.searchMulti(["kb/docs"], "zorro");

    expect(requests.length).toBeGreaterThan(0);
    for (const r of requests) {
      expect(Object.prototype.hasOwnProperty.call(r, "query_vector")).toBe(false);
    }
    expect(hits.length).toBeGreaterThan(0);
  });

  it("recall NO envía `query_vector` (el workaround está retirado)", async () => {
    requests.length = 0;
    await adapter.recall("zorro", "kb/docs");

    expect(requests.length).toBeGreaterThan(0);
    for (const r of requests) {
      expect(Object.prototype.hasOwnProperty.call(r, "query_vector")).toBe(false);
    }
  });

  it("CONTRATO: la API 0.9.0 acepta búsqueda sólo-texto sin `query_vector`", async () => {
    const db = adapter.getDb();
    expect(db).not.toBeNull();
    const hits = await db!.search({
      namespace: "kb/docs",
      text_query: "zorro",
      top_k: 5,
    } as unknown as Parameters<NonNullable<typeof db>["search"]>[0]);

    expect(hits.length).toBeGreaterThan(0);
  });

  it("VDB-BUG-05: `text_query` vacío sigue siendo un caso de error → el guard de barrido sigue vivo", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const hits = await adapter.searchMulti(["kb/docs"], "   ");

    expect(hits).toEqual([]);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("VDB-BUG-05"));
    errSpy.mockRestore();
  });
});
