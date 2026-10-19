import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Sidebar } from "../components/sidebar.js";
import { App } from "../src/App.js";
import { SettingsModal } from "../components/sidebar/SettingsModal.js";

const baseProps = {
  activeProject: "default",
  onSelectProject: vi.fn(),
  activeSubEgo: "ego.nucleus",
  onSelectSubEgo: vi.fn(),
  onNewSession: vi.fn(),
};

describe("Targets44: Touch targets >= 44px y erradicación de <select> nativos", () => {
  afterEach(() => {
    cleanup();
  });

  it("Sidebar: controles del icon rail, avatar y botones de cabecera tienen >=44px y cero <select>", async () => {
    const { container } = render(<Sidebar {...baseProps} />);

    // 1. Cero selects nativos en el DOM
    expect(container.querySelector("select")).toBeNull();
    expect(document.body.querySelector("select")).toBeNull();

    // 2. Icon rail: todos los botones interactivos del rail deben tener min-h-11 y min-w-11 (>=44px)
    const rail = container.querySelector('nav[aria-label="Icon Rail"]');
    expect(rail).not.toBeNull();
    const railButtons = Array.from(rail!.querySelectorAll("button"));
    expect(railButtons.length).toBeGreaterThanOrEqual(6);

    for (const btn of railButtons) {
      const cls = btn.className;
      const has44MinH = cls.includes("min-h-11") || cls.includes("min-h-[44px]");
      const has44MinW = cls.includes("min-w-11") || cls.includes("min-w-[44px]");
      expect(
        has44MinH,
        `Botón del rail "${btn.getAttribute("aria-label") || btn.textContent}" debe tener clase de altura mínima >=44px (min-h-11)`
      ).toBe(true);
      expect(
        has44MinW,
        `Botón del rail "${btn.getAttribute("aria-label") || btn.textContent}" debe tener clase de anchura mínima >=44px (min-w-11)`
      ).toBe(true);
    }

    // 3. Avatar de usuario en el rail (Perfil de Eros)
    const avatar = rail!.querySelector('button[aria-label="Perfil de usuario y configuración"]');
    expect(avatar).not.toBeNull();
    expect(avatar!.className).toContain("min-h-11");
    expect(avatar!.className).toContain("min-w-11");

    // 4. Botones de cabecera en panel contextual: buscador y colapso
    const searchBtn = container.querySelector('button[aria-label="Buscar en memoria (Ctrl+K)"]');
    expect(searchBtn).not.toBeNull();
    expect(searchBtn!.className).toContain("min-h-11");
    expect(searchBtn!.className).toContain("min-w-11");

    const collapseBtn = container.querySelector('button[aria-label="Colapsar panel"]');
    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn!.className).toContain("min-h-11");
    expect(collapseBtn!.className).toContain("min-w-11");
  });

  it("App: selectores y botones del header tienen >=44px y cero <select> nativos", () => {
    const { container } = render(<App />);

    // 1. Cero selects nativos en el árbol de App
    expect(container.querySelector("select")).toBeNull();
    expect(document.body.querySelector("select")).toBeNull();

    // 2. Selector de modelo activo
    const modelPickerBtn = screen.getByRole("button", { name: "Selector de modelo activo" });
    expect(modelPickerBtn.className).toContain("min-h-11");
    expect(modelPickerBtn.className).toContain("min-w-11");

    // 3. Botón Isla Flotante
    const islandBtn = screen.getByRole("button", { name: "Mostrar u ocultar Isla Flotante" });
    expect(islandBtn.className).toContain("min-h-11");
    expect(islandBtn.className).toContain("min-w-11");

    // 4. Botón Workspace
    const workspaceBtn = screen.getByRole("button", { name: "Alternar panel de Workspace" });
    expect(workspaceBtn.className).toContain("min-h-11");
    expect(workspaceBtn.className).toContain("min-w-11");

    // 5. Selectores que sustituyen a <select>: Modelo del chat y Tema de diseño
    const chatModelTrigger = screen.getByRole("combobox", { name: "Modelo del chat" });
    expect(chatModelTrigger.className).toContain("min-h-11");
    expect(chatModelTrigger.className).toContain("min-w-11");

    const themeTrigger = screen.getByRole("combobox", { name: "Tema de diseño" });
    expect(themeTrigger.className).toContain("min-h-11");
    expect(themeTrigger.className).toContain("min-w-11");
  });

  it("SettingsModal: cero <select> nativos y todos los Select tienen >=44px", () => {
    render(<SettingsModal open={true} onOpenChange={vi.fn()} />);

    // 1. Cero selects nativos
    expect(document.body.querySelector("select")).toBeNull();

    // 2. Triggers de Select en SettingsModal
    const providerTrigger = screen.getByRole("combobox", { name: "Proveedor activo" });
    expect(providerTrigger.className).toContain("min-h-11");
    expect(providerTrigger.className).toContain("min-w-11");
  });
});
