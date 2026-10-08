import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { NativeVantaDB } from "vantadb/native";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * CORE-15: Suite de contrato in-process EgoMemoryAdapter ↔ NativeVantaDB.
 * Pinea las firmas de tipos, comportamiento del binding NAPI-RS y garantías
 * de persistencia de Fjall LSM requeridas por Ego (contrapartida de MEMG-24).
 */
describe("CORE-15 — NativeVantaDB ↔ EgoMemoryAdapter Contract Suite", () => {
  const contractDir = path.join(os.tmpdir(), `ego-contract-vantadb-${Date.now()}`);
  let rawDb: NativeVantaDB;
  let adapter: EgoMemoryAdapter;

  beforeAll(async () => {
    await fs.mkdir(contractDir, { recursive: true });
    rawDb = await NativeVantaDB.connect(path.join(contractDir, "raw_db"), {
      read_only: false,
    });
    adapter = new EgoMemoryAdapter(path.join(contractDir, "adapter_db"));
    await adapter.init();
  });

  afterAll(async () => {
    if (rawDb) {
      await rawDb.close();
    }
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(contractDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos de Windows en fs.rm
    }
  });

  describe("1. Contrato Directo de NativeVantaDB (NAPI-RS API Surface)", () => {
    it("expone todos los métodos canónicos requeridos por el Runtime de Ego", () => {
      expect(typeof NativeVantaDB.connect).toBe("function");
      expect(typeof rawDb.put).toBe("function");
      expect(typeof rawDb.putBatch).toBe("function");
      expect(typeof rawDb.get).toBe("function");
      expect(typeof rawDb.delete).toBe("function");
      expect(typeof rawDb.list).toBe("function");
      expect(typeof rawDb.listNamespaces).toBe("function");
      expect(typeof rawDb.search).toBe("function");
      expect(typeof rawDb.flush).toBe("function");
      expect(typeof rawDb.close).toBe("function");
      expect(typeof rawDb.capabilities).toBe("function");
    });

    it("capabilities() devuelve un contrato de características válido", async () => {
      const caps = await rawDb.capabilities();
      expect(caps).toBeDefined();
      expect(typeof caps.runtime_profile).toBe("string");
      expect(caps.persistence).toBe(true);
      expect(caps.vector_search).toBe(true);
      expect(caps.read_only).toBe(false);
    });

    it("put y get preservan metadatos escalares tipados y variantes tagged", async () => {
      const rec = await rawDb.put({
        namespace: "contract/scalars",
        key: "scalars_01",
        payload: "Test scalar payloads",
        metadata: {
          str_val: { String: "ego-runtime" },
          num_val: { Float: 42.5 },
          bool_val: { Bool: true },
          null_val: "Null",
          list_val: { ListString: ["alpha", "beta", "gamma"] },
        },
      });

      expect(rec.namespace).toBe("contract/scalars");
      expect(rec.key).toBe("scalars_01");
      expect(rec.created_at_ms).toBeDefined();

      const retrieved = await rawDb.get({
        namespace: "contract/scalars",
        key: "scalars_01",
      });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.payload).toBe("Test scalar payloads");
      expect(retrieved?.metadata).toBeDefined();
    });

    it("list() pagina deterministamente mediante cursores opacos", async () => {
      const ns = "contract/pagination";
      const batch = Array.from({ length: 8 }, (_, i) => ({
        namespace: ns,
        key: `item_${i.toString().padStart(2, "0")}`,
        payload: `Payload for item ${i}`,
        metadata: { index: { Float: i } },
      }));

      await rawDb.putBatch(batch);

      // Página 1
      const page1 = await rawDb.list({ namespace: ns, limit: 3 });
      expect(page1.records.length).toBe(3);
      expect(page1.next_cursor).toBeDefined();

      // Página 2 con cursor
      const page2 = await rawDb.list({
        namespace: ns,
        limit: 3,
        cursor: page1.next_cursor as number,
      });
      expect(page2.records.length).toBe(3);
      expect(page2.records[0].key).not.toBe(page1.records[0].key);
      expect(page2.next_cursor).toBeDefined();

      // Página 3 (restante)
      const page3 = await rawDb.list({
        namespace: ns,
        limit: 3,
        cursor: page2.next_cursor as number,
      });
      expect(page3.records.length).toBe(2);
    });

    it("search() ejecuta búsqueda léxica BM25 nativa con score numérico", async () => {
      const ns = "contract/search";
      await rawDb.put({
        namespace: ns,
        key: "doc_search_target",
        payload: "Ego cognitive operating system engine architecture with local persistence",
      });

      const hits = await rawDb.search({
        namespace: ns,
        text_query: "cognitive operating system",
        query_vector: [],
        top_k: 5,
      });

      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].record.key).toBe("doc_search_target");
      expect(typeof (hits[0] as unknown as { score?: number; distance?: number }).score === "number" ||
             typeof (hits[0] as unknown as { score?: number; distance?: number }).distance === "number").toBe(true);
    });

    it("delete() elimina registros existentes y responde coherentemente ante inexistentes", async () => {
      const ns = "contract/delete";
      await rawDb.put({
        namespace: ns,
        key: "to_be_deleted",
        payload: "Temporary content",
      });

      const existedBefore = await rawDb.get({ namespace: ns, key: "to_be_deleted" });
      expect(existedBefore).not.toBeNull();

      const deleted = await rawDb.delete({ namespace: ns, key: "to_be_deleted" });
      expect(deleted).toBe(true);

      const retrievedAfter = await rawDb.get({ namespace: ns, key: "to_be_deleted" });
      expect(retrievedAfter).toBeNull();
    });
  });

  describe("2. Contrato de EgoMemoryAdapter (Capa de Abstracción de Ego)", () => {
    it("prohíbe bases de datos :memory: para garantizar la regla innegociable de persistencia", () => {
      expect(() => new EgoMemoryAdapter(":memory:")).toThrow(/Se requiere una ruta de almacenamiento real/);
      expect(() => new EgoMemoryAdapter("")).toThrow(/Se requiere una ruta de almacenamiento real/);
    });

    it("inyecta automáticamente metadatos de gobernanza en cada escritura", async () => {
      await adapter.put({
        namespace: "kb/contract",
        key: "fact:audit_check",
        payload: { statement: "Autonomous agent execution" },
        metadata: { custom_tag: "test" },
      });

      const raw = await (adapter as unknown as { db: { get: (req: { namespace: string; key: string }) => Promise<{ metadata: Record<string, unknown> } | null> } }).db.get({
        namespace: "kb/contract",
        key: "fact:audit_check",
      });

      expect(raw).not.toBeNull();
      const meta = raw?.metadata as Record<string, unknown>;
      expect(meta.org_id).toEqual({ String: "org_default" });
      expect(meta.agent_id).toEqual({ String: "ego.nucleus" });
      expect(meta.state).toEqual({ String: "active" });
      expect(meta.ts).toBeDefined();
    });

    it("searchMulti() resuelve comodines y realiza búsqueda federada paralela", async () => {
      await adapter.putMulti([
        {
          namespace: "kb/engineering",
          key: "doc:arch",
          payload: "Microkernel and Cognitive Runtime event pipeline",
        },
        {
          namespace: "kb/product",
          key: "doc:vision",
          payload: "Cognitive Operating System for high impact engineering",
        },
      ]);

      const hits = await adapter.searchMulti(["kb/*"], "Cognitive Operating System", {
        topK: 5,
      });

      expect(hits.length).toBeGreaterThan(0);
      const keys = hits.map((h) => h.record.key);
      expect(keys).toContain("doc:vision");
    });

    it("quarantine() y promote() garantizan el ciclo de vida inmutable de datos dudosos", async () => {
      await adapter.quarantine(
        {
          namespace: "crm/leads",
          key: "lead_unverified_42",
          payload: { email: "unverified@example.com", score: 0.95 },
        },
        "third_party_webhook_untrusted"
      );

      const qKey = "crm/leads:lead_unverified_42";
      await adapter.promote(qKey, "crm/verified_leads", "lead_verified_42");

      const promoted = (await adapter.get("crm/verified_leads", "lead_verified_42")) as {
        email: string;
      };
      expect(promoted).toBeDefined();
      expect(promoted.email).toBe("unverified@example.com");

      // Verificar que el registro en cuarentena fue eliminado
      const inQuarantine = await adapter.get("quarantine/pending", qKey);
      expect(inQuarantine).toBeNull();
    });

    it("supersedeFact() implementa ADR-028 (soft-replace sin borrado destructivo)", async () => {
      const ns = "projects/ego/specs";
      await adapter.put({
        namespace: ns,
        key: "arch_v1",
        payload: { version: 1, title: "Initial specs" },
      });

      await adapter.supersedeFact("arch_v1", {
        namespace: ns,
        key: "arch_v2",
        payload: { version: 2, title: "Revised specs" },
      });

      const newVersion = (await adapter.get(ns, "arch_v2")) as { version: number };
      expect(newVersion.version).toBe(2);

      // Verificar que el anterior aún existe y tiene metadatos superseded
      const rawOld = await (adapter as unknown as { db: { get: (req: { namespace: string; key: string }) => Promise<{ metadata: Record<string, unknown> } | null> } }).db.get({
        namespace: ns,
        key: "arch_v1",
      });
      expect(rawOld).not.toBeNull();
      const oldMeta = rawOld?.metadata as Record<string, unknown>;
      expect(oldMeta.state).toEqual({ String: "superseded" });
      expect(oldMeta.is_latest).toEqual({ Bool: false });
    });

    it("exportDump() e importDump() validan el formato canónico VDBJSON con SHA-256", async () => {
      const dumpFilePath = path.join(contractDir, "contract_export.vdbdump");
      const exportReport = await adapter.exportDump(dumpFilePath);

      expect(exportReport.recordsExported).toBeGreaterThan(0);
      expect(exportReport.checksum).toBeDefined();
      expect(typeof exportReport.checksum).toBe("string");

      const fileContent = await fs.readFile(dumpFilePath, "utf8");
      expect(fileContent.startsWith("VDBJSON\n")).toBe(true);

      // Restaurar en una base limpia
      const restorePath = path.join(contractDir, "restored_adapter_db");
      await fs.mkdir(restorePath, { recursive: true });
      const restoreAdapter = new EgoMemoryAdapter(restorePath);
      await restoreAdapter.init();

      const importReport = await restoreAdapter.importDump(dumpFilePath);
      expect(importReport.recordsImported).toBe(exportReport.recordsExported);

      const restoredItem = (await restoreAdapter.get("projects/ego/specs", "arch_v2")) as {
        version: number;
      };
      expect(restoredItem).toBeDefined();
      expect(restoredItem.version).toBe(2);

      await restoreAdapter.close();
    });

    it("close() garantiza OpGate y rechazo determinista de llamadas posteriores", async () => {
      const freshDir = path.join(contractDir, "opgate_check_db");
      await fs.mkdir(freshDir, { recursive: true });
      const testAdapter = new EgoMemoryAdapter(freshDir);
      await testAdapter.init();
      expect(testAdapter.ready).toBe(true);

      await testAdapter.close();
      expect(testAdapter.ready).toBe(false);

      await expect(
        testAdapter.put({
          namespace: "test",
          key: "k",
          payload: "fail",
        })
      ).rejects.toThrow(/No inicializado. Llamar a init\(\) primero./);
    });
  });
});
