import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { ExecutionManager, ExecutionEvent } from "../src/index.js";

describe("@ego/execution — ExecutionManager (ACT-03)", () => {
  let manager: ExecutionManager;
  const events: ExecutionEvent[] = [];

  const mockContext = (callId = "call_test_001"): ToolExecutionContext => ({
    callId,
    sessionId: "sess_test",
    workspacePath: "/workspace/ego"
  });

  const simpleTool: ToolDefinition<{ input: string }, { result: string }> = {
    name: "simple_echo",
    description: "Eco simple",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ input: z.string() }),
    execute: async ({ input }) => ({ result: `ECHO: ${input}` })
  };

  const slowTool: ToolDefinition<{ sleepMs: number }, { done: boolean }> = {
    name: "slow_tool",
    description: "Herramienta lenta con retardo",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ sleepMs: z.number() }),
    execute: async ({ sleepMs }, ctx) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ done: true }), sleepMs);
        ctx.abortSignal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Abortado durante el retardo"));
        });
      });
    }
  };

  const hugeOutputTool: ToolDefinition<{ size: number }, string> = {
    name: "huge_output",
    description: "Genera texto masivo",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ size: z.number() }),
    execute: async ({ size }) => "A".repeat(size)
  };

  const failingTool: ToolDefinition<{}, never> = {
    name: "crash_tool",
    description: "Fallo intencionado",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({}),
    execute: async () => {
      throw new Error("Fallo forzado en herramienta");
    }
  };

  beforeEach(() => {
    events.length = 0;
    manager = new ExecutionManager({
      defaultTimeoutMs: 1000,
      maxConcurrentExecutions: 2,
      onEvent: (e) => events.push(e)
    });
  });

  it("1. Ejecuta herramienta exitosamente y emite telemetría de eventos", async () => {
    const res = await manager.execute(simpleTool, { input: "hola" }, mockContext("call_01"));

    expect(res.status).toBe("success");
    expect(res.output).toEqual({ result: "ECHO: hola" });
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.truncated).toBe(false);

    expect(events.some((e) => e.type === "started" && e.callId === "call_01")).toBe(true);
    expect(events.some((e) => e.type === "completed" && e.callId === "call_01")).toBe(true);
  });

  it("2. Interrumpe ejecución por timeout cuando la herramienta excede el tiempo límite", async () => {
    const res = await manager.execute(
      slowTool,
      { sleepMs: 500 },
      mockContext("call_timeout"),
      { timeoutMs: 50 } // Timeout forzado a 50ms
    );

    expect(res.status).toBe("timeout");
    expect(res.error).toContain("Timeout de 50ms excedido");
    expect(events.some((e) => e.type === "timeout" && e.callId === "call_timeout")).toBe(true);
  });

  it("3. Cancela cooperativamente mediante AbortSignal externo", async () => {
    const controller = new AbortController();

    const promise = manager.execute(
      slowTool,
      { sleepMs: 500 },
      mockContext("call_abort"),
      { abortSignal: controller.signal }
    );

    // Cancelar a los 30ms
    setTimeout(() => controller.abort("Cancelación de usuario"), 30);

    const res = await promise;
    expect(res.status).toBe("aborted");
    expect(res.error).toContain("Cancelación de usuario");
    expect(events.some((e) => e.type === "aborted" && e.callId === "call_abort")).toBe(true);
  });

  it("4. Cancela puntualmente una ejecución activa mediante abortExecution()", async () => {
    const promise = manager.execute(
      slowTool,
      { sleepMs: 1000 },
      mockContext("call_to_kill")
    );

    // Esperar a que esté activa
    await new Promise((r) => setTimeout(r, 20));
    expect(manager.getActiveExecutions().some((e) => e.callId === "call_to_kill")).toBe(true);

    const aborted = manager.abortExecution("call_to_kill", "Terminado por el supervisor");
    expect(aborted).toBe(true);

    const res = await promise;
    expect(res.status).toBe("aborted");
    expect(res.error).toContain("Terminado por el supervisor");
  });

  it("5. Cancela todas las ejecuciones activas masivamente con abortAll()", async () => {
    const p1 = manager.execute(slowTool, { sleepMs: 1000 }, mockContext("call_mass_1"));
    const p2 = manager.execute(slowTool, { sleepMs: 1000 }, mockContext("call_mass_2"));

    await new Promise((r) => setTimeout(r, 20));
    expect(manager.runningCount).toBe(2);

    manager.abortAll("Parada de emergencia");

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe("aborted");
    expect(r2.status).toBe("aborted");
    expect(manager.runningCount).toBe(0);
  });

  it("6. Gobierna concurrencia máxima encolando tareas excedentes", async () => {
    // maxConcurrent = 2. Lanzamos 4 llamadas de 50ms cada una
    const p1 = manager.execute(slowTool, { sleepMs: 60 }, mockContext("p1"));
    const p2 = manager.execute(slowTool, { sleepMs: 60 }, mockContext("p2"));
    const p3 = manager.execute(slowTool, { sleepMs: 30 }, mockContext("p3"));
    const p4 = manager.execute(slowTool, { sleepMs: 30 }, mockContext("p4"));

    expect(manager.runningCount).toBe(2);
    expect(manager.queuedCount).toBe(2);

    const results = await Promise.all([p1, p2, p3, p4]);
    expect(results.every((r) => r.status === "success")).toBe(true);
    expect(manager.runningCount).toBe(0);
    expect(manager.queuedCount).toBe(0);
  });

  it("7. Trunca salidas que exceden la cuota de memoria configurada", async () => {
    // Cuota de 500 bytes
    const res = await manager.execute(
      hugeOutputTool,
      { size: 2000 },
      mockContext("call_huge"),
      { maxOutputSizeBytes: 500 }
    );

    expect(res.status).toBe("success");
    expect(res.truncated).toBe(true);
    expect(typeof res.output).toBe("string");
    expect(res.output).toContain("Truncado por ExecutionManager");
  });

  it("8. Aísla excepciones y fallos de herramientas sin desestabilizar el runtime", async () => {
    const res = await manager.execute(failingTool, {}, mockContext("call_fail"));

    expect(res.status).toBe("error");
    expect(res.error).toBe("Fallo forzado en herramienta");
    expect(events.some((e) => e.type === "failed" && e.callId === "call_fail")).toBe(true);
  });
});
