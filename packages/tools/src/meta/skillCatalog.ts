/**
 * E13 (Ola 4b / A3 / T2) — Catálogo de skills con divulgación progresiva.
 *
 * ## Por qué
 *
 * Hasta ahora no existía un catálogo de skills consultable: el modelo recibía
 * el índice completo (o nada). La **divulgación progresiva** invierte eso:
 * el modelo pide lo que necesita y recibe el mínimo útil.
 *
 * ## Contrato estructural (DIP)
 *
 * `packages/tools` NO depende de `@ego/integrations` (donde vive
 * `SkillScanner`): el catálogo se **inyecta**. El main process (o un test)
 * conecta su scanner con un adaptador de 5 líneas — ver el handoff A3-ola4b
 * §fuera-de-zona.
 */

/**
 * Entrada de skill del catálogo.
 *
 * `body` es OPCIONAL a propósito: la divulgación progresiva entrega el
 * cuerpo sólo cuando el modelo lo pide (`includeBody: true`).
 */
export interface SkillCatalogEntry {
  /** Identificador estable de la skill (p. ej. "pdf-export"). */
  readonly id: string;
  /** Nombre legible. */
  readonly name: string;
  /** Descripción de una línea: qué hace y cuándo usarla. */
  readonly description: string;
  /** Etiquetas para la búsqueda. */
  readonly tags?: readonly string[];
  /** Ruta del artefacto (`SKILL.md`). */
  readonly path?: string;
  /** Cuerpo completo (sólo si el catálogo lo trae). */
  readonly body?: string;
}

/**
 * Catálogo de skills consultable.
 *
 * Implementaciones: un array estático, un scanner de disco, o un índice
 * persistente. El paquete sólo necesita `list()`.
 */
export interface SkillCatalogLike {
  list(): readonly SkillCatalogEntry[] | Promise<readonly SkillCatalogEntry[]>;
}

/** Skill puntuada por el motor de búsqueda. */
export interface RankedSkill {
  readonly skill: SkillCatalogEntry;
  readonly score: number;
}

/** Palabras vacías (español + inglés) que no aportan señal. */
const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "y",
  "o",
  "a",
  "en",
  "para",
  "con",
  "por",
  "que",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "with"
]);

/**
 * Normaliza una cadena a tokens comparables (minúsculas, sin puntuación).
 */
function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Puntúa una skill frente a una consulta.
 *
 * La puntuación es **determinista** y explicable:
 * - coincidencia exacta de id (×100) o de nombre (×60);
 * - el nombre contiene la consulta completa (+30);
 * - cada token de la consulta aparece en el nombre (+10), en las etiquetas
 *   (+6), en el id (+8) o en la descripción (+4).
 */
export function scoreSkill(entry: SkillCatalogEntry, query: string): number {
  const q = (query ?? "").trim().toLowerCase();
  if (q.length === 0) return 0;

  const name = (entry.name ?? "").toLowerCase();
  const id = (entry.id ?? "").toLowerCase();
  const description = (entry.description ?? "").toLowerCase();
  const tags = (entry.tags ?? []).map((t) => t.toLowerCase());

  let score = 0;
  if (id === q) score += 100;
  if (name === q) score += 60;
  if (name.includes(q)) score += 30;
  if (id.includes(q)) score += 15;

  for (const token of tokenize(query)) {
    if (name.includes(token)) score += 10;
    if (id.includes(token)) score += 8;
    if (tags.some((t) => t.includes(token))) score += 6;
    if (description.includes(token)) score += 4;
  }
  return score;
}

/**
 * Ordena un catálogo de skills por relevancia respecto a la consulta.
 *
 * - Con consulta: sólo entran las skills con `score > 0`.
 * - Sin consulta: entran todas (modo "listar"), con puntuación 0.
 * - Empates: por `id` ascendente ⇒ orden estable y reproducible.
 */
export function rankSkills(
  entries: readonly SkillCatalogEntry[],
  query: string
): RankedSkill[] {
  const q = (query ?? "").trim();
  const scored: RankedSkill[] = [];

  for (const skill of entries) {
    const score = q.length === 0 ? 0 : scoreSkill(skill, q);
    if (q.length > 0 && score <= 0) continue;
    scored.push({ skill, score });
  }

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.skill.id.localeCompare(b.skill.id);
  });
}
