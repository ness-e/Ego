import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AnsiText } from "../components/assistant-ui/ansi-text.js";
import { MessageRenderBoundary } from "../components/assistant-ui/message-render-boundary.js";
import { AskDirective } from "../components/assistant-ui/ask-directive.js";
import { ArtifactCard } from "../components/assistant-ui/artifact-card.js";
import { MarkdownText } from "../components/assistant-ui/markdown-text.js";

describe("HERM-01..05: Chat Assistant-UI Composables", () => {
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

  describe("HERM-05: AnsiText", () => {
    it("renderiza texto plano sin spans adicionales si no hay códigos ANSI", async () => {
      await act(async () => {
        root.render(<AnsiText text="Texto plano sin formato" />);
      });

      expect(container.textContent).toBe("Texto plano sin formato");
      expect(container.querySelectorAll("span")).toHaveLength(1);
    });

    it("renderiza spans con colores y estilos para secuencias ANSI SGR", async () => {
      const ansiString = "\x1b[1;32mÉxito:\x1b[0m \x1b[31mError 500\x1b[0m";
      await act(async () => {
        root.render(<AnsiText text={ansiString} />);
      });

      expect(container.textContent).toContain("Éxito: Error 500");
      const spans = container.querySelectorAll("span span");
      expect(spans.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("HERM-04: MessageRenderBoundary", () => {
    function BrokenComponent(): never {
      throw new Error("Simulated widget render crash");
    }

    it("aísla el error de renderizado mostrando fallback sin propagar la excepción", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await act(async () => {
        root.render(
          <MessageRenderBoundary resetKey="test-msg-1">
            <BrokenComponent />
          </MessageRenderBoundary>
        );
      });

      expect(container.textContent).toContain("Error al renderizar mensaje");
      expect(container.textContent).toContain("Simulated widget render crash");
      consoleSpy.mockRestore();
    });

    it("renderiza los hijos normalmente cuando no hay errores", async () => {
      await act(async () => {
        root.render(
          <MessageRenderBoundary resetKey="test-msg-2">
            <div>Mensaje renderizado con éxito</div>
          </MessageRenderBoundary>
        );
      });

      expect(container.textContent).toBe("Mensaje renderizado con éxito");
    });
  });

  describe("HERM-03: AskDirective", () => {
    it("renderiza la pregunta y botones de opciones", async () => {
      const handleSelect = vi.fn();
      await act(async () => {
        root.render(
          <AskDirective
            question="¿Desea aplicar los cambios en el archivo?"
            options="Sí, continuar|No, cancelar"
            onSelect={handleSelect}
          />
        );
      });

      expect(container.textContent).toContain("¿Desea aplicar los cambios en el archivo?");
      const buttons = Array.from(container.querySelectorAll("button"));
      const yesBtn = buttons.find((b) => b.textContent?.includes("Sí, continuar"));
      const noBtn = buttons.find((b) => b.textContent?.includes("No, cancelar"));

      expect(yesBtn).toBeDefined();
      expect(noBtn).toBeDefined();

      await act(async () => {
        yesBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(handleSelect).toHaveBeenCalledWith("Sí, continuar");
    });
  });

  describe("HERM-01: ArtifactCard", () => {
    it("renderiza tarjeta de artefacto con título, lenguaje y líneas", async () => {
      const handleOpen = vi.fn();
      const codeSnippet = "const a = 1;\nconst b = 2;\nconsole.log(a + b);";

      await act(async () => {
        root.render(
          <ArtifactCard
            title="math_calc.ts"
            language="typescript"
            kind="code"
            content={codeSnippet}
            onOpen={handleOpen}
          />
        );
      });

      expect(container.textContent).toContain("math_calc.ts");
      expect(container.textContent).toContain("3 líneas");

      const openBtn = container.querySelector('button[title="Abrir en Workspace"]');
      expect(openBtn).toBeDefined();

      await act(async () => {
        openBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(handleOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("HERM-02: MarkdownText", () => {
    it("suprime etiquetas <thinking> crudas según §9 de arquitectura canónica", async () => {
      const textWithCoT =
        "<thinking>analizando dependencias internas de Fjall y VantaDB</thinking>Respuesta pública de Ego";

      await act(async () => {
        root.render(<MarkdownText text={textWithCoT} />);
      });

      expect(container.textContent).not.toContain("analizando dependencias internas");
      expect(container.textContent).toContain("Respuesta pública de Ego");
    });

    it("renderiza acordeón de Explicabilidad y Evidencia para <ego:why>", async () => {
      const textWithWhy =
        "He generado la propuesta de arquitectura.\n<ego:why>Consultado namespace vanta/kb y memoria de proyectos.</ego:why>";

      await act(async () => {
        root.render(<MarkdownText text={textWithWhy} />);
      });

      expect(container.textContent).toContain("Explicabilidad & Evidencia");
      // Inicialmente el contenido de why está plegado
      expect(container.textContent).not.toContain("Consultado namespace vanta/kb");

      // Clic para desplegar
      const toggleBtn = container.querySelector("button");
      await act(async () => {
        toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(container.textContent).toContain("Consultado namespace vanta/kb");
    });

    it("promueve bloques de código de gran tamaño a ArtifactCard", async () => {
      const longCode =
        "```typescript\n" +
        Array.from({ length: 15 }, (_, i) => `const var_${i} = ${i};`).join("\n") +
        "\n```";

      await act(async () => {
        root.render(<MarkdownText text={longCode} />);
      });

      expect(container.textContent).toContain("typescript");
      expect(container.textContent).toContain("15 líneas");
    });
  });
});
