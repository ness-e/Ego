import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { Modal } from "../components/ui-kit/Modal.js";
import {
  Omnibar,
  OMNIBAR_SELECT_EVENT,
  type OmnibarHit,
} from "../components/omnibar.js";
import { SplitPane } from "../components/PaneShell.js";
import { EgoChat } from "../components/ego-chat.js";
import { ApprovalCard } from "../components/tools/ApprovalCard.js";
import { ActivityWidget } from "../components/activity-widget/ActivityWidget.js";
import { ego, type PendingApprovalInfo } from "../lib/ego.js";

// STAB-13 — UX motion/Modal/composer/targets/omnibar (RTL por comportamiento).
// Sin vi.restoreAllMocks(): protege el MockEgoBridge global de setup.ts.
const HERE = path.join(process.cwd(), "test") + path.sep;

function ModalWrap() {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open} onOpenChange={setOpen} title="STAB-13" description="d">
      <p>contenido</p>
    </Modal>
  );
}

const mockRequest: PendingApprovalInfo = {
  approvalId: "app-stab13-1",
  action: {
    sessionId: "sess-1",
    subEgoId: "ego.developer",
    toolName: "fs_write_file",
    callId: "call-1",
    inputDigest: "abc123hash",
    createdAt: Date.now(),
  },
  toolName: "fs_write_file",
  toolCategory: "filesystem",
  riskLevel: "sensitive",
  arguments: { path: "src/x.ts" },
  status: "pending",
  createdAt: Date.now(),
  expiresAt: Date.now() + 60000,
};

const HITS_RAW = [
  {
    score: 0.94,
    record: {
      namespace: "kb/docs",
      key: "tarifa",
      payload: JSON.stringify({ titulo: "Tarifas 2026", contenido: "límite 150 USD/hora" }),
    },
  },
  {
    score: 0.81,
    record: {
      namespace: "kb/docs",
      key: "contrato",
      payload: JSON.stringify({ titulo: "Contrato marco", contenido: "cláusulas" }),
    },
  },
];


/**
 * El objetivo tactil de 44 px se puede expresar con dos literales de Tailwind v4:
 * `min-h-11` (= 2.75rem) o `min-h-[44px]`. El CONTRATO es el tamano, no la
 * clase: se aceptan las dos formas para que migrar `min-h-[44px]` -> `min-h-11`
 * (que es lo que hizo la ola 2026-10-20) no rompa la puerta.
 */
