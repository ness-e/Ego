import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import { EgoMemoryLifecycle } from "../EgoMemoryLifecycle.js";

describe("@ego/memory — Integration Test Suite", () => {
  const testDir = path.join(os.tmpdir(), `ego-memory-test-${Date.now()}`);
  const dumpFile = path.join(os.tmpdir(), `ego-test-dump-${Date.now()}.vdbdump`);
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
      await fs.rm(dumpFile, { force: true });
    } catch {
      // Ignorar bloqueos de Windows
    }
  });

  it("1. Inicializa y verifica estado ready", () => {
    expect(adapter.ready).toBe(true);
  });

  it("2. Realiza escrituras put y putMulti con normalización de metadatos", async () => {
    await adapter.put({
      namespace: "kb/test",
      key: "doc:1",
      payload: { title: "VantaDB Core", content: "Fast LSM persistence engine" },
      metadata: { priority: 1, tag: "db" },
    });

    await adapter.putMulti([
      {
        namespace: "kb/test",
        key: "doc:2",
        payload: "Segundo documento de prueba",
        metadata: { tag: "test" },
      },
      {
        namespace: "projects/test",
        key: "config:1",
        payload: { model: "local-llm" },
      },
    ]);

    const doc1 = (await adapter.get("kb/test", "doc:1")) as { title: string };
    expect(doc1).toBeDefined();
    expect(doc1.title).toBe("VantaDB Core");

    const doc2 = await adapter.get("kb/test", "doc:2");
    expect(doc2).toBe("Segundo documento de prueba");
  });

  it("3. Búsqueda federada searchMulti con comodines y scoring BM25", async () => {
    const hits = await adapter.searchMulti(["kb/*", "projects/*"], "VantaDB", { topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].record.key).toBe("doc:1");
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("4. Flujo de cuarentena y promoción", async () => {
    await adapter.quarantine(
      {
        namespace: "kb/untrusted",
        key: "unverified:1",
        payload: "Dato pendiente de validación",
      },
      "user_input_unverified"
    );

    const qKey = "kb/untrusted:unverified:1";
    await adapter.promote(qKey, "kb/verified", "fact:1");

    const promoted = await adapter.get("kb/verified", "fact:1");
    expect(promoted).toBe("Dato pendiente de validación");
  });

  it("5. Supersede histórico (soft-replace ADR-028)", async () => {
    await adapter.put({
      namespace: "kb/facts",
      key: "version:old",
      payload: "Versión 1 de la directiva",
    });

    await adapter.supersedeFact("version:old", {
      namespace: "kb/facts",
      key: "version:new",
      payload: "Versión 2 de la directiva",
    });

    const newFact = await adapter.get("kb/facts", "version:new");
    expect(newFact).toBe("Versión 2 de la directiva");
  });

  it("6. Exportación e importación de dump canónico (.vdbdump con VDBJSON)", async () => {
    const exportReport = await adapter.exportDump(dumpFile);
    expect(exportReport.recordsExported).toBeGreaterThanOrEqual(4);
    expect(exportReport.checksum).toBeDefined();

    const dumpContent = await fs.readFile(dumpFile, "utf8");
    expect(dumpContent.startsWith("VDBJSON\n")).toBe(true);

    // Restauración en base de datos secundaria limpia
    const restoreDir = path.join(os.tmpdir(), `ego-memory-restore-${Date.now()}`);
    await fs.mkdir(restoreDir, { recursive: true });
    const restoreAdapter = new EgoMemoryAdapter(restoreDir);
    await restoreAdapter.init();

    const importReport = await restoreAdapter.importDump(dumpFile);
    expect(importReport.recordsImported).toBe(exportReport.recordsExported);

    const restoredDoc = (await restoreAdapter.get("kb/test", "doc:1")) as { title: string };
    expect(restoredDoc.title).toBe("VantaDB Core");

    await restoreAdapter.close();
    await fs.rm(restoreDir, { recursive: true, force: true });
  });

  it("7. EgoMemoryLifecycle: Ensamblado pre-turn y persistencia de turno", async () => {
    const lifecycle = new EgoMemoryLifecycle(adapter);
    const preTurn = await lifecycle.assemblePreTurn("VantaDB", ["kb/*"]);

    expect(preTurn.recallStatus.glyph).toContain("🧠");
    expect(preTurn.recallStatus.hits.length).toBeGreaterThan(0);

    await lifecycle.syncTurnToDisk({
      sessionId: "sess_unit_01",
      turnIndex: 1,
      userMessage: "¿Qué es VantaDB?",
      assistantResponse: "Es el motor LSM de persistencia de Ego.",
      recalledKeys: preTurn.recallStatus.hits.map((f) => f.key),
    });

    const turn = (await adapter.get("session/turns", "sess_unit_01:turn:1")) as {
      userMessage: string;
    };
    expect(turn).toBeDefined();
    expect(turn.userMessage).toBe("¿Qué es VantaDB?");
  });
});
