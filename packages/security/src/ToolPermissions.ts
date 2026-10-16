/**
 * ToolPermissions — Matriz de permisos de herramientas y Sandbox (SEC-05 / Fase 11).
 *
 * Une las piezas existentes sin reimplementarlas:
 * - `PathValidator` (`@ego/tools`, CARP-03): confinamiento de paths al
 *   workspace + rutas reservadas + symlinks. Aquí vive la réplica LÉXICA
 *   (sin fs) para el veredicto previo; el enforcement canónico sigue en
 *   el nativo en tiempo de ejecución.
 * - `NetPolicy` (`@ego/tools`, OCLW-09): anti-SSRF con DNS. Aquí vive la
 *   réplica LÉXICA (sin DNS) para el veredicto previo; la resolución DNS
 *   y el pinning TOCTOU pertenecen a SEC-08.
 * - Allowlist MCP (F1T2): este módulo la consume vía
 *   `ToolPermissionsOptions.allowedMcpServers`, no la define.
 * - Aprobación HITL (runtime `ToolRegistry.resolveApprovalRequirement`,
 *   COUC-10): este módulo devuelve el veredicto (`allow | deny |
 *   requireApproval`); el runtime decide el flujo de aprobación.
 *
 * Diseño: cero dependencias (ni `@ego/tools`: evita arista nueva entre
 * paquetes; tipado estructural). Fail-closed: desconocido → deny.
 * Cero eco: `reason` nombra REGLAS, nunca comandos/URLs completos.
 */

export type ToolDecision = "allow" | "deny" | "requireApproval";

export type ToolRiskLevelLike = "safe" | "sensitive" | "destructive";

export type ToolOriginLike = "native" | "mcp" | "custom" | "skill";

export interface ToolDecisionResult {
  decision: ToolDecision;
  /** Regla que disparó (p. ej. `blocked_command`). Nunca un valor sensible. */
  rule: string;
  /** Explicación sin eco de comandos, URLs con credenciales ni paths sensibles. */
  reason: string;
}

export interface ToolCallRequest {
  toolName: string;
  category: string;
  riskLevel?: ToolRiskLevelLike | string;
  origin?: ToolOriginLike | string;
  mcpServerId?: string;
  /** Arg de path (fs/git/cwd) cuando aplica. */
  path?: string;
  /** Comando (terminal) cuando aplica. */
  command?: string;
  /** URL destino (web) cuando aplica. */
  url?: string;
  workspacePath?: string;
  /** `true` si la invocación viene de un scheduler/cron (STAB-02). */
  isCron?: boolean;
}

/** Veredicto fail-closed para casos desconocidos/sin perímetro (Gate P: deny). */
export type ToolDefaultMode = "deny" | "allow";

/** Política de approvals portada en las opciones (STAB-02). */
export interface ToolApprovalsOptions {
  /** `mode`/`timeoutMs` se portan para composición (los consume el ApprovalEngine vía main); no alteran veredictos aquí. */
  mode?: "manual" | "smart" | "off";
  timeoutMs?: number;
  /** Solo `cronMode` altera veredictos en `evaluateToolCall` (con `isCron`). */
  cronMode?: "allow" | "ask" | "deny";
}

export interface ToolPermissionsOptions {
  workspacePath?: string;
  /** Allowlist de servidores MCP (F1T2). Sin ella, MCP → requireApproval. */
  allowedMcpServers?: readonly string[];
  extraBlockedCommands?: readonly RegExp[];
  extraReservedDirs?: readonly string[];
  /**
   * Default fail-closed para herramienta/categoría desconocida o sin
   * workspace (STAB-02, Gate P vinculante: deny). Los innegociables
   * (`blocked_command`, `reserved_path`, `path_outside_workspace`,
   * `unsafe_url`, `mcp_not_allowlisted`) deniegan SIEMPRE, aun con "allow".
   */
  defaultMode?: ToolDefaultMode;
  /**
   * Raíces extra bajo las que un path absoluto sigue confinado
   * (espeja `additionalDirectories` de CFG-06 en main).
   */
  additionalDirectories?: readonly string[];
  /** Política de approvals; ver `ToolApprovalsOptions`. */
  approvals?: ToolApprovalsOptions;
}

