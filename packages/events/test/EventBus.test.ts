import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/EventBus.js";
import { EventNormalizer } from "../src/EventNormalizer.js";
import { StructuredLogger } from "../src/StructuredLogger.js";

describe("@ego/events — EventBus & Logging Suite (ACT-05)", () => {
  it("1. Emite y recibe eventos tipados a través del bus", async () => {
    const bus = new EventBus();
    const received: any[] = [];

    bus.on("task.created", (event) => {
      received.push(event);
    });

    bus.emit("task.created", {
      taskId: "task_001",
      goal: "Indexar repositorio",
      priority: "P0",
    }, { source: "test_runtime" });

    // Esperar microtask
    await new Promise((r) => setTimeout(r, 20));

    expect(received).toHaveLength(1);
    expect(received[0].payload.taskId).toBe("task_001");
    expect(received[0].source).toBe("test_runtime");
    expect(received[0].id).toBeDefined();
    expect(received[0].timestamp).toBeGreaterThan(0);
  });

  it("2. Permite desuscribirse con el callback retornado", async () => {
    const bus = new EventBus();
    let count = 0;

    const sub = bus.on("tool.started", () => {
      count++;
    });

    bus.emit("tool.started", {
      callId: "call_1",
      toolName: "fs_read_file",
      input: { path: "foo.txt" },
    }, { source: "agent" });

    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);

    sub.unsubscribe();

    bus.emit("tool.started", {
      callId: "call_2",
      toolName: "fs_read_file",
      input: { path: "bar.txt" },
    }, { source: "agent" });

    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1); // No incrementó
  });

  it("3. Soporta suscripciones de un solo disparo con once()", async () => {
    const bus = new EventBus();
    let count = 0;

    bus.once("subego.invoked", () => {
      count++;
    });

    bus.emit("subego.invoked", {
      subEgoId: "sub_dev",
      role: "developer",
      input: "Fix bug",
    }, { source: "router" });

    bus.emit("subego.invoked", {
      subEgoId: "sub_dev",
      role: "developer",
      input: "Write test",
    }, { source: "router" });

    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
  });

  it("4. Soporta patrones wildcard (ej. 'tool.*')", async () => {
    const bus = new EventBus();
    const toolEvents: string[] = [];

    bus.on("tool.*", (event) => {
      toolEvents.push(event.type);
    });

    bus.emit("tool.started", { callId: "c1", toolName: "git_diff", input: {} }, { source: "cli" });
    bus.emit("tool.executed", { callId: "c1", toolName: "git_diff", durationMs: 40, result: "diff" }, { source: "cli" });
    bus.emit("task.started", { taskId: "t1", startedAt: Date.now() }, { source: "task_mgr" });

    await new Promise((r) => setTimeout(r, 20));
    expect(toolEvents).toEqual(["tool.started", "tool.executed"]);
  });

  it("5. Espera un evento asíncrono con waitFor() y timeout", async () => {
    const bus = new EventBus();

    setTimeout(() => {
      bus.emit("approval.resolved", {
        approvalId: "appr_99",
        approved: true,
        resolvedBy: "user",
      }, { source: "ui" });
    }, 30);

    const event = await bus.waitFor("approval.resolved", (e) => e.payload.approvalId === "appr_99", 1000);
    expect(event.payload.approved).toBe(true);

    // Debe rechazar por timeout si el evento no llega
    await expect(bus.waitFor("system.alert", undefined, 50)).rejects.toThrow("Timeout");
  });

  it("6. Normaliza eventos en el borde con EventNormalizer (COUC-01)", () => {
    expect(EventNormalizer.canNormalize("PreToolUse")).toBe(true);
    expect(EventNormalizer.normalizeType("PreToolUse")).toBe("tool.started");
    expect(EventNormalizer.normalizeType("PermissionRequest")).toBe("approval.required");

    const normalizedPayload = EventNormalizer.normalizePayload("PreToolUse", {
      tool: "fs_write_file",
      arguments: { path: "src/main.ts", content: "hello" },
    });

    expect(normalizedPayload.toolName).toBe("fs_write_file");
    expect(normalizedPayload.input).toEqual({ path: "src/main.ts", content: "hello" });
  });

  it("7. StructuredLogger enmascara secretos y API keys en los logs (Zero Secrets)", () => {
    const logs: string[] = [];
    const logger = new StructuredLogger({
      outputStream: (line) => logs.push(line),
      minSeverity: "info",
    });

    const bus = new EventBus();
    logger.attachToEventBus(bus);

    bus.emit("tool.started", {
      callId: "c1",
      toolName: "external_api",
      input: {
        token: "sk-proj-1234567890abcdef1234567890",
        auth: "Bearer secret_bearer_token_value_xyz123456",
        safeParam: "production_cluster",
      },
    }, { source: "runtime" });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(logs).toHaveLength(1);
        const logged = logs[0];
        expect(logged).toContain("[REDACTED_SECRET]");
        expect(logged).not.toContain("sk-proj-1234567890");
        expect(logged).toContain("production_cluster");
        resolve();
      }, 20);
    });
  });
});
