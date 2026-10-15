import { describe, it, expect } from "vitest";
import { resolve as resolveFsPath, join as joinFsPath } from "node:path";
import { PermissionsSettingsSchema } from "../src/ipc/schema.js";
import {
  APPROVAL_TIMEOUT_MS_CFG06,
  getCachedPermissionsSettings,
  isPathInScope,
  isTaskKindSafe,
  parsePermissionsSettings,
  resolveCwdRoot,
  resolveEffectivePermission,
  resolvePermissionDecision,
  resolveScopeDirs,
  setCachedPermissionsSettingsForTests,
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

describe("@ego/desktop STAB-02 — TASK_SAFE_KINDS paused vs directo", () => {
  it("kinds seguros corren directo; el resto queda paused (HITL)", () => {
    for (const kind of ["indexing", "sync", "maintenance", "notification"]) {
      expect(isTaskKindSafe(kind)).toBe(true);
    }
    for (const kind of ["cron", "agent-run", "", undefined, null, 42]) {
      expect(isTaskKindSafe(kind)).toBe(false);
    }
  });
});

describe("@ego/desktop STAB-02 — resolveCwdRoot con additionalDirectories", () => {
  const ws = resolveFsPath("/ws-test-ego");
  const shared = resolveFsPath("/ws-test-shared");

  it("sin cwd → workspace; relativo → bajo workspace", () => {
    expect(resolveCwdRoot(undefined, ws, [])).toBe(ws);
    expect(resolveCwdRoot("sub/dir", ws, [])).toBe(ws);
  });

  it("absoluto bajo workspace → workspace; bajo dir extra → ese root", () => {
    expect(resolveCwdRoot(joinFsPath(ws, "notas"), ws, [shared])).toBe(ws);
    expect(resolveCwdRoot(joinFsPath(shared, "data"), ws, [shared])).toBe(shared);
  });

  it("fuera de todo root → workspace (PathValidator falla cerrado)", () => {
    expect(resolveCwdRoot(resolveFsPath("/otro-lado"), ws, [shared])).toBe(ws);
  });

  it("coherencia con evaluateToolCall: scope dirs = workspace + extras", () => {
    const scopeDirs = resolveScopeDirs(ws, [shared]);
    expect(isPathInScope(joinFsPath(shared, "a.json"), scopeDirs)).toBe(true);
    expect(isPathInScope(resolveFsPath("/otro-lado/b.json"), scopeDirs)).toBe(false);
  });
});

describe("@ego/desktop STAB-02 — cache gov/settings/permissions", () => {
  it("sin cache → defaults CFG-06; set/get round-trip para tests", () => {
    setCachedPermissionsSettingsForTests(null);
    const defaults = getCachedPermissionsSettings();
    expect(defaults.permissions.defaultMode).toBe("acceptEdits");
    expect(defaults.approvals.timeoutSec).toBe(60);
    expect(defaults.approvals.cronMode).toBe("deny");
    const custom = parsePermissionsSettings({
      permissions: { defaultMode: "read-only", rules: [], additionalDirectories: ["/x"] },
      approvals: { mode: "manual", timeoutSec: 30, cronMode: "ask" },
    });
    setCachedPermissionsSettingsForTests(custom);
    expect(getCachedPermissionsSettings().approvals.timeoutSec).toBe(30);
    expect(getCachedPermissionsSettings().approvals.timeoutSec * 1000).toBe(30_000);
    setCachedPermissionsSettingsForTests(null);
  });
});
