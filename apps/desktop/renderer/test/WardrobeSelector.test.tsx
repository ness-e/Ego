import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WardrobeSelector } from "../components/character/wardrobe/WardrobeSelector.js";
import { TraitRegistry } from "../components/character/traits/TraitRegistry.js";

describe("CHAR-10: WardrobeSelector — Personalización y persistencia de avatar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    TraitRegistry.initialize();
    const orig = TraitRegistry.getPreset("ego.nucleus");
    TraitRegistry.registerPreset({ ...orig, outfitId: null, baseForm: "delta-core" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("debe renderizar el selector con el preset de ego.nucleus", async () => {
    await act(async () => {
      root.render(<WardrobeSelector subEgoId="ego.nucleus" />);
    });

    expect(container.textContent).toContain("Personalización de Identidad & Rasgos Morfológicos");
    expect(container.textContent).toContain("ego.nucleus");
    expect(container.textContent).toContain("Geometría Base del Núcleo");
    expect(container.textContent).toContain("Cyan Neón");
  });

  it("debe permitir seleccionar geometría morfológica y guardarla", async () => {
    const handleSave = vi.fn();

    await act(async () => {
      root.render(<WardrobeSelector subEgoId="ego.nucleus" onSave={handleSave} />);
    });

    // Encontrar botón de geometría Superelipse
    const superellipseBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Superelipse")
    );
    expect(superellipseBtn).toBeDefined();

    await act(async () => {
      superellipseBtn?.click();
    });

    // Encontrar botón de guardar
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Guardar Personalización")
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedConfig = handleSave.mock.calls[0][0];
    expect(savedConfig.subEgoId).toBe("ego.nucleus");
    expect(savedConfig.baseForm).toBe("coucou-mochi");

    // Verificar que TraitRegistry fue actualizado
    const updatedPreset = TraitRegistry.getPreset("ego.nucleus");
    expect(updatedPreset.baseForm).toBe("coucou-mochi");
  });

  it("debe restaurar a los valores predeterminados", async () => {
    await act(async () => {
      root.render(<WardrobeSelector subEgoId="ego.nucleus" />);
    });

    // Cambiar a Esmeralda Dev
    const emeraldBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Esmeralda Dev")
    );
    await act(async () => {
      emeraldBtn?.click();
    });

    // Click en restaurar
    const resetBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Restaurar Predeterminado")
    );
    await act(async () => {
      resetBtn?.click();
    });

    expect(container.textContent).toContain("Geometría Base del Núcleo");
    expect(container.textContent).toContain("Delta Core (Triángulo C₃)");
  });
});
