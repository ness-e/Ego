import { describe, it, expect } from "vitest";
import { MockIPCBridge } from "../src/MockIPCBridge.js";

describe("COUC-15: MockIPCBridge (Browser & Isolated UI Testing)", () => {
  it("proporciona todas las operaciones requeridas de la API de Electron en memoria", async () => {
    const api = MockIPCBridge.createMockApi();

    // 1. Proyectos
    const projects = await api.projects.list();
    expect(projects.length).toBeGreaterThan(0);
    const active = await api.projects.getActive();
    expect((active as any).id).toBe("mock_proj_01");

    // 2. Sub-Egos
    const subegos = await api.subegos.list();
    expect(subegos.length).toBe(2);

    // 3. Memoria local
    await api.memory({ op: "put", args: ["key_test", { value: 123 }] });
    const memoryVal = await api.memory({ op: "get", args: ["key_test"] });
    expect(memoryVal).toEqual({ value: 123 });

    // 4. LLM Stream Mock
    const streamRes = await api.llmStream({ prompt: "Hola Ego" });
    expect((streamRes as any).text).toContain("Mock LLM Response");

    // 5. Aprobaciones
    const appr = await api.resolveApproval({ approvalId: "appr_1", approved: true });
    expect(appr.success).toBe(true);
  });

  it("permite suscripción a eventos simulados", async () => {
    const api = MockIPCBridge.createMockApi();
    let changedProjectId = "";

    const unsub = api.onProjectChanged((data) => {
      changedProjectId = data.activeProjectId;
    });

    await api.projects.select("proj_custom_99");
    expect(changedProjectId).toBe("proj_custom_99");

    unsub();
  });

  it("strict por defecto (H17): rechaza ops de memoria desconocidas", async () => {
    const api = MockIPCBridge.createMockApi();
    await expect(api.memory({ op: "drop", args: [] })).rejects.toThrow(/strict/i);
  });

  it("strict (H19): rechaza apiKey en claro y jamás la expone", async () => {
    const api = MockIPCBridge.createMockApi();
    await expect(
      api.settings.saveModelConfig({ activeProvider: "openai", apiKey: "sk-live-123" })
    ).rejects.toThrow(/apiKey/i);

    const cfg = (await api.settings.getModelConfig()) as Record<string, unknown>;
    expect(cfg).not.toHaveProperty("apiKey");
  });

  it("strict (H18): valida entradas con zod", async () => {
    const api = MockIPCBridge.createMockApi();
    await expect(api.llmStream({ prompt: "" })).rejects.toThrow();
    await expect(api.subegos.create("no-es-objeto" as never)).rejects.toThrow();
  });

  it("modo permisivo explícito: preserva compat legacy sin romper callers viejos", async () => {
    const api = MockIPCBridge.createMockApi({ permissive: true });
    await expect(api.memory({ op: "drop", args: [] })).resolves.toBeNull();
  });
});
