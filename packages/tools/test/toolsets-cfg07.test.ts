import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  ToolDefinition,
  cloneRegistryForProfile,
  filterToolsByToolsets,
  isToolEnabledByToolsets,
  resolveApprovalWithMcpOverride,
  resolveMcpToolDecision,
  buildToolsResetDoc,
  toolToolsets,
} from "../src/index.js";
// Paridad de contrato con el schema IPC (import relativo solo en test,
// sin acoplamiento runtime entre paquetes): valida que las reglas y
// toolsets que consume este módulo parsean en `schema.ts` (sección MCP).
import {
  McpToolApprovalsSchema,
  ProfileToolsetsSchema,
  McpToolsResetDocSchema,
} from "../../../apps/desktop/src/ipc/schema.js";

describe("@ego/tools — toolsets por perfil + approval por-tool MCP (CFG-07)", () => {
  const safeRead: ToolDefinition<{ path: string }, { content: string }> = {
    name: "fs_read_file",
    description: "Lee un archivo del workspace.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    tags: ["fs", "io", "read"],
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => ({ content: `mock:${path}` }),
  };

  const destructiveExec: ToolDefinition<{ command: string }, { exitCode: number }> = {
    name: "terminal_exec",
    description: "Ejecuta un comando en la shell.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    tags: ["cli", "exec", "os"],
    inputSchema: z.object({ command: z.string() }),
    execute: async () => ({ exitCode: 0 }),
  };

  const mcpScreenshot: ToolDefinition<{ url: string }, { ok: boolean }> = {
    name: "screenshot",
    description: "Captura la página vía Playwright.",
    category: "mcp",
    riskLevel: "safe",
    origin: "mcp",
    mcpServerId: "playwright",
    tags: ["browser"],
    inputSchema: z.object({ url: z.string() }),
    execute: async () => ({ ok: true }),
  };

  const buildRegistry = (): ToolRegistry =>
    new ToolRegistry([safeRead, destructiveExec, mcpScreenshot]);

  it("1. Tool bloqueada (deny por-tool) pide aprobación aunque sea safe", () => {
    const registry = buildRegistry();
    const base = registry.resolveApprovalRequirement("screenshot");
    expect(base).toBe(false);

    const decision = resolveMcpToolDecision(
      [{ serverId: "playwright", tool: "screenshot", decision: "deny" }],
      { serverId: "playwright", tool: "screenshot" }
    );
    expect(decision).toBe("deny");
    expect(resolveApprovalWithMcpOverride(base, decision)).toBe(true);
  });

  it("2. Approve explícito (allow) exime a tool que la base exigiría", () => {
    const registry = buildRegistry();
    const base = registry.resolveApprovalRequirement("terminal_exec");
    expect(base).toBe(true);

    // Las reglas MCP no gobiernan tools nativas (sin serverId): sin override.
    expect(
      resolveMcpToolDecision(
        [{ serverId: "playwright", tool: "terminal_exec", decision: "allow" }],
        { tool: "terminal_exec" }
      )
    ).toBeUndefined();
    expect(resolveApprovalWithMcpOverride(base, undefined)).toBe(true);

    // En cambio, una tool MCP sensitive con allow queda eximida.
    expect(resolveApprovalWithMcpOverride(true, "allow")).toBe(false);
    expect(resolveApprovalWithMcpOverride(false, "ask")).toBe(true);
  });

  it("3. Deny gana entre reglas y sin regla rige la base", () => {
    const rules = [
      { serverId: "playwright", tool: "screenshot", decision: "allow" as const },
      { serverId: "playwright", tool: "screenshot", decision: "deny" as const },
    ];
    expect(
      resolveMcpToolDecision(rules, { serverId: "playwright", tool: "screenshot" })
    ).toBe("deny");
    expect(
      resolveMcpToolDecision(rules, { serverId: "playwright", tool: "otra" })
    ).toBeUndefined();
    expect(
      resolveMcpToolDecision(rules, { serverId: "otro", tool: "screenshot" })
    ).toBeUndefined();
  });

  it("4. Toolsets: disabled veta (deny gana sobre enabled)", () => {
    const tool = mcpScreenshot;
    expect(toolToolsets(tool)).toContain("browser");
    expect(toolToolsets(destructiveExec)).toContain("terminal");
    expect(toolToolsets(safeRead)).toContain("file");

    expect(
      isToolEnabledByToolsets(tool, { enabled: ["browser"], disabled: ["browser"] })
    ).toBe(false);
    expect(
      isToolEnabledByToolsets(tool, { enabled: [], disabled: ["browser"] })
    ).toBe(false);
    expect(
      isToolEnabledByToolsets(tool, { enabled: ["browser"], disabled: [] })
    ).toBe(true);
  });

  it("5. Enabled no vacío = allowlist; vacío = sin restricción", () => {
    const tools = [safeRead, destructiveExec, mcpScreenshot];
    const allowFile = filterToolsByToolsets(tools, { enabled: ["file"], disabled: [] });
    expect(allowFile.map((t) => t.name)).toEqual(["fs_read_file"]);

    const noRestriction = filterToolsByToolsets(tools, { enabled: [], disabled: [] });
    expect(noRestriction).toHaveLength(3);
  });

  it("6. cloneRegistryForProfile aísla por perfil sin mutar el original", () => {
    const registry = buildRegistry();
    const clone = cloneRegistryForProfile(registry, { enabled: [], disabled: ["terminal"] });
    expect(clone.has("terminal_exec")).toBe(false);
    expect(clone.has("fs_read_file")).toBe(true);
    expect(clone.has("screenshot")).toBe(true);

    clone.unregister("screenshot");
    expect(clone.has("screenshot")).toBe(false);
    expect(registry.has("screenshot")).toBe(true);
    expect(registry.count()).toBe(3);
  });

  it("7. Reset doc tras cambio de tools preserva prompt caching", () => {
    const doc = buildToolsResetDoc({ version: 2, changedToolsets: ["browser", "terminal"] });
    expect(doc).toContain("v2");
    expect(doc).toContain("browser, terminal");
    expect(doc.toLowerCase()).toContain("prompt caching");
    expect(() => buildToolsResetDoc({ version: 0 })).toThrow(/entero positivo/);
  });

  it("8. Schemas IPC MCP (CFG-07) parsean reglas, toolsets y reset doc", () => {
    const approvals = McpToolApprovalsSchema.safeParse({
      rules: [{ serverId: "playwright", tool: "screenshot", decision: "deny" }],
    });
    expect(approvals.success).toBe(true);

    expect(
      McpToolApprovalsSchema.safeParse({
        rules: [{ serverId: "playwright", tool: "bad name!", decision: "deny" }],
      }).success
    ).toBe(false);

    const profile = ProfileToolsetsSchema.safeParse({
      profile: "planner",
      enabled: ["web", "file"],
      disabled: ["terminal"],
    });
    expect(profile.success).toBe(true);

    expect(
      ProfileToolsetsSchema.safeParse({ profile: "planner", enabled: ["nope"], disabled: [] })
        .success
    ).toBe(false);

    const reset = McpToolsResetDocSchema.safeParse({ version: 2, changedToolsets: ["browser"] });
    expect(reset.success).toBe(true);
    if (reset.success) expect(reset.data.preservePromptCaching).toBe(true);
  });
});
