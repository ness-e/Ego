import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SubEgoSelector } from "../components/SubEgoSelector.js";
import { ego } from "../lib/ego.js";

describe("CANV-12: SubEgoSelector — Prueba de Componente UI en Happy-DOM", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("debe renderizar el selector con el Sub-Ego activo y opciones de MockEgoBridge", async () => {
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <SubEgoSelector
          activeSubEgoId="ego.nucleus"
          onSelectSubEgo={onSelect}
        />
      );
    });

    // Permitir resolución de efectos y llamadas asíncronas a ego().subegos.list()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container.textContent).toContain("Ego Núcleo");
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("debe abrir el dropdown al hacer click y permitir seleccionar otro Sub-Ego", async () => {
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <SubEgoSelector
          activeSubEgoId="ego.nucleus"
          onSelectSubEgo={onSelect}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const triggerButton = container.querySelector("button");
    expect(triggerButton).not.toBeNull();

    // Click para abrir dropdown
    await act(async () => {
      triggerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Debe mostrar la lista de Sub-Egos (por ejemplo "Ego Dev")
    expect(container.textContent).toContain("Ego Dev");

    // Click en la opción Ego Dev
    const items = container.querySelectorAll("button");
    const devItem = Array.from(items).find((btn) => btn.textContent?.includes("Ego Dev"));
    expect(devItem).toBeDefined();

    await act(async () => {
      devItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("ego.developer");
  });
});
