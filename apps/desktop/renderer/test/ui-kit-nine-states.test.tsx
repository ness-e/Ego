import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "../components/ui-kit/Button.js";
import { Input } from "../components/ui-kit/Input.js";
import { Modal } from "../components/ui-kit/Modal.js";
import { Tabs } from "../components/ui-kit/Tabs.js";
import { Badge } from "../components/ui-kit/Badge.js";

/**
 * T16 (EGO-FIND-12): los 9 estados P22 por componente del kit —
 * default / hover / active / focus / disabled / loading / error / empty / overflow.
 * Contrato: `docs/design/design-system.md` §3.
 *
 * Nota happy-dom: las pseudo-clases CSS no se simulan; hover/active/focus se
 * verifican como contrato de clases Tailwind presentes en el DOM
 * (`hover:…`, `active:…`, `focus-visible:…` / `focus-within:…`). Los 6 estados
 * restantes se verifican por comportamiento real (attrs ARIA, disabled, slots).
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
});

describe("T16 FIND-12: Button — 9 estados P22", () => {
  it("default: variante primary renderiza con bg-ink", async () => {
    const el = await mount(<Button variant="primary">Crear</Button>);
    expect(el.querySelector("button")?.className).toContain("bg-ink");
  });

  it("hover: expone clase hover:opacity-90", async () => {
    const el = await mount(<Button variant="primary">Crear</Button>);
    expect(el.querySelector("button")?.className).toContain("hover:opacity-90");
  });

  it("active: expone clase active:scale", async () => {
    const el = await mount(<Button variant="primary">Crear</Button>);
    expect(el.querySelector("button")?.className).toContain("active:scale-");
  });

  it("focus: expone anillo focus-visible:outline", async () => {
    const el = await mount(<Button variant="primary">Crear</Button>);
    expect(el.querySelector("button")?.className).toContain("focus-visible:outline");
  });

  it("disabled: disabled=true deshabilita el botón", async () => {
    const el = await mount(<Button disabled>Off</Button>);
    expect(el.querySelector("button")?.disabled).toBe(true);
  });

  it("loading: deshabilita + aria-busy + spinner", async () => {
    const el = await mount(<Button loading>Borrando</Button>);
    const btn = el.querySelector("button");
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("aria-busy")).toBe("true");
    expect(el.innerHTML).toContain("animate-spin");
  });

  it("error: variante danger mapea el estado error", async () => {
    const el = await mount(<Button variant="danger">Borrar</Button>);
    expect(el.querySelector("button")?.className).toContain("bg-red-950");
  });

  it("empty: sin children mantiene altura mínima (>=44px, objetivo táctil)", async () => {
    const el = await mount(<Button variant="primary" aria-label="vacio" />);
    // T5 (EGO-FIND-55): el default era `min-h-[28px] min-w-[28px]`, que
    // contradecía el objetivo de 44px. El test CODIFICABA la regresión.
    expect(el.querySelector("button")?.className).toContain("min-h-11");
    expect(el.querySelector("button")?.className).toContain("min-w-11");
  });

  it("overflow: truncate limita ancho con max-w-full", async () => {
    const el = await mount(<Button truncate>Texto larguísimo que desborda</Button>);
    const btn = el.querySelector("button");
    expect(btn?.className).toContain("max-w-full");
    expect(btn?.className).toContain("truncate");
  });
});

describe("T16 FIND-12: Input — 9 estados P22", () => {
  it("default: renderiza input con placeholder", async () => {
    const el = await mount(<Input aria-label="buscar" placeholder="Buscar…" />);
    expect(el.querySelector("input")?.placeholder).toContain("Buscar");
  });

  it("hover: wrapper expone hover:border-dim", async () => {
    const el = await mount(<Input aria-label="q" />);
    expect(el.innerHTML).toContain("hover:border-dim");
  });

  it("active: wrapper expone active:border-dim", async () => {
    const el = await mount(<Input aria-label="q" />);
    expect(el.innerHTML).toContain("active:border-dim");
  });

  it("focus: wrapper expone anillo focus-within:border-brand", async () => {
    const el = await mount(<Input aria-label="q" />);
    expect(el.innerHTML).toContain("focus-within:border-brand");
  });

  it("disabled: disabled=true deshabilita el input", async () => {
    const el = await mount(<Input aria-label="off" disabled />);
    expect(el.querySelector("input")?.disabled).toBe(true);
  });

  it("loading: spinner + aria-busy", async () => {
    const el = await mount(<Input aria-label="cargando" loading />);
    expect(el.querySelector("input")?.getAttribute("aria-busy")).toBe("true");
    expect(el.innerHTML).toContain("animate-spin");
  });

  it("error: aria-invalid + mensaje role=alert", async () => {
    const el = await mount(
      <Input aria-label="nombre" error="Requerido" value="x" onChange={() => {}} />
    );
    expect(el.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Requerido");
  });

  it("empty: hint opcional en cursiva cuando no hay valor", async () => {
    const el = await mount(<Input aria-label="nick" hint="Visible para el equipo" />);
    expect(el.textContent).toContain("Visible para el equipo");
    expect(el.querySelector(".italic")).not.toBeNull();
  });

  it("overflow: truncate + contador maxLength", async () => {
    const el = await mount(
      <Input aria-label="bio" truncate hint="Bio corta" value="12345" maxLength={10} onChange={() => {}} />
    );
    expect(el.querySelector("input")?.className).toContain("truncate");
    expect(el.textContent).toContain("5/10");
  });
});

describe("T16 FIND-12: Modal — 9 estados P22", () => {
  it("default: role=dialog + aria-modal nativos de Radix", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="Fábrica">
        <p>contenido</p>
      </Modal>
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  it("hover: botón de cierre expone hover:bg-raised", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T">
        <p>x</p>
      </Modal>
    );
    const close = document.body.querySelector('button[aria-label="Cerrar diálogo"]');
    expect(close?.className).toContain("hover:bg-raised");
  });

  it("active: botón de cierre expone active:scale-95", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T">
        <p>x</p>
      </Modal>
    );
    const close = document.body.querySelector('button[aria-label="Cerrar diálogo"]');
    expect(close?.className).toContain("active:scale-95");
  });

  it("focus: contenido expone anillo focus:outline", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T">
        <p>x</p>
      </Modal>
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain("focus:outline");
  });

  it("disabled: renderiza sin invocar onOpenChange al montar", async () => {
    const spy = vi.fn();
    await mount(
      <Modal open onOpenChange={spy} title="T" disabled>
        <p>x</p>
      </Modal>
    );
    // El guard `if (disabled) return` bloquea el cierre; a nivel unitario se
    // verifica que el diálogo sigue operativo y el callback no se dispara solo.
    // (El dismiss por Escape lo gobierna Radix y se hereda sin re-testear.)
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("loading: aria-busy + franja Cargando…", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T" loading>
        <p>x</p>
      </Modal>
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).toContain("Cargando…");
  });

  it("error: slot role=alert con el mensaje", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T" error="Falló">
        <p>x</p>
      </Modal>
    );
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Falló");
  });

  it("empty: slot vacío cuando no hay contenido útil", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T" empty="Sin datos">
        <p>x</p>
      </Modal>
    );
    expect(document.body.textContent).toContain("Sin datos");
  });

  it("overflow: contenido con scroll (overflow-y-auto + max-h)", async () => {
    await mount(
      <Modal open onOpenChange={() => {}} title="T">
        <div style={{ height: 2000 }}>alto</div>
      </Modal>
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain("max-h-[85vh]");
    expect(document.body.innerHTML).toContain("overflow-y-auto");
  });
});

describe("T16 FIND-12: Tabs — 9 estados P22", () => {
  const twoTabs = [
    { value: "a", label: "Plantilla", content: <span>CA</span> },
    { value: "b", label: "Custom", content: <span>CB</span> },
  ];

  it("default: tablist con 2 tabs y contenido", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} />);
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(el.querySelectorAll('[role="tab"]').length).toBe(2);
    expect(el.textContent).toContain("CA");
  });

  it("hover: triggers exponen hover:text-ink", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} />);
    expect(el.innerHTML).toContain("hover:text-ink");
  });

  it("active: triggers exponen estilos data-[state=active]", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} />);
    expect(el.innerHTML).toContain("data-[state=active]:border-ink");
  });

  it("focus: triggers y paneles exponen focus-visible", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} />);
    expect(el.innerHTML).toContain("focus-visible:outline-brand");
  });

  it("disabled: tab deshabilitada queda disabled", async () => {
    const el = await mount(
      <Tabs
        defaultValue="a"
        tabs={[
          { value: "a", label: "A", content: <span>CA</span> },
          { value: "b", label: "B", content: <span>CB</span>, disabled: true },
        ]}
      />
    );
    const triggers = el.querySelectorAll('[role="tab"]');
    expect((triggers[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading: aria-busy + triggers deshabilitados", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} loading />);
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    const triggers = el.querySelectorAll('[role="tab"]');
    expect((triggers[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("error: franja role=alert con el mensaje", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} error="No cargó" />);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("No cargó");
  });

  it("empty: sin tabs muestra el slot vacío", async () => {
    const el = await mount(<Tabs tabs={[]} empty="Sin pestañas aún" />);
    expect(el.textContent).toContain("Sin pestañas aún");
  });

  it("overflow: lista con scroll horizontal + labels truncados", async () => {
    const el = await mount(<Tabs defaultValue="a" tabs={twoTabs} />);
    expect(el.innerHTML).toContain("overflow-x-auto");
    expect(el.innerHTML).toContain("max-w-[160px]");
  });
});

describe("T16 FIND-12: Badge — 9 estados P22", () => {
  it("default: renderiza children con tono info", async () => {
    const el = await mount(<Badge tone="info">Borrador</Badge>);
    expect(el.textContent).toContain("Borrador");
  });

  it("hover: expone hover:brightness-110", async () => {
    const el = await mount(<Badge>X</Badge>);
    expect(el.querySelector("span")?.className).toContain("hover:brightness-110");
  });

  it("active: expone active:scale", async () => {
    const el = await mount(<Badge>X</Badge>);
    expect(el.querySelector("span")?.className).toContain("active:scale-");
  });

  it("focus: expone anillo focus-visible:outline", async () => {
    const el = await mount(<Badge focusable>X</Badge>);
    const root = el.querySelector("span");
    expect(root?.getAttribute("tabindex")).toBe("0");
    expect(root?.className).toContain("focus-visible:outline");
  });

  it("disabled: tono dim sin opacity (contraste AA)", async () => {
    const el = await mount(<Badge tone="dim">Off</Badge>);
    const cls = el.querySelector("span")?.className ?? "";
    expect(cls).toContain("border-hairline/60");
    expect(cls).toContain("bg-panel");
    expect(cls).toContain("text-faint");
    expect(cls).not.toContain("opacity-70");
  });

  it("loading: aria-busy + pulse + spinner", async () => {
    const el = await mount(<Badge loading>Sync</Badge>);
    expect(el.querySelector("[aria-busy]")).not.toBeNull();
    expect(el.innerHTML).toContain("animate-pulse");
  });

  it("error: tono risk mapea el estado error", async () => {
    const el = await mount(<Badge tone="risk">Falló</Badge>);
    expect(el.querySelector("span")?.className).toContain("text-red-300");
  });

  it("empty: sin children muestra placeholder —", async () => {
    const el = await mount(<Badge />);
    expect(el.querySelector('[aria-label="vacío"]')).not.toBeNull();
  });

  it("overflow: title + truncate con ancho máximo", async () => {
    const el = await mount(<Badge overflow="Texto larguísimo que desborda">corto</Badge>);
    expect(el.querySelector("[title]")).not.toBeNull();
    expect(el.innerHTML).toContain("truncate");
  });
});
