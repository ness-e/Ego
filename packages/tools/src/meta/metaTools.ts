import { z } from "zod";
import { ToolRegistry } from "../ToolRegistry.js";
import { findMissingTools } from "../ToolContract.js";
import type { ToolDefinition, ToolJsonSchema } from "../types.js";
import { rankSkills, type SkillCatalogEntry, type SkillCatalogLike } from "./skillCatalog.js";

/**
 * E13 (Ola 4b / A3 / T2) — Metatools de divulgación progresiva.
 *
 * ## El problema que resuelven
 *
 * El catálogo de tools era **fijo por rol/perfil** y el de skills no existía
 * como catálogo consultable. El modelo no podía pedir "más herramientas" ni
 * "¿hay una skill para esto?": o recibía todo (contexto inflado) o nada.
 *
 * Los tres metatools forman una escalera de divulgación progresiva:
 *
 * | Metatool | Pregunta que responde | Devuelve |
 * |---|---|---|
 * | `lookup_skills` | "¿hay una skill para esto?" | índice relevante (id, nombre, descripción) |
 * | `search_tools` | "¿qué tools hay para esto?" | resúmenes (nombre, descripción, riesgo) |
 * | `expand_tools` | "¿cómo se llama exactamente esta tool?" | schema JSON completo |
 *
 * El modelo baja por la escalera **sólo cuando lo necesita**.
 *
 * ## Gobernanza
 *
 * Los metatools operan sobre el registro en el que están **registrados**. Si
 * se registran en el clon confinado de un Sub-Ego, ese Sub-Ego no puede
 * expandir tools fuera de su confinement (el contrato `ToolContract` lo
 * garantiza: `findMissingTools`).
 */

/** Nombres canónicos de los metatools (E13). */
export const META_TOOL_NAMES: readonly string[] = Object.freeze([
  "lookup_skills",
  "search_tools",
  "expand_tools"
]);

/** Error tipado de los metatools. */
export class MetaToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaToolError";
  }
}

/** Opciones de construcción de los metatools. */
export interface MetaToolsOptions {
  /**
   * Catálogo de skills consultable. Sin él, `lookup_skills` falla con
   * `MetaToolError` (fail-closed: no se inventa un catálogo vacío).
   */
  skills?: SkillCatalogLike;
  /** Límite por defecto de resultados (default: 5). */
  defaultLimit?: number;
  /** Tope duro del límite (default: 50). */
  maxLimit?: number;
}

/** Resumen de una tool (sin schema): la primera escala de divulgación. */
export interface ToolSummary {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly riskLevel: string;
  readonly requiresApproval: boolean;
  readonly origin: string;
  readonly tags: readonly string[];
}

/** Coincidencia de skill devuelta por `lookup_skills`. */
export interface SkillMatch {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly path?: string;
  readonly score: number;
  /** Cuerpo de la skill: sólo si se pidió (`includeBody`). */
  readonly body?: string;
}

/** Límite por defecto de resultados de un metatool. */
const DEFAULT_LIMIT = 5;
/** Tope duro del límite. */
const DEFAULT_MAX_LIMIT = 50;

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
}

/**
 * Tokeniza y puntúa un conjunto de tools con el mismo motor que las skills
 * (mismo criterio de relevancia, misma determinación).
 */
function scoreTool(tool: ToolDefinition, query: string): number {
  const q = (query ?? "").trim().toLowerCase();
  if (q.length === 0) return 1;

  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  const tags = (tool.tags ?? []).map((t) => t.toLowerCase());

  let score = 0;
  if (name === q) score += 100;
  if (name.includes(q)) score += 30;
  for (const token of q.split(/[^a-z0-9áéíóúüñ]+/i).filter((t) => t.length > 1)) {
    if (name.includes(token)) score += 10;
    if (tags.some((t) => t.includes(token))) score += 6;
    if (description.includes(token)) score += 4;
  }
  return score;
}

/**
 * Crea el metatool `lookup_skills`: busca skills en el catálogo inyectado.
 */
