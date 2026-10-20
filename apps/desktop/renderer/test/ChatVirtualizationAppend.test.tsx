import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EgoChat, type Msg } from "../components/ego-chat.js";

type DeltaHandler = (chunk: unknown) => void;

/**
 * T1 (EGO-FIND-20) — Regresión P0: el chat revienta con >60 mensajes + envío de turno.
 *
 * El caso que faltaba en la suite del P0 (`ChatVirtualization.test.tsx`): montar
 * 60+ mensajes ESTÁTICOS nunca ejercita el append; el desync entre el array local
 * de React y el store de assistant-ui solo aparece cuando se AÑADE un turno.
 *
 * Síntoma histórico: `useClientLookup: index N out of bounds (length: N-1)`,
 * lanzado desde `ThreadPrimitive.MessageByIndex` (`ego-chat.tsx:1560`), que
 * resuelve por ÍNDICE contra el store mientras el `<Virtualizer>` itera el
 * array local.
 */
describe("T1: virtualización + append de turno no revienta (EGO-FIND-20)", () => {
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

  function installBridge() {
    let deltaCb: DeltaHandler | null = null;
    const bridge = {
      llmStream: vi.fn(async () => {
        deltaCb?.({ type: "text", delta: "respuesta" });
        return {
          ok: true,
          turnId: "turn-t1",
          text: "respuesta final",
          recallStatus: { count: 0, glyph: "x", sources: [] as string[], tokensEstimate: 0 },
        };
      }),
      settings: {
        getModelConfig: vi.fn(async () => ({ activeProvider: "ollama" })),
        saveModelConfig: vi.fn(async () => ({ ok: true })),
      },
      memory: vi.fn(async () => ({ ok: true })),
      resolveApproval: vi.fn(async () => ({ ok: true })),
      onChatDelta: (cb: DeltaHandler) => {
        deltaCb = cb;
        return () => {
          deltaCb = null;
        };
      },
      onRecallStatus: () => () => {},
      onChatError: () => () => {},
      onApprovalRequest: () => () => {},
      onEvent: () => () => {},
    };
    (window as unknown as { ego?: unknown }).ego = bridge;
    return bridge;
  }

  async function sendMessage(text: string) {
    const input = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    await act(async () => {
      const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      desc?.set?.call(input, text);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const sendBtn = container.querySelector(
      'button[aria-label="Enviar mensaje"]'
    ) as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    await act(async () => {
      sendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
    });
  }

  function seed(count: number): Msg[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: [{ type: "text" as const, text: `msg ${i}` }],
    }));
  }

  it("no lanza index-out-of-bounds al añadir un turno con 70 mensajes previos", async () => {
    installBridge();
    const uncaught: string[] = [];
    const onError = (e: ErrorEvent) => {
      uncaught.push(String(e.error ?? e.message));
    };
    window.addEventListener("error", onError);

    await act(async () => {
      root.render(<EgoChat initialMessages={seed(70)} />);
    });

    await sendMessage("pregunta tras 70 mensajes");

    window.removeEventListener("error", onError);

    expect(
      uncaught.filter((e) => e.includes("out of bounds") || e.includes("useClientLookup")),
      `errores no capturados: ${uncaught.join(" | ")}`
    ).toEqual([]);
    // El turno nuevo (respuesta del asistente) debe estar montado: `keepMounted`
    // garantiza que el último mensaje del hilo nunca se desmonta.
    expect(container.textContent).toContain("respuesta final");
  });

  it("el hilo virtualizado sigue montando mensajes tras el append (keepMounted)", async () => {
    installBridge();
    await act(async () => {
      root.render(<EgoChat initialMessages={seed(70)} />);
    });
    await sendMessage("otra pregunta");
    const mounted = container.querySelectorAll('[data-testid="chat-message-turn"]');
    expect(mounted.length).toBeGreaterThan(0);
    // El último item debe seguir montado (contrato de `keepMounted`).
    const last = mounted[mounted.length - 1];
    expect(last?.getAttribute("data-message-id")).toBeTruthy();
  });
});
