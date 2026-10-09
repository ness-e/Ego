import { describe, it, expect, vi } from "vitest";
import {
  ApprovalEngine,
  canonicalJsonStringify,
  computeActionIdentity
} from "../src/ApprovalEngine.js";
import type { ToolExecutionContext } from "@ego/tools";

describe("@ego/execution — ApprovalEngine Suite (ACT-06)", () => {
  const dummyContext: ToolExecutionContext = {
    sessionId: "sess_unit_test",
    subEgoId: "ego.developer",
    workspacePath: "/home/user/project",
    environmentVariables: {}
  };

  describe("1. Identidad Causal Exacta (ActionIdentity & Digest determinista, COUC-03)", () => {
    it("canonicalJsonStringify genera el mismo JSON independiente del orden de claves", () => {
      const obj1 = { z: 1, a: 2, m: { y: "test", b: true } };
      const obj2 = { a: 2, m: { b: true, y: "test" }, z: 1 };

      expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
      expect(canonicalJsonStringify(obj1)).toBe('{"a":2,"m":{"b":true,"y":"test"},"z":1}');
    });

    it("computeActionIdentity genera hashes SHA-256 idénticos para llamadas idénticas", () => {
      const id1 = computeActionIdentity({
        sessionId: "sess_1",
        subEgoId: "sub_1",
        toolName: "fs_write_file",
        callId: "call_abc",
        arguments: { path: "src/index.ts", content: "console.log('test')" }
      });

      const id2 = computeActionIdentity({
        sessionId: "sess_1",
        subEgoId: "sub_1",
        toolName: "fs_write_file",
        callId: "call_abc",
        arguments: { content: "console.log('test')", path: "src/index.ts" }
      });

      expect(id1.inputDigest).toBe(id2.inputDigest);
      expect(typeof id1.inputDigest).toBe("string");
      expect(id1.inputDigest.length).toBe(64);
    });

    it("computeActionIdentity detecta modificaciones en argumentos", () => {
      const id1 = computeActionIdentity({
        sessionId: "sess_1",
        toolName: "terminal_exec",
        callId: "call_1",
        arguments: { command: "ls -la" }
      });

      const id2 = computeActionIdentity({
        sessionId: "sess_1",
        toolName: "terminal_exec",
        callId: "call_1",
        arguments: { command: "rm -rf /" }
      });

      expect(id1.inputDigest).not.toBe(id2.inputDigest);
    });
  });

  describe("2. Políticas y Evaluación de Requerimiento de Aprobación", () => {
    it("en modo standard: safe no requiere aprobación, sensitive y destructive sí", () => {
      const engine = new ApprovalEngine({ mode: "standard" });

      const safeEval = engine.evaluateRequirement(
        { name: "fs_read_file", category: "filesystem", riskLevel: "safe" },
        {},
        dummyContext
      );
      expect(safeEval.required).toBe(false);

      const sensitiveEval = engine.evaluateRequirement(
        { name: "fs_write_file", category: "filesystem", riskLevel: "sensitive" },
        {},
        dummyContext
      );
      expect(sensitiveEval.required).toBe(true);

      const destructiveEval = engine.evaluateRequirement(
        { name: "terminal_exec", category: "terminal", riskLevel: "destructive" },
        {},
        dummyContext
      );
      expect(destructiveEval.required).toBe(true);
    });

    it("en modo permissive: solo destructive requiere aprobación", () => {
      const engine = new ApprovalEngine({ mode: "permissive" });

      const safeEval = engine.evaluateRequirement(
        { name: "fs_read_file", riskLevel: "safe" },
        {},
        dummyContext
      );
      expect(safeEval.required).toBe(false);

      const sensitiveEval = engine.evaluateRequirement(
        { name: "fs_write_file", riskLevel: "sensitive" },
        {},
        dummyContext
      );
      expect(sensitiveEval.required).toBe(false);

      const destructiveEval = engine.evaluateRequirement(
        { name: "terminal_exec", riskLevel: "destructive" },
        {},
        dummyContext
      );
      expect(destructiveEval.required).toBe(true);
    });

    it("en modo strict: cualquier acción no safe requiere aprobación", () => {
      const engine = new ApprovalEngine({ mode: "strict" });

      const sensitiveEval = engine.evaluateRequirement(
        { name: "custom_tool", riskLevel: "sensitive" },
        {},
        dummyContext
      );
      expect(sensitiveEval.required).toBe(true);
      expect(sensitiveEval.reason).toContain("ESTRICTO");
    });

    it("reglas explícitas tienen prioridad sobre el modo general", () => {
      const engine = new ApprovalEngine({
        mode: "permissive",
        rules: [
          { toolName: "git_diff", requireApproval: true, reason: "Regla forzada" }
        ]
      });

      const res = engine.evaluateRequirement(
        { name: "git_diff", riskLevel: "safe" },
        {},
        dummyContext
      );
      expect(res.required).toBe(true);
      expect(res.reason).toBe("Regla forzada");
    });
  });

  describe("3. Retención Asíncrona HITL y Resolución (COUC-04)", () => {
    it("congela la ejecución y la resuelve exitosamente cuando el usuario aprueba", async () => {
      const onReq = vi.fn();
      const onRes = vi.fn();
      const engine = new ApprovalEngine({
        onApprovalRequested: onReq,
        onApprovalResolved: onRes
      });

      const requestPromise = engine.requestApproval({
        tool: { name: "fs_write_file", category: "filesystem", riskLevel: "sensitive" },
        arguments: { path: "demo.txt", content: "hello" },
        context: dummyContext,
        callId: "call_01"
      });

      expect(engine.listPendingApprovals().length).toBe(1);
      const pending = engine.listPendingApprovals()[0];
      expect(pending.status).toBe("pending");
      expect(pending.toolName).toBe("fs_write_file");
      expect(onReq).toHaveBeenCalledWith(pending);

      // Simular que el usuario aprueba desde la UI
      const resolved = engine.resolveApproval(pending.approvalId, {
        approved: true,
        resolvedBy: "human_user"
      });

      expect(resolved).toBe(true);
      const decision = await requestPromise;
      expect(decision.approved).toBe(true);
      expect(decision.resolvedBy).toBe("human_user");
      expect(engine.listPendingApprovals().length).toBe(0);
      expect(onRes).toHaveBeenCalled();
    });

    it("permite rechazar con motivo explícito", async () => {
      const engine = new ApprovalEngine();

      const requestPromise = engine.requestApproval({
        tool: { name: "terminal_exec", category: "terminal", riskLevel: "destructive" },
        arguments: { command: "npm publish" },
        context: dummyContext,
        callId: "call_02"
      });

      const pending = engine.listPendingApprovals()[0];
      const rejected = engine.rejectApproval(pending.approvalId, "No es momento de publicar");

      expect(rejected).toBe(true);
      const decision = await requestPromise;
      expect(decision.approved).toBe(false);
      expect(decision.reason).toBe("No es momento de publicar");
    });

    it("soporta modificación de argumentos por el usuario", async () => {
      const engine = new ApprovalEngine();

      const requestPromise = engine.requestApproval({
        tool: { name: "fs_write_file", category: "filesystem", riskLevel: "sensitive" },
        arguments: { path: "config.json", content: "{}" },
        context: dummyContext,
        callId: "call_03"
      });

      const pending = engine.listPendingApprovals()[0];
      engine.resolveApproval(pending.approvalId, {
        approved: true,
        modifiedArguments: { path: "config.json", content: '{"safe":true}' }
      });

      const decision = await requestPromise;
      expect(decision.approved).toBe(true);
      expect(decision.modifiedArguments).toEqual({ path: "config.json", content: '{"safe":true}' });
    });

    it("hace cumplir la coincidencia de ActionIdentity con expectedDigest", async () => {
      const engine = new ApprovalEngine();

      const requestPromise = engine.requestApproval({
        tool: { name: "terminal_exec", category: "terminal", riskLevel: "destructive" },
        arguments: { command: "rm file.txt" },
        context: dummyContext,
        callId: "call_04"
      });

      const pending = engine.listPendingApprovals()[0];

      // Intentar resolver con un digest falso
      expect(() => {
        engine.resolveApproval(
          pending.approvalId,
          { approved: true },
          { expectedDigest: "0000000000000000000000000000000000000000000000000000000000000000" }
        );
      }).toThrow(/Violación de identidad causal/);

      // Resolver con el digest real
      engine.resolveApproval(
        pending.approvalId,
        { approved: true },
        { expectedDigest: pending.action.inputDigest }
      );

      const decision = await requestPromise;
      expect(decision.approved).toBe(true);
    });
  });

  describe("4. Resiliencia, Timeouts y Cancelación", () => {
    it("aplica timeout y cancela deterministamente si el usuario no responde", async () => {
      const engine = new ApprovalEngine({ defaultTimeoutMs: 50 });

      const decision = await engine.requestApproval({
        tool: { name: "terminal_exec", category: "terminal", riskLevel: "destructive" },
        arguments: { command: "reboot" },
        context: dummyContext,
        callId: "call_timeout"
      });

      expect(decision.approved).toBe(false);
      expect(decision.reason).toContain("Timeout de aprobación humana excedido");
    });

    it("cancela inmediatamente si se activa un AbortSignal", async () => {
      const engine = new ApprovalEngine({ defaultTimeoutMs: 5000 });
      const controller = new AbortController();

      const requestPromise = engine.requestApproval({
        tool: { name: "terminal_exec", category: "terminal", riskLevel: "destructive" },
        arguments: { command: "long task" },
        context: dummyContext,
        callId: "call_abort",
        abortSignal: controller.signal
      });

      // Disparar abort tras breve tiempo
      setTimeout(() => controller.abort(), 20);

      const decision = await requestPromise;
      expect(decision.approved).toBe(false);
      expect(decision.reason).toContain("AbortSignal");
      expect(engine.listPendingApprovals().length).toBe(0);
    });

    it("clearAll limpia y resuelve todas las solicitudes pendientes", async () => {
      const engine = new ApprovalEngine();

      const p1 = engine.requestApproval({
        tool: { name: "t1", category: "system", riskLevel: "sensitive" },
        arguments: {},
        context: dummyContext,
        callId: "c1"
      });

      const p2 = engine.requestApproval({
        tool: { name: "t2", category: "system", riskLevel: "sensitive" },
        arguments: {},
        context: dummyContext,
        callId: "c2"
      });

      expect(engine.listPendingApprovals().length).toBe(2);

      engine.clearAll("Shutdown de prueba");

      const [d1, d2] = await Promise.all([p1, p2]);
      expect(d1.approved).toBe(false);
      expect(d1.reason).toBe("Shutdown de prueba");
      expect(d2.approved).toBe(false);
      expect(d2.reason).toBe("Shutdown de prueba");
      expect(engine.listPendingApprovals().length).toBe(0);
    });
  });
});
