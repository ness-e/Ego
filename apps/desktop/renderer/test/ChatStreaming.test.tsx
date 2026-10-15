import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EgoChat } from "../components/ego-chat.js";
import { getSharedCanvasBridge } from "../hooks/useCanvasBridge.js";

type DeltaHandler = (chunk: unknown) => void;

/**
 * T02 — Streaming real del chat (RED primero, TDD).
 * Contrato: 2 chunks incrementales visibles ANTES del invoke final,
 * skeleton con altura reservada, tool_call/tool_result inline,
 * bloqueo BYOK explícito sin keys, payload canvas estructurado.
 */
describe("T02: ChatStreaming — deltas reales + skeleton + HITL único + BYOK", () => {
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

  function installBridge(opts: {
    provider: string;
    providerKey?: string;
    chunks?: unknown[];
    finalText?: string;
    /** Barrera manual: el invoke final no resuelve hasta que se libere. */
    release?: Promise<void>;
  }) {
    let deltaCb: DeltaHandler | null = null;
    const bridge = {
      llmStream: vi.fn(async () => {
        for (const c of opts.chunks ?? []) deltaCb?.(c);
        await (opts.release ?? Promise.resolve());
        return {
          ok: true,
          turnId: "turn_test",
          text: opts.finalText ?? "Respuesta final del turno.",
          recallStatus: { count: 0, glyph: "🧠", sources: [] as string[], tokensEstimate: 0 },
        };
      }),
      settings: {
        getModelConfig: vi.fn(async () => ({
          activeProvider: opts.provider,
          ...(opts.providerKey ? { openaiKey: opts.providerKey } : {}),
        })),
        saveModelConfig: vi.fn(async (config: unknown) => ({ ok: true, config })),
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

  it("pinta 2 chunks incrementales antes del invoke final (delta suscrito)", async () => {
    // Gate manual: el invoke final NO resuelve hasta liberarlo — la aserción
    // intermedia es determinista (sin carreras de timers bajo carga).
    let releaseFinal!: () => void;
    const release = new Promise<void>((r) => {
      releaseFinal = r;
    });
    installBridge({
      provider: "ollama",
      chunks: [
        { type: "text", delta: "Hola " },
        { type: "text", delta: "mundo" },
      ],
      finalText: "Hola mundo. Respuesta final del turno.",
      release,
    });

    await act(async () => {
      root.render(<EgoChat />);
    });

    await sendMessage("pregunta de prueba");

    // El invoke final sigue bloqueado: solo los 2 deltas son visibles.
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Hola ");
    expect(container.textContent).toContain("mundo");
    expect(container.textContent).not.toContain("Respuesta final del turno");
    // Skeleton con altura reservada visible durante el streaming.
    expect(
      container.querySelector('[data-testid="chat-streaming-skeleton"]')
    ).not.toBeNull();

    // Tras liberar el invoke final, el texto definitivo reemplaza el stream.
    await act(async () => {
      releaseFinal();
      await release;
    });
    expect(container.textContent).toContain("Respuesta final del turno");
  });

  it("pinta tool_call/tool_result inline durante el streaming", async () => {
    let releaseFinal!: () => void;
    const release = new Promise<void>((r) => {
      releaseFinal = r;
    });
    installBridge({
      provider: "ollama",
      chunks: [
        { type: "text", delta: "Consultando " },
        { type: "tool_call", callId: "call-1", toolName: "fs_read_file", arguments: { path: "a.txt" } },
        { type: "tool_result", callId: "call-1", toolName: "fs_read_file", success: true, output: "ok" },
      ],
      finalText: "Listo.",
      release,
    });

    await act(async () => {
      root.render(<EgoChat />);
    });

    await sendMessage("lee el archivo");

    await act(async () => {
      await Promise.resolve();
    });

    const strip = container.querySelector('[data-testid="chat-tool-activity"]');
    expect(strip).not.toBeNull();
    expect(strip?.textContent).toContain("fs_read_file");

    await act(async () => {
      releaseFinal();
      await release;
    });
    expect(container.textContent).toContain("Listo.");
  });

  it("envía el sessionId del hilo en llmStream (historial por sesión)", async () => {
    // 2026-10-15: sin sessionId todos los turnos caían al bucket del
    // lifecycle y el historial por sesión jamás se acumulaba.
    const bridge = installBridge({
      provider: "ollama",
      chunks: [{ type: "text", delta: "hola " }],
      finalText: "hola. Respuesta final.",
    });

    await act(async () => {
      root.render(<EgoChat sessionId="sess-test-hilo-1" />);
    });

    await sendMessage("hola hilo");

    expect(bridge.llmStream).toHaveBeenCalledTimes(1);
    expect((bridge.llmStream.mock.calls as unknown[][])[0]?.[0]).toMatchObject({
      prompt: "hola hilo",
      sessionId: "sess-test-hilo-1",
    });
  });

  it("bloquea con error BYOK explícito sin keys del proveedor activo (sin invocar)", async () => {
    const bridge = installBridge({ provider: "openai", finalText: "nunca" });

    await act(async () => {
      root.render(<EgoChat />);
    });

    await sendMessage("hola sin keys");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(bridge.llmStream).not.toHaveBeenCalled();
    expect(container.textContent).toContain("BYOK");
    expect(container.textContent).toContain("openai");
  });

  it("permite el turno con key BYOK presente en el proveedor activo", async () => {
    const bridge = installBridge({
      provider: "openai",
      providerKey: "sk-test-key",
      chunks: [{ type: "text", delta: "con key " }],
      finalText: "con key. Respuesta final.",
    });

    await act(async () => {
      root.render(<EgoChat />);
    });

    await sendMessage("hola con key");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(bridge.llmStream).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Respuesta final");
  });

  it("la acción de Canvas viaja con payload estructurado (T04, payload ?? {})", async () => {
    const bridge = installBridge({ provider: "ollama", finalText: "canvas ok" });

    await act(async () => {
      root.render(<EgoChat />);
    });

    await act(async () => {
      getSharedCanvasBridge().dispatchAction("comp-1", "save", { format: "json" });
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(bridge.llmStream).toHaveBeenCalledTimes(1);
    const rawCall = bridge.llmStream.mock.calls[0] as unknown;
    const promptArg = (
      Array.isArray(rawCall) ? rawCall[0] : undefined
    ) as { prompt?: unknown } | undefined;
    const prompt = String(promptArg?.prompt ?? "");
    expect(prompt).toContain("comp-1");
    expect(prompt).toContain('"format":"json"');
  });
});
