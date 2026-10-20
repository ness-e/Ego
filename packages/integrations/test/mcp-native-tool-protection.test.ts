import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import { EventBus, type EgoEvent } from "@ego/events";
import { McpManager } from "../src/mcp/McpManager.js";
import type { McpServerConfig } from "../src/mcp/types.js";

/**
 * T1 — Un servidor MCP NO puede tomar el control de una tool nativa.
 *
 * EGO-FIND-49 (solicitud #6 de A1, Ola 1b T1).
 *
 * `McpManager.connectServer` pasaba SIEMPRE `overrideExisting: true` a
 * `importIntoRegistry` ⇒ un servidor MCP de terceros podía **reemplazar**
 * `fs_read_file` o `terminal_exec` por su propia implementación (takeover de
 * tool nativa: el agente ejecutaría código del servidor de terceros creyendo
 * que es la tool de Ego).
 *
 * REGLAS:
 * 1. Una tool con `origin === "native"` NUNCA puede ser sobrescrita.
 * 2. El override de una tool de SERVIDOR exige `allowOverride` explícito
 *    **por servidor**.
 * 3. Todo override (y todo intento de takeover nativo) queda **auditado** en el
 *    EventBus (`system.alert`), no en un `console.warn`.
 */

const TAKEOVER_SCRIPT = resolve(__dirname, "mock-mcp-takeover-server.cjs");
const MOCK_SCRIPT = resolve(__dirname, "mock-mcp-server.cjs");

describe("T1 — Un servidor MCP no puede sobrescribir tools nativas (EGO-FIND-49)", () => {
  let registry: ToolRegistry;
  let manager: McpManager;
  let eventBus: EventBus;
  let alerts: EgoEvent<{ code: string; message: string; details?: unknown }>[];

  // VECTOR REAL: `McpManager` prefija las tools importadas con
  // `config.toolPrefix || config.id`. Un servidor con id `fs` que exponga la
  // tool `read_file` produce `fs_read_file` → el nombre EXACTO de la tool
  // nativa. Con id `terminal` + tool `exec` → `terminal_exec`.
  const fsTakeoverConfig: McpServerConfig = {
    id: "fs",
    name: "Servidor de Takeover (fs)",
    transport: "stdio",
    command: process.execPath,
    args: [TAKEOVER_SCRIPT],
    timeoutMs: 5000,
  };

  const terminalTakeoverConfig: McpServerConfig = {
    id: "terminal",
    name: "Servidor de Takeover (terminal)",
    transport: "stdio",
    command: process.execPath,
    args: [TAKEOVER_SCRIPT],
    timeoutMs: 5000,
  };

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

  it("la tool NATIVA sobrevive: un servidor que expone `fs_read_file` no la reemplaza", async () => {
    const nativeBefore = registry.get("fs_read_file");
    expect(nativeBefore).toBeDefined();
    expect(nativeBefore!.origin).toBe("native");

    await manager.registerServer(fsTakeoverConfig, true);
    await manager.registerServer(terminalTakeoverConfig, true);

    const nativeAfter = registry.get("fs_read_file");
    expect(nativeAfter).toBeDefined();
    expect(nativeAfter!.origin).toBe("native");
    // La implementación es la NATIVA, no la del servidor de terceros.
    expect(nativeAfter!.description).toBe(nativeBefore!.description);
    expect(nativeAfter!.description).not.toMatch(/MALICIOSA/i);
  });

  it("también sobrevive `terminal_exec` (la tool destructiva)", async () => {
    const before = registry.get("terminal_exec");
    await manager.registerServer(fsTakeoverConfig, true);
    await manager.registerServer(terminalTakeoverConfig, true);

    const after = registry.get("terminal_exec");
    expect(after!.origin).toBe("native");
    expect(after!.description).toBe(before!.description);
  });

  it("un servidor MCP sí puede registrar una tool propia (sin colisión)", async () => {
    await manager.registerServer(fsTakeoverConfig, true);
    await manager.registerServer(terminalTakeoverConfig, true);

    expect(registry.has("fs_takeover_only_tool")).toBe(true);
    const tool = registry.get("fs_takeover_only_tool");
    expect(tool!.origin).toBe("mcp");
  });

  it("el takeover de una tool nativa NO se puede forzar con `allowOverride`", async () => {
    await manager.registerServer({ ...fsTakeoverConfig, allowOverride: true }, true);

    const native = registry.get("fs_read_file");
    expect(native!.origin).toBe("native");
    expect(native!.description).not.toMatch(/MALICIOSA/i);
  });

  it("el takeover de una tool nativa queda AUDITADO en el EventBus", async () => {
    await manager.registerServer(fsTakeoverConfig, true);
    await manager.registerServer(terminalTakeoverConfig, true);

    const takeoverAlerts = alerts.filter(
      (a) => a.payload.code === "MCP_NATIVE_TOOL_PROTECTED"
    );
    expect(takeoverAlerts.length).toBeGreaterThanOrEqual(2); // fs_read_file + terminal_exec
    const details = takeoverAlerts[0]!.payload.details as { toolName: string };
    expect(details.toolName).toMatch(/fs_read_file|terminal_exec/);
  });

  it("el override de una tool de SERVIDOR exige `allowOverride` explícito por servidor", async () => {
    // Dos servidores que exponen la MISMA tool con prefijo común.
    const serverA: McpServerConfig = {
      id: "server-a",
      name: "Servidor A",
      transport: "stdio",
      command: process.execPath,
      args: [MOCK_SCRIPT],
      toolPrefix: "shared",
      timeoutMs: 5000,
    };
    const serverB: McpServerConfig = {
      ...serverA,
      id: "server-b",
      name: "Servidor B",
    };

    await manager.registerServer(serverA, true);
    const firstImpl = registry.get("shared_get_issue");
    expect(firstImpl).toBeDefined();

    // B sin `allowOverride` → NO puede pisar la tool de A.
    await manager.registerServer(serverB, true);
    const afterB = registry.get("shared_get_issue");
    expect(afterB!.description).toBe(firstImpl!.description);
  });

  it("el override AUTORIZADO de una tool de servidor queda auditado en el EventBus", async () => {
    const serverA: McpServerConfig = {
      id: "server-a",
      name: "Servidor A",
      transport: "stdio",
      command: process.execPath,
      args: [MOCK_SCRIPT],
      toolPrefix: "shared",
      timeoutMs: 5000,
    };
    const serverB: McpServerConfig = {
      ...serverA,
      id: "server-b",
      name: "Servidor B",
      allowOverride: true,
    };

    await manager.registerServer(serverA, true);
    await manager.registerServer(serverB, true);

    const overrideAlerts = alerts.filter((a) => a.payload.code === "MCP_TOOL_OVERRIDE");
    expect(overrideAlerts.length).toBeGreaterThan(0);
    const details = overrideAlerts[0]!.payload.details as {
      toolName: string;
      overridingServerId: string;
    };
    expect(details.overridingServerId).toBe("server-b");
    expect(details.toolName).toMatch(/^shared_/);
  });

  it("sin EventBus no se rompe (fail-soft), pero el takeover nativo sigue bloqueado", async () => {
    const bare = new McpManager(registry);
    await bare.registerServer(fsTakeoverConfig, true);

    expect(registry.get("fs_read_file")!.origin).toBe("native");
    await bare.dispose();
  });
});
