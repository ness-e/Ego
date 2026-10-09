import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { ToolRegistry } from "@ego/tools";
import { McpManager } from "../src/mcp/McpManager.js";
import type { McpServerConfig } from "../src/mcp/types.js";

const MOCK_SERVER_SCRIPT = resolve(__dirname, "mock-mcp-server.cjs");

describe("McpManager (Orquestación multicliente MCP y SafeConfigMutation - COUC-10)", () => {
  let registry: ToolRegistry;
  let manager: McpManager;

  const validConfig: McpServerConfig = {
    id: "test-mock-server",
    name: "Mock Server de Pruebas",
    transport: "stdio",
    command: process.execPath,
    args: [MOCK_SERVER_SCRIPT],
    toolPrefix: "mock",
    timeoutMs: 3000,
  };

  beforeEach(() => {
    registry = new ToolRegistry();
    manager = new McpManager(registry);
  });

  afterEach(async () => {
    await manager.dispose();
  });

  it("debe registrar un servidor deshabilitado sin iniciar subproceso", async () => {
    const state = await manager.registerServer(validConfig, false);

    expect(state.id).toBe("test-mock-server");
    expect(state.enabled).toBe(false);
    expect(state.status).toBe("disconnected");
    expect(state.toolsCount).toBe(0);
    expect(registry.count()).toBe(0);
  });

  it("debe conectar un servidor e importar dinámicamente sus herramientas en ToolRegistry", async () => {
    const state = await manager.registerServer(validConfig, true);

    expect(state.status).toBe("connected");
    expect(state.enabled).toBe(true);
    expect(state.toolsCount).toBe(2); // get_issue, delete_repository
    expect(state.lastError).toBeUndefined();

    // Verificamos que el ToolRegistry contiene las herramientas prefijadas
    expect(registry.has("mock_get_issue")).toBe(true);
    expect(registry.has("mock_delete_repository")).toBe(true);

    const tools = manager.listTools({ serverId: "test-mock-server" });
    expect(tools.length).toBe(2);
  });

  it("debe desconectar el servidor y retirar sus herramientas del ToolRegistry", async () => {
    await manager.registerServer(validConfig, true);
    expect(registry.has("mock_get_issue")).toBe(true);

    const disconnectedState = await manager.disconnectServer(validConfig.id);
    expect(disconnectedState.status).toBe("disconnected");
    expect(disconnectedState.enabled).toBe(false);

    // Las herramientas deben haber sido retiradas
    expect(registry.has("mock_get_issue")).toBe(false);
    expect(registry.has("mock_delete_repository")).toBe(false);
  });

  it("debe conmutar en caliente (toggle on/off) preservando la integridad del registro", async () => {
    await manager.registerServer(validConfig, false);
    expect(registry.has("mock_get_issue")).toBe(false);

    // 1. Activar en caliente
    const onState = await manager.toggleServer(validConfig.id, true);
    expect(onState.status).toBe("connected");
    expect(registry.has("mock_get_issue")).toBe(true);

    // 2. Desactivar en caliente
    const offState = await manager.toggleServer(validConfig.id, false);
    expect(offState.status).toBe("disconnected");
    expect(registry.has("mock_get_issue")).toBe(false);
  });

  it("debe eliminar completamente un servidor con removeServer", async () => {
    await manager.registerServer(validConfig, true);
    expect(manager.listServers()).toHaveLength(1);

    const removed = await manager.removeServer(validConfig.id);
    expect(removed).toBe(true);
    expect(manager.listServers()).toHaveLength(0);
    expect(registry.has("mock_get_issue")).toBe(false);
  });

  it("debe aislar y registrar fallos en servidores inválidos sin tumbar el gestor", async () => {
    const invalidConfig: McpServerConfig = {
      id: "failing-server",
      name: "Servidor Inexistente",
      transport: "stdio",
      command: "binario_absolutamente_inexistente_12345",
      timeoutMs: 1000,
    };

    const state = await manager.registerServer(invalidConfig, true);
    expect(state.status).toBe("error");
    expect(state.lastError).toBeDefined();
    expect(manager.listServers()).toHaveLength(1);
  });
});
