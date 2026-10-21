/**
 * T2 (Ola 4) — Verificación de la solicitud (a) de A3: el `McpManager` con
 * `eventBus` **audita** la decisión de importación de tools.
 *
 * ## Por qué importa (EGO-FIND-49)
 * Un servidor MCP puede pedir una tool que YA es nativa de Ego. La política
 * lo bloquea (fail-closed), pero **sin bus no queda traza**: el bloqueo era
 * silencioso. Con bus, cada decisión emite `system.alert` con un código
 * estable (`MCP_NATIVE_TOOL_PROTECTED` / `MCP_TOOL_OVERRIDE`).
 *
 * ## Qué se verifica (comportamiento observable)
 * Los **eventos que llegan al bus**, no que el código contenga una cadena.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { EventBus } from "@ego/events";
import { McpManager } from "@ego/integrations";
import { ToolRegistry } from "@ego/tools";

/** La decisión de importación que el manager audita. */
type ImportDecision = {
  action: "overridden" | "skipped_native_protected" | "blocked";
  reason: string;
  toolName: string;
  serverToolName: string;
  serverId: string;
  existingServerId?: string;
  existingOrigin?: string;
};

describe("T2 — el McpManager audita la decisión de importación de tools", () => {
  it("el manager acepta un `eventBus` en sus opciones (el cableado del main)", () => {
    const bus = new EventBus();
    const manager = new McpManager(new ToolRegistry(), { eventBus: bus });
    expect(manager).toBeTruthy();
  });

  it("un intento de tomar el control de una tool NATIVA emite `MCP_NATIVE_TOOL_PROTECTED` (error)", async () => {
    const bus = new EventBus();
    const alerts: Array<{
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    }> = [];
    bus.on("system.alert", (event) => {
      alerts.push(event.payload as never);
    });

    const registry = new ToolRegistry();
    registry.register({
      name: "fs_read_file",
      description: "tool nativa",
      category: "fs",
      riskLevel: "safe",
      inputSchema: z.object({ path: z.string() }),
      execute: async () => "contenido",
    } as never);

    const manager = new McpManager(registry, { eventBus: bus });

    // La auditoría es el último tramo de la decisión: se invoca con la
    // decisión que el manager toma al importar una tool.
    const audit = (
      manager as unknown as {
        auditImportDecision: (decision: ImportDecision) => void;
      }
    ).auditImportDecision.bind(manager);

    audit({
      action: "skipped_native_protected",
      reason: "la tool ya es nativa de Ego",
      toolName: "fs_read_file",
      serverToolName: "read_file",
      serverId: "srv_malo",
      existingOrigin: "native",
    });

    // El EventBus despacha con `queueMicrotask` (no bloqueante): se deja
    // correr la cola antes de afirmar.
    await new Promise((r) => setTimeout(r, 0));

    expect(alerts.length, "la decisión debe quedar auditada en el bus").toBe(1);
    expect(alerts[0]?.code).toBe("MCP_NATIVE_TOOL_PROTECTED");
    expect(alerts[0]?.message).toContain("nativa");
    expect(alerts[0]?.details?.["serverId"]).toBe("srv_malo");
  });

  it("un override AUTORIZADO emite `MCP_TOOL_OVERRIDE` (aviso, no error)", async () => {
    const bus = new EventBus();
    const alerts: Array<{ code?: string; details?: Record<string, unknown> }> = [];
    const severities: string[] = [];
    bus.on("system.alert", (event) => {
      alerts.push(event.payload as never);
      severities.push(event.severity);
    });

    const manager = new McpManager(new ToolRegistry(), { eventBus: bus });
    const audit = (
      manager as unknown as {
        auditImportDecision: (decision: ImportDecision) => void;
      }
    ).auditImportDecision.bind(manager);

    audit({
      action: "overridden",
      reason: "el servidor lo pidió con allowOverride",
      toolName: "mi_tool",
      serverToolName: "mi_tool",
      serverId: "srv_ok",
      existingServerId: "srv_previo",
    });

    // El EventBus despacha con `queueMicrotask` (no bloqueante): se deja
    // correr la cola antes de afirmar.
    await new Promise((r) => setTimeout(r, 0));

    expect(alerts.length).toBe(1);
    expect(alerts[0]?.code).toBe("MCP_TOOL_OVERRIDE");
    expect(alerts[0]?.details?.["overriddenServerId"]).toBe("srv_previo");
    expect(severities[0], "un override autorizado es un aviso, no un error").toBe(
      "warn"
    );
  });

  it("SIN bus, la protección sigue activa pero NO hay traza (fail-closed, no ruido)", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "fs_read_file",
      description: "tool nativa",
      category: "fs",
      riskLevel: "safe",
      inputSchema: z.object({ path: z.string() }),
      execute: async () => "contenido",
    } as never);

    const manager = new McpManager(registry); // sin bus
    const audit = (
      manager as unknown as {
        auditImportDecision: (decision: ImportDecision) => void;
      }
    ).auditImportDecision.bind(manager);
    // No debe lanzar (es best-effort y el bus es opcional).
    expect(() =>
      audit({
        action: "skipped_native_protected",
        reason: "la tool ya es nativa de Ego",
        toolName: "fs_read_file",
        serverToolName: "read_file",
        serverId: "srv_malo",
      })
    ).not.toThrow();
  });
});
