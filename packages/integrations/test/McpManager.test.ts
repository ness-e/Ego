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

  it("RECONEXIÓN: apagar y volver a encender deja el servidor operativo (Ola 9 / A3)", async () => {
    // BUG PREEXISTENTE (arreglado por A3 en la Ola 9): `cleanupProcess()` mata
    // al subproceso pero no espera a que termine. El evento `exit` del hijo
    // VIEJO llegaba después de spawnear el hijo NUEVO y su
    // `rejectAllPending()` (mapa compartido) rechazaba el handshake
    // `initialize` del hijo nuevo con el error del viejo ⇒ **reconectar
    // siempre fallaba** y las tools no volvían al registro.
    //
    // Es un camino de usuario real: apagar y volver a encender un servidor
    // MCP en los ajustes.
    await manager.registerServer(validConfig, true);
    expect(registry.has("mock_get_issue")).toBe(true);

    await manager.toggleServer(validConfig.id, false);
    expect(registry.has("mock_get_issue")).toBe(false);

    const onState = await manager.toggleServer(validConfig.id, true);
    expect(onState.status, `la reconexión falló: ${onState.lastError ?? ""}`).toBe(
      "connected"
    );
    expect(onState.lastError).toBeUndefined();
    expect(registry.has("mock_get_issue")).toBe(true);
    expect(registry.has("mock_delete_repository")).toBe(true);
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

  it("debe exponer Result explícito ok:true al conectar y ok:false al fallar (F1T2)", async () => {
    const okState = await manager.registerServer(validConfig, true);
    expect(okState.ok).toBe(true);
    expect(okState.lastError).toBeUndefined();

    const invalidConfig: McpServerConfig = {
      id: "failing-result",
      name: "Servidor Inválido",
      transport: "stdio",
      command: "binario_absolutamente_inexistente_12345",
      timeoutMs: 1000,
    };
    const failState = await manager.registerServer(invalidConfig, true);
    expect(failState.ok).toBe(false);
    expect(failState.lastError).toBeDefined();
  });

  it("debe auditar el override de una tool de SERVIDOR en el EventBus, no en un console.warn (F1T2 / EGO-FIND-49)", async () => {
    const { z } = await import("zod");
    const { EventBus } = await import("@ego/events");
    const alerts: Array<{ code: string }> = [];
    const bus = new EventBus();
    bus.on("system.alert", (event) => {
      alerts.push(event.payload as { code: string });
    });

    const audited = new McpManager(registry, { eventBus: bus });

    // Pre-registrar una tool de SERVIDOR (origin "mcp") que colisiona con la
    // importación del servidor con prefijo "mock".
    registry.register({
      name: "mock_get_issue",
      description: "preexistente",
      category: "system",
      riskLevel: "safe",
      origin: "mcp",
      mcpServerId: "otro-servidor",
      inputSchema: z.object({}),
      execute: async () => "preexistente",
    });

    await audited.registerServer({ ...validConfig, allowOverride: true }, true);

    const overrideAlerts = alerts.filter((a) => a.code === "MCP_TOOL_OVERRIDE");
    expect(overrideAlerts.length).toBeGreaterThan(0);
    await audited.dispose();
  });

  it("sin `allowOverride`, el override de una tool de servidor se BLOQUEA y se audita como bloqueo", async () => {
    const { z } = await import("zod");
    const { EventBus } = await import("@ego/events");
    const alerts: Array<{ code: string }> = [];
    const bus = new EventBus();
    bus.on("system.alert", (event) => {
      alerts.push(event.payload as { code: string });
    });

    const audited = new McpManager(registry, { eventBus: bus });

    registry.register({
      name: "mock_get_issue",
      description: "preexistente",
      category: "system",
      riskLevel: "safe",
      origin: "mcp",
      mcpServerId: "otro-servidor",
      inputSchema: z.object({}),
      execute: async () => "preexistente",
    });

    await audited.registerServer(validConfig, true);

    expect(registry.get("mock_get_issue")!.description).toBe("preexistente");
    expect(alerts.filter((a) => a.code === "MCP_TOOL_OVERRIDE")).toHaveLength(0);
    expect(alerts.filter((a) => a.code === "MCP_TOOL_IMPORT_BLOCKED").length).toBeGreaterThan(0);

    await audited.dispose();
  });

  it("una tool NATIVA preexistente NO se sobrescribe ni se audita como override (EGO-FIND-49)", async () => {
    const { z } = await import("zod");
    const { EventBus } = await import("@ego/events");
    const alerts: Array<{ code: string }> = [];
    const bus = new EventBus();
    bus.on("system.alert", (event) => {
      alerts.push(event.payload as { code: string });
    });

    const audited = new McpManager(registry, { eventBus: bus });

    registry.register({
      name: "mock_get_issue",
      description: "preexistente",
      category: "system",
      riskLevel: "safe",
      origin: "native",
      inputSchema: z.object({}),
      execute: async () => "preexistente",
    });

    await audited.registerServer(validConfig, true);

    // La nativa sobrevive.
    expect(registry.get("mock_get_issue")!.origin).toBe("native");
    expect(registry.get("mock_get_issue")!.description).toBe("preexistente");
    // Y el intento queda auditado como protección, no como override.
    const protectedAlerts = alerts.filter((a) => a.code === "MCP_NATIVE_TOOL_PROTECTED");
    expect(protectedAlerts.length).toBeGreaterThan(0);
    expect(alerts.filter((a) => a.code === "MCP_TOOL_OVERRIDE")).toHaveLength(0);

    await audited.dispose();
  });
});
