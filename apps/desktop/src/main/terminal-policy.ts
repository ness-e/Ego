/**
 * Política de terminal viva (R5, defensa en profundidad).
 *
 * A3-T3 / EGO-FIND-32: la allowlist canónica vive AHORA en
 * `packages/tools/src/native/terminal/TerminalCommandPolicy.ts` (una sola
 * fuente de verdad). Antes había DOS allowlists divergentes: esta copia
 * local y la del tool nativo.
 *
 * `TerminalCommandPolicy.evaluate()` es **más estricto** que la allowlist
 * simple anterior: segmenta la línea, rechaza `$(…)`, `>`, `&`, dot-sourcing
 * y subcomandos no permitidos. Se usa en AMBOS paths (panel interactivo y
 * tool nativo) para no dejar una vía más permisiva.
 *
 * La denylist de patrones letales se conserva como segunda capa (bypasseable
 * por naturaleza — nunca es la única defensa: decisión owner T03/R5).
 */
import {
  TerminalCommandPolicy,
  TERMINAL_SAFE_COMMANDS as CANONICAL_TERMINAL_SAFE_COMMANDS,
  GIT_SAFE_SUBCOMMANDS as CANONICAL_GIT_SAFE_SUBCOMMANDS,
} from "@ego/tools";

/** Máximo de sesiones de terminal viva concurrentes. */
export const MAX_TERMINAL_SESSIONS = 8;

/** Timeout por defecto de una sesión de terminal viva. */
export const TERMINAL_DEFAULT_TIMEOUT_MS = 60_000;

/** Patrones letales bloqueados en el ingress IPC (capa extra). */
export const TERMINAL_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /rm\s+-rf\s+[/\\]/i,
  /rmdir\s+\/s\s+\/q\s+[a-zA-Z]:[/\\]/i,
  /format\s+[a-zA-Z]:/i,
  /:(){ :|:& };:/,
  /mkfs/i,
  /dd\s+if=.*of=\/dev\/(sd|nvme|hd)/i,
];

/**
 * Conjunto seguro documentado para `ipc.terminal.spawn` (deny-by-default).
 * Reexportado de la política canónica (`@ego/tools`) — una sola fuente de
 * verdad (A3-T3, diff 6).
 */
export const TERMINAL_SAFE_COMMANDS: ReadonlySet<string> = CANONICAL_TERMINAL_SAFE_COMMANDS;

/**
 * Subcomandos de git de solo lectura permitidos en terminal viva.
 * Reexportado de la política canónica (`@ego/tools`).
 */
export const GIT_SAFE_SUBCOMMANDS: ReadonlySet<string> = CANONICAL_GIT_SAFE_SUBCOMMANDS;

/**
 * `true` si el comando puede spawnearse.
 *
 * Ahora delega en `TerminalCommandPolicy.evaluate()`, que segmenta la línea y
 * aplica la allowlist canónica (más estricta que la copia anterior: rechaza
 * `$(…)`, redirecciones `>`, `&`, dot-sourcing y subcomandos no permitidos).
 */
export function isTerminalCommandAllowed(command: string): boolean {
  return TerminalCommandPolicy.evaluate(command).allowed;
}

/** `true` si el comando matchea algún patrón letal de la denylist. */
export function isTerminalCommandForbidden(command: string): boolean {
  return TERMINAL_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(command));
}
