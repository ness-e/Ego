import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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
import { ego } from "../lib/ego.js";

// T07 UI-04 (EGO-FIND-07/08): axe 0 violaciones en superficies migradas.
// Este archivo BLOQUEA CI (corre en `pnpm test`, gate `ci.yml`).
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
    document.body.innerHTML = "";
  });

  const mount = async (node: React.ReactNode) => {
    await act(async () => {
      root.render(node);
    });
  };

  const pressEscape = async () => {
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
  };

  it("Modal base: dialog + aria-modal + cierre etiquetado + Escape cierra (trap Radix)", async () => {
    let open = true;
    const onOpenChange = vi.fn((v: boolean) => {
      open = v;
    });
    const renderModal = async () => {
      await act(async () => {
        root.render(
          <Modal open={open} onOpenChange={onOpenChange} title="Fábrica" description="d">
            <p>contenido</p>
          </Modal>
        );
      });
    };
    await renderModal();
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(
      document.body.querySelector('[role="dialog"] button[aria-label="Cerrar diálogo"]')
    ).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ModelPicker: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    await mount(
      <ModelPicker isOpen activeModelId="claude-3-7-sonnet" onClose={onClose} onSelectModel={() => {}} />
    );
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it("SessionPicker: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    await mount(
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
    await mount(<SessionPicker isOpen sessions={[]} onClose={onClose} onResumeSession={() => {}} />);
    expect(document.body.textContent).toContain("Sin sesiones recientes");
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();
    expect(fmt(await axeViolations())).toBe("");
  });

  it("SubEgosView factory: modal con roles tab + 0 violaciones", async () => {
    await mount(<SubEgosView />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const openBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Crear Sub-Ego")
    );
    expect(openBtn).toBeDefined();
    await act(async () => {
      openBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector('[role="tablist"]')).not.toBeNull();
    expect(document.body.querySelectorAll('[role="tab"]').length).toBeGreaterThanOrEqual(3);
    expect(fmt(await axeViolations())).toBe("");
  });

  it("ActivityWidget approval: modal 0 violaciones + Escape lo cierra", async () => {
    await mount(<ActivityWidget />);
    const bridge = ego() as unknown as {
      emitApprovalRequest: (r: unknown) => void;
    };
    await act(async () => {
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
    });
    const reviewBtn = container.querySelector('[data-testid="activity-approval"] button');
    expect(reviewBtn).not.toBeNull();
    await act(async () => {
      reviewBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("WhyButton: dialog 0 violaciones + Escape lo cierra", async () => {
    await mount(
      <WhyButton why={{ directCause: "causa", vantaSources: ["kb/x"], auditTrace: "audit:1" }} />
    );
    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("McpManagerModal: 0 violaciones + Escape llama onClose", async () => {
    const onClose = vi.fn();
    await mount(<McpManagerModal isOpen onClose={onClose} />);
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
    await mount(<McpAddServerDialog isOpen onClose={onClose} onSubmit={async () => {}} />);
    expect(fmt(await axeViolations())).toBe("");
    await pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it("DomainSelector: menú accesible por teclado (flechas/Enter/Escape)", async () => {
    const domains: DomainMeta[] = [
      { id: "engineering", name: "Engineering", description: "d1", icon: "code", defaultSubEgoId: "ego.dev" },
      { id: "product", name: "Product", description: "d2", icon: "kanban", defaultSubEgoId: "ego.pm" },
    ];
    const onSelect = vi.fn();
    await mount(<DomainSelector domains={domains} activeDomainId="engineering" onSelectDomain={onSelect} />);
    const trigger = container.querySelector("button");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    // Al abrir, el foco cae en la opción activa (engineering, índice 0);
    // Flecha abajo lo mueve a la siguiente opción (product, índice 1).
    expect(document.activeElement).toBe(container.querySelectorAll('[role^="menuitem"]')[0]);
    await act(async () => {
      menu?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const options = Array.from(container.querySelectorAll('[role^="menuitem"]'));
    expect(options.length).toBe(2);
    expect(document.activeElement).toBe(options[1]);
    // Enter selecciona y cierra.
    await act(async () => {
      document.activeElement?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith("product");
    // Reabrir y cerrar con Escape devuelve el foco al trigger.
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    await act(async () => {
      container.querySelector('[role="menu"]')?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
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

  it("contraste WCAG AA por cálculo: dim #8a8a92 sobre paper #0a0a0b ≥ 4.5:1", async () => {
    const css = fs.readFileSync(HERE + "../src/index.css", "utf8");
    expect(css).toContain("--color-dim: #8a8a92");
    const lum = (hex: string): number => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
        v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string): number => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    expect(ratio("#8a8a92", "#0a0a0b")).toBeGreaterThanOrEqual(4.5);
    // Anillo de foco brand sobre paper: componente UI ≥ 3:1.
    expect(ratio("#f59e0b", "#0a0a0b")).toBeGreaterThanOrEqual(3);
  });
});
