import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EgoChat } from "../components/ego-chat.js";
import {
  CFG11_FIRST_PAINT_TARGET_MS,
  createPaintMarks,
  firstTokenLatencyMs,
  inputToPaintMs,
} from "../components/ego-chat.js";

type DeltaHandler = (chunk: unknown) => void;

/**
 * CFG-11 — Marcas input-to-paint por frontera (tSend/tFirst/tPaint).
 * Contrato: el primer delta emite `chat.first_token` con latencia;
 * objetivo documentado <800ms; sin cambiar UX (rAF batching intacto).
 */
describe("CFG-11: input-to-paint — helpers puros", () => {
  it("objetivo documentado de 800ms", () => {
    expect(CFG11_FIRST_PAINT_TARGET_MS).toBe(800);
  });

  it("crea marcas con tSend y resto pendiente", () => {
    const m = createPaintMarks(1000);
    expect(m.tSend).toBe(1000);
    expect(m.tFirst).toBeNull();
    expect(m.tPaint).toBeNull();
    expect(firstTokenLatencyMs(m)).toBeNull();
    expect(inputToPaintMs(m)).toBeNull();
  });

  it("computa latencias por frontera", () => {
    const m = createPaintMarks(1000);
    m.tFirst = 1250;
    m.tPaint = 1300;
    expect(firstTokenLatencyMs(m)).toBe(250);
    expect(inputToPaintMs(m)).toBe(300);
  });
});

describe("CFG-11: input-to-paint — emite chat.first_token en el primer delta", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalEgo: unknown;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEgo = (window as unknown as { ego?: unknown }).ego;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (window as unknown as { ego?: unknown }).ego = originalEgo;
    debugSpy.mockRestore();
  });

  it("un turno con deltas loguea first_token_ms una sola vez", async () => {
    let releaseFinal!: () => void;
    const release = new Promise<void>((r) => {
      releaseFinal = r;
    });
    let deltaCb: DeltaHandler | null = null;
    (window as unknown as { ego?: unknown }).ego = {
      llmStream: vi.fn(async () => {
        deltaCb?.({ type: "text", delta: "Hola " });
        deltaCb?.({ type: "text", delta: "mundo" });
        await release;
        return {
          ok: true,
          turnId: "turn_cfg11",
          text: "Hola mundo final.",
          recallStatus: { count: 0, glyph: "🧠", sources: [] as string[], tokensEstimate: 0 },
        };
      }),
      settings: { getModelConfig: vi.fn(async () => ({ activeProvider: "ollama" })) },
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

    await act(async () => {
      root.render(<EgoChat />);
    });

    const input = container.querySelector("textarea, input:not([type='file'])") as HTMLElement | null;
    if (!input) throw new Error("composer input no encontrado");
    await act(async () => {
      if (input instanceof HTMLTextAreaElement) {
        const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
        desc?.set?.call(input, "hola cfg11");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');
    if (!sendBtn) throw new Error("botón Enviar no encontrado");
    await act(async () => {
      sendBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    const calls = debugSpy.mock.calls.filter((c) => String(c[0]).includes("chat.first_token"));
    expect(calls.length).toBe(1);
    expect(String(calls[0]?.[0])).toMatch(/first_token_ms=\d/);

    await act(async () => {
      releaseFinal();
      await release;
    });
    expect(container.textContent).toContain("Hola mundo final");
  });
});
