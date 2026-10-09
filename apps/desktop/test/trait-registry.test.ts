import { describe, it, expect, vi } from "vitest";
import {
  TraitRegistry,
  type TraitCategory,
  type DomainCharacterPreset,
} from "../renderer/components/character/traits/TraitRegistry.js";
import type { HeadFrame } from "../renderer/components/character/wardrobe/CharacterWardrobe.js";

describe("TraitRegistry — Presets de Dominio y Rasgos Compatibles (CHAR-07)", () => {
  it("1. Inicializa y registra traits anatómicos/geométricos sin ropa humana", () => {
    TraitRegistry.initialize();
    const traits = TraitRegistry.listTraits();
    expect(traits.length).toBeGreaterThanOrEqual(6);

    const categories = new Set(traits.map((t) => t.category));
    expect(categories.has("sensor")).toBe(true);
    expect(categories.has("crest")).toBe(true);
    expect(categories.has("visor")).toBe(true);
    expect(categories.has("aura")).toBe(true);

    // Aseguramos que ningún rasgo sea vestimenta humana (sombreros, trajes, bufandas)
    for (const trait of traits) {
      expect(trait.name.toLowerCase()).not.toContain("gorro");
      expect(trait.name.toLowerCase()).not.toContain("sombrero");
      expect(trait.name.toLowerCase()).not.toContain("bufanda");
      expect(trait.name.toLowerCase()).not.toContain("ropa");
    }
  });

  it("2. Contiene exactamente los 5 presets canónicos de dominio y ego.nucleus", () => {
    const requiredPresets = [
      "ego.nucleus",
      "researcher",
      "code_reviewer",
      "copywriter",
      "analyst",
      "planner",
    ];

    for (const id of requiredPresets) {
      const preset = TraitRegistry.getPreset(id);
      expect(preset).toBeDefined();
      expect(preset.id).toBe(id);
      expect(preset.bodyColors.length).toBe(2);
      expect(preset.accentColor.length).toBe(3);
      expect(preset.description).toBeDefined();
    }
  });

  it("3. getPreset resuelve por coincidencia de subEgoId o dominio con fallback seguro", () => {
    const byDomain = TraitRegistry.getPreset("knowledge");
    expect(byDomain.id).toBe("researcher");

    const byEngineering = TraitRegistry.getPreset("engineering");
    expect(byEngineering.id).toBe("code_reviewer");

    const fallback = TraitRegistry.getPreset("unknown-subego-custom");
    expect(fallback.id).toBe("ego.nucleus");
  });

  it("4. Valida compatibilidad y detecta colisiones de categoría de traits", () => {
    // Researcher combina sensor y visor (compatibles)
    const validCheck = TraitRegistry.validateCompatibility([
      "sensor_antenna_scanner",
      "visor_analytical",
    ]);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.conflicts.length).toBe(0);

    // Dos sensors en la misma entidad deben disparar conflicto
    const invalidCheck = TraitRegistry.validateCompatibility([
      "sensor_antenna_scanner",
      "sensor_bipolar_nodes",
    ]);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.conflicts[0]).toContain("Categoría duplicada 'sensor'");
  });

  it("5. Ejecuta renderLayer invocando los métodos de dibujo con el contexto Canvas 2D", () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      ellipse: vi.fn(),
      setLineDash: vi.fn(),
      globalAlpha: 1,
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 1,
      lineCap: "butt",
    } as unknown as CanvasRenderingContext2D;

    const mockHead: HeadFrame = {
      R: 50,
      rx: 50,
      ry: 50,
      yaw: 0,
      pitch: 0,
      phys: { dx: 0, dy: 0 },
    };

    // Renderizamos capa frontal de researcher
    expect(() => {
      TraitRegistry.renderLayer(
        "front",
        mockCtx,
        mockHead,
        ["sensor_antenna_scanner", "visor_analytical"],
        [0.06, 0.71, 0.83],
        1.0,
      );
    }).not.toThrow();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });
});
