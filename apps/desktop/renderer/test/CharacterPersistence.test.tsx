import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WardrobeSelector, type CustomCharacterConfig } from "../components/character/wardrobe/WardrobeSelector.js";
import {
  toCharacterPayload,
  saveCharacterConfig,
  loadCharacterConfig,
  characterNamespace,
  CHARACTER_KEY,
  type CharacterMemoryGateway,
} from "../components/character/wardrobe/characterProfileBridge.js";

const CONFIG: CustomCharacterConfig = {
  subEgoId: "ego.nucleus",
  name: "Mi Núcleo",
  bodyColors: ["#06b6d4", "#083344"],
  eyeShape: "happy",
  baseForm: "quantum-monolith",
  outfitId: null,
  traits: ["sensor_antenna_scanner", "trait_desconocido_xyz"],
};

function fakeGateway(store: Map<string, unknown>): CharacterMemoryGateway {
  return {
    put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
      store.set(`${item.namespace}/${item.key}`, item.payload);
      return { ok: true };
    }),
    get: vi.fn(async (namespace: string, key: string) => {
      const payload = store.get(`${namespace}/${key}`);
      return payload === undefined ? null : { namespace, key, payload };
    }),
  };
}

describe("CHAR-10: persistencia UI de personalización a VantaDB", () => {
  describe("1. Mapper UI → perfil canónico", () => {
    it("construye un payload válido con namespace y clave canónicos", () => {
      const payload = toCharacterPayload(CONFIG);
      expect(characterNamespace("ego.nucleus")).toBe("egos/ego.nucleus");
      expect(CHARACTER_KEY).toBe("character");
      expect(payload.id).toBe("char_nucleus");
      expect(payload.name).toBe("Mi Núcleo");
      expect(payload.baseForm).toBe("quantum-monolith");
      expect(payload.palette.primary).toBe("#06b6d4");
      expect(payload.palette.secondary).toBe("#083344");
      expect(payload.defaultEye).toBe("happy");
    });

    it("mapea traits conocidos al vocabulario canónico y preserva todos en uiConfig", () => {
      const payload = toCharacterPayload(CONFIG);
      const kinds = payload.traits.map((t) => t.kind);
      expect(kinds).toContain("antennae");
      const uiConfig = (payload.metadata as { uiConfig: CustomCharacterConfig }).uiConfig;
      expect(uiConfig.traits).toEqual(["sensor_antenna_scanner", "trait_desconocido_xyz"]);
      expect(uiConfig).toEqual(CONFIG);
    });

    it("rechaza colores inválidos en lugar de persistir basura", () => {
      expect(() =>
        toCharacterPayload({ ...CONFIG, bodyColors: ["no-es-color", "#083344"] })
      ).toThrow();
    });
  });

  describe("2. Round-trip contra gateway (put → get)", () => {
    it("lo guardado se recupera idéntico (sobrevive reinicio)", async () => {
      const store = new Map<string, unknown>();
      const gateway = fakeGateway(store);
      await saveCharacterConfig(CONFIG, gateway);
      expect(gateway.put).toHaveBeenCalledTimes(1);
      const item = (gateway.put as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        namespace: string;
        key: string;
      } | undefined;
      expect(item?.namespace).toBe("egos/ego.nucleus");
      expect(item?.key).toBe("character");

      const loaded = await loadCharacterConfig("ego.nucleus", gateway);
      expect(loaded).toEqual(CONFIG);
    });

    it("ausente o corrupto devuelve null sin romper (nunca wipe)", async () => {
      const store = new Map<string, unknown>();
      const gateway = fakeGateway(store);
      expect(await loadCharacterConfig("ego.nucleus", gateway)).toBeNull();

      store.set("egos/ego.nucleus/character", "{json-roto");
      expect(await loadCharacterConfig("ego.nucleus", gateway)).toBeNull();

      const failing: CharacterMemoryGateway = {
        put: vi.fn(async () => { throw new Error("down"); }),
        get: vi.fn(async () => { throw new Error("down"); }),
      };
      expect(await loadCharacterConfig("ego.nucleus", failing)).toBeNull();
      await expect(saveCharacterConfig(CONFIG, failing)).rejects.toThrow("down");
    });
  });

  describe("3. Integración WardrobeSelector ↔ window.ego", () => {
    let container: HTMLDivElement;
    let root: Root;

    const memoryMock = () => (window as unknown as { ego: { memory: ReturnType<typeof vi.fn> } }).ego.memory;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      memoryMock().mockReset();
      memoryMock().mockResolvedValue({ ok: true });
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      memoryMock().mockReset();
      memoryMock().mockResolvedValue({ ok: true });
    });

    it("guardar dispara put a egos/<id> + character", async () => {
      await act(async () => {
        root.render(<WardrobeSelector subEgoId="ego.nucleus" />);
      });
      memoryMock().mockClear();

      const saveBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Guardar Personalización")
      );
      await act(async () => {
        saveBtn?.click();
        await new Promise((r) => setTimeout(r, 10));
      });

      const puts = memoryMock().mock.calls.filter((c) => c[0] === "put");
      expect(puts.length).toBeGreaterThan(0);
      const item = puts[0]?.[1]?.[0] as { namespace: string; key: string; payload: { id: string } } | undefined;
      expect(item?.namespace).toBe("egos/ego.nucleus");
      expect(item?.key).toBe("character");
      expect(item?.payload.id.startsWith("char_")).toBe(true);
    });

    it("al montar restaura la personalización guardada", async () => {
      memoryMock().mockImplementation(async (op: string) => {
        if (op === "get") {
          return {
            namespace: "egos/ego.nucleus",
            key: "character",
            payload: toCharacterPayload(CONFIG),
          };
        }
        return { ok: true };
      });

      await act(async () => {
        root.render(<WardrobeSelector subEgoId="ego.nucleus" />);
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(memoryMock().mock.calls.some((c) => c[0] === "get")).toBe(true);
      expect(container.textContent).toContain("Mi Núcleo");
    });
  });
});
