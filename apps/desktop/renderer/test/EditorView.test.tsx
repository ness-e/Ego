import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EditorView } from "../components/canvas/EditorView.js";

describe("CANV-03: EditorView con CodeMirror 6", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderiza el componente con header, lenguaje y código base", () => {
    const code = "const x: number = 42;\nconsole.log(x);";
    const { container } = render(
      <EditorView
        props={{
          id: "test-editor",
          title: "Mi Script",
          language: "typescript",
          code,
          readOnly: false,
          lineNumbers: true,
        }}
      />
    );

    expect(screen.getByText("Mi Script")).toBeTruthy();
    expect(screen.getByText("typescript")).toBeTruthy();
    // Verificamos que CodeMirror 6 haya montado su contenedor .cm-editor
    expect(container.querySelector(".cm-editor")).not.toBeNull();
    // Verificamos texto en sr-only para accesibilidad
    const srOnly = container.querySelector(".sr-only");
    expect(srOnly?.textContent).toBe(code);
  });

  it("permite copiar el contenido al portapapeles", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    const code = "print('Hola desde Python')";
    render(
      <EditorView
        props={{
          id: "py-editor",
          title: "script.py",
          language: "python",
          code,
          readOnly: true,
          lineNumbers: true,
        }}
      />
    );

    const copyBtn = screen.getByRole("button", { name: /copiar/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(code);
    expect(await screen.findByText("Copiado")).toBeTruthy();
  });

  it("respeta el modo solo lectura mostrando la insignia correspondiente", () => {
    render(
      <EditorView
        props={{
          id: "readonly-editor",
          title: "readonly.md",
          language: "markdown",
          code: "# Encabezado",
          readOnly: true,
          lineNumbers: true,
        }}
      />
    );

    expect(screen.getByText("Solo lectura")).toBeTruthy();
  });
});
