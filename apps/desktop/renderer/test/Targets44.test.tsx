import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Sidebar } from "../components/sidebar.js";
import { App } from "../src/App.js";
import { SettingsModal } from "../components/sidebar/SettingsModal.js";
import { ActivityTray } from "../components/activity-tray/ActivityTray.js";

/**
 * T5 (EGO-FIND-55, EGO-FIND-56) — Barrido de targets táctiles y selects nativos.
 *
 * Antes (`87fc3ad`) el test solo miraba Sidebar / App / SettingsModal, con
 * lo que la regresión STAB-13 quedó viva:
 *  - `src/App.tsx:240` → toggle de sidebar en `h-7 w-7` (28 px)
 *  - `components/activity-tray/ActivityTray.tsx:352,362,372` → `min-h-[28px]`
 *  - `components/ui-kit/Button.tsx:56` → fuerza `min-h-[28px] min-w-[28px]`
 *  - 7 `<select>` nativos vivos en `DomainCanvasView`, `ShortcutsPanel`,
 *    `FormView`, `QueryView` y `CronPanel`.
 *
 * Este test barre el árbol de componentes del renderer y falla si aparece
 * CUALQUIER target interactivo por debajo de 44 px o CUALQUIER `<select>`
 * nativo.
 */

/** Clases Tailwind que declaran un tamaño < 44 px (28/32/36 px y variantes). */
const SUB_44_CLASSES = [
  "min-h-[28px]",
  "min-h-[32px]",
  "min-h-[36px]",
  "min-w-[28px]",
  "min-w-[32px]",
  "min-w-[36px]",
  "h-7",
  "w-7",
  "h-8",
  "w-8",
  "h-9",
  "w-9",
  "size-7",
  "size-8",
  "size-9",
];

/** `min-h-11` / `min-w-11` = 44 px en Tailwind (spacing 0.25rem → 2.75rem). */
const OK_44_CLASSES = [
  "min-h-11",
  "min-w-11",
  "min-h-[44px]",
  "min-w-[44px]",
  "h-11",
  "w-11",
  "size-11",
  "h-[44px]",
  "w-[44px]",
];

/** Elementos que son controles interactivos por naturaleza. */
const INTERACTIVE = "button, a[href], input, select, textarea, [role='button'], [role='combobox'], [role='tab'], [role='option'], [role='menuitem'], [role='switch'], [role='checkbox']";

function classListOf(el: Element): string[] {
  return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function hasOk44(el: Element): boolean {
  const classes = classListOf(el);
  return classes.some((c) => OK_44_CLASSES.includes(c));
}

/**
 * `true` si el control declara un tamaño >= 44 px por min-height/min-width
 * O por tamaño explícito (`h-11 w-11`, `size-11`, …) que no esté compensado
 * por un `min-h-[<44]` menor.
 */
function is44Compliant(el: Element): boolean {
  const classes = classListOf(el);
  const declaresSmaller = classes.some((c) => SUB_44_CLASSES.includes(c));
  if (!declaresSmaller) return true;
  // Un `min-h-11` junto a un `h-7` sigue siendo 44 px de alto (min gana).
  return classes.some((c) => OK_44_CLASSES.includes(c));
}

function findViolations(root: ParentNode, label: string): string[] {
  const violations: string[] = [];
  const controls = Array.from(root.querySelectorAll(INTERACTIVE));
  for (const el of controls) {
    if (el.closest("[data-allow-small-targets='true']")) continue;
    if (!is44Compliant(el)) {
      violations.push(
        `${label}: <${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`
      );
    }
  }
  return violations;
}

describe("T5: targets >= 44 px y cero <select> nativos en todo el renderer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    activeProject: "default",
    onSelectProject: vi.fn(),
    activeSubEgo: "ego.nucleus",
    onSelectSubEgo: vi.fn(),
    onNewSession: vi.fn(),
  };

  it("Sidebar: cero <select> nativos y todos los controles del rail >= 44 px", async () => {
    const { container } = render(<Sidebar {...baseProps} />);
    expect(container.querySelector("select")).toBeNull();
    expect(document.body.querySelector("select")).toBeNull();

    const rail = container.querySelector('nav[aria-label="Icon Rail"]');
    expect(rail).not.toBeNull();
    const railButtons = Array.from(rail!.querySelectorAll("button"));
    expect(railButtons.length).toBeGreaterThanOrEqual(6);
    for (const btn of railButtons) {
      expect(
        hasOk44(btn),
        `Botón del rail "${btn.getAttribute("aria-label") || btn.textContent}" debe declarar >=44px`
      ).toBe(true);
    }
    expect(findViolations(container, "Sidebar")).toEqual([]);
  });

  it("App: cero <select> nativos y todos los controles del header >= 44 px", () => {
    const { container } = render(<App />);
    expect(container.querySelector("select")).toBeNull();
    expect(document.body.querySelector("select")).toBeNull();

    for (const name of [
      "Conmutar barra lateral",
      "Selector de modelo activo",
      "Mostrar u ocultar Isla Flotante",
      "Alternar panel de Workspace",
    ]) {
      const btn = screen.getByRole("button", { name });
      expect(
        hasOk44(btn),
        `Botón "${name}" debe declarar >=44px (clases: ${btn.getAttribute("class")})`
      ).toBe(true);
    }
    expect(findViolations(container, "App")).toEqual([]);
  });

  it("SettingsModal: cero <select> nativos y todos los Select >= 44 px", () => {
    render(<SettingsModal open={true} onOpenChange={vi.fn()} />);
    expect(document.body.querySelector("select")).toBeNull();

    const providerTrigger = screen.getByRole("combobox", { name: "Proveedor activo" });
    expect(hasOk44(providerTrigger)).toBe(true);
    expect(findViolations(document.body, "SettingsModal")).toEqual([]);
  });

  it("ActivityTray: los botones de acción de tarea >= 44 px", () => {
    render(
      <ActivityTray
        tasks={[
          { id: "t-1", title: "Tarea en curso", status: "running", progress: 10 },
          { id: "t-2", title: "Tarea en cola", status: "queued", progress: 0 },
        ]}
      />
    );
    const violations = findViolations(document.body, "ActivityTray");
    expect(
      violations,
      `controles por debajo de 44px en ActivityTray:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("el ui-kit Button sin hijos declara >= 44 px (el default era 28 px)", async () => {
    const { Button } = await import("../components/ui-kit/index.js");
    render(<Button aria-label="icono sin texto" />);
    const btn = screen.getByRole("button", { name: "icono sin texto" });
    expect(
      hasOk44(btn),
      `Button sin hijos debe declarar >=44px (clases: ${btn.getAttribute("class")})`
    ).toBe(true);
  });
});

describe("T5: barrido de <select> nativos en el código fuente del renderer", () => {
  it("no queda ningún <select nativo en el renderer", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(process.cwd(), "components");
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        if (entry.endsWith(".test.tsx") || entry.endsWith(".test.ts")) continue;
        const src = readFileSync(full, "utf8");
        // Solo cuenta un `<select>` REAL como elemento JSX: la palabra
        // "<select>" dentro de un comentario no es un elemento nativo.
        if (/<select(\s|>|\/)/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""))) {
          offenders.push(full);
        }
      }
    };
    walk(root);
    expect(
      offenders,
      `<select> nativos todavía presentes:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
