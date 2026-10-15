import { describe, it, expect } from "vitest";
import { PermissionsSettingsSchema } from "../src/ipc/schema.js";
import {
  APPROVAL_TIMEOUT_MS_CFG06,
  isPathInScope,
  parsePermissionsSettings,
  resolveEffectivePermission,
  resolvePermissionDecision,
  resolveScopeDirs,
  shouldRequireApproval,
} from "../src/main.js";

const SETTINGS = parsePermissionsSettings({});

describe("@ego/desktop — CFG-06 permissions deny-gana + approvals", () => {
  it("aplica defaults decisión owner: acceptEdits + smart/60s/cron-deny", () => {
    const parsed = PermissionsSettingsSchema.parse({});
    expect(parsed.permissions.defaultMode).toBe("acceptEdits");
    expect(parsed.approvals.mode).toBe("smart");
    expect(parsed.approvals.timeoutSec).toBe(60);
    expect(parsed.approvals.cronMode).toBe("deny");
    expect(APPROVAL_TIMEOUT_MS_CFG06).toBe(60_000);
  });

  it("deny gana sobre allow y ask en el mismo query", () => {
    const rules = [
      { pattern: "fs.write", decision: "allow" as const },
      { pattern: "fs", decision: "ask" as const },
      { pattern: "fs.write", decision: "deny" as const },
    ];
    expect(resolvePermissionDecision(rules, { tool: "fs.write" })).toBe("deny");
  });

  it("ask gana sobre allow; allow solo → allow; sin match → ask fail-closed", () => {
    const rules = [
      { pattern: "fs", decision: "ask" as const },
      { pattern: "fs.read", decision: "allow" as const },
    ];
    expect(resolvePermissionDecision(rules, { tool: "fs.read" })).toBe("ask");
    expect(
      resolvePermissionDecision([{ pattern: "fs.read", decision: "allow" as const }], {
        tool: "fs.read",
      })
    ).toBe("allow");
    expect(resolvePermissionDecision(rules, { tool: "net.fetch" })).toBe("ask");
  });

  it("path fuera de alcance exige ask aunque defaultMode sea acceptEdits", () => {
    const scopeDirs = resolveScopeDirs("/ws/ego", ["/ws/shared"]);
    expect(isPathInScope("/ws/ego/notes.md", scopeDirs)).toBe(true);
    expect(isPathInScope("/ws/shared/data.json", scopeDirs)).toBe(true);
    expect(isPathInScope("/etc/passwd", scopeDirs)).toBe(false);
    expect(
      resolveEffectivePermission(SETTINGS.permissions, { path: "/etc/passwd" }, { scopeDirs })
    ).toBe("ask");
    expect(
      resolveEffectivePermission(
        SETTINGS.permissions,
        { path: "/ws/ego/notes.md" },
        { scopeDirs }
      )
    ).toBe("allow");
  });

  it("smart pide aprobación en ask/riesgo, no en allow seguro", () => {
    const scopeDirs = resolveScopeDirs("/ws/ego", []);
    const safe = shouldRequireApproval(
      SETTINGS,
      { name: "fs.read", riskLevel: "safe" },
      { tool: "fs.read", path: "/ws/ego/a.md" },
      { scopeDirs }
    );
    expect(safe).toMatchObject({ allowed: true, requireApproval: false });
    const destructive = shouldRequireApproval(
      SETTINGS,
      { name: "fs.rm", riskLevel: "destructive" },
      { tool: "fs.rm" },
      { scopeDirs }
    );
    expect(destructive).toMatchObject({ allowed: true, requireApproval: true });
  });

  it("deny veta sin preguntar incluso con approvals off; cron siempre deny", () => {
    const denySettings = parsePermissionsSettings({
      permissions: {
        defaultMode: "acceptEdits",
        rules: [{ pattern: "fs.exec", decision: "deny" }],
        additionalDirectories: [],
      },
      approvals: { mode: "off", timeoutSec: 60, cronMode: "deny" },
    });
    const gated = shouldRequireApproval(denySettings, { name: "fs.exec" }, { tool: "fs.exec" });
    expect(gated).toMatchObject({ allowed: false, requireApproval: false });
    const cron = shouldRequireApproval(
      SETTINGS,
      { name: "kb.sync", riskLevel: "safe" },
      { tool: "kb.sync" },
      { isCron: true }
    );
    expect(cron).toMatchObject({ allowed: false, requireApproval: false });
  });

  it("payload inválido falla cerrado antes de tocar motores", () => {
    expect(() =>
      parsePermissionsSettings({ approvals: { timeoutSec: 99999 } })
    ).toThrowError();
  });
});
