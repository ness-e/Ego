// Adapted from hermes-agent (MIT), apps/shared/src/fuzzy.ts
/**
 * FuzzySearch.ts — Algoritmo de puntuación y ranking difuso sin dependencias.
 *
 * Código **derivado** de Hermes Agent (MIT, Copyright (c) 2025 Nous Research):
 * `FuzzyMatch`, `searchFold`, `fuzzyScore` y `fuzzyRank` son un port del
 * fichero de origen (con `RankedItem` renombrado a `RankedResult`). El aviso de
 * licencia está en el `LICENSE.md` de este paquete.
 *
 * Evalúa coincidencias de subsecuencia ponderando:
 * - Coincidencia exacta o de prefijo
 * - Límites de palabra (tras '-', '_', '.', '/', espacio o camelCase)
 * - Caracteres contiguos
 * - Menor índice de inicio
 */

export interface FuzzyMatch {
  score: number;
  positions: number[];
}

const WORD_BOUNDARY = /[-_/.\s]/;

export function searchFold(value: string): string {
  return value.toLowerCase().replace(/[-_.]/g, " ");
}

function isBoundary(target: string, index: number): boolean {
  if (index === 0) return true;
  const prev = target[index - 1];
  if (prev === undefined) return false;
  if (WORD_BOUNDARY.test(prev)) return true;

  const cur = target[index];
  if (cur === undefined) return false;
  return prev === prev.toLowerCase() && cur !== cur.toLowerCase() && cur === cur.toUpperCase();
}

/**
 * Evalúa un query contra un texto objetivo. Retorna null si el query no es subsecuencia.
 */
export function fuzzyScore(target: string, query: string): FuzzyMatch | null {
  if (!query) {
    return { score: 0, positions: [] };
  }
  if (!target) {
    return null;
  }

  const lowerTarget = searchFold(target);
  const lowerQuery = searchFold(query);

  const positions: number[] = [];
  let score = 0;
  let prevIndex = -1;
  let searchFrom = 0;

  for (let i = 0; i < lowerQuery.length; i++) {
    const qChar = lowerQuery[i];
    if (qChar === undefined || qChar === " ") continue;

    const hit = lowerTarget.indexOf(qChar, searchFrom);
    if (hit === -1) {
      return null;
    }

    positions.push(hit);

    let charScore = 1;
    if (isBoundary(target, hit)) {
      charScore += 8;
    } else if (prevIndex !== -1 && hit === prevIndex + 1) {
      charScore += 6; // Contiguo
    }

    // Penalización por distancia al inicio
    charScore += Math.max(0, 5 - hit * 0.2);

    score += charScore;
    prevIndex = hit;
    searchFrom = hit + 1;
  }

  // Bonificación por coincidencia exacta
  if (lowerTarget === lowerQuery) {
    score += 50;
  } else if (lowerTarget.startsWith(lowerQuery)) {
    score += 25;
  }

  return { score, positions };
}

export interface RankedResult<T> {
  item: T;
  score: number;
  positions: number[];
}

/**
 * Filtra y ordena una colección de elementos mediante búsqueda difusa.
 */
export function fuzzyRank<T>(
  items: readonly T[],
  query: string,
  getTarget: (item: T) => string
): RankedResult<T>[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return items.map((item) => ({ item, score: 0, positions: [] }));
  }

  const results: RankedResult<T>[] = [];
  for (const item of items) {
    const target = getTarget(item);
    const match = fuzzyScore(target, trimmed);
    if (match) {
      results.push({ item, score: match.score, positions: match.positions });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
