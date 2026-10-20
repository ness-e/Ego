import { describe, it, expect } from "vitest";
import { GraphRagEngine } from "../src/GraphRagEngine.js";
import type { SearchHit } from "@ego/memory";

function seedHit(key: string, payload: string, nodeId: string, score: number): SearchHit {
  return {
    record: {
      namespace: "kb/docs",
      key,
      payload,
      metadata: {},
      created_at_ms: 0,
      updated_at_ms: 0,
      version: 1,
      node_id: nodeId,
    },
    score,
  } as SearchHit;
}

describe("GraphRagEngine — descubrimiento de arista real (T4 / EGO-FIND-42)", () => {
  it("(1) usa el grafo nativo de VantaDB cuando el adaptador lo expone", async () => {
    const nativeEdges = [{ source: "100", target: "200", label: "derived_from" }];
    const mockAdapter = {
      searchMulti: async () => [seedHit("doc_a", "Documento A", "100", 0.9)],
      graphRagSearch: async () => ({
        nodes: [
          { id: "100", content: "Documento A", score: 0.9, hop_distance: 0 },
          { id: "200", content: "Documento B", score: 0.4, hop_distance: 1 },
        ],
        edges: nativeEdges,
        context_text: "contexto nativo",
        stats: {
          seeds_found: 1,
          nodes_expanded: 1,
          total_candidates: 2,
          expansion_hops_used: 1,
        },
      }),
    };

    const engine = new GraphRagEngine(mockAdapter as never);
    const result = await engine.search("documento", { maxDepth: 2 });

    // La arista nativa (origen real) debe aparecer en el subgrafo.
    const native = result.edges.find((e) => e.to === "200" || e.to.endsWith(":200"));
    expect(native).toBeDefined();
    expect(native?.relation).toBe("derived_from");
    // Y el nodo vecino debe marcarse como resuelto por el grafo nativo.
    const neighbor = result.expandedNodes.find((n) => n.id.endsWith(":200"));
    expect(neighbor).toBeDefined();
    expect(neighbor?.metadata?.["graphSource"]).toBe("vanta-graph");
  });

  it("(2) sin grafo nativo disponible degrada al descubrimiento heurístico (metadata + regex)", async () => {
    const mockAdapter = {
      searchMulti: async () => [
        seedHit("doc_aaaa1111", "Documento A que menciona doc_bbbb2222.", "100", 0.9),
      ],
    };

    const engine = new GraphRagEngine(mockAdapter as never);
    const result = await engine.search("documento", { maxDepth: 2 });

    const heuristic = result.edges.find((e) => e.to === "kb/docs:doc_bbbb2222");
    expect(heuristic).toBeDefined();
    expect(heuristic?.relation).toBe("mentions");
  });

  it("(3) el grafo nativo devuelve error → degrada a heurístico sin lanzar", async () => {
    const mockAdapter = {
      searchMulti: async () => [
        seedHit("doc_aaaa1111", "Documento A que menciona doc_bbbb2222.", "100", 0.9),
      ],
      graphRagSearch: async () => {
        throw new Error("graphragSearch no disponible");
      },
    };

    const engine = new GraphRagEngine(mockAdapter as never);
    const result = await engine.search("documento", { maxDepth: 2 });

    expect(result.edges.some((e) => e.to === "kb/docs:doc_bbbb2222")).toBe(true);
  });
});
