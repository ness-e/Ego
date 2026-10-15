import { describe, it, expect } from "vitest";
import { EventBus } from "../src/EventBus.js";

describe("@ego/events — hooks SessionStart/SessionEnd (STAB-12)", () => {
  it("1. sin hooks configurados permite + emite hook.decided no-matching", async () => {
    const bus = new EventBus();
    const seen = await new Promise<{ reason: string; phase: string }>((resolve) => {
      bus.on("hook.decided", (e) => resolve({ reason: e.payload.reason, phase: e.payload.phase }));
      bus.evaluateSessionStart("sess_01");
    });
    expect(seen).toEqual({ reason: "no-matching-hook", phase: "SessionStart" });
  });

  it("2. SessionStart con hook válido bloquea fail-closed + registra matchedHookId", () => {
    const bus = new EventBus();
    bus.configureHooks({
      hooks: [{ id: "gate-start", kind: "SessionStart", toolPattern: "*", command: "check-session" }],
    });
    const d = bus.evaluateSessionStart("sess_02");
    expect(d.allow).toBe(false);
    expect(d.matchedHookId).toBe("gate-start");
    expect(bus.getHooksStatus().sessionStart).toBe(1);
  });

  it("3. SessionEnd nunca bloquea (observación) aunque haya hook", () => {
    const bus = new EventBus();
    bus.configureHooks({
      hooks: [{ id: "obs-end", kind: "SessionEnd", toolPattern: "*", command: "log-session" }],
    });
    const d = bus.recordSessionEnd("sess_03");
    expect(d.allow).toBe(true);
    expect(d.reason).toBe("observed-by-hook:obs-end");
    expect(bus.getHooksStatus().sessionEnd).toBe(1);
  });

  it("4. sessionId inválido bloquea SessionStart (fail-closed) y no SessionEnd", () => {
    const bus = new EventBus();
    expect(bus.evaluateSessionStart("").allow).toBe(false);
    expect(bus.recordSessionEnd("").allow).toBe(true);
  });

  it("5. config con kind inválido se rechaza sin mutar la vigente", () => {
    const bus = new EventBus();
    bus.configureHooks({
      hooks: [{ id: "ok", kind: "PreToolUse", toolPattern: "fs*", command: "check" }],
    });
    expect(() =>
      bus.configureHooks({
        hooks: [{ id: "bad", kind: "SessionMiddle" as never, toolPattern: "*", command: "x" }],
      })
    ).toThrow(/fail-closed/);
    expect(bus.getHooksStatus().preToolUse).toBe(1);
  });

  it("6. kill switch permite todo incluyendo SessionStart", () => {
    const bus = new EventBus();
    bus.configureHooks({
      disableAllHooks: true,
      hooks: [{ id: "gate", kind: "SessionStart", toolPattern: "*", command: "check" }],
    });
    expect(bus.evaluateSessionStart("s").allow).toBe(true);
  });
});
