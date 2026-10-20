/**
 * ToolContract — contrato de existencia de herramientas.
 *
 * EGO-FIND-45 (Ola 1 / A3 / T5).
 *
 * Los manifiestos de Sub-Ego, los dominios funcionales y las plantillas
 * declaraban tools que **no existen** en el `ToolRegistry`. Consecuencias:
 * - `SubEgoSelector` (`packages/decision`) nunca encontraba un candidato,
 * - los filtros por tool del registro no devolvían nada,
 * - la documentación de producto prometía capacidades inexistentes.
 *
 * Este módulo provee una comprobación estructural (sin dependencias) que puede
 * inyectarse en el registro de Sub-Egos y en el de dominios, más un helper
 * para auditar un conjunto de declaraciones de una vez.
 */

/** Catálogo mínimo de tools (compatible con `ToolRegistry`). */
export interface ToolCatalogLike {
  has(name: string): boolean;
}

/** Violación de contrato detectada. */
export interface ToolContractViolation {
  /** Origen de la declaración (p. ej. `domain:engineering`, `manifest:ego.dev`). */
  readonly source: string;
  /** Nombre de la tool declarada que no existe. */
  readonly tool: string;
  /** Explicación legible. */
  readonly reason: string;
}

/**
 * Devuelve los nombres declarados que NO existen en el catálogo.
 */
export function findMissingTools(
  declared: readonly string[],
  catalog: ToolCatalogLike
): string[] {
  const missing: string[] = [];
  for (const name of declared) {
    if (!catalog.has(name)) missing.push(name);
  }
  return missing;
}

/**
 * Verifica que todas las tools declaradas existen. Lanza si alguna falta.
 *
 * `context` describe el origen de la declaración (para el mensaje de error).
 */
export function assertToolsExist(
  declared: readonly string[],
  catalog: ToolCatalogLike,
  context = "declaración"
): void {
  const missing = findMissingTools(declared, catalog);
  if (missing.length === 0) return;
  throw new Error(
    `[ToolContract] ${context}: declara tools que no existen en el catálogo: ` +
      `${missing.join(", ")}. Declara solo tools registradas (o quita la declaración).`
  );
}

/**
 * Audita un conjunto de declaraciones y devuelve TODAS las violaciones
 * (en vez de fallar en la primera). Útil para tests de contrato y para
 * reportes de migración.
 */
export function collectToolContractViolations(
  entries: ReadonlyArray<{ source: string; tools: readonly string[] }>,
  catalog: ToolCatalogLike
): ToolContractViolation[] {
  const violations: ToolContractViolation[] = [];
  for (const entry of entries) {
    for (const tool of findMissingTools(entry.tools, catalog)) {
      violations.push({
        source: entry.source,
        tool,
        reason: `La tool '${tool}' no está registrada en el catálogo.`,
      });
    }
  }
  return violations;
}
