/**
 * T1.3 (Ola 4) — El `ariaLabel` del `Menu` del kit: **o funciona, o no
 * existe**.
 *
 * ## El problema
 * Radix (`@radix-ui/react-dropdown-menu@2.1.25`) compone sus props así:
 *
 * ```js
 * jsx(MenuPrimitive.Content, {
 *   id: context.contentId,
 *   "aria-labelledby": context.triggerId,   ← Radix
 *   ...menuScope,
 *   ...contentProps,                          ← el CONSUMIDOR va después
 *   ref: forwardedRef,
 *   ...
 * })
 * ```
 *
 * Como `...contentProps` va **después**, el consumidor puede anular el
 * `aria-labelledby` de Radix (bastaría con pasar `undefined`). Y en el
 * cálculo del nombre accesible, `aria-labelledby` tiene prioridad sobre
 * `aria-label`: con el valor por defecto de Radix, el menú se nombra por su
 * **trigger** y el `ariaLabel` del kit no llega a decir nada.
 *
 * ## La decisión
 * **El `ariaLabel` se queda, y ahora hace lo que promete**: si el consumidor
 * lo pasa, el menú se nombra por esa etiqueta (el kit anula el
 * `aria-labelledby` de Radix). Si no lo pasa, el menú se nombra por su
 * trigger (el default de Radix, que es lo natural: el botón que abre el
 * menú es su nombre).
 *
 * La alternativa —quitar la prop— habría roto ~15 consumidores y habría
 * perdido el único nombre cuando el trigger es un botón de icono sin
 * texto visible.
 */
import { describe, it, expect, afterEach } from "vitest";
import { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { Menu } from "../components/ui-kit/Menu.js";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function mount(node: ReactNode): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  return container;
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
});

/** Abre el menú y devuelve su panel (`role="menu"`). */
async function openMenu(props: { ariaLabel?: string }): Promise<HTMLElement | null> {
  const el = await mount(
    <Menu
      trigger={<button type="button">Acciones</button>}
      items={[{ label: "Copiar" }, { label: "Pegar" }]}
      {...props}
    />
  );
  // Radix abre el panel en un portal: se busca en el documento.
  await act(async () => {
    const trigger = el.querySelector("button");
    trigger?.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true })
    );
    trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return document.querySelector('[role="menu"]') as HTMLElement | null;
}

describe("T1.3 — el `ariaLabel` del `Menu` nombra el menú (o no existe)", () => {
  it("SIN `ariaLabel`: el menú se nombra por su trigger (default de Radix)", async () => {
    const menu = await openMenu({});
    expect(menu, "el panel del menú no se montó").toBeTruthy();
    // `aria-labelledby` apunta al trigger → el nombre natural.
    expect(menu!.getAttribute("aria-labelledby")).toBeTruthy();
    expect(menu!.getAttribute("aria-label")).toBeNull();
  });

  it("CON `ariaLabel`: el menú se nombra por ESA etiqueta (no por el trigger)", async () => {
    const menu = await openMenu({ ariaLabel: "Acciones del proyecto" });
    expect(menu, "el panel del menú no se montó").toBeTruthy();
    expect(menu!.getAttribute("aria-label")).toBe("Acciones del proyecto");
    // Y el `aria-labelledby` de Radix queda anulado: si no, ganaría él
    // (prioridad de `aria-labelledby` sobre `aria-label`).
    expect(menu!.getAttribute("aria-labelledby")).toBeNull();
  });

  it("el trigger conserva su nombre accesible (no se le roba al menú)", async () => {
    const el = await mount(
      <Menu
        trigger={<button type="button">Acciones</button>}
        items={[{ label: "Copiar" }]}
        ariaLabel="Acciones del proyecto"
      />
    );
    const trigger = el.querySelector("button");
    expect(trigger?.textContent).toBe("Acciones");
  });
});
