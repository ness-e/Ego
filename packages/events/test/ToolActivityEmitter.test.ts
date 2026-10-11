import { describe, it, expect } from "vitest";
import { EventBus } from "../src/EventBus.js";
import { ToolActivityEmitter } from "../src/ToolActivityEmitter.js";

describe("ToolActivityEmitter Suite (OCLW-14)", () => {
  it("debe emitir eventos estructurados de telemetría de herramientas en EventBus", async () => {
    const bus = new EventBus();
    const emitter = new ToolActivityEmitter(bus, "RuntimeSupervisor");

    const events: any[] = [];
    bus.on("tool.started", (e) => events.push(e));
    bus.on("tool.progress", (e) => events.push(e));
    bus.on("tool.executed", (e) => events.push(e));
    bus.on("tool.patch_summary", (e) => events.push(e));

    emitter.emitStart({
      callId: "call-1",
      toolName: "git_diff",
      input: { path: "src" },
      riskLevel: "safe",
    });

    emitter.emitProgress({
      callId: "call-1",
      toolName: "git_diff",
      deltaOutput: "+ console.log('test');",
      percent: 50,
      status: "running",
    });

    emitter.emitCompleted({
      callId: "call-1",
      toolName: "git_diff",
      result: "diff output complete",
      durationMs: 45,
    });

    emitter.emitPatchSummary({
      callId: "call-1",
      toolName: "git_diff",
      added: ["file1.ts"],
      modified: ["file2.ts"],
      deleted: [],
      summary: "1 added, 1 modified",
    });

    // Esperar microtasks asíncronos del EventBus
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(events).toHaveLength(4);
    expect(events[0].type).toBe("tool.started");
    expect(events[0].payload.toolName).toBe("git_diff");
    expect(events[1].type).toBe("tool.progress");
    expect(events[1].payload.percent).toBe(50);
    expect(events[2].type).toBe("tool.executed");
    expect(events[2].payload.durationMs).toBe(45);
    expect(events[3].type).toBe("tool.patch_summary");
    expect(events[3].payload.added).toEqual(["file1.ts"]);
  });
});
