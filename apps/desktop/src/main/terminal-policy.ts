/**
 * Política de terminal viva (R5, defensa en profundidad).
 *
 * Extraído de `../main.ts` (STAB-09). Espejo intencional de
 * `packages/tools/src/native/terminal/NativeTerminalTool.ts:10-17`: el
 * guardrail fuerte vive en el tool + `PathValidator` + `requiresApproval`;
 * este pre-chequeo evita siquiera spawnear lo letal desde el renderer
 * (untrusted). La denylist es bypasseable por naturaleza — nunca es la
 * única defensa (decisión owner T03/R5).
 */

/** Máximo de sesiones de terminal viva concurrentes. */
export const MAX_TERMINAL_SESSIONS = 8;

/** Timeout por defecto de una sesión de terminal viva. */
export const TERMINAL_DEFAULT_TIMEOUT_MS = 60_000;

/** Patrones letales bloqueados en el ingress IPC. */
export const TERMINAL_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+\/s\s+\/q\s+[a-zA-Z]:[\/\\]/i,
  /format\s+[a-zA-Z]:/i,
  /:(){ :|:& };:/,
  /mkfs/i,
  /dd\s+if=.*of=\/dev\/(sd|nvme|hd)/i,
];

/** Conjunto seguro documentado para `ipc.terminal.spawn` (deny-by-default). */
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

/** Subcomandos de git de solo lectura permitidos en terminal viva. */
export const GIT_SAFE_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "status",
  "diff",
  "log",
  "branch",
  "show",
  "rev-parse",
]);

/**
 * `true` si el comando puede spawnearse: cabeza en allowlist y, para git,
 * subcomando de solo lectura. Normaliza `C:\…\git.exe` → `git`.
 */
export function isTerminalCommandAllowed(command: string): boolean {
  const tokens = command.trim().split(/\s+/);
  const head =
    (tokens[0] ?? "").split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/, "") ?? "";
  if (!TERMINAL_SAFE_COMMANDS.has(head)) return false;
  if (head === "git") {
    return GIT_SAFE_SUBCOMMANDS.has((tokens[1] ?? "").toLowerCase());
  }
  return true;
}

/** `true` si el comando matchea algún patrón letal de la denylist. */
export function isTerminalCommandForbidden(command: string): boolean {
  return TERMINAL_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(command));
}
