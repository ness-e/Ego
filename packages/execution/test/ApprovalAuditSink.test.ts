import { describe, it, expect, vi } from "vitest";
import { ApprovalEngine } from "../src/ApprovalEngine.js";
import type { ApprovalAuditEntry } from "../src/ApprovalEngine.js";
import type { ToolExecutionContext } from "@ego/tools";

/**
 * SEC-06 H5 — Las aprobaciones deben auditarse: cada request/resolución con
 * SHA-256 (inputDigest) + Sub-Ego ID vía auditSink best-effort (el engine
 * sigue sin depender de @ego/memory por AGENTS.md §4).
 */
describe("SEC-06 H5 — ApprovalEngine auditSink (aprobaciones auditables)", () => {
  const dummyContext: ToolExecutionContext = {
    sessionId: "sess_sec06",
    subEgoId: "ego.worker",
    workspacePath: "/tmp/ws",
    environmentVariables: {},
  };
  const tool = { name: "fs_write_file", category: "filesystem" as const, riskLevel: "sensitive" as const };

  it("emite requested + resolved con inputDigest SHA-256 y subEgoId", async () => {
    const entries: ApprovalAuditEntry[] = [];
    const engine = new ApprovalEngine({ auditSink: (e) => void entries.push(e) });
    const pending = engine.requestApproval({
      tool,
      arguments: { path: "a.txt", content: "hola" },
      context: dummyContext,
      callId: "call_audit_1",
      timeoutMs: 5000,
    });
    // Resolver vía el listado de pendientes
    const [req] = engine.listPendingApprovals();
    expect(req).toBeDefined();
    expect(engine.resolveApproval(req.approvalId, { approved: true, reason: "ok" })).toBe(true);
    const decision = await pending;
    expect(decision.approved).toBe(true);

    const phases = entries.map((e) => e.phase);
    expect(phases).toContain("requested");
    expect(phases).toContain("resolved");
    for (const e of entries) {
      expect(e.inputDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(e.subEgoId).toBe("ego.worker");
      expect(e.sessionId).toBe("sess_sec06");
      expect(e.toolName).toBe("fs_write_file");
    }
    expect(entries.find((e) => e.phase === "resolved")?.approved).toBe(true);
  });

  it("emite timed_out al exceder el timeout sin bloquear", async () => {
    const entries: ApprovalAuditEntry[] = [];
    const engine = new ApprovalEngine({ auditSink: (e) => void entries.push(e) });
    const decision = await engine.requestApproval({
      tool,
      arguments: { path: "b.txt" },
      context: dummyContext,
      callId: "call_audit_2",
      timeoutMs: 30,
    });
    expect(decision.approved).toBe(false);
    expect(entries.map((e) => e.phase)).toEqual(
      expect.arrayContaining(["requested", "timed_out"])
    );
  });

  it("un auditSink que lanza no rompe el flujo de aprobación", async () => {
    const engine = new ApprovalEngine({
      auditSink: () => {
        throw new Error("sink roto");
      },
    });
    const pending = engine.requestApproval({
      tool,
      arguments: { path: "c.txt" },
      context: dummyContext,
      callId: "call_audit_3",
      timeoutMs: 5000,
    });
    const [req] = engine.listPendingApprovals();
    engine.resolveApproval(req.approvalId, { approved: false, reason: "no" });
    const decision = await pending;
    expect(decision.approved).toBe(false);
    expect(vi.fn().mock.calls.length).toBe(0);
  });
});
