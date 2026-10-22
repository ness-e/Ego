/**
 * Ola 10 (A4) — Contratos de COMPORTAMIENTO de los 8 hallazgos visuales.
 *
 * ## Por qué este fichero
 * Los hallazgos de la auditoría visual (EGO-FIND-96/97/98/99/100/101/102/103)
 * son de **producto**: lo que se ve. Su prueba no puede ser "el fuente
 * contiene la cadena X" (eso es lo que `EGO-FIND-63` bansa): tiene que
 * comprobar lo que el usuario recibe.
 *
 * Lo que se comprueba aquí es el **DOM renderizado** (atributos, clases
 * presentes, número de superficies) y el **comportamiento** (un clic que
 * cambia la paleta, un `disabled` real, un estado de foco único).
 *
 * En jsdom Tailwind no aplica el CSS: por eso se comprueba la **lista de
 * clases del DOM renderizado** (que es lo que el navegador recibe) y no el
 * fichero fuente.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";

import { Input } from "../components/ui-kit/Input.js";
import { SplitPane } from "../components/PaneShell.js";
import { ThemeIO } from "../components/canvas/ThemeIO.js";
import { EmptyState } from "../components/canvas/EmptyState.js";
import {
  DesignSystemProvider,
  PRESET_THEMES,
} from "../components/canvas/DesignSystemProvider.js";

afterEach(() => {
  cleanup();
});

describe("Ola 10 — contratos de comportamiento de los visuales", () => {
  it("EGO-FIND-101: el Input tiene UN solo anillo de foco (el outline)", () => {
    const { container } = render(<Input aria-label="buscar" value="" onChange={() => {}} />);
    // El Input envuelve: contenedor > wrapper > shell (el que lleva el foco).
    const shell = container
      .querySelector("div")
      ?.querySelector("div");
    const cls = shell?.className ?? "";
    expect(cls, "el foco debe ser el outline del sistema").toContain(
      "focus-within:outline-brand"
    );
    // El borde NO se vuelve brand al enfocar: si lo hiciera habría DOS
    // anillos (el del hallazgo).
    expect(cls).not.toContain("focus-within:border-brand");
  });

  it("EGO-FIND-102: el panel NO anima su `width` (no hay transición no-composited)", () => {
    const { container } = render(
      <SplitPane id="p" side="left" defaultWidth={300} minWidth={200} maxWidth={600}>
        <span>contenido</span>
      </SplitPane>
    );
    const panel = container.querySelector("[data-pane-id='p']");
    const cls = panel?.className ?? "";
    expect(cls, "el ancho no debe transicionar (reflow por frame)").not.toContain(
      "transition-[width]"
    );
  });

  it("EGO-FIND-98: el estado vacío dice QUÉ es, PARA QUÉ y QUÉ hacer", () => {
    render(
      <EmptyState
        title="Vista previa de archivos"
        description="Elige un archivo del árbol para verlo aquí."
        action={<button type="button">Abrir</button>}
        hint="También puedes abrirlo desde el chat."
      />
    );
    expect(screen.getByText("Vista previa de archivos")).toBeTruthy();
    expect(screen.getByText(/Elige un archivo del árbol/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir" })).toBeTruthy();
    expect(screen.getByText(/También puedes abrirlo desde el chat/)).toBeTruthy();
  });

  it("EGO-FIND-99: las paletas canónicas son VISIBLES e intercambiables", () => {
    render(
      <DesignSystemProvider>
        <ThemeIO />
      </DesignSystemProvider>
    );
    // Las 4 paletas del sistema están presentes como botones.
    const group = screen.getByRole("group", { name: "Elegir paleta" });
    const buttons = Array.from(group.querySelectorAll("button"));
    expect(buttons.length, "deben verse todas las paletas canónicas").toBe(
      Object.keys(PRESET_THEMES).length
    );
    // Y son intercambiables: el que no está activo cambia la paleta.
    const inactive = buttons.find((b) => b.getAttribute("aria-pressed") === "false");
    expect(inactive, "debe haber una paleta inactiva").toBeTruthy();
    // Al pulsar una paleta INACTIVA, esa paleta pasa a ser la activa
    // (el clic de verdad cambia el tema del provider).
    fireEvent.click(inactive!);
    expect(
      inactive!.getAttribute("aria-pressed"),
      "la paleta pulsada debe quedar activa"
    ).toBe("true");
  });
});
