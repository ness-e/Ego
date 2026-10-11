import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

describe("EgoMemoryAdapter — Version Tree y Time Travel (DSEK-01, DSEK-02)", () => {
  const testDir = path.join(os.tmpdir(), `ego-version-tree-test-${Date.now()}`);
  let adapter: EgoMemoryAdapter;

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
  });

  afterAll(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos en Windows
    }
  });

  it("permite encadenar versiones mediante supersedeFact y reconstruir el historial completo", async () => {
    const ns = "projects/audit";

    // Versión 1
    await adapter.put({
      namespace: ns,
      key: "req:v1",
      payload: { title: "Requerimiento Inicial", budget: 1000 },
      metadata: { author: "alice" },
    });

    await new Promise((r) => setTimeout(r, 20));

    // Versión 2 (supersedes v1)
    await adapter.supersedeFact(
      ns,
      "req:v1",
      "req:v2",
      { title: "Requerimiento Ajustado", budget: 1500 },
      { author: "bob" }
    );

    await new Promise((r) => setTimeout(r, 20));

    // Versión 3 (supersedes v2)
    await adapter.supersedeFact(
      ns,
      "req:v2",
      "req:v3",
      { title: "Requerimiento Final", budget: 2000 },
      { author: "charlie" }
    );

    // Reconstruir árbol genealógico desde la versión 2
    const historyFromV2 = await adapter.getVersionHistory(ns, "req:v2");
    expect(historyFromV2.length).toBe(3);

    expect(historyFromV2[0].key).toBe("req:v1");
    expect(historyFromV2[0].supersededBy).toBe("req:v2");

    expect(historyFromV2[1].key).toBe("req:v2");
    expect(historyFromV2[1].supersedes).toBe("req:v1");
    expect(historyFromV2[1].supersededBy).toBe("req:v3");

    expect(historyFromV2[2].key).toBe("req:v3");
    expect(historyFromV2[2].supersedes).toBe("req:v2");
    expect(historyFromV2[2].supersededBy).toBeUndefined();

    // Reconstruir árbol genealógico desde v3 (la más reciente)
    const historyFromV3 = await adapter.getVersionHistory(ns, "req:v3");
    expect(historyFromV3.length).toBe(3);
    expect(historyFromV3[0].key).toBe("req:v1");
    expect(historyFromV3[2].key).toBe("req:v3");
  });

  it("recupera la versión correcta en un punto exacto en el tiempo con getAtTimestamp", async () => {
    const ns = "projects/history";

    const t1 = Date.now();
    await adapter.put({
      namespace: ns,
      key: "doc:v1",
      payload: { version: 1, content: "Borrador inicial" },
    });

    await new Promise((r) => setTimeout(r, 40));
    const afterV1 = Date.now();
    await new Promise((r) => setTimeout(r, 40));

    await adapter.supersedeFact(
      ns,
      "doc:v1",
      "doc:v2",
      { version: 2, content: "Segunda revisión" }
    );

    await new Promise((r) => setTimeout(r, 30));
    const afterV2 = Date.now();
    await new Promise((r) => setTimeout(r, 30));

    await adapter.supersedeFact(
      ns,
      "doc:v2",
      "doc:v3",
      { version: 3, content: "Aprobado para producción" }
    );

    // Consulta en instante afterV1 -> debe ser v1
    const vAtAfterV1 = await adapter.getAtTimestamp(ns, "doc:v3", afterV1);
    expect(vAtAfterV1).toBeDefined();
    expect(vAtAfterV1?.key).toBe("doc:v1");
    expect((vAtAfterV1?.payload as any).version).toBe(1);

    // Consulta en instante afterV2 -> debe ser v2
    const vAtAfterV2 = await adapter.getAtTimestamp(ns, "doc:v1", afterV2);
    expect(vAtAfterV2).toBeDefined();
    expect(vAtAfterV2?.key).toBe("doc:v2");
    expect((vAtAfterV2?.payload as any).version).toBe(2);

    // Consulta en tiempo actual -> debe ser v3
    const vCurrent = await adapter.getAtTimestamp(ns, "doc:v2", Date.now());
    expect(vCurrent).toBeDefined();
    expect(vCurrent?.key).toBe("doc:v3");
    expect((vCurrent?.payload as any).version).toBe(3);
  });
});
