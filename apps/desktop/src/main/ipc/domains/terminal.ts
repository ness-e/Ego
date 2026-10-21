/**
 * T3 (Ola 5) — Canal IPC `ipc.terminal.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { spawn } from "node:child_process";
import { PathValidator } from "@ego/tools";
import {
  TerminalSpawnSchema,
  TerminalStdinSchema,
  TerminalKillSchema,
} from "../../../ipc/schema.js";
import {
  evaluateToolCall,
  isDenied,
} from "@ego/security";
import {
  MAX_TERMINAL_SESSIONS,
  TERMINAL_DEFAULT_TIMEOUT_MS,
  TERMINAL_FORBIDDEN_PATTERNS,
  TERMINAL_SAFE_COMMANDS,
  isTerminalCommandAllowed,
} from "../../terminal-policy.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.terminal.*`. */
export function registerTerminalIpc(deps: IpcDeps): void {
  const {
    adapter,
    endTerminalSession,
    getCachedPermissionsSettings,
    killTerminalSession,
    pushTerminalOutput,
    resolveCwdRoot,
    terminalSessions,
  } = deps;

  ipcMain.handle("ipc.terminal.spawn", async (_e, rawReq: unknown) => {
    const parseResult = TerminalSpawnSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { command, cwd, timeoutMs } = parseResult.data;
    const workspace = process.env.EGO_WORKSPACE_PATH || process.cwd();
    const permissionSettings = getCachedPermissionsSettings();
    // STAB-02: veto deny-gana de la matriz `@ego/security` (superset de 16
    // patrones + confinamiento con additionalDirectories). Solo `deny` veta:
    // `requireApproval` no bloquea (el safe-set R5 gobierna el allow directo;
    // la vía de escape HITL sigue siendo terminal_exec con aprobación).
    const permVerdict = evaluateToolCall(
      {
        toolName: "terminal.spawn",
        category: "terminal",
        command,
        path: cwd,
        workspacePath: workspace,
      },
      {
        workspacePath: workspace,
        defaultMode: "deny",
        additionalDirectories: permissionSettings.permissions.additionalDirectories,
      }
    );
    if (isDenied(permVerdict)) {
      return {
        ok: false,
        denied: true,
        error: `Comando o cwd vetado por la política de permisos (STAB-02 deny-gana: regla '${permVerdict.rule}'). Vía de escape: HITL vía terminal_exec con aprobación.`,
      };
    }
    for (const pattern of TERMINAL_FORBIDDEN_PATTERNS) {
      if (pattern.test(command)) {
        return {
          ok: false,
          denied: true,
          error: `Comando bloqueado por guardrail (R5 deny-by-default, patrón '${pattern}'). Vía de escape: HITL vía terminal_exec con aprobación.`,
        };
      }
    }
    if (!isTerminalCommandAllowed(command)) {
      return {
        ok: false,
        denied: true,
        error: `Comando fuera del conjunto seguro documentado (R5 deny-by-default: ${[...TERMINAL_SAFE_COMMANDS].join(", ")} + git de solo lectura). Vía de escape: HITL vía terminal_exec con aprobación.`,
      };
    }
    if (terminalSessions.size >= MAX_TERMINAL_SESSIONS) {
      return { ok: false, error: `Límite de sesiones de terminal alcanzado (${MAX_TERMINAL_SESSIONS}).` };
    }
    let executionCwd: string;
    try {
      const effectiveRoot = resolveCwdRoot(
        cwd,
        workspace,
        permissionSettings.permissions.additionalDirectories
      );
      // A3-T11 / diff 6b: `validatePathAsync` cierra la ventana TOCTOU
      // (el path se re-resuelve justo antes del spawn, no antes).
      executionCwd = cwd
        ? await PathValidator.validatePathAsync(cwd, effectiveRoot)
        : workspace;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const sessionId = `term_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "powershell.exe" : "/bin/bash";
    const shellArgs = isWindows ? ["-NoProfile", "-Command", command] : ["-c", command];
    try {
      const proc = spawn(shell, shellArgs, { cwd: executionCwd, windowsHide: true });
      const timeout = setTimeout(
        () => {
          killTerminalSession(sessionId, "timeout");
        },
        timeoutMs ?? TERMINAL_DEFAULT_TIMEOUT_MS
      );
      terminalSessions.set(sessionId, {
        id: sessionId,
        command,
        cwd: executionCwd,
        proc,
        startedAt: Date.now(),
        timeoutTimer: timeout,
      });
      proc.stdout?.on("data", (chunk) => {
        pushTerminalOutput(sessionId, String(chunk));
      });
      proc.stderr?.on("data", (chunk) => {
        pushTerminalOutput(sessionId, String(chunk));
      });
      proc.on("error", (err) => {
        pushTerminalOutput(sessionId, `[ERROR: ${err.message}]`);
        endTerminalSession(sessionId, 1);
      });
      proc.on("close", (exitCode) => {
        endTerminalSession(sessionId, exitCode ?? 0);
      });
      return { ok: true, sessionId, cwd: executionCwd };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("ipc.terminal.stdin", async (_e, rawReq: unknown) => {
    const parseResult = TerminalStdinSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const session = terminalSessions.get(parseResult.data.sessionId);
    if (!session) {
      return { ok: false, error: `Sesión '${parseResult.data.sessionId}' no encontrada o ya finalizada.` };
    }
    try {
      if (!session.proc.stdin || !session.proc.stdin.writable) {
        return { ok: false, error: "stdin no disponible en esta sesión." };
      }
      session.proc.stdin.write(parseResult.data.data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("ipc.terminal.kill", async (_e, rawReq: unknown) => {
    const parseResult = TerminalKillSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const killed = killTerminalSession(parseResult.data.sessionId, "user");
    if (!killed) {
      return { ok: false, error: `Sesión '${parseResult.data.sessionId}' no encontrada o ya finalizada.` };
    }
    try {
      await adapter.recordAudit(
        "terminal",
        parseResult.data.sessionId,
        { action: "kill", by: "user" },
        "user"
      );
    } catch {
      // noop: auditoría best-effort
    }
    return { ok: true, sessionId: parseResult.data.sessionId };
  });
}