/** Categorías conocidas = `ToolCategory` de `@ego/tools` (matriz cerrada). */
const KNOWN_CATEGORIES = new Set(["filesystem", "git", "terminal", "web", "system", "mcp"]);

/**
 * Rutas reservadas críticas (réplica léxica de `PathValidator`
 * `RESERVED_SYSTEM_DIRS`; el enforcement con fs/symlink sigue allí).
 */
const RESERVED_SYSTEM_DIRS = [
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "/etc",
  "/bin",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
  "/sys",
  "/proc",
];

/** Segmentos que elevan cualquier acceso a `requireApproval` (COUC-10). */
const SENSITIVE_SEGMENTS = [
  ".ego/",
  ".ego\\",
  "gov/",
  "gov\\",
  "quarantine/",
  "quarantine\\",
  ".key",
  ".pem",
  "credentials",
  "secrets",
];

/**
 * Patrones de comandos bloqueados. Superconjunto de
 * `FORBIDDEN_COMMAND_PATTERNS` de `NativeTerminalTool` (los 6 primeros)
 * + endurecimiento SEC-05: shells ofuscados, download cradles,
 * persistencia y apagado.
 */
const BLOCKED_COMMAND_PATTERNS: readonly RegExp[] = [
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+\/s\s+\/q\s+[a-zA-Z]:[\/\\]/i,
  /format\s+[a-zA-Z]:/i,
  /:(){ :|:& };:/,
  /mkfs/i,
  /dd\s+if=.*of=\/dev\/(sd|nvme|hd)/i,
  /-EncodedCommand/i,
  /\bIEX\s*\(/i,
  /Invoke-Expression/i,
  /Invoke-Mimikatz/i,
  /\bschtasks\b/i,
  /\bnet\s+user\b/i,
  /\breg\s+add\b/i,
  /\bsc\s+(create|config|start)\b/i,
  /shutdown(\.exe)?\s+\//i,
  /chmod\s+-R\s+777\s+\//,
];

/** Hosts siempre bloqueados (réplica léxica de `NetPolicy`). */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
  "100.100.100.200",
  "fd00:ec2::254",
]);

/** Servidores MCP conocidos de Ego (defecto; el deploy los restringe). */
export const DEFAULT_ALLOWED_MCP_SERVERS: readonly string[] = ["github", "filesystem"] as const;

function deny(rule: string, reason: string): ToolDecisionResult {
  return { decision: "deny", rule, reason };
}

function approval(rule: string, reason: string): ToolDecisionResult {
  return { decision: "requireApproval", rule, reason };
}

/** Normaliza un path para comparación léxica (sin tocar fs). */
function normalizeLexical(raw: string): string {
  let out = raw.replace(/\\/g, "/");
  try {
    // Decodifica %2e / %2f para cerrar el bypass de traversal codificado.
    // Bucle acotado (doble-codificado); si falla, se usa el crudo.
    for (let i = 0; i < 2; i++) {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    }
  } catch {
    // decode malformado → se conserva el crudo (fail-closed abajo si hay rareza)
  }
  return out;
}

