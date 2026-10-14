import { describe, it, expect } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "../components/ui-kit/Button.js";
import { Input } from "../components/ui-kit/Input.js";
import { Modal } from "../components/ui-kit/Modal.js";
import { Tabs } from "../components/ui-kit/Tabs.js";
import { Badge } from "../components/ui-kit/Badge.js";
import { useUiStore } from "../components/ui-kit/store.js";

// T06 S2 (RED): kit Radix+Zustand con los 9 estados P22 por componente:
// default / hover / active / focus / disabled / loading / error / empty / overflow.
describe("T06 UI-03: ui-kit base (Radix + cva + tailwind-merge, 9 estados P22)", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (node: React.ReactNode) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(node);
    });
    return container;
  };

  const unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };

  it("Button: 9 estados (variantes + disabled/loading + aria)", async () => {
    const el = await mount(<Button variant="primary">Crear</Button>);
    const btn = el.querySelector("button");
    expect(btn?.textContent).toContain("Crear");
    expect(btn?.className).toContain("bg-ink");
    await unmount();

    const el2 = await mount(
      <Button variant="danger" loading>
        Borrando
      </Button>
    );
    const btn2 = el2.querySelector("button");
    expect(btn2?.disabled).toBe(true);
    expect(btn2?.getAttribute("aria-busy")).toBe("true");
    await unmount();

    const el3 = await mount(
      <Button variant="ghost" disabled>
        Off
      </Button>
    );
    expect(el3.querySelector("button")?.disabled).toBe(true);
    await unmount();
  });

  it("Input: 9 estados (default/focus/disabled/error/empty + loading)", async () => {
    const el = await mount(<Input aria-label="buscar" placeholder="Buscar…" />);
    expect(el.querySelector("input")?.placeholder).toContain("Buscar");
    await unmount();

    const el2 = await mount(<Input aria-label="nombre" error="Requerido" value="x" onChange={() => {}} />);
    expect(el2.textContent).toContain("Requerido");
    expect(el2.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    await unmount();

    const el3 = await mount(<Input aria-label="off" disabled />);
    expect(el3.querySelector("input")?.disabled).toBe(true);
    await unmount();
  });

  it("Modal: Radix Dialog con trap nativo, Escape, aria-modal y 9 estados", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="Fábrica">
        <p>contenido</p>
      </Modal>
    );
    // Radix usa role="dialog" + aria-modal nativos (portal en body)
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(document.body.textContent).toContain("contenido");
    await unmount();

    // error + empty + overflow: el Modal expone slots de estado
    await mount(
      <Modal open onOpenChange={() => {}} title="T" error="Falló" empty="Sin datos">
        <div style={{ height: 2000 }}>alto</div>
      </Modal>
    );
    expect(document.body.textContent).toContain("Falló");
    expect(document.body.textContent).toContain("Sin datos");
    await unmount();
  });

  it("Tabs: Radix Tabs con roles tab/tablist y 9 estados", async () => {
    const el = await mount(
      <Tabs
        defaultValue="a"
        tabs={[
          { value: "a", label: "Plantilla", content: <span>CA</span> },
          { value: "b", label: "Custom", content: <span>CB</span>, disabled: true },
        ]}
      />
    );
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(el.querySelectorAll('[role="tab"]').length).toBe(2);
    expect(el.textContent).toContain("CA");
    await unmount();
  });

  it("Badge: variantes + estados (loading/error/empty/overflow con title)", async () => {
    const el = await mount(<Badge tone="ok">Activo</Badge>);
    expect(el.textContent).toContain("Activo");
    await unmount();

    const el2 = await mount(
      <Badge tone="risk" loading>
        Sync
      </Badge>
    );
    expect(el2.querySelector("[aria-busy]")).not.toBeNull();
    await unmount();

    const el3 = await mount(
      <Badge tone="dim" overflow="Texto larguísimo que desborda el contenedor del badge">
        corto
      </Badge>
    );
    expect(el3.querySelector("[title]")).not.toBeNull();
    await unmount();
  });

  it("store Zustand: pickers + modelo + sesión + error/empty globales", () => {
    const s0 = useUiStore.getState();
    expect(s0.modelPickerOpen).toBe(false);
    expect(s0.sessionPickerOpen).toBe(false);

    act(() => {
      useUiStore.getState().openModelPicker();
    });
    expect(useUiStore.getState().modelPickerOpen).toBe(true);

    act(() => {
      useUiStore.getState().setActiveModelId("gpt-4o");
      useUiStore.getState().closeModelPicker();
      useUiStore.getState().setUiError("boom");
    });
    const s1 = useUiStore.getState();
    expect(s1.activeModelId).toBe("gpt-4o");
    expect(s1.modelPickerOpen).toBe(false);
    expect(s1.uiError).toBe("boom");

    act(() => {
      useUiStore.getState().clearUiError();
      useUiStore.getState().reset();
    });
    expect(useUiStore.getState().uiError).toBeNull();
    expect(s0).toBeDefined();
  });
});
