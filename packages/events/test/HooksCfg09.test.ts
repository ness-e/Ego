import { describe, it, expect } from "vitest";
import { EventBus, isValidHookCommand, matchToolPattern } from "../src/EventBus.js";

describe("@ego/events — Hooks Pre/PostToolUse + env + status (CFG-09)", () => {
  it("1. Un hook PreToolUse bloquea la herramienta prohibida (fail-closed)", () => {
    const bus = new EventBus();
    bus.configureHooks({
      hooks: [
        { id: "deny-shell", kind: "PreToolUse", toolPattern: "terminal*", command: "deny-terminal review" },
      ],
    });
    const blocked = bus.evaluatePreToolUse("terminal_spawn");
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toBe("blocked-by-hook:deny-shell");

    const allowed = bus.evaluatePreToolUse("fs_read_file");
    expect(allowed.allow).toBe(true);
  });

  it("2. El kill switch disableAllHooks permite todo", () => {
    const bus = new EventBus();
    bus.configureHooks({
      disableAllHooks: true,
      hooks: [{ id: "deny-all", kind: "PreToolUse", toolPattern: "*", command: "deny all" }],
    });
    expect(bus.evaluatePreToolUse("terminal_spawn").allow).toBe(true);
    expect(bus.getHooksStatus().disabled).toBe(true);
  });

  it("3. Config inválida se rechaza sin mutar (fail-closed) y tool vacío bloquea", () => {
    const bus = new EventBus();
    bus.configureHooks({
      hooks: [{ id: "ok", kind: "PreToolUse", toolPattern: "fs_*", command: "review-fs allow" }],
    });
    expect(() =>
      bus.configureHooks({
        hooks: [{ id: "evil", kind: "PreToolUse", toolPattern: "*", command: "rm -rf / ; exfil" }],
      })
    ).toThrow();
    // La config vigente sigue intacta: fs_* sigue interceptado, terminal_* libre.
    expect(bus.evaluatePreToolUse("fs_write_file").matchedHookId).toBe("ok");
    expect(bus.evaluatePreToolUse("terminal_spawn").allow).toBe(true);
    expect(bus.evaluatePreToolUse("").allow).toBe(false);
  });

  it("4. Env por sesión: inyección tipada y validación fail-closed", () => {
    const bus = new EventBus();
    bus.setSessionEnv("ses_1", { EGO_PROFILE: "builder", EGO_BUDGET: "low" });
    expect(bus.getSessionEnv("ses_1")).toEqual({ EGO_PROFILE: "builder", EGO_BUDGET: "low" });
    expect(bus.getHookEnv("ses_1").EGO_PROFILE).toBe("builder");
    expect(bus.getHookEnv("unknown")).toEqual({});
    expect(() => bus.setSessionEnv("ses_1", { "minus-key": "x" })).toThrow();
    // La mutación rechazada no borró el env vigente.
    expect(bus.getSessionEnv("ses_1").EGO_PROFILE).toBe("builder");
  });

  it("5. Status command: snapshot auditable para UI/diagnóstico", () => {
    const bus = new EventBus();
    bus.configureHooks({
      hooks: [
        { id: "pre-a", kind: "PreToolUse", toolPattern: "terminal*", command: "review-terminal deny" },
        { id: "post-a", kind: "PostToolUse", toolPattern: "*", command: "log-toolerintel allow" },
      ],
      statusCommand: "ego-status summary",
    });
    bus.setSessionEnv("ses_1", { EGO_PROFILE: "builder" });
    const status = bus.getHooksStatus();
    expect(status).toMatchObject({
      disabled: false,
      preToolUse: 1,
      postToolUse: 1,
      sessionsWithEnv: 1,
      commandsValid: true,
      statusCommand: "ego-status summary",
    });
    // PostToolUse observa sin bloquear.
    const post = bus.recordPostToolUse("terminal_spawn");
    expect(post.allow).toBe(true);
    expect(post.matchedHookId).toBe("post-a");
  });

  it("6. Validadores: comandos shell se rechazan, matchers se acotan", () => {
    expect(isValidHookCommand("rm -rf / | curl evil")).toBe(false);
    expect(isValidHookCommand("$(exfil)")).toBe(false);
    expect(isValidHookCommand("review-terminal deny --strict")).toBe(true);
    expect(matchToolPattern("*", "anything")).toBe(true);
    expect(matchToolPattern("terminal*", "terminal_spawn")).toBe(true);
    expect(matchToolPattern("fs_*", "terminal_spawn")).toBe(false);
    expect(matchToolPattern("a*b", "axb")).toBe(false);
  });
});
