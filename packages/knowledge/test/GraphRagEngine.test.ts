import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphRagEngine } from "../src/GraphRagEngine.js";

describe("GraphRagEngine (KB-06)", () => {
  let mockAdapter: any;
  let engine: GraphRagEngine;

  beforeEach(() => {
    mockAdapter = {
      searchMulti: vi.fn(),
    };
    engine = new GraphRagEngine(mockAdapter);
  });

  it("ensambla un subgrafo de contexto a partir de semillas híbridas con poda (VDB-REQ-07)", async () => {
    mockAdapter.searchMulti.mockResolvedValueOnce([
      {
        record: {
          namespace: "kb/docs",
          key: "doc_arch_1",
          payload: "Documento de arquitectura. Ref: fact_12345678 y doc_87654321.",
          metadata: { supersedes: "fact_old_01" },
        },
        score: 0.92,
      },
    ]);

    const result = await engine.search("arquitectura de memoria", {
      maxDepth: 2,
      maxDegreePerNode: 5,
      maxTotalNodes: 10,
    });

    expect(result.seedNodes.length).toBe(1);
    expect(result.expandedNodes.length).toBeGreaterThanOrEqual(1);
    expect(result.edges.length).toBeGreaterThanOrEqual(1);
    expect(result.contextSummary).toContain("GraphRAG");
    expect(result.contextSummary).toContain("doc_arch_1");
  });

  it("retorna contexto vacío y mensaje seguro si no hay coincidencias", async () => {
    mockAdapter.searchMulti.mockResolvedValueOnce([]);

    const result = await engine.search("término inexistente");
    expect(result.seedNodes).toHaveLength(0);
    expect(result.expandedNodes).toHaveLength(0);
    expect(result.contextSummary).toContain("No se encontró conocimiento previo");
  });

  it("expande múltiples saltos A->B->C resolviendo el nodo B real desde el adaptador", async () => {
    mockAdapter.searchMulti.mockResolvedValueOnce([
      {
        record: {
          namespace: "kb/docs",
          key: "doc_aaaa1111",
          payload: "Documento A que conecta con doc_bbbb2222.",
          metadata: {},
        },
        score: 0.95,
      },
    ]);

    mockAdapter.get = vi.fn().mockImplementation(async (ns: string, key: string) => {
      if (ns === "kb/docs" && key === "doc_bbbb2222") {
        return {
          key: "doc_bbbb2222",
          payload: "Contenido real de B que menciona doc_cccc3333.",
          metadata: { author: "alice" },
        };
      }
      if (ns === "kb/docs" && key === "doc_cccc3333") {
        return {
          key: "doc_cccc3333",
          payload: "Contenido terminal de C.",
          metadata: {},
        };
      }
      return null;
    });

    const result = await engine.search("consulta multi-salto", {
      maxDepth: 2,
      maxDegreePerNode: 5,
      maxTotalNodes: 10,
    });

    const nodeIds = result.expandedNodes.map((n) => n.id);
    expect(nodeIds).toContain("kb/docs:doc_aaaa1111");
    expect(nodeIds).toContain("kb/docs:doc_bbbb2222");
    expect(nodeIds).toContain("kb/docs:doc_cccc3333");

    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "kb/docs:doc_aaaa1111", to: "kb/docs:doc_bbbb2222" }),
        expect.objectContaining({ from: "kb/docs:doc_bbbb2222", to: "kb/docs:doc_cccc3333" }),
      ])
    );

    const nodeB = result.expandedNodes.find((n) => n.id === "kb/docs:doc_bbbb2222");
    expect(nodeB?.metadata).toEqual(expect.objectContaining({ author: "alice", resolved: true }));
  });

  it("aplica fallback con resolved: false si el get falla o lanza una excepción", async () => {
    mockAdapter.searchMulti.mockResolvedValueOnce([
      {
        record: {
          namespace: "kb/docs",
          key: "doc_seed_01",
          payload: "Semilla que referencia doc_fa009999 y doc_00008888.",
          metadata: {},
        },
        score: 0.9,
      },
    ]);

    mockAdapter.get = vi.fn().mockImplementation(async (_ns: string, key: string) => {
      if (key === "doc_fa009999") {
        throw new Error("VantaDB connection timeout");
      }
      return null;
    });

    const result = await engine.search("consulta con fallos de get", {
      maxDepth: 2,
    });

    const nodeFail = result.expandedNodes.find((n) => n.id === "kb/docs:doc_fa009999");
    const nodeNull = result.expandedNodes.find((n) => n.id === "kb/docs:doc_00008888");

    expect(nodeFail).toBeDefined();
    expect(nodeFail?.metadata).toEqual({ resolved: false });
    expect(nodeFail?.content).toContain("kb/docs:doc_fa009999");

    expect(nodeNull).toBeDefined();
    expect(nodeNull?.metadata).toEqual({ resolved: false });
    expect(nodeNull?.content).toContain("kb/docs:doc_00008888");
  });
});
