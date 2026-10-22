import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { ToolRegistry, registerNativeTools, subEgoToolsView } from "@ego/tools";
import { EventBus, type EgoEvent } from "@ego/events";
import { McpManager } from "../src/mcp/McpManager.js";
import { McpClient } from "../src/mcp/McpClient.js";
import type { McpServerConfig } from "../src/mcp/types.js";

/**
 * Ola 9 (A3) — Dueño de las tools que llegan **en caliente** desde un
 * servidor MCP (petición cruzada de A4, `handoff/A4-ola9.md` §7.2).
 *
 * ## El hueco que A4 deja
 * `McpClient.importIntoRegistryDetailed` registraba las tools importadas en
 * el registro **global** sin declarar dueño (`packages/integrations/src/mcp/
 * McpClient.ts:424`). Con la vista filtrada por Sub-Ego (Ola 9 · A4), la
 * regla "sin dueño ⇒ global" hace que **todo Sub-Ego** las vea.
 *
 * ## La decisión (y su evidencia)
 * La conexión MCP la abre **la app**, no un Sub-Ego:
 * - `apps/desktop/src/main/ipc/domains/mcp.ts:49` → handler IPC
 *   `ipc.mcp.addServer`: lo dispara el **usuario** al configurar un servidor
 *   MCP externo en los ajustes (el esquema `AddMcpServerSchema` no tiene
 *   ningún campo de Sub-Ego);
 * - `apps/desktop/src/main/window/create-window.ts:701` → la app **restaura**
 *   sus servidores MCP persistidos al arrancar;
 * - `packages/integrations/src/mcp/**` tiene **0** referencias a `subEgoId`
 *   (los únicos `subEgo*` son `subEgoRegistry`, el proveedor de prompts del
 *   servidor MCP, sin relación).
 *
 * ⇒ **Las tools de un servidor MCP son GLOBALES (sin dueño)**: son
 * infraestructura de la app (las configuró el usuario), no un artefacto de un
 * Sub-Ego. Eso es lo correcto y NO es un olvido: por eso el ámbito se
 * declara **explícitamente** en la API (`scope: "app"`), y por eso el
 * camino privado (`scope: "sub-ego"`) existe y está probado.
 */
const MOCK_SCRIPT = resolve(__dirname, "mock-mcp-server.cjs");

const serverConfig: McpServerConfig = {
  id: "server-a",
  name: "Servidor A",
  transport: "stdio",
  command: process.execPath,
  args: [MOCK_SCRIPT],
  toolPrefix: "srv",
  timeoutMs: 5000,
};

describe("Ola 9 — dueño de las tools de un servidor MCP (petición de A4 §7.2)", () => {
  let registry: ToolRegistry;
  let manager: McpManager;
  let eventBus: EventBus;
  let alerts: EgoEvent<{ code: string; message: string; details?: unknown }>[];

  beforeEach(() => {
    registry = new ToolRegistry();
    registerNativeTools(registry, { workspacePath: process.cwd(), enableCanvas: true });
    eventBus = new EventBus();
    alerts = [];
    eventBus.on("system.alert", (event) => {
      alerts.push(event);
    });
    manager = new McpManager(registry, { eventBus });
  });

  afterEach(async () => {
    await manager.dispose();
  });

  it("ÁMBITO APP (el caso real): la conexión la abre la app ⇒ tool GLOBAL", async () => {
    // No se declara dueño a propósito: la conexión la abre la app (IPC
    // `ipc.mcp.addServer` / restauración al arranque), no un Sub-Ego.
    await manager.registerServer(serverConfig, true);

    const tool = registry.get("srv_get_issue");
    expect(tool).toBeDefined();
    expect(tool!.origin).toBe("mcp");
    // Sin dueño ⇒ GLOBAL: la ven todas las vistas de Sub-Ego.
    expect(tool!.ownerSubEgoId).toBeUndefined();

    const vistaAuditor = subEgoToolsView(registry, "ego.auditor");
    const vistaOtro = subEgoToolsView(registry, "ego.otro");
    expect(vistaAuditor.has("srv_get_issue")).toBe(true);
    expect(vistaOtro.has("srv_get_issue")).toBe(true);
  });

  it("ÁMBITO SUB-EGO: la tool privada NO aparece en la vista de otro Sub-Ego", async () => {
    await manager.registerServer(serverConfig, true, {
      scope: "sub-ego",
      ownerSubEgoId: "ego.auditor",
    });

    const tool = registry.get("srv_get_issue");
    expect(tool).toBeDefined();
    expect(tool!.ownerSubEgoId).toBe("ego.auditor");

    // El dueño la ve.
    expect(subEgoToolsView(registry, "ego.auditor").has("srv_get_issue")).toBe(true);
    // OTRO Sub-Ego NO.
    expect(subEgoToolsView(registry, "ego.otro").has("srv_get_issue")).toBe(false);
    expect(subEgoToolsView(registry, "ego.otro").get("srv_get_issue")).toBeUndefined();
  });

  it("el dueño SOBREVIVE a una reconexión (toggle off/on)", async () => {
    await manager.registerServer(serverConfig, true, {
      scope: "sub-ego",
      ownerSubEgoId: "ego.auditor",
    });
    expect(registry.get("srv_get_issue")!.ownerSubEgoId).toBe("ego.auditor");

    await manager.toggleServer("server-a", false);
    expect(registry.has("srv_get_issue")).toBe(false);

    const on = await manager.toggleServer("server-a", true);
    expect(on.status).toBe("connected");
    expect(registry.get("srv_get_issue")!.ownerSubEgoId).toBe("ego.auditor");
  });

  it("el `McpClient` acepta el dueño y lo propaga al registro", async () => {
    const client = new McpClient(serverConfig);
    await client.connect();
    const result = client.importIntoRegistryDetailed(registry, {
      prefix: "srv",
      ownerSubEgoId: "ego.auditor",
    });

    expect(result.registered).toBeGreaterThan(0);
    const tool = registry.get("srv_get_issue");
    expect(tool!.ownerSubEgoId).toBe("ego.auditor");
    expect(subEgoToolsView(registry, "ego.otro").has("srv_get_issue")).toBe(false);
    await client.disconnect();
  });

  it("EGO-FIND-49 intacto: una tool NATIVA no se sobrescribe ni con dueño", async () => {
    const nativeBefore = registry.get("fs_read_file")!;

    await manager.registerServer(
      {
        id: "fs",
        name: "Servidor de Takeover (fs)",
        transport: "stdio",
        command: process.execPath,
        args: [resolve(__dirname, "mock-mcp-takeover-server.cjs")],
        allowOverride: true,
        timeoutMs: 5000,
      },
      true,
      { scope: "sub-ego", ownerSubEgoId: "ego.auditor" }
    );

    const nativeAfter = registry.get("fs_read_file")!;
    expect(nativeAfter.origin).toBe("native");
    expect(nativeAfter.description).toBe(nativeBefore.description);

    const takeoverAlerts = alerts.filter(
      (a) => a.payload.code === "MCP_NATIVE_TOOL_PROTECTED"
    );
    expect(takeoverAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it("el veto de tools nativas NO depende del ámbito (app o Sub-Ego)", async () => {
    await manager.registerServer(
      {
        id: "fs",
        name: "Servidor de Takeover (fs)",
        transport: "stdio",
        command: process.execPath,
        args: [resolve(__dirname, "mock-mcp-takeover-server.cjs")],
        allowOverride: true,
        timeoutMs: 5000,
      },
      true
    );

    expect(registry.get("fs_read_file")!.origin).toBe("native");
  });
});
