import { EgoMemoryAdapter, SearchHit } from "@ego/memory";
import { ScoreThresholdFilter } from "./filters/ScoreThresholdFilter.js";
import { KnowledgeSearchOptions, KnowledgeSearchOptionsSchema } from "./schemas/knowledge.js";

/**
 * Motor de búsqueda híbrida con reordenamiento MMR (KB-04).
 * Combina recuperación léxica BM25 y búsqueda de memoria federada en VantaDB.
 * Aplica corte de umbral calibrado (KHOJ-03) para eliminar ruido antes de inyectar al contexto.
 *
 * Nota de honestidad (H09): con retrieval federado mono-llamada (`searchMulti`)
 * no hay múltiples listas que fusionar, así que no se reclama RRF canónico:
 * el paso de ordenamiento es un re-rank mono-lista que preserva el score
 * original del motor. Si el umbral descarta todo, se retorna vacío por defecto
 * (guarda anti-alucinación KHOJ-03); el fallback sin filtrar exige el flag
 * explícito `allowUnfilteredFallback` y queda registrado con `console.warn`.
 */
export class HybridSearch {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  /**
   * Actualiza el adaptador mnemónico (soporte para hot recovery / VDB-INC-03).
   */
  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Ejecuta búsqueda híbrida federada multi-namespace con re-rank y filtro de corte.
   */
  public async search(
    query: string,
    rawOptions: Partial<KnowledgeSearchOptions> = {}
  ): Promise<SearchHit[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const options = KnowledgeSearchOptionsSchema.parse(rawOptions);
    const topK = options.topK;

    // 1. Recuperar candidatos de los namespaces configurados vía searchMulti
    const rawHits = await this.adapter.searchMulti(options.namespaces, query, {
      topK: topK * 2, // Recuperar pool ampliado para re-rank y filtrado
      excludeSuperseded: options.excludeSuperseded,
    });

    if (rawHits.length === 0) {
      return [];
    }

    // 2. Aplicar filtro de umbral calibrado (KHOJ-03/H10) para descartar ruido.
    // H09: sin fallback silencioso. Si el filtro descarta todo, se retorna
    // vacío salvo flag explícito (con warn) que asume el bypass del umbral.
    // El modo de score viaja por opción: normalized (defecto, relativo a la
    // distribución BM25 del lote) o absolute (semántica coseno [0,1]).
    const thresholdFilter = new ScoreThresholdFilter({ mode: options.scoreMode });
    const filteredHits = thresholdFilter.filter(rawHits, options.minConfidence);

    let candidates: SearchHit[];
    if (filteredHits.length > 0) {
      candidates = filteredHits;
    } else if (options.allowUnfilteredFallback) {
      console.warn(
        `[HybridSearch] El umbral ${options.minConfidence} descartó los ${rawHits.length} candidatos; ` +
          `retornando top-${topK} sin filtrar (allowUnfilteredFallback=true). Guarda KHOJ-03 explícitamente omitida.`
      );
      candidates = rawHits.slice(0, topK);
    } else {
      return [];
    }

    // 3. Re-rank mono-lista honesto: orden estable por score original
    // descendente, preservando el score del motor (no se sobrescribe).
    const rankedHits = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // 4. Aplicar reordenamiento por diversidad Maximal Marginal Relevance (MMR) si está habilitado
    if (options.useMmr && rankedHits.length > 2) {
      return this.applyMmrDiversity(rankedHits, topK, options.mmrLambda);
    }

    return rankedHits.slice(0, topK);
  }

  /**
   * Reordenamiento MMR (Maximal Marginal Relevance) heurístico para evitar fragmentos casi idénticos.
   */
  private applyMmrDiversity(hits: SearchHit[], topK: number, lambda: number): SearchHit[] {
    const selected: SearchHit[] = [];
    const remaining = [...hits];

    // El primer resultado con el score más alto siempre se selecciona
    if (remaining.length > 0) {
      selected.push(remaining.shift()!);
    }

    while (selected.length < topK && remaining.length > 0) {
      let bestIndex = 0;
      let bestMmrScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        if (!candidate) continue;
        const relevance = candidate.score ?? 0;

        // Calcular redundancia máxima respecto a los ya seleccionados (solapamiento de texto jaccard simple)
        let maxSimilarity = 0;
        for (const sel of selected) {
          const sim = this.jaccardSimilarity(candidate.record?.payload || "", sel.record?.payload || "");
          if (sim > maxSimilarity) maxSimilarity = sim;
        }

        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;
        if (mmrScore > bestMmrScore) {
          bestMmrScore = mmrScore;
          bestIndex = i;
        }
      }

      const picked = remaining.splice(bestIndex, 1)[0];
      if (picked) {
        selected.push(picked);
      }
    }

    return selected;
  }

  /**
   * Similitud de Jaccard basada en n-gramas o palabras para penalizar duplicación en MMR.
   */
  private jaccardSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
