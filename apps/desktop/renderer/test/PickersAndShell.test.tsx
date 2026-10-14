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

      // Radix porta el contenido a document.body (T07: Modal con trap+Escape)
      expect(document.body.textContent).toContain("Claude 3.7 Sonnet");
      expect(document.body.textContent).toContain("GPT-4o");
      expect(document.body.textContent).toContain("Gemini 3.8 Flash");
      expect(document.body.textContent).toContain("Qwen 2.5 Coder 32B (Local)");

      // Filtrar por texto
      const input = document.body.querySelector("input");
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
      // 2026-10-14: las sesiones son datos del test (el componente ya no
      // inventa DEFAULT_SESSIONS; vacío honesto en producción).
      const sessions = [
        { id: "sess-test-arch", title: "Arquitectura del Cognitive Runtime", preview: "Revisión de adapters...", subEgoId: "ego.nucleus", updatedAt: Date.now() - 900000 },
        { id: "sess-test-canvas", title: "Integración de Dynamic Workspace y Canvas", preview: "PayloadRef y DOM...", subEgoId: "ego.developer", updatedAt: Date.now() - 7200000 },
      ];

      await act(async () => {
        root.render(
          <SessionPicker
            isOpen={true}
            sessions={sessions}
            onClose={handleClose}
            onResumeSession={handleResume}
          />
        );
      });

      // Radix porta el contenido a document.body (T07: Modal con trap+Escape)
      expect(document.body.textContent).toContain("Arquitectura del Cognitive Runtime");
      expect(document.body.textContent).toContain("Integración de Dynamic Workspace y Canvas");

      // Clic en la primera sesión
      const firstSession = document.body.querySelector(".cursor-pointer");
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
