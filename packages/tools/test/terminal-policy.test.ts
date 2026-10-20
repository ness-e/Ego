import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";

/**
 * EGO-FIND-32 / EGO-FIND-33 — T3 de la ola 1 (A3).
 *
 * La ruta del AGENTE de terminal (`NativeTerminalTool.execute`) usaba solo una
 * denylist de 6 regex; la allowlist `TERMINAL_SAFE_COMMANDS` gobernaba
 * únicamente el panel interactivo (`apps/desktop/src/main.ts`).
 *
 * Estos tests fijan el contrato: la ruta del agente es deny-by-default sobre
 * una allowlist de cabezas normalizadas, y el `env` del subproceso no filtra
 * el entorno completo.
 */

const spawnCalls: Array<{ command: string; args: string[]; env: Record<string, string> }> = [];
const fakeProc = {
  stdout: { on: () => undefined },
  stderr: { on: () => undefined },
  on: (event: string, cb: (arg: unknown) => void) => {
    if (event === "close") {
      // Emula `close` de forma asíncrona para no dejar la promesa colgando.
      setTimeout(() => cb(0), 0);
    }
    return undefined;
  },
  kill: () => true,
};

vi.mock("node:child_process", () => ({
  spawn: (command: string, args: string[], options: { env?: Record<string, string> }) => {
    spawnCalls.push({ command, args, env: options.env ?? {} });
    return fakeProc;
  },
  execFile: () => {
    const cb = (err: Error | null, stdout: string, stderr: string) => {
      void err;
      void stdout;
      void stderr;
    };
    const child = { stdout: "", stderr: "", on: () => child };
    return Object.assign(Promise.resolve(child), { cb });
  },
  exec: () => {
    const child = { stdout: "", stderr: "", on: () => child };
    return Object.assign(Promise.resolve(child), { cb: () => undefined });
  },
}));

import {
  createTerminalExecTool,
  TerminalCommandPolicy,
  sanitizeProcessEnv,
  TERMINAL_SAFE_COMMANDS,
  GIT_SAFE_SUBCOMMANDS,
} from "../src/index.js";

const WORKSPACE = path.join(os.tmpdir(), "ego-terminal-policy-ws");

async function runTerminal(command: string): Promise<{ ok: boolean; error?: string }> {
  const tool = createTerminalExecTool({ defaultWorkspacePath: WORKSPACE });
  try {
    await tool.execute({ command, timeoutMs: 1000 }, {
      callId: "c1",
      sessionId: "s1",
      workspacePath: WORKSPACE,
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

describe("T3 — Terminal: allowlist real en la ruta del agente (EGO-FIND-32)", () => {
  beforeEach(() => {
    spawnCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("expone la allowlist canónica y los subcomandos git de solo lectura", () => {
    expect(TERMINAL_SAFE_COMMANDS.has("git")).toBe(true);
    expect(GIT_SAFE_SUBCOMMANDS.has("status")).toBe(true);
    expect(GIT_SAFE_SUBCOMMANDS.has("push")).toBe(false);
  });

  it("BYPASS 1 — `rm -fr /` (el regex antiguo exigía `-rf`) queda bloqueado", async () => {
    const res = await runTerminal("rm -fr /");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/allowlist|conjunto seguro|bloqueado/i);
    expect(spawnCalls).toHaveLength(0);
  });

  it("BYPASS 2 — `Remove-Item -Recurse -Force C:\\` (cmdlet PowerShell) queda bloqueado", async () => {
    const res = await runTerminal("Remove-Item -Recurse -Force C:\\");
    expect(res.ok).toBe(false);
    expect(spawnCalls).toHaveLength(0);
  });

  it("BYPASS 3 — `cmd /c del /s /q C:\\temp` (escape por intérprete) queda bloqueado", async () => {
    const res = await runTerminal("cmd /c del /s /q C:\\temp");
    expect(res.ok).toBe(false);
    expect(spawnCalls).toHaveLength(0);
  });

  it("BYPASS 4 — `powershell -enc <base64>` queda bloqueado", async () => {
    const res = await runTerminal("powershell -enc SQBFAFgA");
    expect(res.ok).toBe(false);
    expect(spawnCalls).toHaveLength(0);
  });

  it("bloquea el encadenamiento por `;` aunque el primer segmento sea inocuo", async () => {
    const res = await runTerminal("ls; rm -rf /");
    expect(res.ok).toBe(false);
    expect(spawnCalls).toHaveLength(0);
  });

  it("bloquea la sustitución de comandos `$(...)` y la redirección `>`", async () => {
    expect((await runTerminal("ls $(rm -rf /)")).ok).toBe(false);
    expect((await runTerminal("echo hi > out.txt")).ok).toBe(false);
    expect(spawnCalls).toHaveLength(0);
  });

  it("permite un comando de la allowlist y lo ejecuta", async () => {
    const res = await runTerminal("git status");
    expect(res.ok).toBe(true);
    expect(spawnCalls).toHaveLength(1);
  });

  it("bloquea los subcomandos git que mutan el repositorio", async () => {
    expect((await runTerminal("git push origin main")).ok).toBe(false);
    expect((await runTerminal("git commit -m x")).ok).toBe(false);
    expect(spawnCalls).toHaveLength(0);
  });

  it("normaliza la cabeza con ruta absoluta y extensión", () => {
    expect(TerminalCommandPolicy.normalizeHead("C:\\Windows\\System32\\git.exe")).toBe("git");
    expect(TerminalCommandPolicy.normalizeHead("/usr/bin/ls")).toBe("ls");
    expect(TerminalCommandPolicy.normalizeHead('"C:\\Program Files\\node.exe"')).toBe("node");
  });

  it("expone la decisión de política con motivo auditable", () => {
    const denied = TerminalCommandPolicy.evaluate("rm -rf /");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBeTruthy();

    const allowed = TerminalCommandPolicy.evaluate("git diff --stat");
    expect(allowed.allowed).toBe(true);
  });
});

describe("T3 — Terminal: env saneado (EGO-FIND-33)", () => {
  beforeEach(() => {
    spawnCalls.length = 0;
  });

  it("el env del subproceso NO contiene variables de entorno ajenas a la allowlist", () => {
    const sanitized = sanitizeProcessEnv({
      PATH: "/usr/bin",
      SystemRoot: "C:\\Windows",
      HOME: "/home/u",
      GITHUB_TOKEN: "ghp_supersecrettoken",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      EGO_WORKSPACE_PATH: "/ws",
      RANDOM_JUNK: "leak-me",
    });

    expect(sanitized.PATH).toBe("/usr/bin");
    expect(sanitized.SystemRoot).toBe("C:\\Windows");
    expect(sanitized.HOME).toBe("/home/u");
    // Las variables EGO_* propias se preservan.
    expect(sanitized.EGO_WORKSPACE_PATH).toBe("/ws");
    // Los secretos y el ruido no.
    expect(sanitized.GITHUB_TOKEN).toBeUndefined();
    expect(sanitized.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(sanitized.RANDOM_JUNK).toBeUndefined();
  });

  it("el subproceso real recibe el env saneado, no `process.env` completo", async () => {
    const original = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_supersecrettoken";
    try {
      const res = await runTerminal("git status");
      expect(res.ok).toBe(true);
      expect(spawnCalls).toHaveLength(1);
      expect(spawnCalls[0]!.env.GITHUB_TOKEN).toBeUndefined();
      expect(spawnCalls[0]!.env.PATH).toBeDefined();
    } finally {
      if (original === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = original;
    }
  });
});
