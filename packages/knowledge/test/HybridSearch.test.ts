import { describe, it, expect, vi, beforeEach } from "vitest";
import { HybridSearch } from "../src/HybridSearch.js";
import { CosineThresholdFilter } from "../src/filters/CosineThresholdFilter.js";
import { FactExtractor } from "../src/extractors/FactExtractor.js";

describe("HybridSearch & Retrieval Components (KB-04)", () => {
  let mockAdapter: any;
  let hybridSearch: HybridSearch;

  beforeEach(() => {
    mockAdapter = {
      searchMulti: vi.fn(),
    };
    hybridSearch = new HybridSearch(mockAdapter);
  });

  describe("CosineThresholdFilter (KHOJ-03)", () => {
    const filter = new CosineThresholdFilter({ minConfidence: 0.70 });

    it("descarta candidatos con score inferior a 0.70", () => {
      const hits: any[] = [
        { record: { key: "1", payload: "Alto" }, score: 0.88 },
        { record: { key: "2", payload: "Límite" }, score: 0.70 },
        { record: { key: "3", payload: "Bajo" }, score: 0.65 },
        { record: { key: "4", payload: "Muy bajo" }, score: 0.30 },
      ];

      const filtered = filter.filter(hits);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((h) => h.record.key)).toEqual(["1", "2"]);
    });

    it("evalúa score individual correctamente", () => {
      expect(filter.isAboveThreshold(0.75)).toBe(true);
      expect(filter.isAboveThreshold(0.69)).toBe(false);
    });
  });

  describe("FactExtractor (KHOJ-04)", () => {
    const extractor = new FactExtractor();

    it("extrae hechos atómicos desde formato clave-valor", () => {
      const text = `
- Runtime: Node.js 22
- Base de datos: VantaDB 0.8.0
- Desktop: Electron
      `.trim();

      const facts = extractor.extractFromText(text, "setup.md");
      expect(facts.length).toBe(3);
      expect(facts[0].subject).toBe("Runtime");
      expect(facts[0].object).toBe("Node.js 22");
      expect(facts[1].subject).toBe("Base de datos");
      expect(facts[1].object).toBe("VantaDB 0.8.0");
    });

    it("extrae hechos desde oraciones verbales", () => {
      const text = "Ego implementa Cognitive Runtime central propio.";
      const facts = extractor.extractFromText(text, "principios.md");

      expect(facts.length).toBe(1);
      expect(facts[0].subject).toBe("Ego");
      expect(facts[0].predicate).toBe("implementa");
      expect(facts[0].object).toBe("Cognitive Runtime central propio.");
    });
  });

  describe("HybridSearch RRF & MMR", () => {
    it("aplica fusión RRF a los resultados federados", async () => {
      mockAdapter.searchMulti.mockResolvedValueOnce([
        { record: { namespace: "kb/docs", key: "doc_1", payload: "Contenido 1" }, score: 0.9 },
        { record: { namespace: "kb/facts", key: "fact_1", payload: "Contenido 2" }, score: 0.85 },
      ]);

      const hits = await hybridSearch.search("consulta sobre arquitectura", {
        topK: 2,
        minConfidence: 0.70,
      });

      expect(hits.length).toBe(2);
      expect(hits[0].score).toBeGreaterThan(0);
      expect(hits[0].record?.key).toBe("doc_1");
    });

    it("retorna array vacío si la consulta está vacía", async () => {
      const hits = await hybridSearch.search("   ");
      expect(hits).toEqual([]);
      expect(mockAdapter.searchMulti).not.toHaveBeenCalled();
    });
  });
});
