import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SubEgoSelector } from "../components/SubEgoSelector.js";

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

    // El dropdown es el primitive `Menu` del kit (Radix DropdownMenu), que
    // aporta teclado, roles `menu`/`menuitem` y retorno del foco. Dos
    // consecuencias para el test:
    //  1. abre con `pointerdown` (no con `click`);
    //  2. el panel se PORTALEA a `document.body`, así que se busca fuera
    //     del `container` de React.
    await act(async () => {
      triggerButton?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    });

    // Debe mostrar la lista de Sub-Egos (por ejemplo "Ego Dev")
    expect(document.body.textContent).toContain("Ego Dev");

    // Click en la opción Ego Dev
    const items = document.body.querySelectorAll("[role='menuitem']");
    const devItem = Array.from(items).find((btn) =>
      btn.textContent?.includes("Ego Dev"),
    );
    expect(devItem).toBeDefined();

    await act(async () => {
      devItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("ego.developer");
  });
});