function checkPath(
  requestedPath: string,
  workspace: string,
  extraReserved: readonly string[],
  extraScopeDirs: readonly string[] = []
): ToolDecisionResult | null {
  if (requestedPath.includes("\0")) {
    return deny("null_byte_path", "Path con byte nulo rechazado.");
  }
  const normTarget = normalizeLexical(requestedPath);
  const normWs = normalizeLexical(workspace);
  const lowerTarget = normTarget.toLowerCase();

  const reserved = [...RESERVED_SYSTEM_DIRS.map((d) => normalizeLexical(d).toLowerCase()),
    ...extraReserved.map((d) => normalizeLexical(d).toLowerCase())];
  for (const dir of reserved) {
    const prefix = dir.endsWith("/") ? dir : `${dir}/`;
    if (lowerTarget === dir || lowerTarget.startsWith(prefix)) {
      return deny("reserved_path", "Path en directorio reservado del sistema.");
    }
  }

  // Absoluto (posix, drive Windows o UNC) o con drive → debe estar contenido
  // en el workspace O en alguno de los additionalDirectories (STAB-02).
  const isAbs =
    normTarget.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normTarget) ||
    normTarget.startsWith("//");
  const inScope = (root: string): boolean => {
    const normRoot = normalizeLexical(root);
    if (normRoot.trim().length === 0) return false;
    const base = normRoot.endsWith("/") ? normRoot : `${normRoot}/`;
    const t = normTarget.toLowerCase();
    const b = base.toLowerCase();
    return t === normRoot.toLowerCase() || t.startsWith(b);
  };
  if (isAbs) {
    if (inScope(normWs) || extraScopeDirs.some(inScope)) return null;
    return deny("path_outside_workspace", "Path absoluto fuera del workspace permitido.");
  } else {
    // Relativo: resolver segmentos . y .. léxicamente contra la base.
    const parts = normTarget.split("/");
    let depth = 0;
    for (const seg of parts) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") depth -= 1;
      else depth += 1;
      if (depth < 0) {
        return deny("path_outside_workspace", "Traversal fuera del workspace permitido (CARP-03).");
      }
    }
  }
  return null;
}

function isSensitivePath(requestedPath: string): boolean {
  const norm = normalizeLexical(requestedPath).toLowerCase();
  return SENSITIVE_SEGMENTS.some((s) => norm.includes(s.toLowerCase()));
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  if (a === 127 || a === 0 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function checkUrl(rawUrl: string): ToolDecisionResult | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return deny("unsafe_url", "URL malformada.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return deny("unsafe_url", "Solo se permiten esquemas http/https (COUC-13).");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return deny("unsafe_url", "Host interno o protegido bloqueado (anti-SSRF).");
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) && isBlockedIpv4(host)) {
    return deny("unsafe_url", "IP privada o especial bloqueada (anti-SSRF).");
  }
  const lower = host.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe8") || lower.startsWith("fe9") ||
    lower.startsWith("fea") || lower.startsWith("feb") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return deny("unsafe_url", "IPv6 privada o especial bloqueada (anti-SSRF).");
  }
  return null;
}

/**
 * Veredicto previo de permiso para una invocación de herramienta.
 * Orden fail-closed: herramienta → comando → path → red → MCP → cron →
 * matriz. No ejecuta nada ni toca fs/red: el enforcement vive en los nativos.
 * `defaultMode` (deny por defecto, Gate P) solo rige los casos desconocidos o
 * sin perímetro; los innegociables deniegan siempre (deny gana).
 */