const expectMin44 = (el: Element | null, axis: "h" | "w") => {
  const cls = el?.getAttribute("class") ?? "";
  const ok = cls.includes(`min-${axis}-11`) || cls.includes(`min-${axis}-[44px]`);
  expect(ok, `falta el min-${axis} de 44px en: ${cls}`).toBe(true);
};
describe("STAB-13: UX motion/Modal/composer/targets/omnibar", () => {
  afterEach(() => {
    cleanup();
  });

  it("Modal: dialog + cierre 44px + Escape desmonta tras el exit (waitFor)", async () => {
    const user = userEvent.setup();
    render(<ModalWrap />);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    const close = document.body.querySelector(
      '[role="dialog"] button[aria-label="Cerrar diálogo"]'
    ) as HTMLButtonElement;
    expect(close).not.toBeNull();
    // `min-h-11` es 44 px en Tailwind v4 (spacing 0.25rem -> 2.75rem): el
    // criterio es el TAMANO, no el literal de la clase.
      expectMin44(close, "h");
      expectMin44(close, "w");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it("Composer: Enviar ≥44px + morph layoutId composer-action en fuente", async () => {
    render(<EgoChat />);
    const send = await screen.findByRole("button", { name: /enviar mensaje/i });
    expectMin44(send, "h");
    expectMin44(send, "w");
    const src = fs.readFileSync(HERE + "../components/ego-chat.tsx", "utf8");
    expect(src).toContain('layoutId="composer-action"');
    expect(src).toContain('<AnimatePresence mode="wait"');
  });

  it("Copy-confirm: CSS data-copied + CodeBlock textual espejo intacto", async () => {
    const css = fs.readFileSync(HERE + "../src/index.css", "utf8");
    expect(css).toContain('button[data-copied="true"]');
    const md = fs.readFileSync(
      HERE + "../components/assistant-ui/markdown-text.tsx",
      "utf8"
    );
    expect(md).toContain("Copiado");
  });

  it("Targets 44px HITL: ApprovalCard Aprobar/Editar/Rechazar", async () => {
    render(<ApprovalCard request={mockRequest} onResolve={vi.fn()} />);
    for (const name of [/aprobar/i, /editar/i, /rechazar/i]) {
      const btn = screen.getByRole("button", { name });
    expectMin44(btn, "h");
    }
  });

  it("Targets 44px Revisar: ActivityWidget HITL", async () => {
    render(<ActivityWidget />);
    const bridge = ego() as unknown as {
      emitApprovalRequest: (r: unknown) => void;
    };
    bridge.emitApprovalRequest({ ...mockRequest, approvalId: "app-stab13-2" });
    const reviewBtn = await screen.findByText("Revisar");
      expectMin44(reviewBtn as HTMLElement, "h");
      expectMin44(reviewBtn as HTMLElement, "w");
  });

  it("Omnibar navegable: ↓↑ + activedescendant + aria-selected + Enter elige", async () => {
    const user = userEvent.setup();
    const bridge = window.ego as unknown as { memory: unknown };
    const originalMemory = bridge.memory;
    (bridge.memory as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      HITS_RAW
    );
    const selected: OmnibarHit[] = [];
    const onSelect = (e: Event) => selected.push((e as CustomEvent<OmnibarHit>).detail);
    window.addEventListener(OMNIBAR_SELECT_EVENT, onSelect);
    try {
      render(<Omnibar />);
      await user.keyboard("{Control>}k{/Control}");
      const input = await screen.findByRole("combobox", {
        name: /buscar en memoria/i,
      });
      // STAB-13 D2: sin autoFocus nativo (el foco lo gobierna Radix).
      expect(input.hasAttribute("autofocus")).toBe(false);
      await user.type(input, "tarifa");
      expect(await screen.findByText("Tarifas 2026")).toBeTruthy();
      expect(await screen.findByText("Contrato marco")).toBeTruthy();

      await user.keyboard("{ArrowDown}");
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(options[0]?.getAttribute("aria-selected")).toBe("true");
      expect(options[1]?.getAttribute("aria-selected")).toBe("false");
      expect(input.getAttribute("aria-activedescendant")).toBe(
        options[0]?.getAttribute("id")
      );

      await user.keyboard("{ArrowDown}");
      expect(options[1]?.getAttribute("aria-selected")).toBe("true");
      await user.keyboard("{ArrowUp}");
      expect(options[0]?.getAttribute("aria-selected")).toBe("true");

      await user.keyboard("{Enter}");
      expect(selected).toHaveLength(1);
      expect(selected[0]?.key).toBe("tarifa");
      await waitFor(() => expect(screen.queryByRole("search")).toBeNull());
    } finally {
      window.removeEventListener(OMNIBAR_SELECT_EVENT, onSelect);
      bridge.memory = originalMemory;
    }
  });

  it("Omnibar vacío honesto con role=status", async () => {
    const user = userEvent.setup();
    const bridge = window.ego as unknown as { memory: unknown };
    const originalMemory = bridge.memory;
    (bridge.memory as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([]);
    try {
      render(<Omnibar />);
      await user.keyboard("{Control>}k{/Control}");
      const input = await screen.findByRole("combobox", {
        name: /buscar en memoria/i,
      });
      await user.type(input, "zzz");
      // Hay dos status (buscando → vacío); se espera al mensaje final.
      const empty = await screen.findByText(/sin resultados/i);
      expect(empty.getAttribute("role")).toBe("status");
    } finally {
      bridge.memory = originalMemory;
    }
  });

  it("SplitPane colapsado: presente en DOM + oculto + fuera de AT", async () => {
    render(
      <SplitPane id="stab13" side="left" isCollapsed>
        <aside aria-label="Panel colapsado">hola</aside>
      </SplitPane>
    );
    const pane = document.body.querySelector('[data-pane-id="stab13"]');
    expect(pane).not.toBeNull();
    expect(pane?.getAttribute("aria-hidden")).toBe("true");
    expect((pane as HTMLElement).style.visibility).toBe("hidden");
    // El landmark persiste en el DOM (estable para AT) pero oculto.
    expect(pane?.querySelector('aside[aria-label="Panel colapsado"]')).not.toBeNull();
    await act(async () => {});
  });
});