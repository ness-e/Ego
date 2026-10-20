import path from "node:path";

/**
 * TerminalCommandPolicy — política canónica de ejecución de comandos de terminal.
 *
 * EGO-FIND-32 (Ola 1 / A3 / T3).
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * `NativeTerminalTool` (la ruta del AGENTE) aplicaba **solo** una denylist de
 * 6 regex sobre el texto del comando. La allowlist `TERMINAL_SAFE_COMMANDS`
 * vivía únicamente en `apps/desktop/src/main/terminal-policy.ts` y gobernaba
 * **solo** el panel interactivo (`ipc.terminal.spawn`).
 *
 * Con denylist el bypass es trivial:
 *   - `rm -fr /`      (el regex exigía literalmente `-rf`)
 *   - `Remove-Item -Recurse -Force C:\`  (cmdlet nativo de PowerShell)
 *   - `cmd /c del /s /q C:\temp`         (escape por intérprete)
 *   - `powershell -enc <base64>`         (comando codificado)
 *
 * DECISIÓN
 * --------
 * Este módulo es la **única fuente canónica** de la allowlist de terminal
 * (deny-by-default) y se aplica tanto a la ruta del agente como a la del
 * panel interactivo. `apps/desktop/src/main/terminal-policy.ts` debe reexportar
 * desde aquí (handoff A3 → A4).
 *
 * La evaluación NO es por substring: se tokeniza el comando, se segmenta por
 * metacaracteres de shell y se evalúa **cada** segmento por separado, de modo
 * que `ls; rm -rf /` se rechaza aunque el primer segmento sea inocuo.
 */

/**
 * Cabezas de comando permitidas (deny-by-default: todo lo demás se rechaza).
 *
 * Refleja el conjunto que ya usaba el panel interactivo de Ego. `git` exige
 * además un subcomando de solo lectura (`GIT_SAFE_SUBCOMMANDS`).
 */
export const TERMINAL_SAFE_COMMANDS: ReadonlySet<string> = new Set([
  "ls",
  "dir",
  "pwd",
  "echo",
  "cat",
  "type",
  "git",
  "pnpm",
  "node",
  "npm",
]);

/** Subcomandos de `git` permitidos (solo lectura / inspección). */
export const GIT_SAFE_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "status",
  "diff",
  "log",
  "branch",
  "show",
  "rev-parse",
]);

/**
 * Subcomandos permitidos por cabeza. Una cabeza con entrada en este mapa exige
 * que su subcomando esté en el conjunto; cualquier otro se rechaza.
 */
export const TERMINAL_SAFE_SUBCOMMANDS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["pnpm", new Set(["test", "build", "lint", "typecheck", "install", "list", "ls", "outdated", "why", "run"])],
  ["npm", new Set(["test", "build", "lint", "typecheck", "install", "list", "ls", "outdated", "view", "ci", "run"])],
  ["node", new Set(["--version", "-v", "--help", "-h"])],
]);

/**
 * Banderas de `git` que abren un escape de ejecución arbitraria o permiten
 * escribir fuera del repo. Se rechazan para cualquier subcomando.
 */
export const GIT_FORBIDDEN_FLAGS: ReadonlySet<string> = new Set([
  "-c",
  "--config",
  "--config-env",
  "--exec-path",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
  "--output",
  "--ext-diff",
  "--textconv",
]);

/**
 * Banderas de `git branch` que mutan el repositorio (borrar/renombrar rama).
 */
export const GIT_BRANCH_FORBIDDEN_FLAGS: ReadonlySet<string> = new Set([
  "-d",
  "-D",
  "--delete",
  "-m",
  "-M",
  "--move",
  "-c",
  "-C",
  "--copy",
]);

/**
 * Banderas de `node` que ejecutan código arbitrario supplied por el comando.
 * `node -e "..."` es un bypass total de cualquier allowlist.
 */
export const NODE_FORBIDDEN_FLAGS: ReadonlySet<string> = new Set([
  "-e",
  "--eval",
  "-p",
  "--print",
  "-r",
  "--require",
  "--loader",
  "--import",
  "--experimental-loader",
]);

/**
 * Subcomandos de `pnpm`/`npm` que lanzan binarios arbitrarios.
 */
export const PACKAGE_MANAGER_FORBIDDEN_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "exec",
  "dlx",
  "create",
  "env",
  "init",
]);

/**
 * Subcomandos de `node` que solo muestran información (sin ejecutar código).
 */
export const NODE_INFO_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "--version",
  "-v",
  "--help",
  "-h",
]);

