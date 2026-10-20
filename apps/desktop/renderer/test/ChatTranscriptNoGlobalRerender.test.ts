// T7 (Ola 1b) — Cierre de la deuda de T8: el store del transcript NO debe
// provocar un re-render global por cada delta de streaming.
//
// RED primero. El store mutaba el último mensaje "en sitio" pero devolvía
// `{ messages: [...messages] }` → un ARRAY NUEVO en cada delta. El consumidor
// (`ego-chat.tsx`) se suscribe con `useChatTranscript((s) => s.messages)`,
// así que la referencia cambiaba en cada delta → `EgoChat` (y con él la
// cabecera, el composer y el árbol de assistant-ui) se re-renderizaba
// entero, que es exactamente el problema que T8 quería eliminar.
//
// Además, el texto del transcript lo renderiza el store de assistant-ui
// (`ThreadPrimitive.Unstable_MessageById`), no nuestro store: nuestro store
// solo necesita el transcript para el mapa de roles y el conteo, y eso NO
// cambia con un delta de texto.
//
// Lo que se verifica:
//  1. `appendToLastMessage` NO cambia la identidad del array (ni del último
//     mensaje): un delta no dispara re-render.
//  2. El texto sí se acumula (el store sigue siendo la fuente de verdad).
//  3. Añadir un mensaje SÍ cambia la identidad (hace falta para el mapa de
//     roles y para el conteo).
//  4. `selectRoleById` es estable ante un delta de texto.
import { describe, it, expect, beforeEach } from "vitest";
import {
  useChatTranscript,
  selectRoleById,
  type ChatTranscriptMessage,
} from "../components/chat/chat-transcript-store.js";

function msg(
  id: string,
  role: "user" | "assistant",
  text: string
): ChatTranscriptMessage {
  return { id, role, content: [{ type: "text", text }] };
}

describe("T7: el store del transcript no re-renderiza por delta", () => {
  beforeEach(() => {
    useChatTranscript.getState().clearMessages();
  });

  it("un delta de texto NO cambia la identidad del array", () => {
    useChatTranscript
      .getState()
      .setMessages([msg("a", "user", "pregunta"), msg("b", "assistant", "res")]);
    const before = useChatTranscript.getState().messages;
    const beforeLast = before[before.length - 1];

    useChatTranscript.getState().appendToLastMessage("puesta");

    const after = useChatTranscript.getState().messages;
    expect(after, "el array debe conservar su identidad (sin re-render)").toBe(
      before
    );
    expect(after[after.length - 1]).toBe(beforeLast);
  });

  it("el texto sí se acumula (el store sigue siendo la fuente de verdad)", () => {
    useChatTranscript
      .getState()
      .setMessages([msg("a", "user", "pregunta"), msg("b", "assistant", "res")]);
    useChatTranscript.getState().appendToLastMessage("puesta");
    useChatTranscript.getState().appendToLastMessage(" final");
    const messages = useChatTranscript.getState().messages;
    expect(messages[1]?.content[0]?.text).toBe("respuesta final");
    expect(messages[0]?.content[0]?.text).toBe("pregunta");
  });

  it("añadir un mensaje SÍ cambia la identidad (el mapa de roles lo necesita)", () => {
    useChatTranscript.getState().setMessages([msg("a", "user", "pregunta")]);
    const before = useChatTranscript.getState().messages;
    useChatTranscript.getState().appendMessage(msg("b", "assistant", "res"));
    const after = useChatTranscript.getState().messages;
    expect(after).not.toBe(before);
    expect(after).toHaveLength(2);
  });

  it("selectRoleById es estable ante un delta de texto", () => {
    useChatTranscript
      .getState()
      .setMessages([msg("a", "user", "pregunta"), msg("b", "assistant", "res")]);
    const before = selectRoleById(useChatTranscript.getState());
    useChatTranscript.getState().appendToLastMessage("puesta");
    const after = selectRoleById(useChatTranscript.getState());
    expect(after.get("a")).toBe("user");
    expect(after.get("b")).toBe("assistant");
    // El contenido es el mismo (solo cambia el texto del último mensaje).
    expect([...after.keys()]).toEqual([...before.keys()]);
  });
});
