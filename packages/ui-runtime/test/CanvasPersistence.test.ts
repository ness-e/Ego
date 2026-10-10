import { describe, it, expect } from "vitest";
import { CanvasPersistenceManager, type CanvasWorkspaceState } from "../src/index.js";

const VALID_STATE: CanvasWorkspaceState = {
  id: "canvas-proj-1",
  projectId: "proj-1",
  activeView: "default",
  components: [
    {
      id: "card-1",
      type: "card",
      metadata: {
        timestamp: 1728518400000,
        generatedBy: "ego.nucleus",
        why: { vantaSources: ["projects/proj-1/card"], directCause: "Init card" },
      },
      props: {
        id: "c1",
        title: "Test Card",
      },
    },
  ],
  selectedComponentId: "card-1",
  updatedAt: 1728518400000,
};

describe("CANV-06: CanvasPersistenceManager — Serialización y persistencia en VantaDB", () => {
  it("debe serializar un estado válido a JSON", () => {
    const json = CanvasPersistenceManager.serialize(VALID_STATE);
    expect(typeof json).toBe("string");
    expect(json).toContain("canvas-proj-1");
    expect(json).toContain("Test Card");
  });

  it("debe deserializar un JSON válido al esquema CanvasWorkspaceState", () => {
    const json = CanvasPersistenceManager.serialize(VALID_STATE);
    const restored = CanvasPersistenceManager.deserialize(json, "proj-1");
    expect(restored.id).toBe("canvas-proj-1");
    expect(restored.components.length).toBe(1);
    expect(restored.components[0].props.title).toBe("Test Card");
  });

  it("debe recuperarse ante JSON inválido o corrupto retornando un estado por defecto seguro", () => {
    const corrupt = "{ invalid json !!! }";
    const fallback = CanvasPersistenceManager.deserialize(corrupt, "fallback-proj");
    expect(fallback.projectId).toBe("fallback-proj");
    expect(fallback.components).toEqual([]);
    expect(fallback.activeView).toBe("default");
  });

  it("debe generar la clave canónica de almacenamiento en VantaDB", () => {
    const key = CanvasPersistenceManager.getVantaKey("ecommerce-core");
    expect(key).toBe("projects/ecommerce-core/workspace/canvas");
  });
});
