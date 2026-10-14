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

  it("debe guardar el estado serializado en el store bajo la clave canónica (T04)", async () => {
    const puts: Array<{ namespace: string; key: string; payload: unknown }> = [];
    const store = {
      put: async (item: { namespace: string; key: string; payload: unknown }) => {
        puts.push(item);
        return { ok: true };
      },
      get: async () => null,
    };

    await CanvasPersistenceManager.save(store, "proj-1", VALID_STATE);

    expect(puts.length).toBe(1);
    expect(puts[0].namespace).toBe("projects/proj-1");
    expect(puts[0].key).toBe("projects/proj-1/workspace/canvas");
    const data = (puts[0].payload as { data: string }).data;
    expect(typeof data).toBe("string");
    expect(data).toContain("canvas-proj-1");
  });

  it("debe cargar y deserializar un estado guardado, sobreviviendo a un reinicio (T04)", async () => {
    const stored = new Map<string, { payload: unknown }>();
    const store = {
      put: async (item: { namespace: string; key: string; payload: unknown }) => {
        stored.set(`${item.namespace}::${item.key}`, { payload: item.payload });
        return { ok: true };
      },
      get: async (namespace: string, key: string) =>
        stored.get(`${namespace}::${key}`) ?? null,
    };

    await CanvasPersistenceManager.save(store, "proj-1", VALID_STATE);
    // Simula reinicio: nuevo lector sobre el mismo store persistente
    const restored = await CanvasPersistenceManager.load(store, "proj-1");

    expect(restored).not.toBeNull();
    expect(restored?.projectId).toBe("proj-1");
    expect(restored?.components.length).toBe(1);
    expect(restored?.components[0].props.title).toBe("Test Card");
  });

  it("debe retornar null al cargar cuando no hay nada persistido (T04)", async () => {
    const store = {
      put: async () => ({ ok: true }),
      get: async () => null,
    };
    await expect(CanvasPersistenceManager.load(store, "proj-vacio")).resolves.toBeNull();
  });
});