/** Extensiones de script admitidas para `node <script>`. */
export const NODE_SCRIPT_EXTENSIONS: ReadonlySet<string> = new Set([".js", ".mjs", ".cjs"]);

/** Metacaracteres de shell que separan segmentos de comando. */
const SEGMENT_SEPARATORS = /[;|&]/;

/** Construcciones que rompen el modelo "un segmento = una cabeza". */
const FORBIDDEN_CONSTRUCTS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\$\(/, reason: "sustitución de comandos `$(...)`" },
  { pattern: /`/, reason: "escape/continuación con backtick" },
  { pattern: />/, reason: "redirección de salida (`>`)" },
  { pattern: /</, reason: "redirección de entrada (`<`)" },
];

/** Decisión auditable de la política de terminal. */
export interface TerminalCommandDecision {
  /** `true` solo si **todos** los segmentos pasan la allowlist. */
  readonly allowed: boolean;
  /** Motivo del rechazo (auditable; nunca contiene el comando completo). */
  readonly reason?: string;
  /** Cabeza normalizada del primer segmento (para telemetría). */
  readonly head?: string;
  /** Número de segmentos evaluados. */
  readonly segmentCount: number;
}

/** Opciones de evaluación. */
export interface TerminalPolicyOptions {
  /** Allowlist alternativa de cabezas (por defecto, la canónica). */
  readonly allowedCommands?: ReadonlySet<string>;
  /** Subcomandos git alternativos. */
  readonly allowedGitSubcommands?: ReadonlySet<string>;
}

/**
 * Normaliza la cabecera de un comando: quita comillas, directorio y extensión.
 *
 * `C:\Windows\System32\git.exe` → `git`
 * `/usr/bin/ls`               → `ls`
 * `"C:\Program Files\node.exe"` → `node`
 */
export function normalizeCommandHead(raw: string): string {
  let token = raw.trim();
  if (token.length === 0) return "";

  // Quita comillas envolventes (dobles o simples).
  if (
    (token.startsWith('"') && token.endsWith('"') && token.length >= 2) ||
    (token.startsWith("'") && token.endsWith("'") && token.length >= 2)
  ) {
    token = token.slice(1, -1);
  }

  // Reduce a basename (soporta separadores POSIX y Windows).
  const base = token.split(/[\\/]/).pop() ?? token;

  // Quita la extensión de ejecutable.
  return base.toLowerCase().replace(/\.(exe|cmd|bat|com|ps1)$/, "");
}

/**
 * Extrae el primer token de un segmento respetando comillas.
 */
function firstToken(segment: string): string {
  const s = segment.trim();
  if (s.length === 0) return "";
  if (s.startsWith('"')) {
    const end = s.indexOf('"', 1);
    if (end > 1) return s.slice(1, end);
  }
  if (s.startsWith("'")) {
    const end = s.indexOf("'", 1);
    if (end > 1) return s.slice(1, end);
  }
  const match = /^\S+/.exec(s);
  return match ? match[0] : "";
}

/**
 * Divide un comando en segmentos, respetando comillas simples y dobles.
 * Los metacaracteres `;`, `|`, `&` y el salto de línea separan segmentos.
 */
export function splitCommandSegments(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of command) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "\n" || char === "\r") {
      segments.push(current);
      current = "";
      continue;
    }
    if (SEGMENT_SEPARATORS.test(char)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  segments.push(current);

  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Extrae los argumentos de un segmento como tokens simples (sin parseo
 * completo de comillas: basta para decidir sobre banderas).
 */
function segmentTokens(segment: string): string[] {
  return segment
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Política canónica de comandos de terminal (deny-by-default).
 */
export class TerminalCommandPolicy {
  /**
   * Normaliza la cabecera de un comando (expuesto como método de clase para
   * ergonomicidad; delega en la función de módulo).
   */
  public static normalizeHead(raw: string): string {
    return normalizeCommandHead(raw);
  }

  /**
   * Evalúa un comando completo. Rechaza si **cualquier** segmento o
   * construcción no permitida aparece en el comando.
   */
  public static evaluate(
    command: string,
    options: TerminalPolicyOptions = {}
  ): TerminalCommandDecision {
    const allowedCommands = options.allowedCommands ?? TERMINAL_SAFE_COMMANDS;
    const allowedGitSubcommands = options.allowedGitSubcommands ?? GIT_SAFE_SUBCOMMANDS;

    if (typeof command !== "string" || command.trim().length === 0) {
      return {
        allowed: false,
        reason: "Comando vacío o inválido.",
        segmentCount: 0,
      };
    }

    for (const construct of FORBIDDEN_CONSTRUCTS) {
      if (construct.pattern.test(command)) {
        return {
          allowed: false,
          reason: `Comando rechazado por la política de terminal: ${construct.reason} no permitido.`,
          segmentCount: 0,
        };
      }
    }

    const segments = splitCommandSegments(command);
    if (segments.length === 0) {
      return {
        allowed: false,
        reason: "Comando vacío tras segmentar.",
        segmentCount: 0,
      };
    }

    for (const segment of segments) {
      const verdict = TerminalCommandPolicy.evaluateSegment(segment, allowedCommands, allowedGitSubcommands);
      if (!verdict.allowed) {
        return {
          allowed: false,
          reason: verdict.reason,
          head: verdict.head,
          segmentCount: segments.length,
        };
      }
    }

    return {
      allowed: true,
      head: normalizeCommandHead(firstToken(segments[0]!)),
      segmentCount: segments.length,
    };
  }

  /**
   * Evalúa un segmento aislado.
   */
  private static evaluateSegment(
    segment: string,
    allowedCommands: ReadonlySet<string>,
    allowedGitSubcommands: ReadonlySet<string>
  ): TerminalCommandDecision {
    const tokens = segmentTokens(segment);
    if (tokens.length === 0) {
      return { allowed: false, reason: "Segmento vacío.", segmentCount: 1 };
    }

    // El operador de invocación de PowerShell (`&`) permite ejecutar cualquier
    // binario: si aparece al inicio del segmento, se rechaza el segmento.
    if (segment.startsWith("&")) {
      return {
        allowed: false,
        reason: "Operador de invocación `&` no permitido en la política de terminal.",
        segmentCount: 1,
      };
    }

    // Dot-sourcing (`.\\script.ps1`) ejecuta código arbitrario.
    if (segment.startsWith(".")) {
      return {
        allowed: false,
        reason: "Dot-sourcing (`.`) no permitido en la política de terminal.",
        segmentCount: 1,
      };
    }

    const head = normalizeCommandHead(firstToken(segment));

    if (!allowedCommands.has(head)) {
      return {
        allowed: false,
        reason:
          `Comando '${head || segment}' fuera del conjunto seguro documentado ` +
          `(deny-by-default: ${[...allowedCommands].join(", ")}).`,
        head,
        segmentCount: 1,
      };
    }

    if (head === "git") {
      return TerminalCommandPolicy.evaluateGit(tokens, allowedGitSubcommands);
    }

    if (head === "node") {
      return TerminalCommandPolicy.evaluateNode(tokens);
    }

    const subcommandAllowlist = TERMINAL_SAFE_SUBCOMMANDS.get(head);
    if (subcommandAllowlist) {
      const subcommand = (tokens[1] ?? "").toLowerCase();
      if (subcommand.length === 0) {
        return {
          allowed: false,
          reason: `'${head}' requiere un subcomando explícito permitido.`,
          head,
          segmentCount: 1,
        };
      }
      if (PACKAGE_MANAGER_FORBIDDEN_SUBCOMMANDS.has(subcommand)) {
        return {
          allowed: false,
          reason: `Subcomando '${subcommand}' de '${head}' no permitido (lanza binarios arbitrarios).`,
          head,
          segmentCount: 1,
        };
      }
      if (!subcommandAllowlist.has(subcommand)) {
        return {
          allowed: false,
          reason: `Subcomando '${subcommand}' de '${head}' no permitido.`,
          head,
          segmentCount: 1,
        };
      }
    }

    return { allowed: true, head, segmentCount: 1 };
  }

  /**
   * Reglas específicas de `node`: sin banderas de eval y, si ejecuta un script,
   * solo rutas **relativas** dentro del workspace (con extensión de script).
   */
  private static evaluateNode(tokens: string[]): TerminalCommandDecision {
    const head = "node";
    const rest = tokens.slice(1);

    for (const token of rest) {
      if (NODE_FORBIDDEN_FLAGS.has(token.toLowerCase())) {
        return {
          allowed: false,
          reason: `Bandera '${token}' de 'node' no permitida (ejecuta código arbitrario).`,
          head,
          segmentCount: 1,
        };
      }
    }

    if (rest.length === 0) {
      return {
        allowed: false,
        reason: "'node' requiere un script o un subcomando de información.",
        head,
        segmentCount: 1,
      };
    }

    const first = rest[0]!;
    const lower = first.toLowerCase();

    if (NODE_INFO_SUBCOMMANDS.has(lower)) {
      return { allowed: true, head, segmentCount: 1 };
    }

    // Script: debe ser una ruta RELATIVA (confinada al cwd/workspace),
    // sin `..` y con extensión de script reconocida.
    if (first.startsWith("-")) {
      return {
        allowed: false,
        reason: `Bandera '${first}' de 'node' no permitida.`,
        head,
        segmentCount: 1,
      };
    }
    if (path.isAbsolute(first) || /^[A-Za-z]:/.test(first)) {
      return {
        allowed: false,
        reason: `Script de 'node' con ruta absoluta no permitido ('${first}'): debe ser relativo al workspace.`,
        head,
        segmentCount: 1,
      };
    }
    if (first.split(/[\\/]/).includes("..")) {
      return {
        allowed: false,
        reason: `Script de 'node' con traversal no permitido ('${first}').`,
        head,
        segmentCount: 1,
      };
    }
    const extension = path.extname(first).toLowerCase();
    if (!NODE_SCRIPT_EXTENSIONS.has(extension)) {
      return {
        allowed: false,
        reason: `Extensión de script de 'node' no permitida ('${extension || "sin extensión"}').`,
        head,
        segmentCount: 1,
      };
    }

    return { allowed: true, head, segmentCount: 1 };
  }

  /**
   * Reglas específicas de `git`: subcomando de solo lectura y sin banderas de escape.
   */
  private static evaluateGit(
    tokens: string[],
    allowedGitSubcommands: ReadonlySet<string>
  ): TerminalCommandDecision {
    const subcommand = (tokens[1] ?? "").toLowerCase();

    if (subcommand.length === 0) {
      return {
        allowed: false,
        reason: "'git' requiere un subcomando explícito de solo lectura.",
        head: "git",
        segmentCount: 1,
      };
    }

    if (!allowedGitSubcommands.has(subcommand)) {
      return {
        allowed: false,
        reason: `Subcomando git '${subcommand}' no permitido (solo lectura: ${[...allowedGitSubcommands].join(", ")}).`,
        head: "git",
        segmentCount: 1,
      };
    }

    for (const token of tokens.slice(2)) {
      const normalized = token.toLowerCase();
      if (GIT_FORBIDDEN_FLAGS.has(normalized)) {
        return {
          allowed: false,
          reason: `Bandera git '${token}' no permitida (escape de ejecución o escritura arbitraria).`,
          head: "git",
          segmentCount: 1,
        };
      }
      if (subcommand === "branch" && GIT_BRANCH_FORBIDDEN_FLAGS.has(normalized)) {
        return {
          allowed: false,
          reason: `Bandera git '${token}' no permitida para 'git branch' (muta el repositorio).`,
          head: "git",
          segmentCount: 1,
        };
      }
    }

    return { allowed: true, head: "git", segmentCount: 1 };
  }
}

/**
 * Variables de entorno que el subproceso puede heredar.
 * Todo lo demás (tokens, credenciales, `NODE_OPTIONS`, etc.) se descarta.
 */
export const PROCESS_ENV_ALLOWLIST: ReadonlySet<string> = new Set([
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "windir",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "ProgramW6432",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "SHELL",
  "TERM",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "USERNAME",
  "USERDOMAIN",
  "COMPUTERNAME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
]);

/** Prefijo de variables propias de Ego que sí se propagan al subproceso. */
export const EGO_ENV_PREFIX = "EGO_";

/**
 * Construye el `env` del subproceso a partir de una allowlist explícita.
 *
 * EGO-FIND-33: `env: { ...process.env }` filtraba el entorno completo
 * (tokens de proveedor, rutas de credenciales, `NODE_OPTIONS`, …) al
 * subproceso. Ahora solo sobrevive lo declarado en `PROCESS_ENV_ALLOWLIST`
 * más las variables `EGO_*`.
 */
export function sanitizeProcessEnv(
  base: NodeJS.ProcessEnv = process.env,
  extraAllowed: ReadonlySet<string> = new Set()
): Record<string, string> {
  const out: Record<string, string> = {};
  const allowed = new Set([...PROCESS_ENV_ALLOWLIST, ...extraAllowed]);
  const allowedLower = new Set([...allowed].map((k) => k.toLowerCase()));

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (allowedLower.has(key.toLowerCase())) {
      out[key] = value;
      continue;
    }
    if (key.toUpperCase().startsWith(EGO_ENV_PREFIX)) {
      out[key] = value;
    }
  }

  return out;
}
