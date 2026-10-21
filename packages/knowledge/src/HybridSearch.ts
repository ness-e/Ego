import { EgoMemoryAdapter, SearchHit } from "@ego/memory";
import { ScoreThresholdFilter } from "./filters/ScoreThresholdFilter.js";
import { KnowledgeSearchOptions, KnowledgeSearchOptionsSchema } from "./schemas/knowledge.js";
import {
  lexicalCosineSimilarity,
  normalizeScores,
  type SimilarityProvider,
} from "./similarity.js";

export interface HybridSearchOptions {
  /**
   * Estrategia de similitud para el reordenamiento MMR.
   * Por defecto: coseno léxico (TF). El fast path de VantaDB 0.9.0 es BM25
   * puro (sin embeddings en el fast path — `VDB-REQ-10`), por lo que
   * aún no existe una lista vectorial densa sobre la que calcular MMR
   * canónico.
   *
   * Workaround upstream: `VDB-REQ-10` — el binding `vantadb-node@0.8.0` no
   * expone embeddings en el fast path, así que Ego no puede calcular un
   * coseno denso real; el MMR usa coseno léxico (TF) como aproximación.
   */
  similarity?: SimilarityProvider;
}

/**
 * Motor de búsqueda federada multi-namespace con reordenamiento MMR (KB-04).
 *
 * Combina la recuperación léxica BM25 de varios namespaces de VantaDB con un
 * re-rank de diversidad (Maximal Marginal Relevance) y un corte de umbral
 * calibrado (KHOJ-03) que elimina ruido antes de inyectarlo al contexto.
 *
 * **Lo que NO hace (honestidad de contrato, EGO-FIND-41):**
 * - **No hay RRF.** El backend expone una única lista fusionada por
 *   `searchMulti`, no varias listas que fusionar. El re-rank es mono-lista:
 *   preserva el score original del motor y sólo reordena por diversidad.
 * - **No hay lista vectorial.** `searchMulti` opera en BM25 puro
 *   (sin embeddings en el fast path — `VDB-REQ-10`), por lo que la
 *   similitud del MMR es coseno léxico, no coseno denso.
 *
 * Workaround upstream: `VDB-REQ-10` — mientras el fast path no exponga
 * embeddings por hit, la fusión RRF real (BM25 + denso) no puede calcularse:
 * `searchMulti` devuelve una única lista léxica, así que el re-rank es
 * mono-lista (score del motor + MMR con coseno léxico).
 * TODO(EGO-FIND-41): migrar a RRF real + coseno denso cuando VantaDB
 * exponga scores vectoriales por hit en `searchMulti`.
 *
 * Si el umbral descarta todo, se retorna vacío por defecto (guarda
 * anti-alucinación KHOJ-03); el fallback sin filtrar exige el flag explícito
 * `allowUnfilteredFallback` y queda registrado con `console.warn`.
 */
export class HybridSearch {
  private adapter: EgoMemoryAdapter;
  private readonly similarity: SimilarityProvider;

  constructor(adapter: EgoMemoryAdapter, options: HybridSearchOptions = {}) {
    this.adapter = adapter;
    this.similarity = options.similarity ?? lexicalCosineSimilarity;
  }

  /**
   * Actualiza el adaptador mnemónico (soporte para hot recovery / VDB-INC-03).
   */
  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Ejecuta la búsqueda federada multi-namespace con re-rank y filtro de corte.
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
   * Reordenamiento MMR (Maximal Marginal Relevance) para evitar fragmentos
   * casi idénticos.
   *
   * EGO-FIND-41: la relevancia se **normaliza a [0,1]** con min-max del lote
   * antes de combinarla con la penalización de redundancia. Sin esa
   * normalización, el score BM25 (rango 0..>10) dominaba siempre a la
   * similitud (rango [0,1]) y el MMR **nunca cambiaba el orden**.
   */
  private applyMmrDiversity(hits: SearchHit[], topK: number, lambda: number): SearchHit[] {
    const selected: SearchHit[] = [];
    const remaining = [...hits];

    // Relevancia normalizada del lote (min-max). Lote degenerado ⇒ todo 1.
    const normalized = normalizeScores(hits.map((h) => h.score ?? 0));
    const relevanceOf = new Map<string, number>();
    hits.forEach((h, i) => {
      const key = h.record ? `${h.record.namespace}:${h.record.key}` : `idx_${i}`;
      relevanceOf.set(key, normalized[i] ?? 0);
    });
    const relevanceFor = (hit: SearchHit, index: number): number => {
      const key = hit.record ? `${hit.record.namespace}:${hit.record.key}` : `idx_${index}`;
      return relevanceOf.get(key) ?? 0;
    };

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
        const relevance = relevanceFor(candidate, i);

        // Redundancia máxima respecto a los ya seleccionados, medida con la
        // estrategia de similitud inyectada (coseno léxico por defecto).
        let maxSimilarity = 0;
        for (const sel of selected) {
          const sim = this.similarity.similarity(
            candidate.record?.payload || "",
            sel.record?.payload || ""
          );
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
}
