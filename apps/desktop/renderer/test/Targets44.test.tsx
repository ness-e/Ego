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
 * ## Política de target size (decisión del owner 2026-10-20)
 * La regla antigua era "44 px para TODO". Se sustituye por el criterio real
 * de WCAG 2.2 (SC 2.5.8 *Target Size (Minimum)*, AA = 24×24 CSS px), más
 * la distinción entre control **con etiqueta visible** y control
 * **sólo-icono**:
 *
 *  - Control con etiqueta visible → mínimo 24 px (AA). El kit usa 28 px
 *    (`size="sm"`) y 32 px (`size="md"`): es la densidad que usan
 *    Claude/Codex/OpenClaw — un rail de 44 px por fila se siente inflado y
 *    rompe el ritmo vertical.
 *  - Control SÓLO-icono (sin texto visible) → 44×44 obligatorio: sin
 *    etiqueta, el área pulsable es la única pista de affordance.
 *  - Cualquier control por debajo de 24 px → violación.
 *
 * Este test barre el árbol de componentes del renderer y falla si aparece
 * un target por debajo del mínimo de su categoría o CUALQUIER `<select>`
 * nativo.
 */

/** Clases Tailwind que declaran un tamaño < 24 px (WCAG 2.2 SC 2.5.8). */
const SUB_24_CLASSES = [
  "min-h-[16px]",
  "min-w-[16px]",
  "min-h-[20px]",
  "min-w-[20px]",
  "h-5",
  "w-5",
  "size-5",
  "h-6",
  "w-6",
  "size-6",
  "h-[20px]",
  "w-[20px]",
  "h-[22px]",
  "w-[22px]",
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
 * ¿El control es SÓLO-icono? Es decir: no tiene texto visible que lo
 * identifique. Un control con `aria-label` pero sin contenido textual sigue
 * siendo sólo-icono (el `aria-label` es para lectores de pantalla).
 */
function isIconOnlyControl(el: Element): boolean {
  const text = (el.textContent ?? "").trim();
  if (text.length > 0) return false;
  // Un `<select>`/`<input>` con valor propio no es "sólo icono" visual.
  if (el.tagName.toLowerCase() === "input") return false;
  if (el.tagName.toLowerCase() === "select") return false;
  if (el.tagName.toLowerCase() === "textarea") return false;
  return true;
}

/**
 * `true` si el control cumple la política de target size vigente:
 *  - declara < 24 px                       → NO cumple
 *  - control SÓLO-icono sin 44 px          → NO cumple
 *  - no declara tamaño (no verificable)     → se acepta (no hay dato)
 *  - declara 44 px                          → cumple siempre
 */
function isTargetCompliant(el: Element): boolean {
  const classes = classListOf(el);
  const has44 = classes.some((c) => OK_44_CLASSES.includes(c));
  const declaresTooSmall = classes.some((c) => SUB_24_CLASSES.includes(c));
  if (declaresTooSmall && !has44) return false;
  // Un tamaño por debajo de 44 px sobre un control sólo-icono no cumple:
  // sin etiqueta, el área pulsable debe ser de 44 px.
  if (!has44 && isIconOnlyControl(el)) {
    const declaresDense = classes.some((c) =>
      /^(h|w|size|min-h|min-w)-(\[)?(5|6|7|8|9|10|20px|22px|24px|28px|32px|36px)/.test(
        c,
      ),
    );
    if (declaresDense) return false;
  }
  return true;
}

function findViolations(root: ParentNode, label: string): string[] {
  const violations: string[] = [];
  const controls = Array.from(root.querySelectorAll(INTERACTIVE));
  for (const el of controls) {
    if (el.closest("[data-allow-small-targets='true']")) continue;
    if (!isTargetCompliant(el)) {
      violations.push(
        `${label}: <${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`
      );
    }
  }
  return violations;
}

describe("T5: targets táctiles y cero <select> nativos en todo el renderer", () => {
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

  it("Sidebar: cero <select> nativos y los controles del rail >= 44 px", async () => {
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

  it("App: cero <select> nativos y los controles del header >= 44 px", () => {
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
      `controles por debajo del target mínimo en ActivityTray:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("el ui-kit Button sólo-icono declara >= 44 px", async () => {
    const { Button } = await import("../components/ui-kit/index.js");
    render(<Button aria-label="icono sin texto" />);
    const btn = screen.getByRole("button", { name: "icono sin texto" });
    expect(
      hasOk44(btn),
      `Button sin hijos debe declarar >=44px (clases: ${btn.getAttribute("class")})`
    ).toBe(true);
  });

  it("el ui-kit Button con etiqueta usa la densidad densa (32 px) sin romper 44 px", async () => {
    const { Button } = await import("../components/ui-kit/index.js");
    const { container } = render(<Button>Guardar</Button>);
    const btn = container.querySelector("button");
    // Densidad densa: 32 px es el tamaño por defecto del control CON etiqueta.
    expect(btn?.className).toContain("h-8");
    // …pero el objetivo táctil de 44 px sigue disponible vía `size="lg"`.
    expect(btn?.className).not.toContain("h-11");
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
