/**
 * T11 (Ola 1c) — Política de permisos del main process.
 *
 * Extraído del god-file `main.ts`: son funciones **pures** (no dependen de
 * estado de proceso) y su contrato es la política de permisos de Ego
 * (deny-gana, `ask` por defecto, `read-only` → ask, path fuera de alcance →
 * `ask` como mínimo).
 *
 * El módulo vive en `src/main/security/` junto al resto de la política de
 * seguridad del main.
 */
import type {
  PermissionDecision,
  PermissionRule,
  PermissionsPolicy,
  PermissionsSettings,
} from "../../ipc/schema.js";
import type { ToolRiskLevel } from "@ego/tools";

/** Info mínima de herramienta para la decisión combinada permiso+approval. */
export interface PermissionToolInfo {
  name: string;
  riskLevel?: ToolRiskLevel;
  requiresApproval?: boolean;
}

/** Consulta de permiso: tool y/o path del FS involucrados en la acción. */
export interface PermissionQuery {
  tool?: string;
  path?: string;
}

/** `true` si la regla matchea (subcadena contra tool o path). */
export function permissionRuleMatches(rule: PermissionRule, query: PermissionQuery): boolean {
  if (query.tool && query.tool.includes(rule.pattern)) return true;
  if (query.path && query.path.includes(rule.pattern)) return true;
  return false;
}

/**
 * Decisión por reglas con deny-gana: entre las reglas que matchean,
 * `deny` > `ask` > `allow`. Sin match → `"ask"` (fail-closed).
 */
export function resolvePermissionDecision(
  rules: PermissionRule[],
  query: PermissionQuery
): PermissionDecision {
  let sawAsk = false;
  let sawAllow = false;
  for (const rule of rules) {
    if (!permissionRuleMatches(rule, query)) continue;
    if (rule.decision === "deny") return "deny";
    if (rule.decision === "ask") sawAsk = true;
    else sawAllow = true;
  }
  if (sawAsk) return "ask";
  if (sawAllow) return "allow";
  return "ask";
}

/**
 * `true` si `path` está bajo alguno de `scopeDirs` (workspace +
 * `additionalDirectories`). Comparación por prefijo normalizado (`/` final).
 */
export function isPathInScope(path: string, scopeDirs: string[]): boolean {
  const norm = (d: string): string => {
    const n = d.replace(/\\/g, "/");
    return n.endsWith("/") ? n : `${n}/`;
  };
  const target = path.replace(/\\/g, "/");
  return scopeDirs.some(
    (dir) => dir.length > 0 && (target === dir.replace(/\\/g, "/") || target.startsWith(norm(dir)))
  );
}

/**
 * Decisión efectiva combinando reglas + `defaultMode` + alcance:
 * 1. reglas (deny-gana); 2. path fuera de alcance → `"ask"` como mínimo;
 * 3. `defaultMode`: `full-access` → allow, `acceptEdits` → allow salvo
 *    `destructive` (→ ask), `read-only` → ask.
 */
export function resolveEffectivePermission(
  policy: PermissionsPolicy,
  query: PermissionQuery,
  opts: { scopeDirs?: string[]; riskLevel?: PermissionToolInfo["riskLevel"] } = {}
): PermissionDecision {
  const matched = policy.rules.some((rule) => permissionRuleMatches(rule, query));
  if (matched) return resolvePermissionDecision(policy.rules, query);
  if (query.path && opts.scopeDirs && !isPathInScope(query.path, opts.scopeDirs)) {
    return "ask";
  }
  if (policy.defaultMode === "full-access") return "allow";
  if (policy.defaultMode === "read-only") return "ask";
  return opts.riskLevel === "destructive" ? "ask" : "allow";
}

/**
 * Puerta combinada permiso + approvals + cron. Retorna si la acción puede
 * correr y si exige aprobación humana (vía `ApprovalEngine` existente).
 * Orden: deny (regla o `cronMode`) veta sin preguntar; `mode: "off"` no
 * pide aprobación a nivel política (el engine conserva sus innegociables);
 * `"manual"` siempre pide; `"smart"` pide si decisión `ask`, riesgo
 * sensitive/destructive o la tool se autodeclara `requiresApproval`.
 */
export function shouldRequireApproval(
  settings: PermissionsSettings,
  tool: PermissionToolInfo,
  query: PermissionQuery,
  opts: { scopeDirs?: string[]; isCron?: boolean } = {}
): { allowed: boolean; requireApproval: boolean; reason?: string } {
  if (opts.isCron) {
    const cron = settings.approvals.cronMode;
    if (cron === "deny") {
      return { allowed: false, requireApproval: false, reason: "cron_mode deny: ejecución programada vetada" };
    }
    if (cron === "ask") {
      return { allowed: true, requireApproval: true, reason: "cron_mode ask: corrida programada exige aprobación" };
    }
  }
  const effective = resolveEffectivePermission(settings.permissions, query, {
    scopeDirs: opts.scopeDirs,
    riskLevel: tool.riskLevel,
  });
  if (effective === "deny") {
    return { allowed: false, requireApproval: false, reason: "deny gana: regla de permiso veta la acción" };
  }
  const mode = settings.approvals.mode;
  if (mode === "off") return { allowed: true, requireApproval: false };
  if (mode === "manual") {
    return {
      allowed: true,
      requireApproval: true,
      reason: effective === "ask" ? "decisión ask en modo manual" : "modo manual: toda acción exige aprobación",
    };
  }
  const needsByRisk = tool.riskLevel === "sensitive" || tool.riskLevel === "destructive";
  if (effective === "ask" || needsByRisk || tool.requiresApproval === true) {
    return {
      allowed: true,
      requireApproval: true,
      reason:
        effective === "ask"
          ? "decisión ask en modo smart"
          : `riesgo ${tool.riskLevel ?? "declarado"} exige aprobación en modo smart`,
    };
  }
  return { allowed: true, requireApproval: false };
}
