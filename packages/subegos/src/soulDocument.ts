import YAML from "yaml";

/**
 * E5 (Ola 4b / A3 / T1) — Parser del artefacto declarativo de identidad.
 *
 * Formato canónico (`SOUL.md` / `AGENT.md`):
 *
 * ```markdown
 * ---
 * id: ego.auditor-tecnico
 * name: Auditor Técnico
 * tone: analytical
 * ---
 * Cuerpo en Markdown: la narrativa de identidad del Sub-Ego.
 * ```
 *
 * El módulo es **puro** (no toca disco, no importa el runtime): parsea y
 * serializa. La resolución de rutas y la lectura del fichero viven en
 * `SubEgoIdentity.ts` (DIP: el lector se inyecta).
 */

/** Documento de identidad parseado: frontmatter + cuerpo. */
export interface ParsedSoulDocument {
  /** Frontmatter YAML parseado (objeto plano). Vacío si el documento no lo tiene. */
  readonly frontmatter: Record<string, unknown>;
  /** Cuerpo Markdown (sin el frontmatter). */
  readonly body: string;
  /** Avisos no fatales (p. ej. "el documento no tiene frontmatter"). */
  readonly warnings: string[];
}

/**
 * Error tipado de parseo del artefacto de identidad.
 */
export class SoulDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SoulDocumentError";
  }
}

const FRONTMATTER_FENCE = /^---[ \t]*\r?\n/;

/**
 * Parsea un documento de identidad en frontmatter + cuerpo.
 *
 * - Sin frontmatter ⇒ `{ frontmatter: {}, body: <todo>, warnings: [...] }`.
 * - Con frontmatter mal formado ⇒ `SoulDocumentError` (fail-closed: una
 *   identidad corrupta NO se degrada silenciosamente a "sin identidad").
 */
export function parseSoulDocument(markdown: string): ParsedSoulDocument {
  const text = typeof markdown === "string" ? markdown : "";
  const warnings: string[] = [];

  if (!FRONTMATTER_FENCE.test(text)) {
    warnings.push("El documento de identidad no tiene frontmatter YAML: se usa el cuerpo como narrativa.");
    return { frontmatter: {}, body: text.trim(), warnings };
  }

  // Cierre del frontmatter: la primera línea `---` (o `...`) tras la apertura.
  const afterOpen = text.replace(FRONTMATTER_FENCE, "");
  const closeMatch = /\r?\n(?:---|\.\.\.)[ \t]*(\r?\n|$)/.exec(afterOpen);
  if (!closeMatch) {
    throw new SoulDocumentError(
      "El frontmatter YAML del documento de identidad no está cerrado (falta la línea '---')."
    );
  }

  const yamlBlock = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length);

  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlBlock);
  } catch (err) {
    throw new SoulDocumentError(
      `Frontmatter YAML inválido en el documento de identidad: ${String(err)}`
    );
  }

  if (parsed === null || parsed === undefined) {
    warnings.push("El frontmatter YAML está vacío: la identidad sólo se compone con los defaults.");
    return { frontmatter: {}, body: body.trim(), warnings };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SoulDocumentError(
      "El frontmatter YAML del documento de identidad debe ser un mapa (clave: valor), no una lista ni un escalar."
    );
  }

  return { frontmatter: parsed as Record<string, unknown>, body: body.trim(), warnings };
}

/**
 * Serializa un documento de identidad de forma canónica.
 *
 * El frontmatter se emite siempre completo (con sus claves por omisión) para
 * que el round-trip sea estable byte a byte.
 */
export function serializeSoulDocument(
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const yaml = YAML.stringify(frontmatter).replace(/\r\n/g, "\n");
  const trimmedBody = (body ?? "").trim();
  return `---\n${yaml}---\n\n${trimmedBody}\n`;
}
