import { ToolRegistry } from "./ToolRegistry.js";
import { ToolDefinition } from "./types.js";

/**
 * Toolsets por perfil + approval por-tool MCP (CFG-07).
 *
 * Paridad de tipos con `apps/desktop/src/ipc/schema.ts` (sección MCP:
 * `McpToolsetNameSchema`, `McpToolApprovalRuleSchema`,
 * `ProfileToolsetsSchema`, `McpToolsResetDocSchema`). Duplicado
 * intencional en ambos lados: el schema lo importa el preload (sin
 * imports de workspace) y este módulo es runtime puro (stdlib + registry).
 *
 * Semántica:
 * 1. Approval por-tool: match EXACTO `serverId` + `tool`; deny gana;
 *    sin regla → rige la base del registry (`riskLevel`/`requiresApproval`).
 *    Solo aplica a tools MCP (`query.serverId` presente); las nativas no
 *    las gobiernan estas reglas.
 * 2. Toolsets: `disabled` veta siempre (deny gana); `enabled: []` = sin
 *    restricción allowlist (back-compat); `enabled` no vacío = allowlist.
 * 3. Reset: tras cambiar tools se emite `buildToolsResetDoc`, que obliga
 *    a preservar prompt caching (prefijo estable, solo se re-emite e
 *    invalida el sufijo de tools).
 */

/** Toolsets canónicos por perfil (paridad con `McpToolsetNameSchema`). */
export const MCP_TOOLSET_NAMES = [
  "web",
  "search",
  "browser",
  "terminal",
  "file",
  "memory",
  "delegation",
  "cronjob",
] as const;

export type McpToolsetName = (typeof MCP_TOOLSET_NAMES)[number];

/** Decisión por-tool (paridad con `McpToolDecisionSchema`). */
export type McpToolDecision = "allow" | "ask" | "deny";

/** Regla por-tool (paridad con `McpToolApprovalRuleSchema`). */
export interface McpToolApprovalRule {
  readonly serverId: string;
  readonly tool: string;
  readonly decision: McpToolDecision;
}

/** Consulta de approval: `serverId` ausente = tool no-MCP (sin override). */
export interface McpToolQuery {
  readonly serverId?: string;
  readonly tool: string;
}

/** Config enable/disable por perfil (paridad con `ProfileToolsetsSchema`, sin el `profile`). */
export interface ProfileToolsetsConfig {
  readonly enabled: readonly McpToolsetName[];
  readonly disabled: readonly McpToolsetName[];
}

interface ToolsetMatcher {
  readonly categories?: ReadonlyArray<ToolDefinition["category"]>;
  readonly tags?: readonly string[];
  readonly namePrefixes?: readonly string[];
  readonly mcpServerIdContains?: readonly string[];
}

/**
 * Pertenencia tool → toolsets por campos declarativos de `ToolDefinition`.
 * Heurística documentada y auditable: ante solape, la tool pertenece a
 * todos los toolsets que matchean (el veto `disabled` es amplio por
 * diseño = fail-closed).
 */
export const TOOLSET_MATCHERS: Record<McpToolsetName, ToolsetMatcher> = {
  web: { categories: ["web"], tags: ["web", "http", "fetch"] },
  search: { tags: ["search"], namePrefixes: ["search_"] },
  browser: {
    tags: ["browser"],
    namePrefixes: ["browser_", "playwright_"],
    mcpServerIdContains: ["playwright"],
  },
  terminal: { categories: ["terminal"], tags: ["cli", "exec"] },
  file: { categories: ["filesystem"], tags: ["fs"] },
  memory: { tags: ["memory"], namePrefixes: ["memory_"] },
  delegation: { tags: ["delegation", "subego"], namePrefixes: ["delegate_", "subego_"] },
  cronjob: { tags: ["cron", "schedule"], namePrefixes: ["cron_", "tasks_"] },
};

/** Toolsets a los que pertenece una tool (puede ser ninguno o varios). */
export function toolToolsets(tool: ToolDefinition): McpToolsetName[] {
  const out: McpToolsetName[] = [];
  for (const name of MCP_TOOLSET_NAMES) {
    const m = TOOLSET_MATCHERS[name];
    if (m.categories?.includes(tool.category)) {
      out.push(name);
      continue;
    }
    if (m.tags?.some((t) => tool.tags?.includes(t))) {
      out.push(name);
      continue;
    }
    if (m.namePrefixes?.some((p) => tool.name.startsWith(p))) {
      out.push(name);
      continue;
    }
    if (
      tool.mcpServerId &&
      m.mcpServerIdContains?.some((s) => tool.mcpServerId?.includes(s))
    ) {
      out.push(name);
    }
  }
  return out;
}

