import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Modal } from "../components/ui-kit/Modal.js";
import { Tabs } from "../components/ui-kit/Tabs.js";
import { ModelPicker } from "../components/ModelPicker.js";
import { SessionPicker } from "../components/SessionPicker.js";
import { DomainSelector, type DomainMeta } from "../components/domains/DomainSelector.js";
import { Omnibar } from "../components/omnibar.js";

// T07 UI-04: snapshots base del árbol accesible (roles/labels/estados).
// Son invariantes explícitas —no blobs `.snap`— para que cada cambio se
// revise a propósito (anti-patrón snapshot-abuse). Esta base CORRE en la
// suite (correctitud que bloquea); los pixel-visual Playwright quedan como
// follow-up advisory para Task 10 (sin browsers/MCP en este entorno).

/** Serializa el árbol accesible mínimo: rol + nombre + selected/disabled. */
function accessibleTree(scope: ParentNode): string {
  const parts: string[] = [];
  const els = scope.querySelectorAll(
    '[role="dialog"],[role="tablist"],[role="tab"],[role="tabpanel"],[role="menu"],[role^="menuitem"],[role="listbox"],[role="option"],[role="combobox"],[role="search"],button,input,select,textarea'
  );
  els.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") ?? "";
    const name =
      el.getAttribute("aria-label") ??
      (el as HTMLElement).innerText?.trim().slice(0, 40) ??
      "";
    const extra = [
      el.getAttribute("aria-selected"),
      el.getAttribute("aria-checked"),
      el.getAttribute("aria-expanded"),
      (el as HTMLButtonElement).disabled ? "disabled" : "",
    ]
      .filter(Boolean)
      .join(",");
    parts.push(`${tag}${role ? `#${role}` : ""}["${name}"]${extra ? `{${extra}}` : ""}`);
  });
  return parts.join("\n");
}

const DOMAINS: DomainMeta[] = [
  { id: "engineering", name: "Engineering", description: "d1", icon: "c", defaultSubEgoId: "ego.dev" },
  { id: "product", name: "Product", description: "d2", icon: "k", defaultSubEgoId: "ego.pm" },
];

describe("T07 UI-04: snapshots base del árbol accesible (advisory visual pendiente)", () => {
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
    document.body.innerHTML = "";
  });

  const mount = async (node: React.ReactNode) => {
    await act(async () => {
      root.render(node);
    });
  };

  it("Modal: árbol con dialog etiquetado, descripción y cierre", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="Fábrica" description="d" error="Falló">
        <p>contenido</p>
      </Modal>
    );
    const tree = accessibleTree(document.body);
    expect(tree).toContain("div#dialog");
    const dialog = document.body.querySelector('[role="dialog"]');
    const labelledBy = dialog?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? "")?.textContent).toContain("Fábrica");
    expect(tree).toContain('button["Cerrar diálogo"]');
    expect(document.body.textContent).toContain("Falló");
  });

  it("Tabs: tablist con 2 tabs (1 deshabilitado) y panel visible", async () => {
    await mount(
      <Tabs
        defaultValue="a"
        tabs={[
          { value: "a", label: "Plantilla", content: <span>CA</span> },
          { value: "b", label: "Custom", content: <span>CB</span>, disabled: true },
        ]}
      />
    );
    const tree = accessibleTree(container);
    expect(tree).toContain("div#tablist");
    expect(container.querySelectorAll('[role="tab"]').length).toBe(2);
    expect(tree).toContain("disabled");
    expect(container.textContent).toContain("CA");
  });

  it("ModelPicker abierto: dialog + buscador nombrado + opciones como botones", async () => {
    await mount(
      <ModelPicker isOpen activeModelId="gpt-4o" onClose={() => {}} onSelectModel={() => {}} />
    );
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    const search = document.body.querySelector("input[aria-label]");
    expect(search).not.toBeNull();
    expect(search?.getAttribute("aria-label")?.length).toBeGreaterThan(0);
    const options = document.body.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    // Cada opción es un <button> activable por teclado.
    options.forEach((o) => expect(o.tagName.toLowerCase()).toBe("button"));
    expect(document.body.textContent).toContain("GPT-4o");
  });

  it("SessionPicker abierto: dialog + buscador nombrado + opciones como botones", async () => {
    await mount(
      <SessionPicker
        isOpen
        sessions={[
          { id: "sess-snap-1", title: "Sesión snap uno", preview: "Vista...", subEgoId: "ego.nucleus", updatedAt: Date.now() },
          { id: "sess-snap-2", title: "Sesión snap dos", preview: "Vista...", subEgoId: "ego.developer", updatedAt: Date.now() },
        ]}
        onClose={() => {}}
        onResumeSession={() => {}}
      />
    );
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector("input[aria-label]")).not.toBeNull();
    const options = document.body.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    options.forEach((o) => expect(o.tagName.toLowerCase()).toBe("button"));
  });

  it("DomainSelector cerrado: trigger con nombre visible + estado colapsado", async () => {
    await mount(
      <DomainSelector domains={DOMAINS} activeDomainId="engineering" onSelectDomain={() => {}} />
    );
    const trigger = container.querySelector("button");
    expect(trigger?.textContent).toContain("Engineering");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("DomainSelector abierto: menú con 2 opciones y activa marcada", async () => {
    const onSelect = vi.fn();
    await mount(
      <DomainSelector domains={DOMAINS} activeDomainId="engineering" onSelectDomain={onSelect} />
    );
    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const options = container.querySelectorAll('[role^="menuitem"]');
    expect(options.length).toBe(2);
    const checked = container.querySelector('[aria-checked="true"]');
    expect(checked).not.toBeNull();
    expect(checked?.textContent).toContain("Engineering");
    // Segunda opción seleccionable con click.
    await act(async () => {
      options[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith("product");
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("Omnibar vía Ctrl+K: search + combobox + listbox", async () => {
    await mount(<Omnibar />);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    expect(document.body.querySelector('[role="search"]')).not.toBeNull();
    expect(document.body.querySelector('[role="combobox"]')).not.toBeNull();
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull();
    const tree = accessibleTree(document.body);
    expect(tree).toContain("Buscar en memoria federada");
  });
});
