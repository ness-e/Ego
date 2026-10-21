import { createHash } from "node:crypto";
import { Fact, FactSchema } from "../schemas/knowledge.js";

/**
 * Verbo → predicado. Se reconocen presente, pasado y futuro en español, y
 * presente en inglés (A2-19). El orden importa: las alternativas más largas
 * van primero para que `usará` no se matchee como `usa`.
 */
const VERB_PATTERN =
  /^(.+?)\s+(usar|usó|usará|utiliza|utilizó|utilizará|requiere|requirió|requerirá|implementa|implementó|implementará|extiende|extió|contiene|contuvo|uses|used|requires|implements|extends|contains)\s+(.+)$/i;

/**
 * Clave de un par clave-valor: etiqueta legible (empieza por letra, ≤40
 * caracteres). Evita que un timestamp (`2024-01-15 10`) o un esquema de URI
 * (`https`) se interpreten como sujeto (A2-19).
 */
const KEY_LABEL_REGEX = /^[\p{L}][\p{L}\p{N} _.-]{0,40}$/u;

/** Línea que es una URL completa (`https://…`), no un par clave-valor. */
const URI_LINE_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Valor que es un URI. */
const URI_VALUE_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Línea que empieza por una fecha. */
const DATE_LINE_REGEX = /^\d{4}-\d{2}-\d{2}\b/;

/**
 * Claves genéricas de prosa: `Nota: revisar más tarde` no es un hecho
 * estruturado sino una anotación. Se excluyen del esquema clave-valor.
 */
const GENERIC_KEYS: ReadonlySet<string> = new Set([
  "nota",
  "notas",
  "aviso",
  "aviso importante",
  "tip",
  "tips",
  "ejemplo",
  "example",
  "info",
  "information",
  "dato",
  "datos",
  "fuente",
  "fuentes",
  "referencia",
  "referencias",
  "enlace",
  "enlaces",
  "link",
  "links",
  "url",
  "urls",
  "nota importante",
]);

/**
 * Extractor heurístico y estructurado de hechos atómicos.
 *
 * **Implementación propia de Ego.** Sin atribución de código derivado.
 * Convierte enunciados declarativos en triples tipados (sujeto, predicado, objeto).
 */
export class FactExtractor {
  /**
   * Extrae hechos a partir de una lista de aserciones en texto o respuestas JSON de modelo.
   */
  public extractFromText(
    text: string,
    source: string,
    options: { confidence?: number; sourceChunkId?: string } = {}
  ): Fact[] {
    const defaultConfidence = options.confidence ?? 0.85;
    const now = Date.now();
    const facts: Fact[] = [];

    // Parseo heurístico de patrones estructurados tipo "Sujeto es/tiene/usa Objeto" o listas clave-valor
    const lines = text.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/^[-*•]\s*/, "");
      if (!line) continue;

      // Patrón clave: valor (ej. "Editor: VSCode", "Runtime: Node 22")
      const kvMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (kvMatch && kvMatch[1] && kvMatch[2]) {
        const subject = kvMatch[1].trim();
        const object = kvMatch[2].trim();

        // Filtros de precisión (A2-19): la línea no es un par clave-valor
        // si es una URL, una fecha, si la clave no es una etiqueta legible,
        // si la clave es genérica o si el valor es un URI.
        const isUriLine = URI_LINE_REGEX.test(line);
        const isDateLine = DATE_LINE_REGEX.test(line);
        const isLabelLike = KEY_LABEL_REGEX.test(subject);
        const isGenericKey = GENERIC_KEYS.has(subject.toLowerCase());
        const isUriValue = URI_VALUE_REGEX.test(object);

        if (!isUriLine && !isDateLine && isLabelLike && !isGenericKey && !isUriValue) {
          const factId = `fact_${createHash("sha256").update(`${subject}:${object}:${source}`).digest("hex").substring(0, 12)}`;

          const fact: Fact = {
            id: factId,
            subject,
            predicate: "is_configured_as",
            object,
            confidence: defaultConfidence,
            temporalScope: "persistent",
            source,
            sourceChunkId: options.sourceChunkId,
            validAt: now,
            invalidAt: null,
            supersededBy: null,
            state: "active",
          };

          if (FactSchema.safeParse(fact).success) {
            facts.push(fact);
          }
          continue;
        }
        // La clave no es utilizable: se intenta el patrón verbal.
      }

      // Patrón verbal común: "X usa Y", "X requiere Y", "X implementa Y"
      const verbMatch = line.match(VERB_PATTERN);
      if (verbMatch && verbMatch[1] && verbMatch[2] && verbMatch[3]) {
        const subject = verbMatch[1].trim();
        const predicate = verbMatch[2].toLowerCase().trim();
        const object = verbMatch[3].trim();
        const factId = `fact_${createHash("sha256").update(`${subject}:${predicate}:${object}:${source}`).digest("hex").substring(0, 12)}`;

        const fact: Fact = {
          id: factId,
          subject,
          predicate,
          object,
          confidence: defaultConfidence,
          temporalScope: "persistent",
          source,
          sourceChunkId: options.sourceChunkId,
          validAt: now,
          invalidAt: null,
          supersededBy: null,
          state: "active",
        };

        if (FactSchema.safeParse(fact).success) {
          facts.push(fact);
        }
      }
    }

    return facts;
  }

  /**
   * Valida y normaliza un objeto Fact emitido por un modelo estructurado.
   */
  public parseFactJson(rawJson: unknown, source: string): Fact | null {
    const now = Date.now();
    try {
      if (typeof rawJson !== "object" || rawJson === null) return null;
      const r = rawJson as Record<string, unknown>;

      const factId =
        typeof r["id"] === "string" && r["id"].length > 0
          ? (r["id"] as string)
          : `fact_${createHash("sha256").update(JSON.stringify(rawJson)).digest("hex").substring(0, 12)}`;

      const fact: Fact = {
        id: factId,
        subject: String(r["subject"] || "General"),
        predicate: String(r["predicate"] || "relates_to"),
        object: String(r["object"] || ""),
        confidence: typeof r["confidence"] === "number" ? (r["confidence"] as number) : 0.8,
        temporalScope:
          r["temporalScope"] === "ephemeral" || r["temporalScope"] === "historical"
            ? (r["temporalScope"] as "ephemeral" | "historical")
            : "persistent",
        source,
        sourceChunkId: typeof r["sourceChunkId"] === "string" ? (r["sourceChunkId"] as string) : undefined,
        validAt: typeof r["validAt"] === "number" ? (r["validAt"] as number) : now,
        invalidAt: typeof r["invalidAt"] === "number" ? (r["invalidAt"] as number) : null,
        supersededBy: typeof r["supersededBy"] === "string" ? (r["supersededBy"] as string) : null,
        state:
          r["state"] === "superseded" || r["state"] === "quarantined" || r["state"] === "rejected"
            ? (r["state"] as "superseded" | "quarantined" | "rejected")
            : "active",
      };

      return FactSchema.parse(fact);
    } catch {
      return null;
    }
  }
}
