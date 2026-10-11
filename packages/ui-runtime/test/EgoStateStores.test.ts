import { describe, it, expect } from "vitest";
import { createEgoStateStores } from "../src/stores/EgoStateStores.js";

describe("COUC-05: Desacoplamiento de Estado Reactivo (Anti-Singleton 7 Stores)", () => {
  it("inicializa 7 stores ortogonales independientes y tipados", () => {
    const stores = createEgoStateStores();

    expect(stores.runtime).toBeDefined();
    expect(stores.interaction).toBeDefined();
    expect(stores.attention).toBeDefined();
    expect(stores.workspace).toBeDefined();
    expect(stores.project).toBeDefined();
    expect(stores.integration).toBeDefined();
    expect(stores.userPrefs).toBeDefined();

    expect(stores.runtime.getState().isExecuting).toBe(false);
    expect(stores.attention.getState().surfaceState).toBe("hidden");
    expect(stores.userPrefs.getState().theme).toBe("dark");
  });

  it("permite suscripción y actualización reactiva desacoplada", () => {
    const stores = createEgoStateStores();
    let attentionReceived = "";

    const unsub = stores.attention.subscribe((state) => {
      attentionReceived = state.surfaceState;
    });

    stores.attention.setState({ surfaceState: "hitl_approval", badgeCount: 1 });
    expect(attentionReceived).toBe("hitl_approval");
    expect(stores.attention.getState().badgeCount).toBe(1);

    unsub();
    stores.attention.setState({ surfaceState: "expanded" });
    // Al desuscribirse no debe actualizar la variable
    expect(attentionReceived).toBe("hitl_approval");
  });

  it("resetea todos los stores al estado inicial limpio", () => {
    const stores = createEgoStateStores();

    stores.runtime.setState({ isExecuting: true, activeRuns: ["run_1"] });
    stores.project.setState({ projectName: "Modified Project" });

    expect(stores.runtime.getState().isExecuting).toBe(true);
    expect(stores.project.getState().projectName).toBe("Modified Project");

    stores.resetAll();

    expect(stores.runtime.getState().isExecuting).toBe(false);
    expect(stores.runtime.getState().activeRuns).toEqual([]);
    expect(stores.project.getState().projectName).toBe("Default Project");
  });
});
