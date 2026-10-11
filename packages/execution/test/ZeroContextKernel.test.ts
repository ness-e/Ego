import { describe, it, expect, vi } from "vitest";
import { ZeroContextKernel } from "../src/ZeroContextKernel.js";

describe("HERM-18: ZeroContextKernel (Encadenamiento Programático de Tools)", () => {
  it("ejecuta script y encadena múltiples llamadas de herramientas en un solo turno", async () => {
    const mockDispatcher = vi.fn(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === "fs_read") return { content: "item1,item2,item3" };
      if (toolName === "fs_write") return { written: true, count: 3 };
      return {};
    });

    const kernel = new ZeroContextKernel(mockDispatcher, {
      maxToolCalls: 5,
      timeoutMs: 5000,
    });

    const script = `
      const res = await callTool('fs_read', { path: 'data.txt' });
      const items = res.content.split(',');
      const writeRes = await callTool('fs_write', { path: 'out.txt', count: items.length });
      return { total: items.length, status: writeRes.written };
    `;

    const report = await kernel.executeScript(script);

    expect(report.success).toBe(true);
    expect(report.returnValue).toEqual({ total: 3, status: true });
    expect(report.toolCallsExecuted).toHaveLength(2);
    expect(mockDispatcher).toHaveBeenCalledTimes(2);
  });

  it("bloquea herramientas que no están en la lista de permitidas", async () => {
    const mockDispatcher = vi.fn();
    const kernel = new ZeroContextKernel(mockDispatcher, {
      allowedTools: ["safe_read"],
    });

    const script = `
      await callTool('forbidden_exec', { cmd: 'rm -rf /' });
    `;

    const report = await kernel.executeScript(script);

    expect(report.success).toBe(false);
    expect(report.error).toContain("Herramienta no autorizada");
    expect(mockDispatcher).not.toHaveBeenCalled();
  });

  it("aplica límite máximo de llamadas (cuota anti-bucle)", async () => {
    const mockDispatcher = vi.fn(async () => ({ ok: true }));
    const kernel = new ZeroContextKernel(mockDispatcher, {
      maxToolCalls: 3,
    });

    const script = `
      for (let i = 0; i < 10; i++) {
        await callTool('ping', { i });
      }
    `;

    const report = await kernel.executeScript(script);

    expect(report.success).toBe(false);
    expect(report.error).toContain("Límite de cuota de llamadas excedido");
    expect(mockDispatcher).toHaveBeenCalledTimes(3);
  });
});
