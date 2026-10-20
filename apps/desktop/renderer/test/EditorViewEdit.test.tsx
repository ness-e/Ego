import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { EditorView as CMView } from "@codemirror/view";
import { EditorView } from "../components/canvas/EditorView.js";

/**
 * T6 (EGO-FIND-57) — El `EditorView` de CodeMirror 6 debe EDITAR de verdad.
 *
 * Antes:
 *  - no había `onChange`: la edición nunca se propagaba al Canvas,
 *  - `props.code` estaba en las deps del `useEffect` → el editor se
 *    destruía y recreaba en cada cambio (cursor, selección e historial de
 *    undo perdidos),
 *  - el fallback a tabla estática ocultaba el fallo sin señal visible.
 */
describe("T6: EditorView con CodeMirror 6 — monta, edita y persiste", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    id: "test-editor",
    title: "Mi Script",
    language: "typescript",
    code: "const x: number = 42;",
    readOnly: false,
    lineNumbers: true,
  };

  it("monta CodeMirror y expone el documento inicial", () => {
    const { container } = render(<EditorView props={baseProps} />);
    expect(container.querySelector(".cm-editor")).not.toBeNull();
    expect(container.querySelector(".cm-content")?.textContent).toContain("const x: number = 42;");
  });

  it("propaga los cambios con onChange (el editor edita de verdad)", () => {
    const onChange = vi.fn();
    const { container } = render(<EditorView props={{ ...baseProps, onChange }} />);

    const content = container.querySelector(".cm-content") as HTMLElement | null;
    expect(content).not.toBeNull();

    // CodeMirror 6 no depende de `contenteditable` en happy-dom, así que se
    // despacha el cambio por la API del editor (transacción de estado), que
    // es exactamente lo que hace el usuario al escribir.
    const editorDom = container.querySelector(".cm-editor") as HTMLElement | null;
    expect(editorDom).not.toBeNull();
    const view = CMView.findFromDOM(editorDom!);
    expect(view).toBeTruthy();

    act(() => {
      view!.dispatch({
        changes: { from: 0, to: 0, insert: "// comentario\n" },
      });
    });

    expect(onChange).toHaveBeenCalled();
    expect(String(onChange.mock.calls[0]?.[0])).toContain("// comentario");
  });

  it("NO remonta el editor cuando cambia `code` (conserva cursor e historial)", () => {
    const { container, rerender } = render(<EditorView props={baseProps} />);
    const first = container.querySelector(".cm-content");
    expect(first).not.toBeNull();

    rerender(<EditorView props={{ ...baseProps, code: "const x: number = 43;" }} />);

    // El mismo nodo DOM (misma identidad) → el editor NO se recreó.
    const second = container.querySelector(".cm-content");
    expect(second).toBe(first);
    expect(second?.textContent).toContain("43");
  });

  it("el fallback a tabla estática NO enmascara el fallo (error visible)", () => {
    // Se fuerza un fallo de montaje simulando un `code` no iterable.
    const broken = { ...baseProps, code: null as unknown as string };
    const { container } = render(<EditorView props={broken} />);
    // Con el fallback, el usuario debe ver un aviso, no una tabla silenciosa.
    const table = container.querySelector("table");
    const notice = container.querySelector("[data-editor-fallback]");
    if (table) {
      expect(notice, "el fallback debe avisar al usuario").not.toBeNull();
    }
  });
});
