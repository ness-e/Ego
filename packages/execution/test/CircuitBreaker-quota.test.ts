import { describe, it, expect } from "vitest";
import { ExecutionManager } from "../src/ExecutionManager.js";
import {
  ToolCircuitOpenError,
  SubEgoQuotaExceededError,
} from "../src/CircuitBreaker.js";
import type { ToolDefinition } from "@ego/tools";

function makeTool(
  name: string,
  execute: () => unknown | Promise<unknown>
): ToolDefinition {
  return {
    name,
    description: name,
    category: "network",
    riskLevel: "sensitive",
    origin: "native",
    parameters: {},
    execute: async () => execute(),
  } as unknown as ToolDefinition;
}

const ctx = (subEgoId = "ego.dev") =>
  ({
    sessionId: "s1",
    projectId: "p1",
    subEgoId,
    callId: "c1",
  }) as never;

describe("Circuit breaker + quota (T3 / R5)", () => {
  it("(1) un tool que falla N veces abre el circuito y la siguiente llamada falla RÁPIDO", async () => {
    const manager = new ExecutionManager({
      circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 60_000 },
    });

    let attempts = 0;
    const failing = makeTool("mcp_colgado", () => {
      attempts++;
      throw new Error("Error HTTP 500: boom");
    });

    // 3 fallos ⇒ el circuito abre (umbral).
    for (let i = 0; i < 3; i++) {
      const res = await manager.execute(failing, {}, ctx(), { callId: `c${i}` });
      expect(res.status).toBe("error");
    }
    expect(attempts).toBe(3);

    // 4ª llamada: veto INMEDIATO, sin ejecutar la herramienta.
    const t0 = Date.now();
    const blocked = await manager.execute(failing, {}, ctx(), { callId: "c3" });
    const elapsed = Date.now() - t0;

    expect(blocked.status).toBe("error");
    expect(blocked.error).toMatch(/circuito|circuit/i);
    expect(attempts).toBe(3); // NO se ejecutó
    expect(elapsed).toBeLessThan(50); // fallo rápido, sin esperar timeout
  });

  it("(2) el error de circuito abierto es TIPADO", async () => {
    const manager = new ExecutionManager({
      circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 60_000 },
    });
    const failing = makeTool("mcp_roto", () => {
      throw new Error("boom");
    });

    await manager.execute(failing, {}, ctx(), { callId: "c0" });
    const blocked = await manager.execute(failing, {}, ctx(), { callId: "c1" });
    expect(blocked.error).toBeTruthy();
    expect(ToolCircuitOpenError).toBeDefined();
    expect(new ToolCircuitOpenError("mcp_roto", 1)).toBeInstanceOf(Error);
  });

  it("(3) un tool sano NO abre el circuito", async () => {
    const manager = new ExecutionManager({
      circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60_000 },
    });
    const ok = makeTool("fs_read", () => "ok");
    for (let i = 0; i < 5; i++) {
      const res = await manager.execute(ok, {}, ctx(), { callId: `c${i}` });
      expect(res.status).toBe("success");
    }
  });

  it("(4) la cuota por Sub-Ego bloquea al superarla con error TIPADO", async () => {
    const manager = new ExecutionManager({ subEgoQuota: { maxCalls: 2 } });
    const ok = makeTool("fs_read", () => "ok");

    const r1 = await manager.execute(ok, {}, ctx("ego.limoso"), { callId: "q1" });
    const r2 = await manager.execute(ok, {}, ctx("ego.limoso"), { callId: "q2" });
    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");

    const r3 = await manager.execute(ok, {}, ctx("ego.limoso"), { callId: "q3" });
    expect(r3.status).toBe("error");
    expect(r3.error).toMatch(/cuota|quota/i);

    // Otro Sub-Ego NO comparte cuota.
    const other = await manager.execute(ok, {}, ctx("ego.otro"), { callId: "q4" });
    expect(other.status).toBe("success");
  });

  it("(5) la cuota se configura por Sub-Ego y es configurable", async () => {
    const manager = new ExecutionManager({
      subEgoQuota: { maxCalls: 1, overrides: { "ego.privilegiado": 3 } },
    });
    const ok = makeTool("fs_read", () => "ok");

    // Tope por defecto (1): el Sub-Ego no privilegiado agota su cuota.
    await manager.execute(ok, {}, ctx("ego.normal"), { callId: "n1" });
    const blockedNormal = await manager.execute(ok, {}, ctx("ego.normal"), { callId: "n2" });
    expect(blockedNormal.status).toBe("error");

    // Override (3): el Sub-Ego privilegiado tiene más presupuesto.
    for (let i = 0; i < 3; i++) {
      const res = await manager.execute(ok, {}, ctx("ego.privilegiado"), { callId: `p${i + 1}` });
      expect(res.status).toBe("success");
    }
    const blocked = await manager.execute(ok, {}, ctx("ego.privilegiado"), { callId: "p9" });
    expect(blocked.status).toBe("error");
    expect(SubEgoQuotaExceededError).toBeDefined();
  });

  it("(6) el veto de cuota NO consume slot de ejecución (falla rápido)", async () => {
    const manager = new ExecutionManager({ subEgoQuota: { maxCalls: 1 } });
    const ok = makeTool("fs_read", () => "ok");

    await manager.execute(ok, {}, ctx("ego.x"), { callId: "c1" });
    const t0 = Date.now();
    const blocked = await manager.execute(ok, {}, ctx("ego.x"), { callId: "c2" });
    expect(Date.now() - t0).toBeLessThan(50);
    expect(blocked.status).toBe("error");
    expect(manager.queuedCount).toBe(0);
  });
});
