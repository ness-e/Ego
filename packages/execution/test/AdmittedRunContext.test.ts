import { describe, it, expect } from "vitest";
import {
  createAdmittedRunContext,
  validateAdmittedRunContext,
} from "../src/AdmittedRunContext.js";
import { ExecutionManager } from "../src/ExecutionManager.js";
import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { z } from "zod";

describe("AdmittedRunContext Suite (OCLW-01)", () => {
  it("debe crear un contexto inmutable con token criptográfico válido", () => {
    const ctx = createAdmittedRunContext({
      admissionSource: "user-chat",
      priority: 1,
      metadata: { subEgo: "planner" },
    });

    expect(ctx.operationalRunInstance.instanceId).toBeDefined();
    expect(ctx.operationalRunInstance.runId).toBeDefined();
    expect(ctx.admissionSource).toBe("user-chat");
    expect(ctx.executionIdentityToken.startsWith("eit_")).toBe(true);
    expect(ctx.priority).toBe(1);
    expect(validateAdmittedRunContext(ctx)).toBe(true);
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.operationalRunInstance)).toBe(true);
  });

  it("debe propagar admittedRunContext a través de los eventos de ExecutionManager", async () => {
    const events: any[] = [];
    const manager = new ExecutionManager({
      onEvent: (e) => events.push(e),
    });

    const tool: ToolDefinition<{ echo: string }, { result: string }> = {
      name: "echo_tool",
      description: "Echo test",
      category: "system",
      riskLevel: "safe",
      origin: "native",
      inputSchema: z.object({ echo: z.string() }),
      execute: async (input) => ({ result: input.echo }),
    };

    const admitted = createAdmittedRunContext({
      admissionSource: "sub-ego",
    });

    const execContext: ToolExecutionContext = {
      callId: "call-123",
      sessionId: "session-abc",
    };

    const res = await manager.execute(tool, { echo: "hola" }, execContext, {
      admittedRunContext: admitted,
    });

    expect(res.status).toBe("success");
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].admittedRunContext).toBe(admitted);
    expect(events[1].admittedRunContext).toBe(admitted);
  });
});