/**
 * Decisión por-tool MCP: match EXACTO `serverId` + `tool`, deny gana.
 * Retorna `undefined` si ninguna regla aplica (rige la base del registry).
 * Sin `query.serverId` no hay match (reglas de ámbito MCP, no nativo).
 */
export function resolveMcpToolDecision(
  rules: readonly McpToolApprovalRule[],
  query: McpToolQuery
): McpToolDecision | undefined {
  if (query.serverId === undefined) return undefined;
  let sawAsk = false;
  let sawAllow = false;
  for (const rule of rules) {
    if (rule.serverId !== query.serverId || rule.tool !== query.tool) continue;
    if (rule.decision === "deny") return "deny";
    if (rule.decision === "ask") sawAsk = true;
    else sawAllow = true;
  }
  if (sawAsk) return "ask";
  if (sawAllow) return "allow";
  return undefined;
}

/**
 * Combina la base del registry con el override MCP: `deny`/`ask` exigen
 * aprobación (tool bloqueada pide aprobación), `allow` = approve
 * explícito (exime), sin override rige la base.
 */
export function resolveApprovalWithMcpOverride(
  baseRequiresApproval: boolean,
  decision: McpToolDecision | undefined
): boolean {
  if (decision === "deny" || decision === "ask") return true;
  if (decision === "allow") return false;
  return baseRequiresApproval;
}

/**
 * Gate toolsets por perfil: `disabled` veta siempre (deny gana);
 * `enabled: []` = sin allowlist; si no, la tool debe pertenecer a ≥1
 * toolset habilitado.
 */
export function isToolEnabledByToolsets(
  tool: ToolDefinition,
  config: ProfileToolsetsConfig
): boolean {
  const sets = toolToolsets(tool);
  if (sets.some((s) => config.disabled.includes(s))) return false;
  if (config.enabled.length === 0) return true;
  return sets.some((s) => config.enabled.includes(s));
}

/** Filtra tools por config de perfil (no muta el array de entrada). */
export function filterToolsByToolsets(
  tools: readonly ToolDefinition[],
  config: ProfileToolsetsConfig
): ToolDefinition[] {
  return tools.filter((t) => isToolEnabledByToolsets(t, config));
}

/**
 * Clon confinado del registry para un perfil (Sub-Egos): instancia
 * independiente; mutarlo no afecta al registro global original.
 */
export function cloneRegistryForProfile(
  registry: ToolRegistry,
  config: ProfileToolsetsConfig
): ToolRegistry {
  return new ToolRegistry(filterToolsByToolsets(registry.list(), config));
}

export interface ToolsResetDocInput {
  readonly version: number;
  readonly changedToolsets?: readonly McpToolsetName[];
  readonly note?: string;
}

/**
 * Doc de reset tras cambio de tools (CFG-07): instruye re-emitir el
 * bloque de tools versionado preservando prompt caching (prefijo
 * estable con breakpoint de caché; solo el sufijo de tools se invalida
 * y re-emite). Falla ante `version` no entera positiva (fail-closed).
 */
export function buildToolsResetDoc(input: ToolsResetDocInput): string {
  if (!Number.isInteger(input.version) || input.version <= 0) {
    throw new Error("[toolsets] `version` debe ser un entero positivo.");
  }
  const changed = input.changedToolsets ?? [];
  const changedLine =
    changed.length > 0 ? changed.join(", ") : "(sin toolsets afectados)";
  const lines = [
    `# Tools reset v${input.version} (CFG-07)`,
    "",
    `Toolsets cambiados: ${changedLine}.`,
    "Acción: re-emitir el bloque de tools con esta versión y resetear el",
    "estado derivado (filtros por perfil, overrides de approval por-tool).",
    "Prompt caching: PRESERVAR el breakpoint de caché — el prefijo del",
    "system prompt queda intacto; solo el sufijo de tools se invalida y",
    "re-emite. No reordenar tools estables (conserva cache hits).",
  ];
  if (input.note) lines.push(`Nota: ${input.note}`);
  return lines.join("\n");
}
