import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@ego/models";
import { ToolRegistry, ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { EventBus, EgoEvent } from "@ego/events";
import { ToolExecutionLoop } from "../src/index.js";

describe("@ego/runtime — gates de gobernanza STAB-12 (allowlist + hooks)", () => {
  let router: ModelRouter;
  let registry: ToolRegistry;
  let eventBus: EventBus;
  let captured: EgoEvent[];

  const mockContext: ToolExecutionContext = {
    callId: "call_gov_test",
    sessionId: "sess_gov_001",
    workspacePath: "/workspace/ego",
  };

  const mcpTool: ToolDefinition<{ q: string }, { hits: string[] }> = {
    name: "evil_search",
    description: "Tool MCP no allowlisted.",
    category: "mcp",
    riskLevel: "safe",
    origin: "mcp",
    mcpServerId: "evil-server",
    inputSchema: z.object({ q: z.string() }),
    execute: async () => ({ hits: ["x"] }),
  };

  const safeTool: ToolDefinition<{ path: string }, { content: string }> = {
    name: "fs_read_file",
    description: "Lectura.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ path: z.string().min(1) }),
    execute: async ({ path }) => ({ content: `C:${path}` }),
  };

  beforeEach(() => {
    router = new ModelRouter();
    registry = new ToolRegistry();
    registry.registerMany([mcpTool, safeTool]);
    eventBus = new EventBus();
    captured = [];
    eventBus.onAny((ev) => {
      captured.push(ev);
    });
  });

  const flush = () => new Promise((r) => setTimeout(r, 10));

  it("1. permissionCheck deny veta MCP fuera de allowlist (mcp_not_allowlisted)", async () => {
    const loop = new ToolExecutionLoop(router, registry, {
      eventBus,
      governance: {
        permissionCheck: (input) =>
          input.mcpServerId !== "github"
            ? { decision: "deny", rule: "mcp_not_allowlisted", reason: "fuera de allowlist" }
            : { decision: "allow", rule: "default_allow", reason: "ok" },
      },
    });
    const result = await loop.run({
      messages: [{ role: "user", content: 'SIMULATE_TOOL:evil_search:{"q":"hola"}' }],
      context: mockContext,
    });
    expect(result.status).toBe("completed");
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(JSON.stringify(toolMsg?.content)).toContain("rejected");
    await flush();
    const decided = captured.find((e) => e.type === "hook.decided");
    expect((decided?.payload as { reason: string }).reason).toBe("denied:mcp_not_allowlisted");
  });

  it("2. preToolUse bloqueado veta con hook.decided warn", async () => {
    const loop = new ToolExecutionLoop(router, registry, {
      eventBus,
      governance: {
        preToolUse: () => ({ allow: false, reason: "blocked-by-hook:gate", matchedHookId: "gate" }),
      },
    });
    const result = await loop.run({
      messages: [{ role: "user", content: 'SIMULATE_TOOL:fs_read_file:{"path":"a.txt"}' }],
      context: mockContext,
    });
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(JSON.stringify(toolMsg?.content)).toContain("interceptada");
    await flush();
    const decided = captured.filter((e) => e.type === "hook.decided");
    expect(decided.length).toBe(1);
    expect((decided[0].payload as { phase: string }).phase).toBe("PreToolUse");
  });

  it("3. postToolUse observa sin bloquear + emite hook.decided", async () => {
    const loop = new ToolExecutionLoop(router, registry, {
      eventBus,
      governance: {
        postToolUse: () => ({ allow: true, reason: "observed-by-hook:obs", matchedHookId: "obs" }),
      },
    });
    const result = await loop.run({
      messages: [{ role: "user", content: 'SIMULATE_TOOL:fs_read_file:{"path":"b.txt"}' }],
      context: mockContext,
    });
    expect(result.status).toBe("completed");
    await flush();
    const decided = captured.filter((e) => e.type === "hook.decided");
    expect(decided.length).toBe(1);
    expect((decided[0].payload as { phase: string }).phase).toBe("PostToolUse");
  });

  it("4. sin governance no hay hook.decided (compat total)", async () => {
    const loop = new ToolExecutionLoop(router, registry, { eventBus });
    const result = await loop.run({
      messages: [{ role: "user", content: 'SIMULATE_TOOL:fs_read_file:{"path":"c.txt"}' }],
      context: mockContext,
    });
    expect(result.status).toBe("completed");
    await flush();
    expect(captured.some((e) => e.type === "hook.decided")).toBe(false);
  });
});
