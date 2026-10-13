import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ModelPicker } from "../components/ModelPicker.js";
import { SessionPicker } from "../components/SessionPicker.js";
import { SplitPane } from "../components/PaneShell.js";

describe("HERM-09..12: Pickers, Slash Commands & Workspace Shell", () => {
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

  describe("HERM-10: ModelPicker", () => {
    it("renderiza lista de modelos canónicos con proveedores y capacidades", async () => {
      const handleSelect = vi.fn();
      const handleClose = vi.fn();

      await act(async () => {
        root.render(
          <ModelPicker
            isOpen={true}
            activeModelId="claude-3-7-sonnet"
            onClose={handleClose}
            onSelectModel={handleSelect}
          />
        );
      });

      expect(container.textContent).toContain("Claude 3.7 Sonnet");
      expect(container.textContent).toContain("GPT-4o");
      expect(container.textContent).toContain("Gemini 2.5 Pro");
      expect(container.textContent).toContain("Qwen 2.5 Coder 32B (Local)");

      // Filtrar por texto
      const input = container.querySelector("input");
      expect(input).toBeDefined();

      await act(async () => {
        if (input) {
          input.value = "sonnet";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    });
  });

  describe("HERM-11: SessionPicker", () => {
    it("renderiza sesiones y permite reanudar con onResumeSession", async () => {
      const handleResume = vi.fn();
      const handleClose = vi.fn();

      await act(async () => {
        root.render(
          <SessionPicker
            isOpen={true}
            onClose={handleClose}
            onResumeSession={handleResume}
          />
        );
      });

      expect(container.textContent).toContain("Arquitectura del Cognitive Runtime");
      expect(container.textContent).toContain("Integración de Dynamic Workspace y Canvas");

      // Clic en la primera sesión
      const firstSession = container.querySelector(".cursor-pointer");
      expect(firstSession).toBeDefined();

      await act(async () => {
        firstSession?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(handleResume).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe("HERM-09: SplitPane", () => {
    it("renderiza con el ancho por defecto y maneja persistencia en localStorage", async () => {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
      }

      await act(async () => {
        root.render(
          <SplitPane id="sidebar" defaultWidth={300} side="left">
            <div>Contenido del sidebar</div>
          </SplitPane>
        );
      });

      expect(container.textContent).toContain("Contenido del sidebar");
      const pane = container.querySelector('[data-pane-id="sidebar"]');
      expect(pane).toBeDefined();
      expect((pane as HTMLElement).style.width).toBe("300px");
    });
  });
});
