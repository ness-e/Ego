import { EgoMemoryAdapter, SearchHit } from "@ego/memory";
import { CosineThresholdFilter } from "./filters/CosineThresholdFilter.js";
import { KnowledgeSearchOptions, KnowledgeSearchOptionsSchema } from "./schemas/knowledge.js";

/**
 * Motor de búsqueda híbrida combinada con fusión RRF y reordenamiento MMR (KB-04).
 * Combina recuperación léxica BM25 y búsqueda de memoria federada en VantaDB.
 * Aplica corte de umbral coseno (KHOJ-03) para eliminar ruido antes de inyectar al contexto.
 */
export class HybridSearch {
  private adapter: EgoMemoryAdapter;
  private readonly thresholdFilter: CosineThresholdFilter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
    this.thresholdFilter = new CosineThresholdFilter();
  }

  /**
   * Actualiza el adaptador mnemónico (soporte para hot recovery / VDB-INC-03).
   */
  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Ejecuta búsqueda híbrida federada multi-namespace con fusión RRF y filtro de corte.
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
      topK: topK * 2, // Recuperar pool ampliado para RRF y filtrado
      excludeSuperseded: options.excludeSuperseded,
    });

    if (rawHits.length === 0) {
      return [];
    }

    // 2. Aplicar filtro de umbral dinámico (KHOJ-03) para descartar ruido
    const filteredHits = this.thresholdFilter.filter(rawHits, options.minConfidence);

    // Si el filtro descarta todo pero teníamos candidatos léxicos razonables, o si se requiere fallback:
    const candidates = filteredHits.length > 0 ? filteredHits : rawHits.slice(0, topK);

    // 3. Fusión Reciprocal Rank Fusion (RRF) canónica
    const rrfScores = new Map<string, number>();
    const k = 60; // Constante canónica RRF

    candidates.forEach((hit, rank) => {
      const key = hit.record ? `${hit.record.namespace}:${hit.record.key}` : String(rank);
      const rrfContribution = 1 / (k + (rank + 1));
      const current = rrfScores.get(key) ?? 0;
      rrfScores.set(key, current + rrfContribution);
    });

    // 4. Asignar scores RRF normalizados y ordenar
    const rankedHits = candidates.map((hit, rank) => {
      const key = hit.record ? `${hit.record.namespace}:${hit.record.key}` : String(rank);
      const rrfScore = rrfScores.get(key) ?? (hit.score ?? 0);
      return {
        ...hit,
        score: Number(rrfScore.toFixed(6)),
      };
    });

    rankedHits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // 5. Aplicar reordenamiento por diversidad Maximal Marginal Relevance (MMR) si está habilitado
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

      selected.push(remaining.splice(bestIndex, 1)[0]);
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
