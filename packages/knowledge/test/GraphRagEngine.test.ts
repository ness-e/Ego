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
});
