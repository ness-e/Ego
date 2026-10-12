import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import { SessionCheckpointPolicy } from "../SessionCheckpointPolicy.js";

describe("SessionCheckpointPolicy — Durabilidad Fail-Closed y Checkpoints de Sesión", () => {
  const testDir = path.join(os.tmpdir(), `ego-checkpoint-policy-test-${Date.now()}`);
  let adapter: EgoMemoryAdapter;
  let policy: SessionCheckpointPolicy;

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
    policy = new SessionCheckpointPolicy(adapter, {
      checkpointIntervalTurns: 3,
      failClosedOnToolFlushError: true,
    });
  });

  afterAll(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos en Windows
    }
  });

  it("permite el despacho de herramienta y registra la intención de ejecución en gov/audit", async () => {
    const sessionId = "sess_test_123";
    const toolCallId = "call_abc_456";

    const decision = await policy.beforeToolDispatch(sessionId, "run_command", toolCallId);
    expect(decision.proceed).toBe(true);
    expect(decision.error).toBeUndefined();

    // Comprobar que existe la entrada pendiente en gov/audit
    const auditRecord = ((await adapter.get("gov/audit", `tool_dispatch:${toolCallId}`))?.payload as { toolName: string; sessionId: string; status: string });
    expect(auditRecord).toBeDefined();
    expect(auditRecord.toolName).toBe("run_command");
    expect(auditRecord.sessionId).toBe(sessionId);
    expect(auditRecord.status).toBe("pending_dispatch");
  });

  it("crea un snapshot en system/snapshots periódicamente según checkpointIntervalTurns", async () => {
    const sessionId = "sess_turn_test";

    // Turno 1 -> no crea checkpoint
    const t1 = await policy.recordTurn(sessionId, "turn_1", { summary: "Primer mensaje" });
    expect(t1.checkpointCreated).toBe(false);
    expect(policy.getTurnCount(sessionId)).toBe(1);

    // Turno 2 -> no crea checkpoint
    const t2 = await policy.recordTurn(sessionId, "turn_2", { summary: "Segundo mensaje" });
    expect(t2.checkpointCreated).toBe(false);

    // Turno 3 (umbral de 3) -> debe crear checkpoint
    const t3 = await policy.recordTurn(sessionId, "turn_3", { summary: "Tercer mensaje completado" });
    expect(t3.checkpointCreated).toBe(true);
    expect(t3.checkpointId).toBeDefined();
    expect(t3.checkpointId?.startsWith("snap_")).toBe(true);

    // Verificar en VantaDB
    const snapshot = ((await adapter.get("system/snapshots", `checkpoint:${sessionId}:${t3.checkpointId}`))?.payload as { sessionId: string; turnCount: number; summary: { summary: string } });
    expect(snapshot).toBeDefined();
    expect(snapshot.sessionId).toBe(sessionId);
    expect(snapshot.turnCount).toBe(3);
    expect(snapshot.summary.summary).toBe("Tercer mensaje completado");
  });

  it("gestiona la política fail-closed si la persistencia falla antes del tool dispatch", async () => {
    // Simular adaptador con error en put
    const brokenAdapter = {
      put: async () => {
        throw new Error("IO error: Disk full");
      },
      flush: async () => {},
    } as unknown as EgoMemoryAdapter;

    const strictPolicy = new SessionCheckpointPolicy(brokenAdapter, {
      failClosedOnToolFlushError: true,
    });

    const decision = await strictPolicy.beforeToolDispatch("sess_999", "file_delete", "call_999");
    expect(decision.proceed).toBe(false);
    expect(decision.error).toContain("Disk full");
  });
});
