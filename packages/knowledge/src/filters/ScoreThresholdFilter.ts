import { SearchHit } from "@ego/memory";

export type ScoreThresholdMode = "normalized" | "absolute";

export interface ScoreThresholdOptions {
  minScore?: number; // Default 0.70 — calibración propia de Ego (ver docs abajo)
  mode?: ScoreThresholdMode; // Default "normalized"
}

/**
 * Filtro de umbral de score calibrado (H10).
 *
 * **Implementación propia de Ego.** El umbral 0.70 es una **calibración
 * propia**: el patrón de filtrado por confianza se estudiará como referencia
 * de diseño, pero **no hay traducción de código** (aquí el corte es un 0.70
 * propio, no el del upstream). Sin atribución de código derivado.
 *
 * Calibración (H10): el umbral 0.70 nació para similitud coseno en [0,1],
 * pero los scores de recuperación BM25 no están acotados (típico 0..>10 según
 * longitud/IDF), así que un corte absoluto 0.70 es arbitrario sobre ellos.
 * Por defecto (`mode: "normalized"`) el filtro normaliza min-max los scores
 * del lote a [0,1] y aplica el umbral sobre el score normalizado: el corte
 * se vuelve relativo a la distribución real del índice en vez de absoluto.
 * `mode: "absolute"` conserva la semántica coseno clásica para scores ya
 * acotados a [0,1].
 */
export class ScoreThresholdFilter {
  private readonly minScore: number;
  private readonly mode: ScoreThresholdMode;

  constructor(options: ScoreThresholdOptions = {}) {
    this.minScore = options.minScore ?? 0.7;
    this.mode = options.mode ?? "normalized";
  }

  public getThreshold(): number {
    return this.minScore;
  }

  public getMode(): ScoreThresholdMode {
    return this.mode;
  }

  /**
    * Filtra una lista de SearchHit reteniendo solo aquellos que superen el umbral.
   * En modo `normalized` el umbral se aplica sobre el score normalizado
   * min-max del lote; en modo `absolute`, sobre el score crudo.
   * Si ningún resultado supera el corte, devuelve array vacío para prevenir
   * alucinaciones (el llamador decide si el fallback explícito aplica).
   */
  public filter(hits: SearchHit[], customThreshold?: number): SearchHit[] {
    const threshold = customThreshold ?? this.minScore;
    if (hits.length === 0) {
      return [];
    }
    if (this.mode === "absolute") {
      return hits.filter((hit) => {
        const score = hit.score ?? 0;
        return score >= threshold;
      });
    }
    let min = Infinity;
    let max = -Infinity;
    for (const hit of hits) {
      const score = hit.score ?? 0;
      if (score < min) min = score;
      if (score > max) max = score;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [];
    }
    const span = max - min;
    return hits.filter((hit) => {
      const score = hit.score ?? 0;
      // Lote degenerado (un solo score o todos iguales): normalizado = 1.
      const normalized = span === 0 ? 1 : (score - min) / span;
      return normalized >= threshold;
    });
  }

  /**
   * Evalúa si un score individual cumple con el criterio de corte.
   * Semántica absoluta (sin contexto de lote no hay normalización posible).
   */
  public isAboveThreshold(score: number, customThreshold?: number): boolean {
    const threshold = customThreshold ?? this.minScore;
    return score >= threshold;
  }
}
