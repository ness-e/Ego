// OCLW-11 (A3) — El tipo de componente `mermaid` del Canvas.
//
// RED primero: antes de este trabajo, `componentKind: "mermaid"` no existía
// en el registry del renderer (el paquete `@ego/ui-runtime` ya tenía el
// preparador y el schema, pero ninguna vista React) → un manifiesto con
// ese tipo renderizaba "Tipo de componente desconocido".
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { getComponentRenderer } from "../components/canvas/registry.js";
import { getCanvasComponentRegistry } from "@ego/ui-runtime";
import { MERMAID_COMPONENT_KIND } from "@ego/ui-runtime";

describe("OCLW-11: tipo de componente `mermaid` en el registry del renderer", () => {
  it("el tipo `mermaid` queda registrado con schema y preparador", () => {
    const renderer = getComponentRenderer(MERMAID_COMPONENT_KIND);
    expect(renderer).toBeTypeOf("function");

    const registry = getCanvasComponentRegistry();
    expect(registry.has(MERMAID_COMPONENT_KIND)).toBe(true);
    expect(registry.getPropsSchema(MERMAID_COMPONENT_KIND)).toBeDefined();
    expect(registry.hasPrepare(MERMAID_COMPONENT_KIND)).toBe(true);
  });

  it("el preparador RECHAZA un diagrama inválido (fail-closed)", () => {
    const registry = getCanvasComponentRegistry();
    const prepared = registry.prepare(MERMAID_COMPONENT_KIND, {
      source: "flowchart TD\n  A[<script>alert(1)</script>] --> B",
    }) as { valid: boolean; source?: string };
    expect(prepared.valid).toBe(false);
    expect(prepared.source).toBeUndefined();
  });

  it("la vista renderiza el fuente saneado de un diagrama válido", () => {
    const renderer = getComponentRenderer(MERMAID_COMPONENT_KIND)!;
    render(
      React.createElement(renderer, {
        props: { source: "flowchart TD\n  A[Uno] --> B[Dos]" },
      })
    );
    const view = screen.getByText(/flowchart TD/);
    expect(view).toBeTruthy();
    expect(document.querySelector('[data-mermaid-view="valid"]')).toBeTruthy();
  });

  it("la vista NO renderiza el contenido de un diagrama inválido (fail-closed)", () => {
    const renderer = getComponentRenderer(MERMAID_COMPONENT_KIND)!;
    render(
      React.createElement(renderer, {
        props: { source: "flowchart TD\n  A[<script>alert(1)</script>] --> B" },
      })
    );
    // El contenido rechazado no aparece en el DOM.
    expect(document.body.textContent).not.toContain("<script>");
    expect(document.querySelector('[data-mermaid-view="valid"]')).toBeNull();
  });
});
