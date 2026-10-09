import { describe, it, expect, beforeEach } from "vitest";
import { EventBus, StructuredLogger, EgoEvent } from "@ego/events";

describe("@ego/desktop — EventBus & Telemetry Integration Suite (ACT-12)", () => {
  let eventBus: EventBus;
  let loggerOutput: string[];
  let structuredLogger: StructuredLogger;

  beforeEach(() => {
    eventBus = new EventBus({ maxHistorySize: 50 });
    loggerOutput = [];
    structuredLogger = new StructuredLogger({
      minSeverity: "info",
      outputStream: (line) => loggerOutput.push(line),
    });
    structuredLogger.attachToEventBus(eventBus);
  });

  it("1. Registra y propaga eventos de ciclo de vida de tareas y herramientas", async () => {
    const receivedEvents: EgoEvent[] = [];
    eventBus.on("task.started", (ev) => {
      receivedEvents.push(ev);
    });
    eventBus.on("tool.started", (ev) => {
      receivedEvents.push(ev);
    });

    eventBus.emit(
      "task.started",
      { taskId: "turn_12345", startedAt: Date.now() },
      { source: "desktop.ipc.llm.stream", sessionId: "sess_desktop_01", traceId: "turn_12345" }
    );

    eventBus.emit(
      "tool.started",
      { callId: "call_abc", toolName: "fs_read_file", input: { path: "test.txt" } },
      { source: "runtime.tool_loop", sessionId: "sess_desktop_01", traceId: "turn_12345" }
    );

    // Permitir despacho asíncrono
    await new Promise((r) => setTimeout(r, 15));

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[0].type).toBe("task.started");
    expect((receivedEvents[0].payload as any).taskId).toBe("turn_12345");
    expect(receivedEvents[1].type).toBe("tool.started");
    expect((receivedEvents[1].payload as any).toolName).toBe("fs_read_file");
  });

  it("2. StructuredLogger captura eventos y redacta secretos sensibles (sk-*, bearer tokens)", async () => {
    eventBus.emit(
      "tool.executed",
      {
        callId: "call_secret",
        toolName: "api_fetch",
        durationMs: 120,
        result: {
          apiKey: "sk-abcdef1234567890abcdef1234567890",
          status: 200,
          token: "bearer secret_bearer_token_123456789",
        },
      },
      { source: "runtime.tool_loop", sessionId: "sess_secure", traceId: "turn_sec" }
    );

    await new Promise((r) => setTimeout(r, 15));

    expect(loggerOutput.length).toBe(1);
    const logLine = loggerOutput[0];
    expect(logLine).toContain("[REDACTED_SECRET]");
    expect(logLine).not.toContain("sk-abcdef1234567890abcdef1234567890");
    expect(logLine).not.toContain("secret_bearer_token_123456789");
  });

  it("3. Soporta suscripción de retransmisión generalizada tipo onAny para IPC bridge", async () => {
    const ipcMockChannel: unknown[] = [];
    const sub = eventBus.onAny((event) => {
      ipcMockChannel.push(event);
    });

    eventBus.emit(
      "approval.required",
      {
        approvalId: "appr_test_01",
        action: "terminal_exec",
        riskLevel: "destructive",
        details: { command: "rm -rf /" },
        timeoutMs: 60000,
      },
      { source: "runtime.tool_loop", sessionId: "sess_ipc", traceId: "turn_ipc", severity: "warn" }
    );

    await new Promise((r) => setTimeout(r, 15));

    expect(ipcMockChannel.length).toBe(1);
    const event = ipcMockChannel[0] as EgoEvent;
    expect(event.type).toBe("approval.required");
    expect(event.severity).toBe("warn");

    sub.unsubscribe();
    eventBus.emit(
      "approval.resolved",
      { approvalId: "appr_test_01", approved: false, resolvedBy: "user" },
      { source: "runtime.tool_loop", sessionId: "sess_ipc", traceId: "turn_ipc" }
    );

    await new Promise((r) => setTimeout(r, 15));

    // Tras unsubscribe, no debe haber nuevos eventos en el canal
    expect(ipcMockChannel.length).toBe(1);
  });
});
