import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnsiText } from "../components/assistant-ui/ansi-text.js";
import { MessageRenderBoundary } from "../components/assistant-ui/message-render-boundary.js";
import { AskDirective } from "../components/assistant-ui/ask-directive.js";
import { ArtifactCard } from "../components/assistant-ui/artifact-card.js";
import { MarkdownText } from "../components/assistant-ui/markdown-text.js";

// STAB-08: migrado de createRoot+act+querySelector+dispatchEvent a RTL por
// comportamiento. Sin vi.restoreAllMocks() (ver App.test.tsx: protege el
// MockEgoBridge global de setup.ts).
describe("HERM-01..05: Chat Assistant-UI Composables", () => {
  afterEach(() => {
    cleanup();
  });

  describe("HERM-05: AnsiText", () => {
    it("renderiza texto plano sin spans adicionales si no hay códigos ANSI", async () => {
      render(<AnsiText text="Texto plano sin formato" />);

      expect(await screen.findByText("Texto plano sin formato")).toBeTruthy();
      expect(document.querySelectorAll("span")).toHaveLength(1);
    });

    it("renderiza spans con colores y estilos para secuencias ANSI SGR", async () => {
      const ansiString = "[1;32mÉxito:[0m [31mError 500[0m";
      render(<AnsiText text={ansiString} />);

      expect(await screen.findByText("Éxito:")).toBeTruthy();
      expect(screen.getByText("Error 500")).toBeTruthy();
      expect(document.querySelectorAll("span span").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("HERM-04: MessageRenderBoundary", () => {
    function BrokenComponent(): never {
      throw new Error("Simulated widget render crash");
    }

    it("aísla el error de renderizado mostrando fallback sin propagar la excepción", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        render(
          <MessageRenderBoundary resetKey="test-msg-1">
            <BrokenComponent />
          </MessageRenderBoundary>
        );

        expect(await screen.findByText(/Error al renderizar mensaje/)).toBeTruthy();
        expect(screen.getByText(/Simulated widget render crash/)).toBeTruthy();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("renderiza los hijos normalmente cuando no hay errores", async () => {
      render(
        <MessageRenderBoundary resetKey="test-msg-2">
          <div>Mensaje renderizado con éxito</div>
        </MessageRenderBoundary>
      );

      expect(await screen.findByText("Mensaje renderizado con éxito")).toBeTruthy();
    });
  });

  describe("HERM-03: AskDirective", () => {
    it("renderiza la pregunta y botones de opciones", async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();
      render(
        <AskDirective
          question="¿Desea aplicar los cambios en el archivo?"
          options="Sí, continuar|No, cancelar"
          onSelect={handleSelect}
        />
      );

      expect(
        await screen.findByText("¿Desea aplicar los cambios en el archivo?")
      ).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Sí, continuar" }));

      expect(handleSelect).toHaveBeenCalledWith("Sí, continuar");
      expect(screen.getByRole("button", { name: "No, cancelar" })).toBeTruthy();
    });
  });

  describe("HERM-01: ArtifactCard", () => {
    it("renderiza tarjeta de artefacto con título, lenguaje y líneas", async () => {
      const user = userEvent.setup();
      const handleOpen = vi.fn();
      const codeSnippet = "const a = 1;\nconst b = 2;\nconsole.log(a + b);";

      render(
        <ArtifactCard
          title="math_calc.ts"
          language="typescript"
          kind="code"
          content={codeSnippet}
          onOpen={handleOpen}
        />
      );

      expect(await screen.findByText("math_calc.ts")).toBeTruthy();
      expect(screen.getByText(/3 líneas/)).toBeTruthy();

      await user.click(screen.getByRole("button", { name: /abrir en workspace/i }));

      expect(handleOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("HERM-02: MarkdownText", () => {
    it("suprime etiquetas <thinking> crudas según §9 de arquitectura canónica", async () => {
      const textWithCoT =
        "<thinking>analizando dependencias internas de Fjall y VantaDB</thinking>Respuesta pública de Ego";

      render(<MarkdownText text={textWithCoT} />);

      expect(await screen.findByText("Respuesta pública de Ego")).toBeTruthy();
      expect(screen.queryByText(/analizando dependencias internas/)).toBeNull();
    });

    it("renderiza acordeón de Explicabilidad y Evidencia para <ego:why>", async () => {
      const user = userEvent.setup();
      const textWithWhy =
        "He generado la propuesta de arquitectura.\n<ego:why>Consultado namespace vanta/kb y memoria de proyectos.</ego:why>";

      render(<MarkdownText text={textWithWhy} />);

      expect(await screen.findByText(/Explicabilidad & Evidencia/)).toBeTruthy();
      expect(screen.queryByText(/Consultado namespace vanta\/kb/)).toBeNull();

      await user.click(screen.getByRole("button", { name: /explicabilidad/i }));

      expect(await screen.findByText(/Consultado namespace vanta\/kb/)).toBeTruthy();
    });

    it("promueve bloques de código de gran tamaño a ArtifactCard", async () => {
      const longCode =
        "```typescript\n" +
        Array.from({ length: 15 }, (_, i) => `const var_${i} = ${i};`).join("\n") +
        "\n```";

      render(<MarkdownText text={longCode} />);

      expect(await screen.findByText("typescript.txt")).toBeTruthy();
      expect(screen.getByText(/15 líneas/)).toBeTruthy();
    });
  });
});
