import { describe, it, expect, vi, beforeEach } from "vitest";
import { BitemporalQueries } from "../src/BitemporalQueries.js";
import { KnowledgeExport } from "../src/KnowledgeExport.js";
import { ProjectMemoryGraph } from "../src/ProjectMemoryGraph.js";

describe("Bitemporal, Export & Project Graph (KB-09, KB-10, KB-11)", () => {
  let mockAdapter: any;

  beforeEach(() => {
    mockAdapter = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
    };
  });

  describe("BitemporalQueries (KB-09 / DSEK-02)", () => {
    it("reconstruye el estado histórico AS OF según los intervalos [valid_at, invalid_at)", async () => {
      const bitemporal = new BitemporalQueries(mockAdapter);

      mockAdapter.list.mockResolvedValueOnce([
        {
          key: "fact_1",
          payload: "Versión 1",
          metadata: {
            fact_id: "fact_1",
            subject: "Arquitectura",
            predicate: "usa",
            object: "SQLite",
            valid_at: 1000,
            invalid_at: 2000, // Expiró en t=2000
          },
        },
        {
          key: "fact_2",
          payload: "Versión 2",
          metadata: {
            fact_id: "fact_2",
            subject: "Arquitectura",
            predicate: "usa",
            object: "VantaDB",
            valid_at: 2000,
            invalid_at: -1, // Sigue vigente
          },
        },
      ]);

      // Consulta en t=1500 (debe retornar Versión 1 SQLite)
      const pastFacts = await bitemporal.asOf(1500);
      expect(pastFacts).toHaveLength(1);
      expect(pastFacts[0].object).toBe("SQLite");

      // Consulta en t=2500 (debe retornar Versión 2 VantaDB)
      mockAdapter.list.mockResolvedValueOnce([
        {
          key: "fact_1",
          payload: "Versión 1",
          metadata: { valid_at: 1000, invalid_at: 2000 },
        },
        {
          key: "fact_2",
          payload: "Versión 2",
          metadata: { valid_at: 2000, invalid_at: -1, object: "VantaDB" },
        },
      ]);

      const presentFacts = await bitemporal.asOf(2500);
      expect(presentFacts).toHaveLength(1);
      expect(presentFacts[0].object).toBe("VantaDB");
    });
  });

  describe("KnowledgeExport (KB-10)", () => {
    it("exporta un paquete con checksum SHA-256 e importa validando integridad", async () => {
      const exporter = new KnowledgeExport(mockAdapter);

      mockAdapter.list.mockResolvedValueOnce([
        { namespace: "kb/facts", key: "fact_1", payload: "Dato", metadata: { ts: 100 } },
      ]);

      const pkg = await exporter.exportPackage("test_project");
      expect(pkg.checksum).toHaveLength(64);
      expect(pkg.totalRecords).toBe(1);

      // Importar paquete idéntico
      const importRes = await exporter.importPackage(pkg);
      expect(importRes.imported).toBe(1);
      expect(mockAdapter.put).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "kb/facts",
          key: "fact_1",
        })
      );
    });

    it("falla la importación si el checksum ha sido corrompido", async () => {
      const exporter = new KnowledgeExport(mockAdapter);
      const pkg = await exporter.exportPackage("test_project");
      pkg.checksum = "corrupted_checksum_" + "0".repeat(45);

      await expect(exporter.importPackage(pkg)).rejects.toThrow("Fallo de integridad");
    });
  });

  describe("ProjectMemoryGraph (KB-11)", () => {
    it("registra y explica la cadena causal de ingeniería por archivo", async () => {
      const graph = new ProjectMemoryGraph(mockAdapter);

      await graph.recordEngineeringTrace({
        id: "trace_01",
        decisionId: "dec_decision_router",
        commitHash: "8a839fd",
        affectedFiles: ["packages/decision/src/DecisionRouter.ts"],
        testFiles: ["packages/decision/test/DecisionRouter.test.ts"],
        outcome: "DecisionRouter implementado",
        timestamp: Date.now(),
      });

      expect(mockAdapter.put).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "proj/traces",
          key: "trace_01",
        })
      );

      // Simular explicación de archivo
      const fileRefPrefix = `ref:${Buffer.from("packages/decision/src/DecisionRouter.ts").toString("hex")}`;
      mockAdapter.list.mockResolvedValueOnce([
        { key: `${fileRefPrefix}:trace_01`, payload: "trace_01" },
      ]);
      mockAdapter.get.mockResolvedValueOnce({
        payload: "Traza",
        metadata: {
          decision_id: "dec_decision_router",
          commit_hash: "8a839fd",
          affected_files_json: JSON.stringify(["packages/decision/src/DecisionRouter.ts"]),
          test_files_json: JSON.stringify(["packages/decision/test/DecisionRouter.test.ts"]),
          outcome: "Completado con éxito",
        },
      });

      const explanation = await graph.explainArtifact("packages/decision/src/DecisionRouter.ts");
      expect(explanation).not.toBeNull();
      expect(explanation?.decisionId).toBe("dec_decision_router");
      expect(explanation?.commitHash).toBe("8a839fd");
    });
  });
});
