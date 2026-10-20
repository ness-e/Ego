import { describe, it, expect } from "vitest";
import { HybridSearch } from "../src/HybridSearch.js";
import { cosineTermSimilarity } from "../src/similarity.js";
import type { SearchHit } from "@ego/memory";

function hit(key: string, score: number, payload: string): SearchHit {
  return {
    record: {
      namespace: "kb/docs",
      key,
      payload,
      metadata: {},
      created_at_ms: 0,
      updated_at_ms: 0,
      version: 1,
      node_id: key,
    },
    score,
  } as SearchHit;
}

const DUP_A =
  "el runtime de ego usa typescript y react en el proceso principal del escritorio";
const DUP_B =
  "el runtime de ego usa typescript y react en el proceso principal del escritorio";
const DISTINCT =
  "el changelog de la ola uno documenta los hallazgos de la auditoria del nucleo cognitivo";

describe("HybridSearch — MMR efectivo (T3 / EGO-FIND-41)", () => {
  it("(1) el MMR penaliza la redundancia: con relevancia normalizada elige el documento distinto", async () => {
    const mockAdapter = {
      searchMulti: async () => [
        hit("dup-a", 10, DUP_A),
        hit("dup-b", 9.9, DUP_B),
        hit("distinct", 9.8, DISTINCT),
      ],
    };

    const search = new HybridSearch(mockAdapter as never);

    const results = await search.search("runtime ego typescript", {
      topK: 2,
      useMmr: true,
      mmrLambda: 0.3,
      minConfidence: 0,
      scoreMode: "absolute",
    });

    // Con relevancia BM25 sin acotar el MMR nunca cambia el orden: el 2.º
    // resultado sería el duplicado. Con relevancia normalizada, la
    // diversidad decide y entra el documento distinto.
    expect(results.map((r) => r.record?.key)).toEqual(["dup-a", "distinct"]);
  });

  it("(2) con lambda alto el MMR prioriza la relevancia (comportamiento clásico)", async () => {
    const mockAdapter = {
      searchMulti: async () => [
        hit("dup-a", 10, DUP_A),
        hit("dup-b", 9.9, DUP_B),
        hit("distinct", 9.8, DISTINCT),
      ],
    };

    const search = new HybridSearch(mockAdapter as never);
    const results = await search.search("runtime ego typescript", {
      topK: 2,
      useMmr: true,
      mmrLambda: 0.95,
      minConfidence: 0,
      scoreMode: "absolute",
    });

    expect(results.map((r) => r.record?.key)).toEqual(["dup-a", "dup-b"]);
  });

  it("(3) la similitud es coseno (no Jaccard): idéntico=1, disjunto=0, parcial=intermedio", () => {
    expect(cosineTermSimilarity("hola mundo", "hola mundo")).toBeCloseTo(1, 6);
    expect(cosineTermSimilarity("hola mundo", "vectores sparse")).toBeCloseTo(0, 6);
    const partial = cosineTermSimilarity("runtime typescript react", "runtime typescript node");
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
  });

  it("(4) el coseno pondera la frecuencia de término (Jaccard no lo haría)", () => {
    // "a" aparece 1 vez, "b" 5 veces: con TF el vector de B está dominado por b.
    const a = "a";
    const b = "a b b b b";
    const sim = cosineTermSimilarity(a, b);
    // Jaccard de palabras daría 1/2 = 0.5; el coseno TF da menos peso al
    // término común minoritario.
    expect(sim).toBeLessThan(0.5);
    expect(sim).toBeGreaterThan(0);
  });

  it("(5) el MMR no rompe cuando sólo hay un candidato", async () => {
    const mockAdapter = {
      searchMulti: async () => [hit("only", 5, "unico documento")],
    };
    const search = new HybridSearch(mockAdapter as never);
    const results = await search.search("unico", {
      topK: 5,
      useMmr: true,
      minConfidence: 0,
      scoreMode: "absolute",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.record?.key).toBe("only");
  });
});
