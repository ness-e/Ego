import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { ToolRegistry } from "@ego/tools";
import { McpClient } from "../src/mcp/McpClient.js";

const mockServerPath = resolve(__dirname, "mock-mcp-server.cjs");

describe("@ego/integrations — McpClient & Nivel B Integration Suite (ACT-09 / COUC-10 / HERM-18)", () => {
  let client: McpClient | null = null;

  afterEach(async () => {
    if (client) {
      await client.disconnect();
      client = null;
    }
  });

  it("1. Conecta con el servidor MCP stdio y completa el handshake initialize", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath, // node
      args: [mockServerPath]
    });

    expect(client.getStatus()).toBe("disconnected");

    await client.connect();

    expect(client.getStatus()).toBe("connected");
    expect(client.getServerInfo()?.name).toBe("mock-github-mcp");
    expect(client.getServerInfo()?.version).toBe("1.0.0");
  });

  it("2. Descubre herramientas remotas mediante tools/list", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath]
    });

    await client.connect();
    const tools = await client.listTools();

    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["get_issue", "delete_repository"]);
    expect(tools[0].inputSchema.required).toEqual(["owner", "repo", "issue_number"]);
  });

  it("3. Importa herramientas dinámicamente en ToolRegistry con inferencia de riesgo y prefijo", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath],
      toolPrefix: "gh"
    });

    await client.connect();
    await client.listTools();

    const registry = new ToolRegistry();
    const count = client.importIntoRegistry(registry);

    expect(count).toBe(2);
    expect(registry.has("gh_get_issue")).toBe(true);
    expect(registry.has("gh_delete_repository")).toBe(true);

    const safeTool = registry.get("gh_get_issue")!;
    expect(safeTool.riskLevel).toBe("safe");
    expect(safeTool.category).toBe("mcp");
    expect(safeTool.origin).toBe("mcp");

    const destructiveTool = registry.get("gh_delete_repository")!;
    expect(destructiveTool.riskLevel).toBe("destructive");
  });

  it("4. Despacha ejecución directa sin turnos de modelo (HERM-18 / Kernel Execution)", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath]
    });

    await client.connect();
    await client.listTools();

    const registry = new ToolRegistry();
    client.importIntoRegistry(registry);

    const tool = registry.get("get_issue")!;
    const output = await tool.execute(
      { owner: "ness-e", repo: "Ego", issue_number: 42 },
      { callId: "c_1", sessionId: "s_1" }
    );

    expect(typeof output).toBe("string");
    const parsed = JSON.parse(output as string);
    expect(parsed.id).toBe(101);
    expect(parsed.title).toContain("ness-e/Ego");
  });

  it("5. Maneja fallos cuando el servidor MCP reporta isError: true", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath]
    });

    await client.connect();
    const registry = new ToolRegistry();
    await client.listTools();
    client.importIntoRegistry(registry);

    // Llamar a una herramienta inexistente directamente
    await expect(client.callTool("non_existent_tool", {})).resolves.toMatchObject({
      isError: true
    });
  });

  it("6. Soporta cancelación interactiva mediante AbortSignal", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath]
    });

    await client.connect();

    const controller = new AbortController();
    controller.abort(); // Cancelado inmediatamente

    await expect(
      client.callTool("get_issue", { owner: "a", repo: "b", issue_number: 1 }, controller.signal)
    ).rejects.toThrow(/AbortSignal/);
  });

  it("7. SafeConfigMutation y recarga atómica con rollback transaccional (COUC-10)", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath]
    });

    await client.connect();
    expect(client.getStatus()).toBe("connected");

    // Intento de recarga con comando inválido que fallará
    const badConfig = {
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio" as const,
      command: "non_existent_executable_12345",
      args: []
    };

    // La recarga debe fallar y ejecutar rollback a la configuración anterior
    await expect(client.reload(badConfig)).rejects.toThrow(/SafeConfigMutation rollback aplicado/);

    // Tras el rollback, el cliente debe mantenerse o restaurar la configuración original
    expect(client.getConfig().command).toBe(process.execPath);
  });

  it("8. Desconexión limpia y transición de estado a disconnected", async () => {
    client = new McpClient({
      id: "mock-gh",
      name: "Mock GitHub MCP",
      transport: "stdio",
      command: process.execPath,
      args: [mockServerPath]
    });

    await client.connect();
    expect(client.getStatus()).toBe("connected");

    await client.disconnect();
    expect(client.getStatus()).toBe("disconnected");

    // Intentar llamar una tool tras desconectar debe fallar inmediatamente
    await expect(client.listTools()).rejects.toThrow(/no está conectado/);
  });
});
