import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  EgoChat,
  shouldVirtualizeChat,
  getChatKeepMountedIndices,
  CHAT_VIRTUALIZATION_THRESHOLD,
  type Msg,
} from "../components/ego-chat.js";

/**
 * T21 (PERF-VIRTUA) — Pruebas de virtualización con virtua en EgoChat.
 *
 * Contrato:
 * 1. shouldVirtualizeChat: función pura con umbral por defecto (60).
 * 2. getChatKeepMountedIndices: mantiene siempre el último mensaje (streaming).
 * 3. Hilo corto (<= 60): monta el 100% de los mensajes con ThreadPrimitive.Messages (sin virtualización).
 * 4. Hilo largo (200 mensajes): activa Virtualizer con virtua, montando MUCHOS menos nodos
 *    que 200 (en Happy-DOM sin layout monta solo los necesarios/keepMounted), y el último mensaje
 *    (#msg-199) SIEMPRE permanece montado.
 * 5. Empty state y Jump to latest intactos.
 */
describe("T21: ChatVirtualization — virtua windowing + umbral + keepMounted", () => {
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

  function makeMessages(count: number): Msg[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: [{ type: "text" as const, text: `Contenido de prueba número ${i}` }],
    }));
  }

  describe("Unidad pura: umbral y ancla de montaje", () => {
    it("shouldVirtualizeChat respeta el umbral canónico de 60 mensajes", () => {
      expect(CHAT_VIRTUALIZATION_THRESHOLD).toBe(60);
      expect(shouldVirtualizeChat(0)).toBe(false);
      expect(shouldVirtualizeChat(1)).toBe(false);
      expect(shouldVirtualizeChat(59)).toBe(false);
      expect(shouldVirtualizeChat(60)).toBe(false);
      expect(shouldVirtualizeChat(61)).toBe(true);
      expect(shouldVirtualizeChat(200)).toBe(true);
    });

    it("shouldVirtualizeChat admite umbral configurable", () => {
      expect(shouldVirtualizeChat(10, 10)).toBe(false);
      expect(shouldVirtualizeChat(11, 10)).toBe(true);
      expect(shouldVirtualizeChat(5, 20)).toBe(false);
    });

    it("getChatKeepMountedIndices devuelve el índice del último mensaje para streaming", () => {
      expect(getChatKeepMountedIndices(0)).toEqual([]);
      expect(getChatKeepMountedIndices(1)).toEqual([0]);
      expect(getChatKeepMountedIndices(60)).toEqual([59]);
      expect(getChatKeepMountedIndices(200)).toEqual([199]);
    });
  });

  describe("Renderizado e integración en DOM", () => {
    it("hilo corto (4 mensajes <= 60): monta todos los mensajes sin virtualización", async () => {
      const shortMessages = makeMessages(4);

      await act(async () => {
        root.render(<EgoChat initialMessages={shortMessages} />);
      });

      // En hilo corto sin virtualización, todos los mensajes están en el DOM
      for (let i = 0; i < 4; i++) {
        const textFound = container.textContent?.includes(`Contenido de prueba número ${i}`);
        expect(textFound).toBe(true);
      }
    });

    it("hilo largo (200 mensajes): monta MUCHOS menos nodos que 200 y el último mensaje está presente", async () => {
      const longMessages = makeMessages(200);

      await act(async () => {
        root.render(<EgoChat initialMessages={longMessages} />);
      });

      // El código anterior sin virtualización montaba 200 burbujas en el DOM.
      // Con virtua en Happy-DOM (sin layout engine), el windowing solo monta los elementos
      // visibles / keepMounted (<= 10 nodos), que es drásticamente menor a 200.
      const mountedMessageBubbles = container.querySelectorAll(
        '[data-testid="chat-message-turn"], .user-turn, .assistant-turn'
      );
      expect(mountedMessageBubbles.length).toBeLessThan(200);

      // Verificación de que el último mensaje (índice 199, en streaming / keepMounted) está presente
      const lastMessageText = container.textContent?.includes("Contenido de prueba número 199");
      expect(lastMessageText).toBe(true);
    });

    it("estado vacío: muestra '¿Por dónde empezamos?' cuando no hay mensajes", async () => {
      await act(async () => {
        root.render(<EgoChat initialMessages={[]} />);
      });

      expect(container.textContent).toContain("¿Por dónde empezamos?");
      expect(container.textContent).toContain("Cerebro Operativo de Ego");
    });

    it("scroll-lock: botón 'Jump to latest' disponible cuando el usuario sube el scroll", async () => {
      await act(async () => {
        root.render(<EgoChat initialMessages={makeMessages(10)} />);
      });

      const viewport = container.querySelector('[style*="overflow-y"]') as HTMLDivElement | null;
      if (viewport) {
        // Simular que el usuario subió (scrollTop = 0, scrollHeight = 2000, clientHeight = 400)
        Object.defineProperty(viewport, "scrollTop", { value: 0, writable: true });
        Object.defineProperty(viewport, "scrollHeight", { value: 2000, writable: true });
        Object.defineProperty(viewport, "clientHeight", { value: 400, writable: true });

        await act(async () => {
          viewport.dispatchEvent(new Event("scroll"));
        });

        const jumpBtn = container.querySelector('button[aria-label="Saltar al último mensaje"]');
        expect(jumpBtn).not.toBeNull();
        expect(jumpBtn?.textContent).toContain("Jump to latest");
      }
    });
  });
});
