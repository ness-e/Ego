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
});