export function createLookupSkillsTool(options: MetaToolsOptions = {}): ToolDefinition {
  const maxLimit = options.maxLimit ?? DEFAULT_MAX_LIMIT;
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;

  return {
    name: "lookup_skills",
    description:
      "Busca en el catálogo de skills las que son relevantes para una consulta y devuelve sólo las " +
      "coincidencias (id, nombre, descripción y por qué encajan). El catálogo completo NO se vuelca en " +
      "el prompt: se pide lo que se necesita. Usa includeBody: true sólo si vas a seguir las " +
      "instrucciones de la skill.",
    category: "system",
    riskLevel: "safe",
    origin: "custom",
    tags: ["meta", "skills", "discovery"],
    inputSchema: z.object({
      query: z.string().min(1, "La consulta no puede estar vacía.").max(500),
      limit: z
        .number()
        .int()
        .positive()
        .max(maxLimit)
        .optional()
        .describe("Máximo de skills devueltas (por defecto 5)."),
      includeBody: z
        .boolean()
        .optional()
        .describe("Si es true, incluye el cuerpo completo de la skill (divulgación en dos pasos).")
    }),
    execute: async (input): Promise<{
      query: string;
      matches: SkillMatch[];
      /** Tamaño del catálogo consultado (candidatos considerados). */
      total: number;
      /** Cuántas skills son realmente relevantes para la consulta. */
      matched: number;
      truncated: boolean;
    }> => {
      const catalog = options.skills;
      if (!catalog) {
        throw new MetaToolError(
          "lookup_skills no tiene catálogo de skills configurado. Inyecta uno con " +
            "`registerMetaTools(registry, { skills })` (fail-closed: no se devuelve un catálogo vacío)."
        );
      }

      const entries: readonly SkillCatalogEntry[] = await catalog.list();
      const ranked = rankSkills(entries, input.query);
      const limit = clampLimit(input.limit, defaultLimit, maxLimit);
      const selected = ranked.slice(0, limit);

      const matches: SkillMatch[] = selected.map(({ skill, score }) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        tags: [...(skill.tags ?? [])],
        ...(skill.path ? { path: skill.path } : {}),
        score,
        ...(input.includeBody && skill.body !== undefined ? { body: skill.body } : {})
      }));

      return {
        query: input.query,
        matches,
        total: entries.length,
        matched: ranked.length,
        truncated: ranked.length > matches.length
      };
    }
  };
}

/**
 * Crea el metatool `search_tools`: busca tools en el registro y devuelve
 * RESÚMENES (no el schema: para eso está `expand_tools`).
 */
export function createSearchToolsTool(
  registry: ToolRegistry,
  options: MetaToolsOptions = {}
): ToolDefinition {
  const maxLimit = options.maxLimit ?? DEFAULT_MAX_LIMIT;
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;

  return {
    name: "search_tools",
    description:
      "Busca herramientas disponibles por texto, categoría o nivel de riesgo y devuelve un resumen de " +
      "cada una. NO devuelve el schema de entrada: usa expand_tools cuando vayas a invocar la tool.",
    category: "system",
    riskLevel: "safe",
    origin: "custom",
    tags: ["meta", "tools", "discovery"],
    inputSchema: z.object({
      query: z.string().max(500).optional().describe("Texto libre de búsqueda (opcional)."),
      category: z
        .enum(["filesystem", "git", "terminal", "web", "system", "mcp"])
        .optional()
        .describe("Filtra por categoría funcional."),
      riskLevel: z
        .enum(["safe", "sensitive", "destructive"])
        .optional()
        .describe("Filtra por nivel de riesgo operacional."),
      limit: z.number().int().positive().max(maxLimit).optional()
    }),
    execute: async (input): Promise<{
      query: string;
      matches: ToolSummary[];
      total: number;
      truncated: boolean;
    }> => {
      const all = registry.list();
      const filtered = all.filter((tool) => {
        if (input.category && tool.category !== input.category) return false;
        if (input.riskLevel && tool.riskLevel !== input.riskLevel) return false;
        return true;
      });

      const query = (input.query ?? "").trim();
      const scored = filtered
        .map((tool) => ({ tool, score: scoreTool(tool, query) }))
        .filter((entry) => (query.length === 0 ? true : entry.score > 0))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.tool.name.localeCompare(b.tool.name);
        });

      const limit = clampLimit(input.limit, defaultLimit, maxLimit);
      const selected = scored.slice(0, limit);

      return {
        query,
        matches: selected.map(({ tool }) => ({
          name: tool.name,
          description: tool.description,
          category: tool.category,
          riskLevel: tool.riskLevel,
          requiresApproval: registry.resolveApprovalRequirement(tool),
          origin: tool.origin,
          tags: [...(tool.tags ?? [])]
        })),
        total: scored.length,
        truncated: scored.length > selected.length
      };
    }
  };
}

