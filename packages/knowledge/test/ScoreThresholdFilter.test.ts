import { describe, it, expect } from "vitest";
import { ScoreThresholdFilter } from "../src/filters/ScoreThresholdFilter.js";
import type { SearchHit } from "@ego/memory";

/**
 * F2T3 — ScoreThresholdFilter calibrado (H10, KHOJ-03).
 *
 * BM25 no está acotado a [0,1] (típico 0..>10 según longitud/IDF), por lo que
 * un umbral absoluto 0.70 "pensado para coseno" es arbitrario sobre scores
 * BM25. Por defecto el filtro normaliza min-max por lote y aplica el umbral
 * sobre el score normalizado; el modo `absolute` conserva la semántica
 * coseno clásica para scores ya acotados.
 */

const hit = (key: string, score: number): SearchHit =>
  ({
    record: {
      namespace: "kb/docs",
      key,
      payload: key,
      metadata: {},
      created_at_ms: 0,
      updated_at_ms: 0,
      version: 1,
      node_id: key,
    },
    score,
  }) as SearchHit;

describe("F2T3 — ScoreThresholdFilter (H10/KHOJ-03)", () => {
  it("modo normalized (defecto): calibra el umbral contra la distribución BM25 del lote", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7 });
    const hits = [hit("a", 4.2), hit("b", 3.1), hit("c", 0.5)];
    // min-max: a=1.0, b≈0.703, c=0.0 → conserva a y b.
    const kept = filter.filter(hits);
    expect(kept.map((h) => h.record.key)).toEqual(["a", "b"]);
  });

  it("modo normalized: un umbral absoluto dejaría pasar ruido que la calibración descarta", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7 });
    // Los tres pasarían un corte absoluto 0.70; normalizados solo el mejor.
    const hits = [hit("a", 0.75), hit("b", 0.72), hit("c", 0.71)];
    const kept = filter.filter(hits);
    expect(kept.map((h) => h.record.key)).toEqual(["a"]);
  });

  it("modo absolute: conserva la semántica coseno clásica sobre scores acotados", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7, mode: "absolute" });
    const hits = [
      hit("alto", 0.88),
      hit("limite", 0.7),
      hit("bajo", 0.65),
      hit("muy-bajo", 0.3),
    ];
    const kept = filter.filter(hits);
    expect(kept.map((h) => h.record.key)).toEqual(["alto", "limite"]);
  });

  it("lote de un solo elemento no se descarta por división por cero", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7 });
    expect(filter.filter([hit("solo", 5.0)])).toHaveLength(1);
    expect(filter.filter([])).toEqual([]);
  });

  it("isAboveThreshold evalúa un score individual en semántica absoluta", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7 });
    expect(filter.isAboveThreshold(0.75)).toBe(true);
    expect(filter.isAboveThreshold(0.69)).toBe(false);
    expect(filter.isAboveThreshold(4.2)).toBe(true);
  });

  it("respeta un umbral personalizado por llamada", () => {
    const filter = new ScoreThresholdFilter({ minScore: 0.7 });
    const hits = [hit("a", 4.2), hit("b", 3.1), hit("c", 0.5)];
    // Umbral 0.95 normalizado solo deja al mejor.
    expect(filter.filter(hits, 0.95).map((h) => h.record.key)).toEqual(["a"]);
  });
});
