import { describe, it, expect, afterEach, vi } from "vitest";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "../components/ui-kit/Button.js";
import { Input } from "../components/ui-kit/Input.js";
import { Menu } from "../components/ui-kit/Menu.js";
import { Tabs } from "../components/ui-kit/Tabs.js";

/**
 * Contrato de API del kit `ui-kit/` — props añadidas tras la ola de
 * migración a Radix (2026-10-20):
 *
 * 1. `Button` — `forwardRef` real (el `ref` llega tipado al `<button>`).
 * 2. `Button` — slot `icon` (sustituye al hack `[&>span]:flex`).
 * 3. `Menu`  — estado seleccionado (`checked` por ítem → `RadioItem`).
 * 4. `Menu`  — estado de apertura controlado (`open` / `onOpenChange`).
 * 5. `Tabs`  — `className` (raíz) y `contentClassName` (panel).
 * 6. `Input` — `leadingIcon` (icono dentro de la caja del campo).
 *
 * Todas las props son **retro-compatibles**: los consumidores previos
 * (que no las usan) siguen renderizando exactamente igual.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function mount(node: React.ReactNode): Promise<HTMLElement> {
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
  document.body.innerHTML = "";
});

/** Radix abre el dropdown con `pointerdown` (no con `click`). */
async function openMenu(trigger: Element | null): Promise<void> {
  await act(async () => {
    trigger?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  });
}

describe("ui-kit API — Button: forwardRef real", () => {
  it("el ref llega al <button> (no viaja implícitamente por ...rest)", async () => {
    const ref = createRef<HTMLButtonElement>();
    const el = await mount(<Button ref={ref}>Guardar</Button>);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("BUTTON");
    expect(ref.current).toBe(el.querySelector("button"));
    await unmountSafe();
  });

  it("el ref sigue funcionando como trigger `asChild` de Radix (Menu)", async () => {
    // `Menu` monta el trigger con `asChild`: el `Slot` de Radix inyecta un
    // `ref` en el hijo. Con `forwardRef` el Button lo acepta de forma
    // tipada en lugar de dejarlo viajar por `...rest`.
    const el = await mount(
      <Menu
        trigger={<Button variant="secondary">Acciones</Button>}
        items={[{ label: "Copiar" }]}
      />
    );
    const trigger = el.querySelector("button");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    await openMenu(trigger);
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    await unmountSafe();
  });
});

