import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeDomain } from "../src/knowledge/KnowledgeDomain.js";

describe("KnowledgeDomain (DOM-03)", () => {
  let domain: KnowledgeDomain;

  beforeEach(() => {
    domain = new KnowledgeDomain();
  });

  it("debe registrar y recuperar hechos con nivel de confianza y verificación", async () => {
    const fact = await domain.addFact({
      claim: "VantaDB 0.8.0 utiliza motor LSM Fjall embebido in-process",
      source: "AGENTS.md:14",
      confidence: 0.95,
      tags: ["vantadb", "storage", "lsm"],
    });

    expect(fact.id).toBeDefined();
    expect(fact.claim).toContain("VantaDB 0.8.0");
    expect(fact.verified).toBe(true);

    const retrieved = await domain.getFact(fact.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.source).toBe("AGENTS.md:14");
  });

  it("debe buscar hechos por palabra clave y filtrar por confianza mínima", async () => {
    await domain.addFact({
      claim: "Electron Context Isolation debe ser estricto",
      source: "security.md",
      confidence: 0.9,
      tags: ["security"],
    });

    await domain.addFact({
      claim: "Hipótesis no validada de rendimiento",
      source: "scratch.md",
      confidence: 0.4,
      tags: ["draft"],
    });

    const highConfidenceMatches = await domain.searchKnowledge("electron", {
      minConfidence: 0.8,
    });
    expect(highConfidenceMatches.length).toBe(1);
    expect(highConfidenceMatches[0].claim).toContain("Context Isolation");

    const draftMatches = await domain.searchKnowledge("rendimiento", {
      minConfidence: 0.3,
    });
    expect(draftMatches.length).toBe(1);
  });

  it("debe sintetizar una bibliografía estructurada con métricas de confianza", async () => {
    const f1 = await domain.addFact({
      claim: "Fast path opera en modo BM25 léxico",
      source: "doc-1.md",
      confidence: 0.9,
    });
    const f2 = await domain.addFact({
      claim: "vantadb-mcp maneja ONNX densamente en subprocess",
      source: "doc-2.md",
      confidence: 0.8,
    });

    const synthesis = await domain.synthesizeBibliography("Arquitectura de Búsqueda", [
      f1.id,
      f2.id,
    ]);

    expect(synthesis.topic).toBe("Arquitectura de Búsqueda");
    expect(synthesis.citedFacts.length).toBe(2);
    expect(synthesis.sourcesCount).toBe(2);
    expect(synthesis.averageConfidence).toBe(0.85);
    expect(synthesis.summary).toContain("2 hechos verificados");
  });

  it("debe generar un vecindario de grafo conceptual para la vista GraphRAG", async () => {
    const view = await domain.getGraphNeighborhood("ent_vantadb");
    expect(view.centerEntityId).toBe("ent_vantadb");
    expect(view.nodes.length).toBeGreaterThan(0);
    expect(view.edges.length).toBeGreaterThan(0);
  });
});
