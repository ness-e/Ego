import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EgoChat } from "../components/ego-chat.js";

/**
 * T19 (T16-COSTS) — badge de coste del turno actual en el chat.
 * Solo lectura de `streamRes.usage`; streaming intacto.
 */
describe("T19: EgoChat — badge de coste por turno", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalEgo: unknown;

  beforeEach(() => {
    originalEgo = (window as unknown as { ego?: unknown }).ego;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (window as unknown as { ego?: unknown }).ego = originalEgo;
  });

  function installBridge(opts: { usage?: unknown; finalText?: string }) {
    const bridge = {
      llmStream: vi.fn(async () => ({
        ok: true,
        turnId: "turn_cost_1",
        text: opts.finalText ?? "Respuesta con coste.",
        recallStatus: { count: 0, glyph: "🧠", sources: [] as string[], tokensEstimate: 0 },
        ...(opts.usage !== undefined ? { usage: opts.usage } : {}),
      })),
      settings: {
        getModelConfig: vi.fn(async () => ({ activeProvider: "ollama" })),
        saveModelConfig: vi.fn(async (config: unknown) => ({ ok: true, config })),
      },
      memory: vi.fn(async () => ({ ok: true })),
      resolveApproval: vi.fn(async () => ({ ok: true })),
      onChatDelta: () => () => {},
      onRecallStatus: () => () => {},
      onChatError: () => () => {},
      onApprovalRequest: () => () => {},
      onEvent: () => () => {},
    };
    (window as unknown as { ego?: unknown }).ego = bridge;
    return bridge;
  }

  async function sendMessage(text: string) {
    const input = container.querySelector(
      "textarea, input[type='text'], input:not([type]), [contenteditable='true']"
    ) as (HTMLTextAreaElement & HTMLInputElement & HTMLElement) | null;
    if (!input) throw new Error("composer input no encontrado");
    await act(async () => {
      const proto =
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc?.set && "value" in input) {
        desc.set.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        input.textContent = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const sendBtn =
      container.querySelector('button[aria-label="Enviar mensaje"]') ??
      Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Enviar")
      );
    if (!sendBtn) throw new Error("botón Enviar no encontrado");
    await act(async () => {
      sendBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  it("muestra el badge con tokens y USD cuando `usage` viene en el turno", async () => {
    installBridge({
      usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200, estimatedCostUsd: 0.0012 },
    });

    await act(async () => {
      root.render(<EgoChat />);
    });
    await sendMessage("hola con coste");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    const badge = container.querySelector('[data-testid="chat-turn-cost"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("200");
    expect(badge?.textContent).toContain("$0.0012");
  });

  it("vacío honesto: sin badge cuando el turno no trae `usage`", async () => {
    installBridge({});

    await act(async () => {
      root.render(<EgoChat />);
    });
    await sendMessage("hola sin coste");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(container.textContent).toContain("Respuesta con coste");
    expect(container.querySelector('[data-testid="chat-turn-cost"]')).toBeNull();
  });
});
