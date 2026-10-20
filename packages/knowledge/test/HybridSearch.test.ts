import { describe, it, expect, vi, beforeEach } from "vitest";
import { asEgoAdapter, type KnowledgeAdapterMock } from "./mockAdapter.js";
import { HybridSearch } from "../src/HybridSearch.js";
import { ScoreThresholdFilter } from "../src/filters/ScoreThresholdFilter.js";
import { FactExtractor } from "../src/extractors/FactExtractor.js";
import type { SearchHit } from "@ego/memory";

const hit = (key: string, score: number): SearchHit =>
  ({
    record: {
      namespace: "kb/docs",
      key,
      payload: `Contenido ${key}`,
      metadata: {},
      created_at_ms: 0,
      updated_at_ms: 0,
      version: 1,
      node_id: key,
    },
    score,
  }) as SearchHit;

describe("HybridSearch & Retrieval Components (KB-04)", () => {
  let mockAdapter: KnowledgeAdapterMock;
  let hybridSearch: HybridSearch;

  beforeEach(() => {
    mockAdapter = {
      searchMulti: vi.fn(),
    } as unknown as KnowledgeAdapterMock;
    hybridSearch = new HybridSearch(asEgoAdapter(mockAdapter));
  });

  describe("ScoreThresholdFilter (KHOJ-03, H10)", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7, mode: "absolute" });

    it("descarta candidatos con score inferior a 0.70 en modo absoluto", () => {
      const hits = [hit("1", 0.88), hit("2", 0.7), hit("3", 0.65), hit("4", 0.3)];

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

  describe("HybridSearch re-rank honesto (H09)", () => {
    it("ordena resultados federados preservando el score original", async () => {
      mockAdapter.searchMulti.mockResolvedValueOnce([hit("doc_1", 0.9), hit("fact_1", 0.85)]);

      const hits = await hybridSearch.search("consulta sobre arquitectura", {
        topK: 2,
        minConfidence: 0.0,
      });

      expect(hits.length).toBe(2);
      expect(hits[0].record?.key).toBe("doc_1");
      // H09: el score original del motor se preserva, no se sobrescribe.
      expect(hits[0].score).toBe(0.9);
      expect(hits[1].score).toBe(0.85);
    });

    it("retorna array vacío si la consulta está vacía", async () => {
      const hits = await hybridSearch.search("   ");
      expect(hits).toEqual([]);
      expect(mockAdapter.searchMulti).not.toHaveBeenCalled();
    });

    it("NO aplica fallback silencioso: si el umbral descarta todo, retorna vacío por defecto (H09)", async () => {
      mockAdapter.searchMulti.mockResolvedValueOnce([hit("ruido_1", 0.2), hit("ruido_2", 0.1)]);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const hits = await hybridSearch.search("consulta sin buenos candidatos", {
        topK: 2,
        minConfidence: 0.99,
        scoreMode: "absolute",
      });

      // Guarda KHOJ-03: nada que supere el umbral → nada al contexto.
      expect(hits).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("fallback explícito solo con flag: registra warn y preserva scores originales", async () => {
      mockAdapter.searchMulti.mockResolvedValueOnce([hit("ruido_1", 0.2), hit("ruido_2", 0.1)]);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const hits = await hybridSearch.search("consulta sin buenos candidatos", {
        topK: 2,
        minConfidence: 0.99,
        scoreMode: "absolute",
        allowUnfilteredFallback: true,
      });

      expect(hits.length).toBe(2);
      expect(hits[0].score).toBe(0.2);
      expect(hits[1].score).toBe(0.1);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });
});
