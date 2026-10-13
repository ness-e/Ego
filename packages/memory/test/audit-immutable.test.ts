import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter, verifyAuditPayload, computeAuditDigest } from "../EgoMemoryAdapter.js";
import { SessionCheckpointPolicy } from "../SessionCheckpointPolicy.js";

/**
 * SEC-06 — Auditoría inmutable gov/audit: SHA-256 + Sub-Ego ID, verificable.
 * Estado previo: recordAudit/promote/supersede/tool_dispatch escribían en
 * gov/audit SIN digest ni subEgoId. Estos tests exigen el cierre de huecos.
 */
describe("SEC-06 — Auditoría inmutable en gov/audit (SHA-256 + Sub-Ego ID)", () => {
  const testDir = path.join(os.tmpdir(), `ego-sec06-audit-test-${Date.now()}`);
  let adapter: EgoMemoryAdapter;

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
  });

  afterAll(async () => {
    if (adapter && adapter.ready) await adapter.close();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos en Windows
    }
  });

  it("H1 — recordAudit persiste sha256 (64 hex) + subEgoId y retorna la key", async () => {
    const key = await adapter.recordAudit(
      "file_write",
      "ego.worker",
      { path: "src/index.ts", bytes: 128 },
      "workspace/src/index.ts",
      "ego.worker"
    );

    expect(key.startsWith("file_write:")).toBe(true);
    const stored = await adapter.get("gov/audit", key);
    expect(stored).not.toBeNull();
    const payload = stored!.payload as Record<string, unknown>;
    expect(payload.action).toBe("file_write");
    expect(payload.subEgoId).toBe("ego.worker");
    expect(typeof payload.sha256).toBe("string");
    expect((payload.sha256 as string)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("H1 — verifyAuditPayload acepta el registro intacto y rechaza el manipulado", async () => {
    const key = await adapter.recordAudit("tool_exec", "ego.worker", { cmd: "ls" });
    const stored = await adapter.get("gov/audit", key);
    expect(verifyAuditPayload(stored!.payload)).toBe(true);

    const tampered = { ...(stored!.payload as Record<string, unknown>), details: { cmd: "rm -rf /" } };
    expect(verifyAuditPayload(tampered)).toBe(false);
  });

  it("H1 — subEgoId por defecto es ego.nucleus cuando no se declara", async () => {
    const key = await adapter.recordAudit("session_start", "ego.nucleus", { sessionId: "s1" });
    const stored = await adapter.get("gov/audit", key);
    expect((stored!.payload as Record<string, unknown>).subEgoId).toBe("ego.nucleus");
  });

  it("H2 — promote y supersede heredan sha256 + subEgoId en su auditoría", async () => {
    await adapter.put({
      namespace: "kb/docs",
      key: "fact:sec06",
      payload: "pendiente",
      metadata: { state: "pending" },
    });
    await adapter.quarantine(
      { namespace: "kb/docs", key: "fact:sec06", payload: "pendiente" },
      "test"
    );
    await adapter.promote("kb/docs:fact:sec06", "kb/verified", "fact:sec06_ok");
    await adapter.supersedeFact("fact:sec06_ok", {
      namespace: "kb/verified",
      key: "fact:sec06_v2",
      payload: "verificado v2",
    });

    const entries = await adapter.list("gov/audit", 50);
    const auditPayloads = entries
      .map((e) => e.payload as Record<string, unknown>)
      .filter((p) => p.action === "promote" || p.action === "supersede");
    expect(auditPayloads.length).toBeGreaterThanOrEqual(2);
    for (const p of auditPayloads) {
      expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(typeof p.subEgoId).toBe("string");
      expect(verifyAuditPayload(p)).toBe(true);
    }
  });

  it("H3 — beforeToolDispatch registra sha256 + sub_ego sin romper la firma previa", async () => {
    const policy = new SessionCheckpointPolicy(adapter);
    const decision = await policy.beforeToolDispatch("sess_sec06", "run_command", "call_sec06_1", {
      subEgoId: "ego.worker",
      args: { command: "ls -la" },
    });
    expect(decision.proceed).toBe(true);

    const rec = await adapter.get("gov/audit", "tool_dispatch:call_sec06_1");
    const payload = rec!.payload as Record<string, unknown>;
    expect(payload.subEgoId).toBe("ego.worker");
    expect(payload.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Digest recomputable desde los campos almacenados (verificable)
    expect(payload.sha256).toBe(
      computeAuditDigest({
        action: "tool_dispatch",
        actor: "ego.worker",
        target: "call_sec06_1",
        subEgoId: "ego.worker",
        details: {
          sessionId: "sess_sec06",
          toolName: "run_command",
          toolCallId: "call_sec06_1",
          args: { command: "ls -la" },
        },
      })
    );
    // La firma sin options sigue funcionando (compatibilidad)
    const d2 = await policy.beforeToolDispatch("sess_sec06", "run_command", "call_sec06_2");
    expect(d2.proceed).toBe(true);
  });
});
