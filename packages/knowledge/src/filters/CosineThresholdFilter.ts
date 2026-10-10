import { SearchHit } from "@ego/memory";

export interface ThresholdOptions {
  minConfidence?: number; // Default 0.70 (KHOJ-03)
}

/**
 * Filtro de umbral dinámico de similitud coseno basado en Khoj (KHOJ-03).
 * Descarta resultados por debajo del umbral mínimo de confianza calibrado (0.70-0.75)
 * antes de alimentar la fusión de rangos RRF o inyectar contexto al LLM.
 */
export class CosineThresholdFilter {
  private readonly minConfidence: number;

  constructor(options: ThresholdOptions = {}) {
    this.minConfidence = options.minConfidence ?? 0.70;
  }

  /**
   * Filtra una lista de SearchHit reteniendo solo aquellos cuyo score supere el umbral.
   * Si ningún resultado supera el corte, devuelve array vacío para prevenir alucinaciones.
   */
  public filter(hits: SearchHit[], customThreshold?: number): SearchHit[] {
    const threshold = customThreshold ?? this.minConfidence;
    return hits.filter((hit) => {
      const score = hit.score ?? 0;
      return score >= threshold;
    });
  }

  /**
   * Evalúa si un score individual cumple con el criterio de corte.
   */
  public isAboveThreshold(score: number, customThreshold?: number): boolean {
    const threshold = customThreshold ?? this.minConfidence;
    return score >= threshold;
  }
}
