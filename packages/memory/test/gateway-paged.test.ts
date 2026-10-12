import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * F2T6 / H04 — Paginación con cursor expuesta EN el gateway.
 * `listPaged()` es la vía canónica para barridos completos sin escapar
 * del adapter vía `getDb()` (consumidores autorizados legacy:
 * `BitemporalQueries`, `cursorListing`, `ProjectExport`).
 */
describe("F2T6/H04 — listPaged() pagina con cursor real hasta agotar", () => {
  const testDir = path.join(os.tmpdir(), `ego-gateway-paged-${Date.now()}`);
  let adapter: EgoMemoryAdapter;
  const NS = "kb/paged";

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
    await adapter.putMulti(
      Array.from({ length: 8 }, (_, i) => ({
        namespace: NS,
        key: `item_${i.toString().padStart(2, "0")}`,
        payload: `Payload ${i}`,
      }))
    );
  });

  afterAll(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos de Windows
    }
  });

  it("drena el namespace completo con páginas de 3 (cursor real)", async () => {
    const seen: string[] = [];
    let cursor: number | string | undefined = undefined;
    let iterations = 0;
    for (;;) {
      const page = await adapter.listPaged(NS, 3, cursor);
      for (const r of page.records) seen.push(r.key);
      if (page.nextCursor === undefined || page.records.length === 0) break;
      cursor = page.nextCursor;
      iterations++;
      if (iterations > 20) throw new Error("paginación no converge");
    }
    expect(seen.sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `item_${i.toString().padStart(2, "0")}`)
    );
  });

  it("retorna una sola página cuando el límite cubre todo", async () => {
    const page = await adapter.listPaged(NS, 100);
    expect(page.records.length).toBe(8);
    expect(page.records[0].metadata?.state).toBe("active");
  });
});