/**
 * Crea el metatool `expand_tools`: expone el schema JSON completo de un
 * subconjunto de tools del registro.
 *
 * Fail-closed: si se piden tools que no existen en el registro, la operación
 * se rechaza (no se devuelve un subconjunto "parecido" al pedido). El
 * contrato de existencia es el de `ToolContract` (`findMissingTools`).
 */
export function createExpandToolsTool(
  registry: ToolRegistry,
  options: MetaToolsOptions = {}
): ToolDefinition {
  const maxLimit = options.maxLimit ?? DEFAULT_MAX_LIMIT;
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;

  return {
    name: "expand_tools",
    description:
      "Expone el schema de entrada completo de un subconjunto de herramientas, para poder invocarlas " +
      "correctamente. Usa search_tools primero si no sabes los nombres exactos. Sólo expone tools " +
      "disponibles en tu ámbito actual.",
    category: "system",
    riskLevel: "safe",
    origin: "custom",
    tags: ["meta", "tools", "discovery"],
    inputSchema: z.object({
      tools: z
        .array(z.string().min(1))
        .max(maxLimit)
        .optional()
        .describe("Nombres exactos de las tools a exponer."),
      query: z
        .string()
        .max(500)
        .optional()
        .describe("Alternativa a `tools`: expone las tools que casen con el texto."),
      limit: z.number().int().positive().max(maxLimit).optional()
    }),
    execute: async (input): Promise<{
      tools: ToolJsonSchema[];
      expanded: string[];
      total: number;
      truncated: boolean;
    }> => {
      const requested = input.tools ?? [];
      if (requested.length === 0 && !input.query) {
        throw new MetaToolError(
          "expand_tools necesita `tools` (nombres exactos) o `query` (texto de búsqueda)."
        );
      }

      let names: string[];
      if (requested.length > 0) {
        // Contrato de existencia: fail-closed ante tools desconocidas.
        const missing = findMissingTools(requested, registry);
        if (missing.length > 0) {
          throw new MetaToolError(
            `expand_tools: no se pueden expandir las tools '${missing.join(", ")}': no existen en el ` +
              `registro disponible para este ámbito. Declara sólo tools existentes.`
          );
        }
        names = requested;
      } else {
        const query = (input.query ?? "").trim();
        const limit = clampLimit(input.limit, defaultLimit, maxLimit);
        names = registry
          .list()
          .map((tool) => ({ tool, score: scoreTool(tool, query) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.tool.name.localeCompare(b.tool.name);
          })
          .slice(0, limit)
          .map((entry) => entry.tool.name);
      }

      const exported = registry.exportJsonSchemas();
      const byName = new Map(exported.map((schema) => [schema.name, schema]));
      const tools = names
        .map((name) => byName.get(name))
        .filter((schema): schema is ToolJsonSchema => schema !== undefined);

      return {
        tools,
        expanded: tools.map((t) => t.name),
        total: tools.length,
        truncated: false
      };
    }
  };
}

/**
 * Registra los metatools de divulgación progresiva en un `ToolRegistry`.
 *
 * Idempotente: si una metatool ya está registrada, no se vuelve a añadir
 * (ni lanza). Se recomienda registrar en el clon confinado de cada
 * Sub-Ego: así, `expand_tools` sólo expone lo que ese Sub-Ego puede usar.
 */
export function registerMetaTools(
  registry: ToolRegistry,
  options: MetaToolsOptions = {}
): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    createLookupSkillsTool(options),
    createSearchToolsTool(registry, options),
    createExpandToolsTool(registry, options)
  ];

  const registered: ToolDefinition[] = [];
  for (const tool of tools) {
    if (registry.has(tool.name)) continue;
    registry.register(tool);
    registered.push(tool);
  }
  return registered;
}
