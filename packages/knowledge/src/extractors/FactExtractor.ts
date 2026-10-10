import { createHash } from "node:crypto";
import { Fact, FactSchema } from "../schemas/knowledge.js";

/**
 * Extractor heurístico y estructurado de hechos atómicos (KHOJ-04).
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
      if (kvMatch) {
        const subject = kvMatch[1].trim();
        const object = kvMatch[2].trim();
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

      // Patrón verbal común: "X usa Y", "X requiere Y", "X implementa Y"
      const verbMatch = line.match(/^([A-Za-z0-9_.\s]+)\s+(usa|utiliza|requiere|implementa|extiende|contiene)\s+(.+)$/i);
      if (verbMatch) {
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
