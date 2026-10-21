import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe, { type AxeResults } from "axe-core";
import * as fs from "node:fs";
import * as path from "node:path";
import { Modal } from "../components/ui-kit/Modal.js";
import { ModelPicker } from "../components/ModelPicker.js";
import { SessionPicker } from "../components/SessionPicker.js";
import { SubEgosView } from "../components/sub-egos.js";
import { ActivityWidget } from "../components/activity-widget/ActivityWidget.js";
import { WhyButton } from "../components/explainability/WhyButton.js";
import { McpManagerModal } from "../components/mcp/McpManagerModal.js";
import { McpAddServerDialog } from "../components/mcp/McpAddServerDialog.js";
import { DomainSelector, type DomainMeta } from "../components/domains/DomainSelector.js";
import { SplitPane } from "../components/PaneShell.js";
import { ActivityTray } from "../components/activity-tray/ActivityTray.js";
import { App } from "../src/App.js";
import { ego } from "../lib/ego.js";
import { PRESET_THEMES } from "../components/canvas/DesignSystemProvider.js";

// STAB-08: migrado de createRoot+act+dispatchEvent a RTL por comportamiento
// (render + user-event). La lógica axe y los asserts WCAG quedan intactos.
// Sin vi.restoreAllMocks() en afterEach: vaciaría el MockEgoBridge global de
// setup.ts (ver App.test.tsx).
// `color-contrast` se excluye del run axe: happy-dom no aplica Tailwind y
// axe no puede medir contraste real sin layout — el contraste se verifica
// por cálculo WCAG determinista más abajo (mismo test, misma suite).

const HERE = path.join(process.cwd(), "test") + path.sep;

// Alcance: el diálogo si hay uno (evita los focus-guards que Radix inyecta
// como hermanos en body — `aria-hidden-focus` sobre ellos es un artefacto
// del portal en happy-dom, no un defecto del producto), si no todo el body.
async function axeViolations(): Promise<AxeResults["violations"]> {
  const scope =
    (document.body.querySelector('[role="dialog"]') as HTMLElement | null) ?? document.body;
  const res = await axe.run(scope, {
    resultTypes: ["violations"],
    rules: {
      "color-contrast": { enabled: false },
    },
  });
  return res.violations;
}

function fmt(violations: AxeResults["violations"]): string {
  return violations
    .map((v) => `${v.id}[${v.nodes.map((n) => n.target.join(" ")).join("|")}]`)
    .join("; ");
}

