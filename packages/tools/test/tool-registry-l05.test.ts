import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../src/ToolRegistry.js";
import type { ToolDefinition, ToolExecutionContext } from "../src/types.js";

/**
 * F6T13/L05 — `toAiSdkTools` con trazabilidad: factory > baseContext > fallback
 * documentado con callId único (ya no `Math.random` colisionable ni
 * `default_session` silencioso).
 */
describe("@ego/tools — toAiSdkTools L05", () => {
  const seen: ToolExecutionContext[] = [];
  const tool: ToolDefinition<{ path: string }, { ok: boolean }> = {
    name: "probe",
    description: "sonda",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ path: z.string() }),
    execute: async (_input, ctx) => {
      seen.push(ctx);
      return { ok: true };
    }
  };

  beforeEach(() => {
    seen.length = 0;
    vi.restoreAllMocks();
  });

  it("usa baseContext real cuando no hay factory", async () => {
    const registry = new ToolRegistry([tool]);
    const adapters = registry.toAiSdkTools(undefined, {
      baseContext: { sessionId: "sess_real", projectId: "p1" }
    });
    await adapters.probe.execute({ path: "x" });
    expect(seen[0].sessionId).toBe("sess_real");
    expect(seen[0].projectId).toBe("p1");
    expect(typeof seen[0].callId).toBe("string");
  });

  it("genera callIds únicos en fallback y avisa una sola vez", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const registry = new ToolRegistry([tool]);
    const adapters = registry.toAiSdkTools();
    await adapters.probe.execute({ path: "a" });
    await adapters.probe.execute({ path: "b" });
    expect(seen[0].callId).not.toBe(seen[1].callId);
    expect(seen[0].sessionId).toBe("default_session");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("trazabilidad");
  });

  it("la factory conserva prioridad sobre baseContext", async () => {
    const registry = new ToolRegistry([tool]);
    const adapters = registry.toAiSdkTools(() => ({ callId: "c1", sessionId: "s-factory" }), {
      baseContext: { sessionId: "s-base" }
    });
    await adapters.probe.execute({ path: "x" });
    expect(seen[0].sessionId).toBe("s-factory");
    expect(seen[0].callId).toBe("c1");
  });
});
