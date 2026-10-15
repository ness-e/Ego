import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { ModelRouter } from "@ego/models";
import { ToolRegistry, ToolExecutionContext } from "@ego/tools";
import { ToolExecutionLoop } from "../src/index.js";

const mockContext: ToolExecutionContext = {
  callId: "call_fingerprint_test",
  sessionId: "sess_fp_001",
  workspacePath: "/workspace/ego",
};

const fingerprintOf = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

describe("@ego/runtime — enforcement cachedSystemPromptFingerprint (STAB-05)", () => {
  let router: ModelRouter;
  let registry: ToolRegistry;

  beforeEach(() => {
    router = new ModelRouter();
    registry = new ToolRegistry();
  });

  it("sin fingerprint fijado el turno corre normal (aditivo, sin regresión)", async () => {
    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: "system-a",
    });
    expect(result.status).toBe("completed");
  });

  it("fingerprint coincidente permite el turno", async () => {
    const system = "system-estable-stab05";
    const loop = new ToolExecutionLoop(router, registry, {
      cachedSystemPromptFingerprint: fingerprintOf(system),
    });
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: system,
    });
    expect(result.status).toBe("completed");
  });

  it("mutación mid-turn sin flag → error sin llamar al modelo", async () => {
    const loop = new ToolExecutionLoop(router, registry, {
      cachedSystemPromptFingerprint: fingerprintOf("system-original"),
    });
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: "system-MUTADO-mid-turn",
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("System prompt");
    expect(result.steps).toBe(0);
  });

  it("rebuild por compresión (isCompressionRebuild:true) es el único cache-break sancionado", async () => {
    const loop = new ToolExecutionLoop(router, registry, {
      cachedSystemPromptFingerprint: fingerprintOf("system-original"),
    });
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: "system-reconstruido-por-compresion",
      isCompressionRebuild: true,
    });
    expect(result.status).toBe("completed");
  });

  it("el flag por-opción también vale aunque el config no fije fingerprint", async () => {
    const loop = new ToolExecutionLoop(router, registry);
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: "cualquiera",
      cachedSystemPromptFingerprint: fingerprintOf("otro"),
    });
    expect(result.status).toBe("error");
  });

  it("la parte estable manda: el overlay efímero puede cambiar cada turno", async () => {
    const stable = "system-estable-3-tiers";
    const loop = new ToolExecutionLoop(router, registry, {
      cachedSystemPromptFingerprint: fingerprintOf(stable),
    });
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: `${stable}\n[EPHEMERAL] recall fresco del turno`,
      stableSystemPrompt: stable,
    });
    expect(result.status).toBe("completed");
  });

  it("mutar la parte estable con overlay intacto → error", async () => {
    const loop = new ToolExecutionLoop(router, registry, {
      cachedSystemPromptFingerprint: fingerprintOf("estable-original"),
    });
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola" }],
      context: mockContext,
      systemPrompt: "estable-MUTADO\n[EPHEMERAL] recall",
      stableSystemPrompt: "estable-MUTADO",
    });
    expect(result.status).toBe("error");
  });
});
