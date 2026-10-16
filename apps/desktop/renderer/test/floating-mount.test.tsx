// floating-mount.test.tsx — FIND-12-02 (TDD RED→GREEN).
//
// Contrato: FloatingApp monta en el shell Task3 (`#ticker`, `#approval-card`,
// `#countdown`) los ViewHost de Task6/9 ante su estado, con contenido > 0;
// zona drop con target válido; Enter sobre approval resuelve vía
// `egoFloating.approve` (idempotente views.tsx:317); Escape (FIND-11-02) intacto.

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FloatingApp, AvatarSafe } from "../floating/floating.js";

type Attention = "hidden" | "compact" | "expanded" | "alert" | "hitl_approval";

interface Snapshot {
  visible: boolean;
  muted: boolean;
  attentionState: Attention;
}

let push: ((s: Snapshot) => void) | null = null;

function installBridge(spies: {
  approve: (id: string) => Promise<unknown>;
  deny: (id: string, reason?: string) => Promise<unknown>;
}): void {
  window.egoFloating = {
    onState: (cb: (s: Snapshot) => void) => {
      push = cb;
      return () => {
        push = null;
      };
    },
    approve: spies.approve,
    deny: spies.deny,
    setMuted: () => Promise.resolve({}),
  } as unknown as Window["egoFloating"];
}

async function mountFloating(): Promise<{ root: Root }> {
  // Shell Task3 (igual que floating.html): mounts estáticos fuera del root React.
  document.body.innerHTML =
    `<div id="ticker" hidden></div>` +
    `<div id="approval-card" hidden></div>` +
    `<div id="countdown" hidden></div>` +
    `<div id="app"></div>`;
  const app = document.getElementById("app") as HTMLElement;
  const root = createRoot(app);
  await act(async () => {
    root.render(createElement(FloatingApp));
  });
  return { root };
}

async function pushState(s: Attention): Promise<void> {
  await act(async () => {
    push?.({ visible: true, muted: false, attentionState: s });
  });
}

function textOf(id: string): string {
  return document.getElementById(id)?.textContent?.trim() ?? "";
}

function childCount(id: string): number {
  return document.getElementById(id)?.childElementCount ?? 0;
}

afterEach(() => {
  push = null;
  delete window.egoFloating;
  document.body.innerHTML = "";
});

describe("FIND-12-02: AvatarSafe contiene un avatar roto sin tumbar el árbol", () => {
  it("un hijo que lanza en commit cae a placeholder estable", async () => {
    function Boom(): never {
      throw new Error("vendor roto (simulado FIND-12-01)");
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(AvatarSafe, null, createElement(Boom)));
    });
    expect(host.querySelector("[data-avatar-fallback]")).not.toBeNull();
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});

describe("FIND-12-02: mounts con contenido ante su estado", () => {
  it("#ticker renderiza overview con contenido en expanded", async () => {
    installBridge({ approve: () => Promise.resolve({}), deny: () => Promise.resolve({}) });
    await mountFloating();
    await pushState("expanded");
    expect(childCount("ticker")).toBeGreaterThan(0);
    expect(textOf("ticker").length).toBeGreaterThan(0);
  });

  it("#approval-card renderiza tarjeta con botones en hitl_approval", async () => {
    installBridge({ approve: () => Promise.resolve({}), deny: () => Promise.resolve({}) });
    await mountFloating();
    await pushState("hitl_approval");
    const card = document.getElementById("approval-card") as HTMLElement;
    expect(card.querySelector(".ego-approve-btn")).not.toBeNull();
    expect(card.querySelector(".ego-deny-btn")).not.toBeNull();
    expect(textOf("approval-card").length).toBeGreaterThan(0);
  });

  it("#approval-card renderiza pregunta con contenido en alert", async () => {
    installBridge({ approve: () => Promise.resolve({}), deny: () => Promise.resolve({}) });
    await mountFloating();
    await pushState("alert");
    expect(childCount("approval-card")).toBeGreaterThan(0);
    expect(textOf("approval-card").length).toBeGreaterThan(0);
  });

  it("#countdown monta barra en expanded", async () => {
    installBridge({ approve: () => Promise.resolve({}), deny: () => Promise.resolve({}) });
    await mountFloating();
    await pushState("expanded");
    expect(document.querySelector("#countdown .ego-countdown")).not.toBeNull();
  });

  it("Enter sobre approval resuelve vía egoFloating.approve (idempotente)", async () => {
    const approve = vi.fn((_id: string) => Promise.resolve({}));
    installBridge({ approve, deny: () => Promise.resolve({}) });
    await mountFloating();
    await pushState("hitl_approval");
    const card = document.getElementById("approval-card") as HTMLElement;
    expect(card.querySelector(".ego-approve-btn")).not.toBeNull();
    await act(async () => {
      card.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
      window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve.mock.calls[0]?.[0]).toBe("floating-preview");
  });

  it("zona drop con target válido: dragover acepta + drop alimenta el ticker", async () => {
    installBridge({ approve: () => Promise.resolve({}), deny: () => Promise.resolve({}) });
    await mountFloating();
    await pushState("expanded");
    const zone = document.querySelector("[data-dropzone]") as HTMLElement;
    expect(zone).not.toBeNull();
    const over = new window.Event("dragover", { bubbles: true, cancelable: true });
    await act(async () => {
      zone.dispatchEvent(over);
    });
    expect(over.defaultPrevented).toBe(true);
    const file = new window.File(["hola"], "nota.pdf", { type: "application/pdf" });
    const drop = new window.Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } });
    await act(async () => {
      zone.dispatchEvent(drop);
    });
    expect(drop.defaultPrevented).toBe(true);
    expect(textOf("ticker")).toContain("nota.pdf");
  });
});
