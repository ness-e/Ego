import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@ego/models";
import { ToolRegistry, ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { ApprovalEngine } from "@ego/execution";
import { EventBus, EgoEvent } from "@ego/events";
import { ToolExecutionLoop } from "../src/index.js";

describe("@ego/runtime — ToolExecutionLoop EventBus Telemetry (ACT-12)", () => {
  let router: ModelRouter;
  let registry: ToolRegistry;
  let eventBus: EventBus;
  let capturedEvents: EgoEvent[];

  const mockContext: ToolExecutionContext = {
    callId: "call_events_test",
    sessionId: "sess_telemetry_001",
    workspacePath: "/workspace/ego"
  };

  const sampleSafeTool: ToolDefinition<{ path: string }, { content: string }> = {
    name: "fs_read_file",
    description: "Lee un archivo del workspace.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({
      path: z.string().min(1)
    }),
    execute: async ({ path }) => {
      return { content: `CONTENIDO_DE_${path}` };
    }
  };

  const sampleDestructiveTool: ToolDefinition<{ command: string }, { exitCode: number }> = {
    name: "terminal_exec",
    description: "Ejecuta un comando sensible en terminal.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    requiresApproval: true,
    inputSchema: z.object({
      command: z.string()
    }),
    execute: async () => {
      return { exitCode: 0 };
    }
  };

  const sampleFailingTool: ToolDefinition<{ flag: boolean }, { ok: boolean }> = {
    name: "failing_tool",
    description: "Herramienta que arroja un error forzado.",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({
      flag: z.boolean()
    }),
    execute: async () => {
      throw new Error("Fallo forzado de ejecución");
    }
  };

  beforeEach(() => {
    router = new ModelRouter();
    registry = new ToolRegistry();
    registry.registerMany([sampleSafeTool, sampleDestructiveTool, sampleFailingTool]);
    eventBus = new EventBus({ maxHistorySize: 100 });
    capturedEvents = [];
    eventBus.onAny((ev) => {
      capturedEvents.push(ev);
    });
  });

  it("1. Emite tool.started, tool.executed y task.completed en ejecución exitosa", async () => {
    const loop = new ToolExecutionLoop(router, registry, { eventBus });

    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:fs_read_file:{"path":"config.json"}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");

    // Pequeño retardo para procesar cola de microtareas del EventBus
    await new Promise((r) => setTimeout(r, 10));

    const eventTypes = capturedEvents.map((e) => e.type);
    expect(eventTypes).toContain("tool.started");
    expect(eventTypes).toContain("tool.executed");
    expect(eventTypes).toContain("task.completed");

    const startedEvent = capturedEvents.find((e) => e.type === "tool.started")!;
    expect(startedEvent.source).toBe("runtime.tool_loop");
    expect(startedEvent.sessionId).toBe(mockContext.sessionId);
    expect((startedEvent.payload as any).toolName).toBe("fs_read_file");
    expect((startedEvent.payload as any).input).toEqual({ path: "config.json" });

    const executedEvent = capturedEvents.find((e) => e.type === "tool.executed")!;
    expect(executedEvent.source).toBe("runtime.tool_loop");
    expect((executedEvent.payload as any).toolName).toBe("fs_read_file");
    expect((executedEvent.payload as any).result).toEqual({ content: "CONTENIDO_DE_config.json" });
    expect((executedEvent.payload as any).durationMs).toBeGreaterThanOrEqual(0);

    const completedEvent = capturedEvents.find((e) => e.type === "task.completed")!;
    expect(completedEvent.source).toBe("runtime.tool_loop");
    expect((completedEvent.payload as any).taskId).toBe(mockContext.sessionId);
    expect((completedEvent.payload as any).durationMs).toBeGreaterThanOrEqual(0);
  });

  it("2. Emite approval.required y approval.resolved con ApprovalEngine en acción destructiva", async () => {
    const approvalEngine = new ApprovalEngine({ mode: "standard" });
    const loop = new ToolExecutionLoop(router, registry, { eventBus, approvalEngine });

    // Auto-aprobar cuando el motor lo requiera
    approvalEngine["config"].onApprovalRequested = (pending) => {
      setTimeout(() => {
        approvalEngine.resolveApproval(pending.approvalId, {
          approved: true,
          resolvedBy: "user",
          reason: "Autorizado por prueba"
        });
      }, 5);
    };

    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:terminal_exec:{"command":"cargo test"}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");

    await new Promise((r) => setTimeout(r, 20));

    const eventTypes = capturedEvents.map((e) => e.type);
    expect(eventTypes).toContain("tool.started");
    expect(eventTypes).toContain("approval.required");
    expect(eventTypes).toContain("approval.resolved");
    expect(eventTypes).toContain("tool.executed");
    expect(eventTypes).toContain("task.completed");

    const approvalReqEvent = capturedEvents.find((e) => e.type === "approval.required")!;
    expect(approvalReqEvent.severity).toBe("warn");
    expect((approvalReqEvent.payload as any).action).toBe("terminal_exec");
    expect((approvalReqEvent.payload as any).riskLevel).toBe("destructive");

    const approvalResEvent = capturedEvents.find((e) => e.type === "approval.resolved")!;
    expect((approvalResEvent.payload as any).approved).toBe(true);
    expect((approvalResEvent.payload as any).resolvedBy).toBe("user");
  });

  it("3. Emite tool.failed cuando la herramienta lanza una excepción", async () => {
    const loop = new ToolExecutionLoop(router, registry, { eventBus });

    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:failing_tool:{"flag":true}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");

    await new Promise((r) => setTimeout(r, 10));

    const eventTypes = capturedEvents.map((e) => e.type);
    expect(eventTypes).toContain("tool.started");
    expect(eventTypes).toContain("tool.failed");

    const failedEvent = capturedEvents.find((e) => e.type === "tool.failed")!;
    expect(failedEvent.severity).toBe("error");
    expect((failedEvent.payload as any).toolName).toBe("failing_tool");
    expect((failedEvent.payload as any).error).toContain("Fallo forzado");
  });

  it("4. Emite tool.failed cuando la herramienta no existe en el registro", async () => {
    const loop = new ToolExecutionLoop(router, registry, { eventBus });

    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:non_existent_tool:{"arg":"val"}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");

    await new Promise((r) => setTimeout(r, 10));

    const failedEvent = capturedEvents.find((e) => e.type === "tool.failed")!;
    expect(failedEvent).toBeDefined();
    expect((failedEvent.payload as any).toolName).toBe("non_existent_tool");
    expect((failedEvent.payload as any).error).toContain("no encontrada");
  });

  it("5. Emite task.failed cuando la ejecución es cancelada con AbortSignal", async () => {
    const loop = new ToolExecutionLoop(router, registry, { eventBus });
    const controller = new AbortController();
    controller.abort(); // Cancelado inmediatamente

    const result = await loop.run({
      messages: [{ role: "user", content: "Ejecutar algo largo" }],
      context: mockContext,
      abortSignal: controller.signal
    });

    expect(result.status).toBe("aborted");

    await new Promise((r) => setTimeout(r, 10));

    const failedEvent = capturedEvents.find((e) => e.type === "task.failed")!;
    expect(failedEvent).toBeDefined();
    expect(failedEvent.severity).toBe("warn");
    expect((failedEvent.payload as any).code).toBe("ABORTED");
  });

  it("6. Permite inyección de EventBus dinámico a nivel de LoopRunOptions", async () => {
    const loop = new ToolExecutionLoop(router, registry); // Sin eventBus global
    const localEventBus = new EventBus();
    const localCaptured: EgoEvent[] = [];
    localEventBus.onAny((ev) => localCaptured.push(ev));

    const result = await loop.run({
      messages: [{ role: "user", content: "Respuesta inmediata" }],
      context: mockContext,
      eventBus: localEventBus
    });

    expect(result.status).toBe("completed");

    await new Promise((r) => setTimeout(r, 10));

    expect(localCaptured.length).toBeGreaterThan(0);
    expect(localCaptured[0].type).toBe("task.completed");
    expect(capturedEvents.length).toBe(0); // El global no recibió nada
  });
});