describe("T07 UI-04: axe WCAG AA (bloquea CI)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
  });

  const mount = (node: React.ReactNode) => {
    render(node);
  };

  const pressEscape = async () => {
    await userEvent.setup().keyboard("{Escape}");
  };

  it("Modal base: dialog + aria-modal + cierre etiquetado + Escape cierra (trap Radix)", async () => {
    const user = userEvent.setup();
    let open = true;
    const onOpenChange = vi.fn((v: boolean) => {
      open = v;
    });
    const renderModal = () => {
      mount(
        <Modal open={open} onOpenChange={onOpenChange} title="Fábrica" description="d">
          <p>contenido</p>
        </Modal>
      );
    };
    renderModal();
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(
      document.body.querySelector('[role="dialog"] button[aria-label="Cerrar diálogo"]')
    ).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ModelPicker: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    mount(
      <ModelPicker isOpen activeModelId="claude-3-7-sonnet" onClose={onClose} onSelectModel={() => {}} />
    );
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it("SessionPicker: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    mount(
      <SessionPicker
        isOpen
        sessions={[
          { id: "sess-a11y-1", title: "Sesión a11y uno", preview: "Vista...", subEgoId: "ego.nucleus", updatedAt: Date.now() },
          { id: "sess-a11y-2", title: "Sesión a11y dos", preview: "Vista...", subEgoId: "ego.developer", updatedAt: Date.now() },
        ]}
        onClose={onClose}
        onResumeSession={() => {}}
      />
    );
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it("SessionPicker vacío honesto: sin listbox sin opciones + 0 violaciones", async () => {
    const onClose = vi.fn();
    mount(<SessionPicker isOpen sessions={[]} onClose={onClose} onResumeSession={() => {}} />);
    expect(document.body.textContent).toContain("Sin sesiones recientes");
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();
    expect(fmt(await axeViolations())).toBe("");
  });

  it("SubEgosView factory: modal con roles tab + 0 violaciones", async () => {
    const user = userEvent.setup();
    mount(<SubEgosView />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const openBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Crear Sub-Ego")
    );
    expect(openBtn).toBeDefined();
    await user.click(openBtn as HTMLButtonElement);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector('[role="tablist"]')).not.toBeNull();
    expect(document.body.querySelectorAll('[role="tab"]').length).toBeGreaterThanOrEqual(3);
    expect(fmt(await axeViolations())).toBe("");
  });

  it("ActivityWidget approval: modal 0 violaciones + Escape lo cierra", async () => {
    const user = userEvent.setup();
    mount(<ActivityWidget />);
    const bridge = ego() as unknown as {
      emitApprovalRequest: (r: unknown) => void;
    };
    bridge.emitApprovalRequest({
      approvalId: "app-a11y-1",
      action: { sessionId: "s-1", subEgoId: "ego.dev", toolName: "fs_write", callId: "c-1", inputDigest: "d", createdAt: Date.now() },
      toolName: "fs_write",
      toolCategory: "fs",
      riskLevel: "destructive",
      arguments: { path: "/tmp/x" },
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const reviewBtn = document.body.querySelector('[data-testid="activity-approval"] button');
    expect(reviewBtn).not.toBeNull();
    await user.click(reviewBtn as HTMLButtonElement);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    // STAB-13: el Modal anima la salida (fade 150ms) antes de desmontar.
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it("WhyButton: dialog 0 violaciones + Escape lo cierra", async () => {
    const user = userEvent.setup();
    mount(
      <WhyButton why={{ directCause: "causa", vantaSources: ["kb/x"], auditTrace: "audit:1" }} />
    );
    const trigger = document.body.querySelector("button");
    expect(trigger).not.toBeNull();
    await user.click(trigger as HTMLButtonElement);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    // STAB-13: salida animada — esperar el desmontaje real.
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it("McpManagerModal: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    mount(<McpManagerModal isOpen onClose={onClose} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it("McpAddServerDialog: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    mount(<McpAddServerDialog isOpen onClose={onClose} onSubmit={async () => {}} />);
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it("DomainSelector: menú accesible por teclado (flechas/Enter/Escape)", async () => {
    const user = userEvent.setup();
    const domains: DomainMeta[] = [
      { id: "engineering", name: "Engineering", description: "d1", icon: "code", defaultSubEgoId: "ego.dev" },
      { id: "product", name: "Product", description: "d2", icon: "kanban", defaultSubEgoId: "ego.pm" },
    ];
    const onSelect = vi.fn();
    mount(<DomainSelector domains={domains} activeDomainId="engineering" onSelectDomain={onSelect} />);
    const trigger = document.body.querySelector("button");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger as HTMLButtonElement);
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    // Al abrir, el foco cae en la opción activa (engineering, índice 0);
    // Flecha abajo lo mueve a la siguiente opción (product, índice 1).
    expect(document.activeElement).toBe(document.body.querySelectorAll('[role^="menuitem"]')[0]);
    await user.keyboard("{ArrowDown}");
    const options = Array.from(document.body.querySelectorAll('[role^="menuitem"]'));
    expect(options.length).toBe(2);
    expect(document.activeElement).toBe(options[1]);
    // Enter selecciona y cierra.
    await user.click(document.activeElement as Element);
    expect(onSelect).toHaveBeenCalledWith("product");
    // Reabrir y cerrar con Escape devuelve el foco al trigger.
    await user.click(trigger as HTMLButtonElement);
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(fmt(await axeViolations())).toBe("");
  });

  it("index.css: anillo focus-visible global sobre el brand (nunca outline:none)", async () => {
    const css = fs.readFileSync(HERE + "../src/index.css", "utf8");
    expect(css).toContain(":focus-visible");
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline[^}]*var\(--color-brand/s);
    expect(css).not.toMatch(/outline\s*:\s*none/);
  });

  it("index.html: lang + title (reglas doc de axe verificadas estáticamente)", async () => {
    const html = fs.readFileSync(HERE + "../index.html", "utf8");
    expect(html).toMatch(/<html[^>]*lang="es"/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });

  /**
   * Luminancia relativa WCAG 2.2 de un color.
   *
   * Acepta **HEX sRGB y OKLCH**: los presets del `DesignSystemProvider`
   * están declarados en OKLCH (T14), así que parsearlos como HEX devolvía
   * `NaN` y los asserts de contraste comparaban `NaN` (fallaban siempre, sin
   * decir por qué). La conversión OKLCH → sRGB lineal es la de Ottosson
   * (la misma que usa `apps/desktop/scripts/srgb-to-oklch.cjs` al revés).
   */
  const lum = (color: string): number => {
    const c = color.trim().startsWith("#")
      ? [1, 3, 5]
          .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
      : oklchToLinearRgb(color);
    return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
  };

  /** OKLCH → sRGB lineal (0..1, sin clampear). */
  const oklchToLinearRgb = (value: string): [number, number, number] => {
    const match = value.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
    if (!match) throw new Error(`color no soportado por lum(): ${value}`);
    const L = Number(match[1]);
    const C = Number(match[2]);
    const H = Number(match[3]);
    const rad = (H * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const b = C * Math.sin(rad);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };

  const wcagRatio = (a: string, b: string): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };

  it("contraste WCAG AA por cálculo: dim #8a8a92 sobre paper #0a0a0b ≥ 4.5:1", async () => {
    const css = fs.readFileSync(HERE + "../src/index.css", "utf8");
    expect(css).toContain("--color-dim: #8a8a92");
    expect(wcagRatio("#8a8a92", "#0a0a0b")).toBeGreaterThanOrEqual(4.5);
    // Anillo de foco brand sobre paper: componente UI ≥ 3:1.
    expect(wcagRatio("#f59e0b", "#0a0a0b")).toBeGreaterThanOrEqual(3);
  });

  describe("WCAG 2.2 AA: ratio determinista sobre paletas de theme-tokens.css", () => {
    const PALETTES = {
      "dark-graphite": {
        bg: "#09090b",
        panel: "#141416",
        raised: "#1c1c20",
        text: "#f4f4f5",
        muted: "#a1a1aa",
        borderStrong: "#71717a",
      },
      "midnight-cyan": {
        bg: "#030712",
        panel: "#0f172a",
        raised: "#1e293b",
        text: "#f8fafc",
        muted: "#94a3b8",
        borderStrong: "#64748b",
      },
      "warm-sepia": {
        bg: "#1c1917",
        panel: "#292524",
        // EGO-FIND-71 (FIND-A11Y-01): superficie `raised` oscurecida para que
        // el borde fuerte #78716c alcance >= 3:1 (2.14:1 antes). Mismo valor
        // que el `raised` del preset `amber-warm` (misma paleta "Warm Sepia").
        raised: "#2c2825",
        text: "#fef3c7",
        muted: "#d6d3d1",
        borderStrong: "#78716c",
      },
      "high-contrast": {
        bg: "#000000",
        panel: "#0a0a0a",
        raised: "#141414",
        text: "#ffffff",
        muted: "#cccccc",
        borderStrong: "#a3a3a3",
      },
    };

    it("texto normal (text y muted) cumple >= 4.5:1 en todas las superficies", () => {
      for (const [name, p] of Object.entries(PALETTES)) {
        for (const surface of [p.bg, p.panel, p.raised]) {
          expect(
            wcagRatio(p.text, surface),
            `Paleta ${name}: text sobre superficie debe ser >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            wcagRatio(p.muted, surface),
            `Paleta ${name}: muted sobre superficie debe ser >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it("bordes interactivos (borderStrong) cumplen >= 3:1 en superficies conformes", () => {
      for (const name of ["dark-graphite", "midnight-cyan", "high-contrast"] as const) {
        const p = PALETTES[name];
        for (const surface of [p.bg, p.panel, p.raised]) {
          expect(
            wcagRatio(p.borderStrong, surface),
            `Paleta ${name}: borderStrong sobre superficie debe ser >= 3:1`
          ).toBeGreaterThanOrEqual(3.0);
        }
      }
      expect(wcagRatio(PALETTES["warm-sepia"].borderStrong, PALETTES["warm-sepia"].bg)).toBeGreaterThanOrEqual(3.0);
      expect(wcagRatio(PALETTES["warm-sepia"].borderStrong, PALETTES["warm-sepia"].panel)).toBeGreaterThanOrEqual(3.0);
      // EGO-FIND-71 (FIND-A11Y-01): `raised` ya cumple y vuelve al contrato
      // completo (antes quedaba excluido por el hallazgo documentado).
      expect(wcagRatio(PALETTES["warm-sepia"].borderStrong, PALETTES["warm-sepia"].raised)).toBeGreaterThanOrEqual(3.0);
    });

    it("warm-sepia: borderStrong #78716c sobre raised #2c2825 cumple >= 3:1 (3.05:1, FIND-A11Y-01 corregido)", () => {
      expect(wcagRatio("#78716c", PALETTES["warm-sepia"].raised)).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("WCAG 2.2 AA: ratio determinista sobre presets de DesignSystemProvider.tsx", () => {
    it("texto normal (text y muted) de los 4 presets cumple >= 4.5:1 sobre todas las superficies", () => {
      for (const [key, preset] of Object.entries(PRESET_THEMES)) {
        const c = preset.colors;
        for (const surface of [c.background, c.panel, c.raised]) {
          expect(
            wcagRatio(c.text, surface),
            `Preset ${key}: text sobre superficie debe ser >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            wcagRatio(c.muted, surface),
            `Preset ${key}: muted sobre superficie debe ser >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it("default-dark cumple >= 3:1 para FIXED_BORDER_STRONG (#71717a) y >= 4.5:1 para FIXED_DIM (#8a8a92)", () => {
      const p = PRESET_THEMES["default-dark"]!.colors;
      for (const surface of [p.background, p.panel, p.raised]) {
        expect(wcagRatio("#71717a", surface)).toBeGreaterThanOrEqual(3.0);
        expect(wcagRatio("#8a8a92", surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("EGO-FIND-71: los tokens FIJOS cumplen en TODAS las superficies de TODOS los presets", () => {
      // Blinda el fix: el dim (#8a8a92) y el borde fuerte (#71717a) son
      // FIJOS del design system, así que cada superficie de cada preset
      // debe dar con ellos el ratio exigido. Sin este assert, un preset
      // nuevo (o un token retocado) volvería a colar un ratio por debajo
      // de AA sin que nadie lo note.
      for (const [key, preset] of Object.entries(PRESET_THEMES)) {
        const c = preset.colors;
        for (const surface of [c.background, c.panel, c.raised]) {
          expect(
            wcagRatio("#8a8a92", surface),
            `Preset ${key}: dim fijo #8a8a92 sobre ${surface} debe ser >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            wcagRatio("#71717a", surface),
            `Preset ${key}: borde fuerte fijo #71717a sobre ${surface} debe ser >= 3:1`
          ).toBeGreaterThanOrEqual(3.0);
        }
      }
    });

    it("midnight-cyan: fixed dim #8a8a92 sobre raised #192436 cumple >= 4.5:1 (4.50:1, FIND-A11Y-04 corregido)", () => {      expect(wcagRatio("#8a8a92", PRESET_THEMES["midnight-cyan"]!.colors.raised)).toBeGreaterThanOrEqual(4.5);
    });

    it("emerald-terminal: fixed dim #8a8a92 sobre panel #001a0e cumple >= 4.5:1 (4.50:1, FIND-A11Y-05 corregido)", () => {
      expect(wcagRatio("#8a8a92", PRESET_THEMES["emerald-terminal"]!.colors.panel)).toBeGreaterThanOrEqual(4.5);
    });

    it("emerald-terminal: fixed borderStrong #71717a sobre panel #001a0e cumple >= 3:1 (3.77:1, FIND-A11Y-02 corregido)", () => {
      expect(wcagRatio("#71717a", PRESET_THEMES["emerald-terminal"]!.colors.panel)).toBeGreaterThanOrEqual(3.0);
    });

    it("amber-warm: fixed dim #8a8a92 sobre panel #171413 cumple >= 4.5:1 (5.35:1, FIND-A11Y-06 corregido)", () => {
      expect(wcagRatio("#8a8a92", PRESET_THEMES["amber-warm"]!.colors.panel)).toBeGreaterThanOrEqual(4.5);
    });

    it("amber-warm: fixed borderStrong #71717a sobre raised #272320 cumple >= 3:1 (3.22:1, FIND-A11Y-03 corregido)", () => {
      expect(wcagRatio("#71717a", PRESET_THEMES["amber-warm"]!.colors.raised)).toBeGreaterThanOrEqual(3.0);
    });
  });

  it("App shell WCAG 2.2 AA: landmarks + separator + 0 violaciones axe (color-contrast off)", async () => {
    mount(<App />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Landmarks con nombre accesible (App.tsx + Sidebar).
    expect(document.querySelector("header")).not.toBeNull();
    expect(document.querySelector("main")).not.toBeNull();
    expect(document.querySelector("footer")).not.toBeNull();
    expect(document.querySelector('section[aria-label="Chat"]')).not.toBeNull();
    expect(
      document.querySelector('section[aria-label="Área de trabajo dinámica"]')
    ).not.toBeNull();
    expect(document.querySelector("aside[aria-label]")).not.toBeNull();
    // Divisor como separator con valor y foco por teclado.
    const sep = document.querySelector('[role="separator"]') as HTMLElement | null;
    expect(sep).not.toBeNull();
    expect(sep?.tabIndex).toBe(0);
    expect(sep?.getAttribute("aria-valuenow")).not.toBeNull();
    expect(sep?.getAttribute("aria-valuemin")).not.toBeNull();
    expect(sep?.getAttribute("aria-valuemax")).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
  });

  it("WCAG 2.2 AA 2.4.11 foco no ocluido: separator ±8px/Esc + menú scrollIntoView + tray Esc", async () => {
    const user = userEvent.setup();
    // reduced-motion: sin animación + scroll auto.
    const css = fs.readFileSync(HERE + "../src/index.css", "utf8");
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/animation:\s*none/);
    expect(css).toMatch(/scroll-behavior:\s*auto/);

    // Separator: flechas ±8px y Escape restablece al default.
    mount(
      <SplitPane id="a11y-sep" defaultWidth={300} minWidth={240} maxWidth={600} side="left">
        <div>panel</div>
      </SplitPane>
    );
    const sep = document.body.querySelector('[role="separator"]') as HTMLElement;
    expect(sep.tabIndex).toBe(0);
    const base = Number(sep.getAttribute("aria-valuenow"));
    expect(base).toBe(300);
    sep.focus();
    expect(document.activeElement).toBe(sep);
    await user.keyboard("{ArrowRight}");
    expect(Number(sep.getAttribute("aria-valuenow"))).toBe(base + 8);
    await user.keyboard("{ArrowLeft}");
    expect(Number(sep.getAttribute("aria-valuenow"))).toBe(base);
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Escape}");
    expect(Number(sep.getAttribute("aria-valuenow"))).toBe(300);
    cleanup();

    // Oclusión 2.4.11: scrollIntoView en apertura, navegación y retorno con Esc.
    const scrollSpy = vi.fn();
    (window.HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView =
      scrollSpy;
    const domains: DomainMeta[] = [
      { id: "engineering", name: "Engineering", description: "d1", icon: "code", defaultSubEgoId: "ego.dev" },
      { id: "product", name: "Product", description: "d2", icon: "kanban", defaultSubEgoId: "ego.pm" },
    ];
    mount(
      <DomainSelector domains={domains} activeDomainId="engineering" onSelectDomain={() => {}} />
    );
    const trigger = document.body.querySelector("button") as HTMLElement;
    await user.click(trigger);
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockClear();
    await user.keyboard("{ArrowDown}");
    expect(scrollSpy).toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(scrollSpy).toHaveBeenCalled();

    // Tray: Escape colapsa el panel y devuelve el foco al trigger.
    cleanup();
    mount(
      <ActivityTray
        tasks={[
          { id: "t-1", title: "Tarea uno", status: "running", progress: 10 },
          { id: "t-2", title: "Tarea dos", status: "queued", progress: 0 },
        ]}
      />
    );
    const toggle = document.body.querySelector(
      'button[aria-controls="activity-tray-panel"]'
    ) as HTMLElement;
    expect(toggle).not.toBeNull();
    await user.click(toggle);
    expect(document.body.querySelector("#activity-tray-panel")).not.toBeNull();
    toggle.focus();
    await user.keyboard("{Escape}");
    // El panel colapsa (o al menos el toggle sigue enfocado/operativo).
    expect(document.body.querySelector("#activity-tray-panel")).toBeNull();
  });
});
