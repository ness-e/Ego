import { describe, it, expect } from "vitest";
import { ExecutionManager } from "../src/ExecutionManager.js";
import type { ToolDefinition } from "@ego/tools";

function makeTool(
  name: string,
  execute: (input: unknown, ctx: { abortSignal?: AbortSignal }) => unknown | Promise<unknown>,
  riskLevel: "safe" | "sensitive" | "destructive" = "safe"
): ToolDefinition {
  return {
    name,
    description: name,
    category: "filesystem",
    riskLevel,
    origin: "native",
    parameters: {},
    execute: async (input: unknown, ctx: { abortSignal?: AbortSignal }) =>
      execute(input, ctx),
  } as unknown as ToolDefinition;
}

const ctx = { sessionId: "s", traceId: undefined, callId: "c1" } as never;

describe("ExecutionManager — límites de salida y cola cancelable (T8 / EGO-FIND-44)", () => {
  it("(1) trunca por BYTES: una salida UTF-8 multibyte no excede la cuota", async () => {
    const manager = new ExecutionManager({ maxOutputSizeBytes: 200 });
    // 300 'á' = 600 bytes UTF-8, 300 chars.
    const payload = "á".repeat(300);

    const res = await manager.execute(makeTool("t", () => payload), {}, ctx);

    expect(res.truncated).toBe(true);
    const bytes = Buffer.byteLength(String(res.output), "utf-8");
    expect(bytes).toBeLessThanOrEqual(260); // 200 + marcador de truncado
    // Sin caracteres de reemplazo (corte limpio de UTF-8).
    expect(String(res.output)).not.toContain("\uFFFD");
  });

  it("(2) aplica la cuota a salidas NO-string (objetos)", async () => {
    const manager = new ExecutionManager({ maxOutputSizeBytes: 300 });
    const big = { blob: "x".repeat(5000) };

    const res = await manager.execute(makeTool("t", () => big), {}, ctx);

    expect(res.truncated).toBe(true);
    expect(typeof res.output).toBe("object");
    expect(res.output).not.toBe(big);
  });

  it("(3) una salida pequeña NO se trunca", async () => {
    const manager = new ExecutionManager({ maxOutputSizeBytes: 5000 });
    const res = await manager.execute(makeTool("t", () => "corta"), {}, ctx);
    expect(res.truncated).toBe(false);
    expect(res.output).toBe("corta");
  });

  it("(4) una ejecución abortada mientras está EN COLA no espera al slot", async () => {
    const manager = new ExecutionManager({ maxConcurrentExecutions: 1, defaultTimeoutMs: 5000 });
    const controller = new AbortController();
    let releaseFirst: (() => void) | null = null;

    const blocking = makeTool("bloqueante", async (_i, c) => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
        c.abortSignal?.addEventListener("abort", () => resolve(), { once: true });
      });
      return "primero";
    });

    const queued = makeTool("encolada", () => "segundo");

    // 1) ocupa el único slot
    const first = manager.execute(blocking, {}, { ...ctx, callId: "c-first" } as never);
    await new Promise((r) => setTimeout(r, 10));

    // 2) encola la segunda y la aborta mientras espera
    const secondPromise = manager.execute(
      queued,
      {},
      { ...ctx, callId: "c-second", abortSignal: controller.signal } as never
    );
    await new Promise((r) => setTimeout(r, 10));
    controller.abort(new Error("cancelado por el usuario"));

    const second = await secondPromise;
    expect(second.status).toBe("aborted");
    // La cola se vació: no quedó ninguna ejecución esperando slot.
    expect(manager.queuedCount).toBe(0);

    releaseFirst?.();
    await first;
  });
});
