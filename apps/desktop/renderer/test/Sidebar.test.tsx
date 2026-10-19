import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../components/sidebar.js";

const baseProps = {
  activeProject: "default",
  onSelectProject: vi.fn(),
  activeSubEgo: "ego.nucleus",
  onSelectSubEgo: vi.fn(),
  onNewSession: vi.fn(),
};

describe("T08 UI-05: Sidebar viva (datos del bridge, no hardcodeados)", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  const setup = async (props = baseProps) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Sidebar {...props} />);
      await Promise.resolve();
    });
    // Deja resolver los IPC del bridge (projects.list + subegos.list).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it("lista proyectos del bridge (Ego Core + Test Project)", async () => {
    await setup();
    expect(container.textContent).toContain("Ego Core");
    expect(container.textContent).toContain("Test Project");
  });

  it("roster vivo del bridge sin hardcodeados del monolito", async () => {
    await setup();
    // Vienen de `subegos.list()` del mock (setup.ts): Núcleo + Dev.
    expect(container.textContent).toContain("Ego Núcleo");
    expect(container.textContent).toContain("Ego Dev");
    // Hardcodeados eliminados del monolito anterior.
    expect(container.textContent).not.toContain("Sub-Ego Marketing");
    expect(container.textContent).not.toContain("Sub-Ego Producto");
    expect(container.textContent).not.toContain("Arquitectura del Sistema Operativo Cognitivo");
  });

  it("sin botones muertos: todo botón visible tiene acción", async () => {
    await setup();
    // Los muertos (Artifacts/Conectores sin onClick) se eliminaron.
    expect(container.textContent).not.toContain("Conectores Nivel A");
    // MCP conserva acción real y el buscador delega al omnibar.
    expect(container.textContent).toContain("MCP Servers & Tools");
    expect(container.textContent).toContain("Buscar recuerdos (Ctrl+K)");
  });

  it("BYOK por proveedor: exige key no vacía antes de guardar", async () => {
    const user = userEvent.setup();
    await setup();
    await act(async () => {
      const settingsBtn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Configuración")
      );
      settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain("Configuración de Ego");
    const trigger = document.body.querySelector('button[aria-label="Proveedor activo"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    await user.click(trigger);
    const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((el) =>
      el.textContent?.includes("Anthropic")
    ) as HTMLElement;
    expect(option).toBeTruthy();
    await user.click(option);
    await act(async () => {
      const save = Array.from(document.body.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Guardar Configuración")
      );
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });
    // Sin key de anthropic ni genérica → error BYOK explícito, no guardado silencioso.
    expect(document.body.textContent).toContain("exige una key no vacía");
  });
});
