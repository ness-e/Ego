import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useChatTranscript,
  selectLastMessageId,
  selectRoleById,
  type Msg,
} from "../components/chat/chat-transcript-store.js";

/**
 * T8 (EGO-FIND-73) — Store Zustand dedicado para el transcript del chat.
 *
 * Antes el transcript vivía en `useState` del componente raíz `EgoChat`:
 * cada delta de streaming re-renderizaba el árbol entero.
 */
describe("T8: store del transcript del chat", () => {
  beforeEach(() => {
    useChatTranscript.setState({ messages: [] });
  });

  /** Constructor de mensaje con la forma EXACTA de `Msg` (tupla de 1). */
  const msg = (
    id: string,
    role: "user" | "assistant",
    text: string
  ): Msg => ({ id, role, content: [{ type: "text", text }] });

  it("sustituye el transcript completo", () => {
    useChatTranscript.getState().setMessages([msg("a", "user", "hola")]);
    expect(useChatTranscript.getState().messages).toHaveLength(1);
    expect(useChatTranscript.getState().messages[0]?.id).toBe("a");
  });

  it("acepta actualizaciones funcionales (misma firma que useState)", () => {
    useChatTranscript
      .getState()
      .setMessages((prev) => [...prev, msg("b", "assistant", "hola")]);
    expect(useChatTranscript.getState().messages).toHaveLength(1);
    expect(useChatTranscript.getState().messages[0]?.id).toBe("b");
  });

  it("appendToLastMessage concatena sin perder el resto del transcript", () => {
    useChatTranscript
      .getState()
      .setMessages([msg("a", "user", "pregunta"), msg("b", "assistant", "res")]);
    useChatTranscript.getState().appendToLastMessage("puesta");
    const messages = useChatTranscript.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[1]?.content[0]?.text).toBe("respuesta");
    expect(messages[0]?.content[0]?.text).toBe("pregunta");
  });

  it("appendToLastMessage es idempotente con texto vacío", () => {
    useChatTranscript.getState().setMessages([msg("b", "assistant", "res")]);
    useChatTranscript.getState().appendToLastMessage("");
    expect(useChatTranscript.getState().messages[0]?.content[0]?.text).toBe("res");
  });

  it("appendToLastMessage no falla con transcript vacío", () => {
    expect(() => useChatTranscript.getState().appendToLastMessage("x")).not.toThrow();
    expect(useChatTranscript.getState().messages).toHaveLength(0);
  });

  it("clearMessages vacía el transcript", () => {
    useChatTranscript.getState().setMessages([msg("a", "user", "x")]);
    useChatTranscript.getState().clearMessages();
    expect(useChatTranscript.getState().messages).toHaveLength(0);
  });

  it("selectLastMessageId devuelve el id del último turno", () => {
    useChatTranscript
      .getState()
      .setMessages([msg("a", "user", "x"), msg("b", "assistant", "y")]);
    expect(selectLastMessageId(useChatTranscript.getState())).toBe("b");
  });

  it("selectRoleById mapea id → rol (para la lista virtualizada)", () => {
    useChatTranscript
      .getState()
      .setMessages([msg("a", "user", "x"), msg("b", "assistant", "y")]);
    const roles = selectRoleById(useChatTranscript.getState());
    expect(roles.get("a")).toBe("user");
    expect(roles.get("b")).toBe("assistant");
  });

  it("el store es compartido entre consumidores (una sola fuente de verdad)", () => {
    const spy = vi.fn();
    const unsub = useChatTranscript.subscribe(spy);
    useChatTranscript.getState().setMessages([msg("a", "user", "x")]);
    expect(spy).toHaveBeenCalled();
    unsub();
  });
});