describe("ui-kit API — Button: slot `icon`", () => {
  it("el icono se renderiza ANTES del <span> de contenido", async () => {
    const el = await mount(
      <Button icon={<span data-testid="icono">I</span>}>Guardar</Button>
    );
    const kids = Array.from(el.querySelector("button")?.children ?? []);
    // kids[0] = envoltorio decorativo del icono (`aria-hidden`).
    expect(kids[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(kids[0]?.querySelector('[data-testid="icono"]')?.textContent).toBe("I");
    // kids[1] = el <span> de contenido (envuelve los `children`).
    expect(kids[1]?.tagName).toBe("SPAN");
    expect(kids[1]?.textContent).toBe("Guardar");
    await unmountSafe();
  });

  it("el gap-1.5 del base separa el icono de la etiqueta", async () => {
    const el = await mount(<Button icon={<span>I</span>}>Guardar</Button>);
    // El `gap-1.5` vive en el `<button>`: al ser el icono hermano del
    // `<span>` de contenido (y no un hijo suyo), el base lo aplica.
    expect(el.querySelector("button")?.className).toContain("gap-1.5");
    await unmountSafe();
  });

  it("el icono NO cuenta como texto visible (sigue siendo botón sólo-icono 44×44)", async () => {
    const el = await mount(<Button icon={<span>I</span>} aria-label="sólo icono" />);
    expect(el.querySelector("button")?.className).toContain("min-h-11");
    expect(el.querySelector("button")?.className).toContain("min-w-11");
    await unmountSafe();

    const el2 = await mount(<Button icon={<span>I</span>}>Guardar</Button>);
    expect(el2.querySelector("button")?.className).not.toContain("min-h-11");
    await unmountSafe();
  });

  it("el icono es decorativo (aria-hidden): el nombre accesible lo da la etiqueta", async () => {
    const el = await mount(<Button icon={<span>I</span>}>Guardar</Button>);
    const iconWrapper = el.querySelector("button > span[aria-hidden]");
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.textContent).toBe("I");
    await unmountSafe();
  });
});

describe("ui-kit API — Menu: estado seleccionado (radio)", () => {
  const radioItems = [
    { label: "Uno", checked: false },
    { label: "Dos", checked: true },
    { label: "Tres", checked: false },
  ];

  it("los ítems con `checked` se renderizan como menuitemradio con aria-checked", async () => {
    const el = await mount(
      <Menu trigger={<button type="button">Abrir</button>} items={radioItems} />
    );
    await openMenu(el.querySelector("button"));

    const radios = Array.from(document.body.querySelectorAll('[role="menuitemradio"]'));
    expect(radios.length).toBe(3);
    const dos = radios.find((r) => r.textContent?.includes("Dos"));
    const uno = radios.find((r) => r.textContent?.includes("Uno"));
    expect(dos?.getAttribute("aria-checked")).toBe("true");
    expect(uno?.getAttribute("aria-checked")).toBe("false");
    await unmountSafe();
  });

  it("el indicador (check) sólo se renderiza en el ítem marcado", async () => {
    const el = await mount(
      <Menu trigger={<button type="button">Abrir</button>} items={radioItems} />
    );
    await openMenu(el.querySelector("button"));

    const radios = Array.from(document.body.querySelectorAll('[role="menuitemradio"]'));
    const dos = radios.find((r) => r.textContent?.includes("Dos"));
    const uno = radios.find((r) => r.textContent?.includes("Uno"));
    // El marcado lleva el indicador (SVG del check).
    expect(dos?.querySelector("svg")).not.toBeNull();
    // El no marcado conserva la columna de ancho fijo pero SIN indicador.
    expect(uno?.querySelector("svg")).toBeNull();
    await unmountSafe();
  });

  it("los ítems SIN `checked` siguen siendo menuitem (acción normal)", async () => {
    const el = await mount(
      <Menu
        trigger={<button type="button">Abrir</button>}
        items={[{ label: "Copiar" }, { label: "Pegar" }]}
      />
    );
    await openMenu(el.querySelector("button"));
    expect(document.body.querySelectorAll('[role="menuitemradio"]').length).toBe(0);
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBe(2);
    await unmountSafe();
  });

  it("un menú mixto (acciones + opciones) conserva ambos roles", async () => {
    const el = await mount(
      <Menu
        trigger={<button type="button">Abrir</button>}
        items={[{ label: "Copiar" }, { label: "Modo", checked: true }]}
      />
    );
    await openMenu(el.querySelector("button"));
    expect(document.body.querySelectorAll('[role="menuitemradio"]').length).toBe(1);
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBe(1);
    await unmountSafe();
  });

  it("`onSelect` se sigue invocando en un ítem radio", async () => {
    const onSelect = vi.fn();
    const el = await mount(
      <Menu
        trigger={<button type="button">Abrir</button>}
        items={[{ label: "Uno", checked: false, onSelect }]}
      />
    );
    await openMenu(el.querySelector("button"));
    const item = document.body.querySelector('[role="menuitemradio"]');
    await act(async () => {
      item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    await unmountSafe();
  });

  it("modo no controlado: al seleccionar, la marca se mueve a la opción elegida", async () => {
    const el = await mount(
      <Menu
        trigger={<button type="button">Abrir</button>}
        items={[
          { label: "Uno", checked: false },
          { label: "Dos", checked: false },
        ]}
      />
    );
    await openMenu(el.querySelector("button"));
    const dos = Array.from(document.body.querySelectorAll('[role="menuitemradio"]')).find((r) =>
      r.textContent?.includes("Dos"),
    );
    await act(async () => {
      dos?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // La selección cierra el menú (comportamiento de Radix): se reabre
    // para comprobar que la marca quedó en la opción elegida.
    await openMenu(el.querySelector("button"));
    const radios = Array.from(document.body.querySelectorAll('[role="menuitemradio"]'));
    const dosAgain = radios.find((r) => r.textContent?.includes("Dos"));
    const unoAgain = radios.find((r) => r.textContent?.includes("Uno"));
    expect(dosAgain?.getAttribute("aria-checked")).toBe("true");
    expect(unoAgain?.getAttribute("aria-checked")).toBe("false");
    await unmountSafe();
  });

  it("modo controlado: el `checked` del consumidor manda sobre la marca", async () => {
    const el = await mount(
      <Menu
        trigger={<button type="button">Abrir</button>}
        items={[
          { label: "Uno", checked: true },
          { label: "Dos", checked: false },
        ]}
      />
    );
    await openMenu(el.querySelector("button"));
    const radios = Array.from(document.body.querySelectorAll('[role="menuitemradio"]'));
    expect(radios.find((r) => r.textContent?.includes("Uno"))?.getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(radios.find((r) => r.textContent?.includes("Dos"))?.getAttribute("aria-checked")).toBe(
      "false",
    );
    await unmountSafe();
  });
});

describe("ui-kit API — Menu: estado de apertura controlado", () => {
  it("`open` controla si el panel se renderiza", async () => {
    await mount(
      <Menu open={false} trigger={<button type="button">Abrir</button>} items={[{ label: "A" }]} />
    );
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    await unmountSafe();

    await mount(
      <Menu open trigger={<button type="button">Abrir</button>} items={[{ label: "A" }]} />
    );
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    await unmountSafe();
  });

  it("`onOpenChange` se invoca al pedir la apertura (estado controlado)", async () => {
    const onOpenChange = vi.fn();
    const el = await mount(
      <Menu
        open={false}
        onOpenChange={onOpenChange}
        trigger={<button type="button">Abrir</button>}
        items={[{ label: "A" }]}
      />
    );
    await openMenu(el.querySelector("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await unmountSafe();
  });

  it("sin `open` el menú sigue siendo autocontenido (no rompe)", async () => {
    const el = await mount(
      <Menu trigger={<button type="button">Abrir</button>} items={[{ label: "A" }]} />
    );
    await openMenu(el.querySelector("button"));
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    await unmountSafe();
  });
});

describe("ui-kit API — Tabs: className y contentClassName", () => {
  const tabs = [
    { value: "a", label: "A", content: <span>CA</span> },
    { value: "b", label: "B", content: <span>CB</span> },
  ];

  it("`className` va a la raíz del kit", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={tabs} className="mi-raiz" />);
    const root = el.firstElementChild as HTMLElement;
    expect(root.className).toContain("mi-raiz");
    expect(root.className).toContain("flex");
    await unmountSafe();
  });

  it("`contentClassName` va al panel (tabpanel)", async () => {
    const el = await mount(
      <Tabs defaultValue="a" tabs={tabs} contentClassName="mi-panel" />
    );
    const panel = el.querySelector('[role="tabpanel"]');
    expect(panel?.className).toContain("mi-panel");
    await unmountSafe();
  });

  it("la raíz de Radix es una columna flex: el panel puede crecer sin selectores frágiles", async () => {
    // Esto es lo que permite sustituir el hack
    // `[&>div>div>div[role=tabpanel]]:flex-1` del WorkbenchView.
    const el = await mount(<Tabs defaultValue="a" tabs={tabs} />);
    const radixRoot = el.querySelector('[role="tablist"]')?.parentElement as HTMLElement;
    expect(radixRoot.className).toContain("flex");
    expect(radixRoot.className).toContain("flex-col");
    expect(radixRoot.className).toContain("grow");
    await unmountSafe();
  });
});

describe("ui-kit API — Input: leadingIcon", () => {
  it("el icono se renderiza dentro de la caja, antes del <input>", async () => {
    const el = await mount(
      <Input aria-label="buscar" leadingIcon={<span data-testid="lupa">L</span>} />
    );
    const input = el.querySelector("input");
    const box = input?.parentElement as HTMLElement;
    const kids = Array.from(box.children);
    // kids[0] = envoltorio decorativo del icono (`aria-hidden`).
    expect(kids[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(kids[0]?.querySelector('[data-testid="lupa"]')?.textContent).toBe("L");
    expect(kids[1]?.tagName).toBe("INPUT");
    await unmountSafe();
  });

  it("el icono es decorativo (aria-hidden) y la API actual se conserva", async () => {
    const el = await mount(
      <Input aria-label="buscar" placeholder="Buscar…" leadingIcon={<span>L</span>} />
    );
    expect(el.querySelector("input")?.placeholder).toContain("Buscar");
    expect(el.querySelector("input")?.getAttribute("aria-label")).toBe("buscar");
    expect(el.querySelector("span[aria-hidden]")).not.toBeNull();
    await unmountSafe();
  });
});

/** Desmonta el árbol de React sin perder el `container` (helper local). */
async function unmountSafe(): Promise<void> {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
  document.body.innerHTML = "";
}
