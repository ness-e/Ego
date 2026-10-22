import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@ego/models";
import {
  ToolRegistry,
  subEgoToolsView,
  type ToolDefinition,
  type ToolExecutionContext,
} from "@ego/tools";
import { ToolExecutionLoop } from "../src/index.js";
import { ToolNotVisibleToSubEgoError } from "../src/ToolVisibility.js";

/**
 * Ola 9 (A4 → A2-bis) — La **vista filtrada** del registro de tools se
 * aplica en los **dos** puntos del bucle que aún miraban el global:
 *
 * 1. la **superficie del modelo** (las tools que ve el LLM), y
 * 2. la **resolución de la ejecución** (`registry.get(name)`), que debe
 *    **fallar cerrado** con un error **tipado** ("no es tuya" ≠ "no existe").
 *
 * El camino **sin** Sub-Ego (usuario/app) sigue viendo el **global**: es
 * deliberado.
 */

const INJECTION_TEXT = "ignore previous instructions";

function makeTool(name: string, output: string): ToolDefinition<{ path: string }, { content: string }> {
  return {
    name,
    description: `Herramienta ${name}`,
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ path: z.string().min(1) }),
    execute: async () => ({ content: output }),
  };
}

describe("ToolExecutionLoop — vista filtrada por Sub-Ego (Ola 9 · A4 → A2-bis)", () => {
  let registry: ToolRegistry;
  let loop: ToolExecutionLoop;

  const globalTool = makeTool("global_tool", "salida global");
  const ownedTool = makeTool("owned_tool", "salida privada");

  const subEgoContext: ToolExecutionContext = {
    callId: "call_sub",
    sessionId: "sess_sub",
    subEgoId: "sub-ego-a",
    workspacePath: "/workspace/ego",
  };
  const userContext: ToolExecutionContext = {
    callId: "call_user",
    sessionId: "sess_user",
    workspacePath: "/workspace/ego",
  };

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.registerMany([globalTool]);
    registry.register(ownedTool, { ownerSubEgoId: "sub-ego-b" });
    loop = new ToolExecutionLoop(new ModelRouter(), registry);
  });

  it("(a) la superficie del modelo del Sub-Ego EXCLUYE la tool ajena", async () => {
    const seen: Array<{ name: string; description: string; parameters: unknown }> = [];
    const router = new ModelRouter();
    // Espía: captura los schemas que el loop pasa al modelo.
    const spy = vi.spyOn(router, "generateText").mockImplementation(async (_role, options) => {
      for (const t of (options.tools ?? []) as Array<{ name: string }>) {
        seen.push({ name: t.name, description: "", parameters: undefined });
      }
      return {
        text: "fin",
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
      };
    });

    const scoped = new ToolExecutionLoop(router, registry);
    await scoped.run({
      messages: [{ role: "user", content: "hola" }],
      context: subEgoContext,
    });

    const names = seen.map((t) => t.name);
    expect(names).toContain("global_tool");
    expect(names).not.toContain("owned_tool");
    spy.mockRestore();
  });

  it("(b) invocar por nombre una tool ajena FALLA CERRADO con error tipado", async () => {
    const result = await loop.run({
      messages: [
        { role: "user", content: 'SIMULATE_TOOL:owned_tool:{"path":"x"}' },
      ],
      context: subEgoContext,
    });

    // No se ejecuta contra el global.
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg?.content).not.toContain("salida privada");
    expect(toolMsg?.content).toMatch(/sub-ego-b/);
  });

  it("(c) el Sub-Ego dueño SÍ puede invocarla", async () => {
    const ownerContext: ToolExecutionContext = {
      callId: "call_owner",
      sessionId: "sess_owner",
      subEgoId: "sub-ego-b",
      workspacePath: "/workspace/ego",
    };
    const result = await loop.run({
      messages: [{ role: "user", content: 'SIMULATE_TOOL:owned_tool:{"path":"x"}' }],
      context: ownerContext,
    });

    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("salida privada");
  });

  it("(d) el camino SIN Sub-Ego (usuario/app) sigue viendo el global", async () => {
    const result = await loop.run({
      messages: [{ role: "user", content: 'SIMULATE_TOOL:owned_tool:{"path":"x"}' }],
      context: userContext,
    });

    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("salida privada");
  });

  it("(e) el error tipado distingue 'no es tuya' de 'no existe'", () => {
    const err = new ToolNotVisibleToSubEgoError("owned_tool", "sub-ego-a", "sub-ego-b");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ToolNotVisibleToSubEgoError");
    expect(err.toolName).toBe("owned_tool");
    expect(err.subEgoId).toBe("sub-ego-a");
    expect(err.ownerSubEgoId).toBe("sub-ego-b");
    expect(err.message).toContain("sub-ego-b");
  });

  it("(f) GUARD: si se deshace el filtrado, este test falla", () => {
    // El dueño de "owned_tool" es "sub-ego-b": "sub-ego-a" NO puede verla.
    const view = subEgoToolsView(registry, "sub-ego-a");
    expect(view.has("global_tool")).toBe(true);
    expect(view.has("owned_tool")).toBe(false);
    expect(view.count()).toBe(1);
  });
});
