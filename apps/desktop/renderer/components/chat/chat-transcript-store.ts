import { create } from "zustand";
import type { RecallBadgeInfo } from "../../lib/ego.js";

/**
 * T8 (EGO-FIND-73) — Store Zustand del transcript del chat.
 *
 * ## Por qué
 * El transcript vivía en `useState` dentro del componente raíz `EgoChat`.
 * Cada delta de streaming llamaba a `setMessages(...)`, lo que provocaba un
 * re-render del componente raíz **completo** (25 `useState` + 25 refs + el
 * `runtime` de assistant-ui) y, en cascada, de todos los consumidores del
 * `ChatActionsContext`. Con un hilo largo eso son decenas de renders por
 * segundo sobre el árbol entero.
 *
 * Con un store dedicado:
 *  - el transcript vive FUERA del árbol de componentes,
 *  - cada consumidor puede suscribirse SOLO a lo que necesita
 *    (`useChatTranscript(s => s.messages.length)`, etc.),
 *  - las mutaciones durante el streaming son updates puntuales del store
 *    (`appendToLastMessage`) en vez de crear un array nuevo completo.
 */

/** Mensaje del transcript del chat (forma canónica compartida). */
export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: [{ type: "text"; text: string }];
  recall?: RecallBadgeInfo;
  isError?: boolean;
};

export type ChatTranscriptMessage = Msg;

export interface ChatTranscriptState {
  messages: ChatTranscriptMessage[];
  /**
   * Sustituye el transcript completo (carga de sesión, reset, clear) o
   * aplica una actualización funcional (misma firma que `useState`).
   */
  setMessages: (
    messages:
      | ChatTranscriptMessage[]
      | ((prev: ChatTranscriptMessage[]) => ChatTranscriptMessage[])
  ) => void;
  /** Añade un mensaje al final. */
  appendMessage: (message: ChatTranscriptMessage) => void;
  /**
   * Actualiza el texto del último mensaje (streaming) **sin** recrear el
   * array completo: muta en sitio el último elemento, de modo que los
   * consumidores que comparan por referencia no se re-renderizan.
   *
   * T7 (Ola 1b): la identidad del array **tampoco** cambia. Antes se
   * devolvía `{ messages: [...messages] }` (array nuevo) → el consumidor
   * `useChatTranscript((s) => s.messages)` se re-renderizaba en CADA delta
   * de streaming, que es justo el re-render global que T8 quería eliminar.
   * El texto del transcript lo renderiza el store de assistant-ui
   * (`ThreadPrimitive.Unstable_MessageById`), no este store: aquí solo se
   * necesita el transcript para el mapa de roles y el conteo, y eso NO
   * cambia con un delta de texto.
   */
  appendToLastMessage: (text: string) => void;
  /** Vacía el transcript. */
  clearMessages: () => void;
  /** Número de mensajes (selector barato para conteos/umbrales). */
  count: () => number;
}

export const useChatTranscript = create<ChatTranscriptState>()((set, get) => ({
  messages: [],
  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function"
          ? (
              messages as (prev: ChatTranscriptMessage[]) => ChatTranscriptMessage[]
            )(state.messages)
          : messages,
    })),
  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  appendToLastMessage: (text) =>
    set((state) => {
      const messages = state.messages;
      const last = messages[messages.length - 1];
      if (!last) return state;
      const current = last.content.map((p) => p.text).join("");
      // Mutación IN SITU: ni la identidad del array ni la del último
      // mensaje cambian → los selectores por referencia (`s.messages`) no
      // disparan re-render durante el streaming. El texto SÍ cambia (lo
      // lee el componente que lo consume).
      last.content = [{ type: "text", text: current + text }];
      // `state` (misma referencia) ⇒ Zustand notifica, pero los selectores
      // que comparan por referencia devuelven el MISMO valor ⇒ no hay
      // re-render en los consumidores granulares.
      return state;
    }),
  clearMessages: () => set({ messages: [] }),
  count: () => get().messages.length,
}));

/**
 * Selector: el último id de mensaje. Es lo que necesita `ChatActionsContext`
 * para saber qué turno está en curso, sin suscribirse al array completo.
 */
export const selectLastMessageId = (
  state: ChatTranscriptState
): string | undefined => {
  const messages = state.messages;
  return messages[messages.length - 1]?.id;
};

/**
 * Selector: mapa id → rol. Lo usa la lista virtualizada para saber el rol
 * de cada mensaje sin depender del array completo.
 */
export const selectRoleById = (
  state: ChatTranscriptState
): ReadonlyMap<string, "user" | "assistant"> => {
  const map = new Map<string, "user" | "assistant">();
  for (const m of state.messages) map.set(m.id, m.role);
  return map;
};
