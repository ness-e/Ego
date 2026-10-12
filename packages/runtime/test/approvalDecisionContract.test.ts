import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@ego/models";
import { ToolRegistry, type ToolDefinition, type ToolExecutionContext } from "@ego/tools";
import type { ApprovalDecision as ExecutionApprovalDecision } from "@ego/execution";
import { ToolExecutionLoop } from "../src/index.js";
import type { ApprovalDecision as RuntimeApprovalDecision } from "../src/types.js";

describe("@ego/runtime — ApprovalDecision fuente única (F3T6/M01)", () => {
  let router: ModelRouter;
  let registry: ToolRegistry;
  let loop: ToolExecutionLoop;
  let receivedArgs: Record<string, unknown> | null;

  const mockContext: ToolExecutionContext = {
    callId: "call_approval_contract",
    sessionId: "sess_ego_m01",
    workspacePath: "/workspace/ego"
  };

  const echoTool: ToolDefinition<{ text: string }, { echo: string }> = {
    name: "echo_tool",
    description: "Herramienta sensible que devuelve su entrada.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    requiresApproval: true,
    inputSchema: z.object({
      text: z.string().min(1)
    }),
    execute: async (args) => {
      receivedArgs = { ...(args as Record<string, unknown>) };
      return { echo: (args as { text: string }).text };
    }
  };

  beforeEach(() => {
    receivedArgs = null;
    router = new ModelRouter();
    registry = new ToolRegistry();
    registry.register(echoTool);
    loop = new ToolExecutionLoop(router, registry);
  });

  it("acepta una decisión enriquecida de @ego/execution y aplica modifiedArguments", async () => {
    const enriched: ExecutionApprovalDecision = {
      approved: true,
      reason: "Aprobado por gobernador de prueba",
      modifiedArguments: { text: "hola-modificado" },
      resolvedBy: "test-governor",
      timestamp: Date.now()
    };
    const asRuntimeDecision: RuntimeApprovalDecision = enriched;

    let handlerCalled = false;
    const result = await loop.run({
      messages: [
        { role: "user", content: 'SIMULATE_TOOL:echo_tool:{"text":"original"}' }
      ],
      context: mockContext,
      approvalHandler: async (req) => {
        handlerCalled = true;
        expect(req.toolName).toBe("echo_tool");
        return asRuntimeDecision;
      }
    });

    expect(handlerCalled).toBe(true);
    expect(result.status).toBe("completed");
    expect(receivedArgs).toEqual({ text: "hola-modificado" });
  });
});
