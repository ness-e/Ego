// floating-keyboard.test.tsx — FIND-11-02 (TDD RED→GREEN).
//
// Contrato: `Escape` colapsa la flotante (vista local, pending intacto).
// expanded/alert/hitl_approval → compact; compact → hidden; hidden → no-op.
// Escape NUNCA resuelve ni rechaza HITL (sin llamadas a approve/deny).
// Tras colapsar, el foco cae al control estable (botón mute) — patrón
// ActivityTray (`ActivityTray.tsx:102-110`), adaptado: la flotante no tiene
// trigger externo, el mute es el único control persistente.
// `Enter` no colapsa (idempotente, `views.tsx:317` — no tocar).

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FloatingApp } from "../floating/floating.js";

type Attention = "hidden" | "compact" | "expanded" | "alert" | "hitl_approval";

interface Snapshot {
  visible: boolean;
  muted: boolean;
  attentionState: Attention;
}

function installBridge(state: Snapshot, spies: { approve: () => Promise<unknown>; deny: () => Promise<unknown> }): void {
  window.egoFloating = {
    onState: (cb: (s: Snapshot) => void) => {
      cb(state);
      return () => {};
    },
    approve: spies.approve,
    deny: spies.deny,
    setMuted: () => Promise.resolve({}),
  } as unknown as Window["egoFloating"];
}

async function mountFloating(state: Snapshot, spies = { approve: () => Promise.resolve({}), deny: () => Promise.resolve({}) }): Promise<{ host: HTMLElement; root: Root; main: () => HTMLElement | null }> {
  installBridge(state, spies);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(FloatingApp));
  });
  return { host, root, main: () => host.querySelector("main") };
}

function pressKey(key: string): void {
  window.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

async function pressKeyAct(key: string): Promise<void> {
  await act(async () => {
    pressKey(key);
  });
}

afterEach(() => {
  delete window.egoFloating;
  document.body.innerHTML = "";
});

describe("FIND-11-02: Escape colapsa la flotante (vista local)", () => {
  it("Escape en expanded colapsa a compact", async () => {
    const { main } = await mountFloating({ visible: true, muted: false, attentionState: "expanded" });
    expect(main()?.dataset.attention).toBe("expanded");
    await pressKeyAct("Escape");
    expect(main()?.dataset.attention).toBe("compact");
  });

  it("Escape en compact colapsa a hidden", async () => {
    const { main } = await mountFloating({ visible: true, muted: false, attentionState: "compact" });
    await pressKeyAct("Escape");
    expect(main()?.dataset.attention).toBe("hidden");
  });

  it("Escape en hidden es no-op", async () => {
    const { main } = await mountFloating({ visible: true, muted: false, attentionState: "hidden" });
    await pressKeyAct("Escape");
    expect(main()?.dataset.attention).toBe("hidden");
  });

  it("Escape en alert colapsa a compact", async () => {
    const { main } = await mountFloating({ visible: true, muted: false, attentionState: "alert" });
    await pressKeyAct("Escape");
    expect(main()?.dataset.attention).toBe("compact");
  });

  it("Escape en hitl_approval colapsa vista SIN resolver el HITL", async () => {
    const approve = vi.fn(() => Promise.resolve({}));
    const deny = vi.fn(() => Promise.resolve({}));
    const { main } = await mountFloating(
      { visible: true, muted: false, attentionState: "hitl_approval" },
      { approve, deny },
    );
    await pressKeyAct("Escape");
    expect(main()?.dataset.attention).toBe("compact");
    expect(approve).not.toHaveBeenCalled();
    expect(deny).not.toHaveBeenCalled();
  });

  it("Enter no colapsa (idempotente, fuera de alcance)", async () => {
    const { main } = await mountFloating({ visible: true, muted: false, attentionState: "expanded" });
    await pressKeyAct("Enter");
    expect(main()?.dataset.attention).toBe("expanded");
  });

  it("tras colapsar, el foco cae al control estable (botón mute)", async () => {
    const { main } = await mountFloating({ visible: true, muted: false, attentionState: "expanded" });
    document.body.focus();
    await pressKeyAct("Escape");
    expect(main()?.dataset.attention).toBe("compact");
    const mute = main()?.querySelector("button");
    expect(mute).not.toBeNull();
    expect(document.activeElement).toBe(mute);
  });

  it("cleanup en unmount: Escape tras desmontar no rompe ni re-monta", async () => {
    const { host, root } = await mountFloating({ visible: true, muted: false, attentionState: "expanded" });
    await act(async () => {
      root.unmount();
    });
    expect(host.querySelector("main")).toBeNull();
    await pressKeyAct("Escape");
    expect(host.querySelector("main")).toBeNull();
  });
});