export function evaluateToolCall(
  request: ToolCallRequest,
  options: ToolPermissionsOptions = {}
): ToolDecisionResult {
  const defaultMode: ToolDefaultMode = options.defaultMode ?? "deny";
  // Fail-closed configurable: unknowns → defaultMode; innegociables → deny.
  const failClosed = (rule: string, denyReason: string): ToolDecisionResult =>
    defaultMode === "allow"
      ? { decision: "allow", rule, reason: "Sin regla aplicable: permitido por defaultMode allow explícito." }
      : deny(rule, denyReason);
  if (!request.toolName || request.toolName.trim().length === 0) {
    return failClosed("unknown_tool", "Herramienta vacía o desconocida: denegada por defecto.");
  }
  if (!KNOWN_CATEGORIES.has(request.category)) {
    return failClosed("unknown_category", "Categoría de herramienta desconocida: denegada por defecto.");
  }

  // 1. Comandos prohibidos (deniegan incluso antes de la aprobación).
  if (typeof request.command === "string" && request.command.length > 0) {
    const patterns = [...BLOCKED_COMMAND_PATTERNS, ...(options.extraBlockedCommands ?? [])];
    for (const pattern of patterns) {
      if (pattern.test(request.command)) {
        return deny("blocked_command", `Comando bloqueado por guardrail de seguridad (${pattern}).`);
      }
    }
  }

  // 2. Confinamiento de paths (CARP-03 + additionalDirectories STAB-02).
  const workspace = request.workspacePath ?? options.workspacePath;
  if (typeof request.path === "string" && request.path.length > 0) {
    if (!workspace || workspace.trim().length === 0) {
      return deny("missing_workspace", "Sin workspace configurado: paths denegados por defecto.");
    }
    const verdict = checkPath(
      request.path,
      workspace,
      options.extraReservedDirs ?? [],
      options.additionalDirectories ?? []
    );
    if (verdict) return verdict;
  } else if (request.category === "filesystem" || request.category === "git") {
    // Estas categorías operan sobre paths: sin workspace no hay perímetro.
    if (!workspace || workspace.trim().length === 0) {
      return deny("missing_workspace", "Sin workspace configurado: denegado por defecto.");
    }
  }

  // 3. Red (réplica léxica de NetPolicy; sin DNS aquí).
  if (typeof request.url === "string" && request.url.length > 0) {
    const verdict = checkUrl(request.url);
    if (verdict) return verdict;
  }

  // 4. Allowlist MCP (F1T2): fuera de lista → deny; sin lista → approval.
  if (request.origin === "mcp" || request.category === "mcp") {
    const allowlist = options.allowedMcpServers;
    if (allowlist) {
      if (!request.mcpServerId || !allowlist.includes(request.mcpServerId)) {
        return deny("mcp_not_allowlisted", "Servidor MCP fuera de la allowlist (F1T2).");
      }
    } else {
      return approval("mcp_unlisted_default_approval", "MCP sin allowlist configurada: requiere aprobación.");
    }
  }

  // 4b. Cron programado (STAB-02): deny veta sin preguntar (deny gana);
  // ask exige HITL. Solo aplica con `isCron`; sin flag no hay efecto.
  // `mode`/`timeoutMs` NO alteran veredictos: los consume el ApprovalEngine.
  if (request.isCron === true) {
    const cronMode = options.approvals?.cronMode ?? "deny";
    if (cronMode === "deny") {
      return deny("cron_denied", "Ejecución programada vetada por política (cron_mode deny).");
    }
    if (cronMode === "ask") {
      return approval("cron_requires_approval", "Ejecución programada: requiere aprobación (cron_mode ask).");
    }
  }

  // 5. Rutas sensibles (COUC-10): incluso lecturas pasan por HITL.
  if (typeof request.path === "string" && request.path.length > 0 && isSensitivePath(request.path)) {
    return approval("sensitive_path", "Path sensible de configuración/gobernanza: requiere aprobación (COUC-10).");
  }

  // 6. Matriz categoría/riesgo (gobernanza §6: lo sensible exige aprobación).
  if (request.category === "terminal") {
    return approval("terminal_requires_approval", "Ejecución de terminal: requiere aprobación.");
  }
  if (
    request.riskLevel !== undefined &&
    request.riskLevel !== "safe" &&
    request.riskLevel !== "sensitive" &&
    request.riskLevel !== "destructive"
  ) {
    return approval("unknown_risk", "Nivel de riesgo desconocido: requiere aprobación por defecto.");
  }
  if (request.riskLevel === "destructive" || request.riskLevel === "sensitive") {
    return approval("risk_requires_approval", "Riesgo sensitive/destructive: requiere aprobación.");
  }

  return { decision: "allow", rule: "default_allow", reason: "Lectura o inspección confinada: permitida." };
}

/** Clasifica un veredicto como denegación. */
export function isDenied(result: ToolDecisionResult): boolean {
  return result.decision === "deny";
}

/** Clasifica un veredicto como pendiente de aprobación HITL. */
export function needsApproval(result: ToolDecisionResult): boolean {
  return result.decision === "requireApproval";
}
