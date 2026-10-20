/**
 * Interfaz de similitud para el reordenamiento MMR (EGO-FIND-41 / T3).
 *
 * El fast path de VantaDB 0.8.0 sólo expone búsqueda BM25 pura
 * (`query_vector: []` — workaround `VDB-REQ-02`), por lo que **no existe una
 * lista vectorial densa** sobre la que calcular MMR canónico. Esta interfaz
 * desacopla el MMR del backend: hoy se implementa con coseno sobre vectores
 * de frecuencia de términos (matemáticamente coseno, no solapamiento de
 * conjuntos); cuando VantaDB exponga embeddings densos por hit
 * (requisito upstream `VDB-REQ-10`) basta con inyectar otra implementación.
 *
 * Workaround upstream: `VDB-REQ-10` — el binding `vantadb-node@0.8.0` no
 * expone embeddings en el fast path (el path cognitivo L0-L3 vive en
 * `vantadb-mcp`), de modo que Ego no puede calcular coseno denso real y
 * sustituye el MMR canónico por coseno léxico (TF).
 */
export interface SimilarityProvider {
  /** Identificador de la estrategia (para telemetría y tests). */
  readonly id: string;
  /** Similitud en [0,1]: 1 = idéntico, 0 = sin términos comunes. */
  similarity(a: string, b: string): number;
}

/** Normaliza texto a tokens comparables (minúsculas, sin puntuación). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((t) => t.length > 0);
}

/** Vector de frecuencia de términos. */
function termVector(text: string): Map<string, number> {
  const vec = new Map<string, number>();
  for (const token of tokenize(text)) {
    vec.set(token, (vec.get(token) ?? 0) + 1);
  }
  return vec;
}

/**
 * Similitud coseno entre dos textos sobre vectores de frecuencia de términos.
 *
 * A diferencia del solapamiento de Jaccard (conjuntos de palabras), el coseno
 * pondera la frecuencia: un término dominante en un documento pesa más, que
 * es el comportamiento esperado al penalizar redundancia.
 */
export function cosineTermSimilarity(a: string, b: string): number {
  const va = termVector(a);
  const vb = termVector(b);
  if (va.size === 0 || vb.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const count of va.values()) normA += count * count;
  for (const count of vb.values()) normB += count * count;

  for (const [term, count] of va) {
    const other = vb.get(term);
    if (other !== undefined) dot += count * other;
  }

  if (normA === 0 || normB === 0) return 0;
  const value = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Proveedor por defecto: coseno léxico (TF).
 *
 * Workaround upstream: `VDB-REQ-10` — el binding `vantadb-node@0.8.0` no
 * expone embeddings densos por hit en `searchMulti` (el fast path es BM25
 * puro), de modo que el MMR opera sobre coseno léxico. Cuando exista la
 * lista vectorial real, se inyectará un `SimilarityProvider` distinto sin
 * tocar el motor MMR.
 */
export const lexicalCosineSimilarity: SimilarityProvider = {
  id: "lexical-cosine-tf",
  similarity: cosineTermSimilarity,
};

/**
 * Normaliza un lote de scores a [0,1] con min-max (misma convención que
 * `ScoreThresholdFilter` en modo `normalized`). Lote degenerado (todos
 * iguales) ⇒ todos valen 1.
 */
export function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) return [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of scores) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const span = max - min;
  if (!Number.isFinite(span) || span === 0) return scores.map(() => 1);
  return scores.map((s) => (s - min) / span);
}
