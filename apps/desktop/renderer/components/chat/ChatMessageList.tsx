"use client";
import { memo, useMemo, type ComponentType, type RefObject } from "react";
import { ThreadPrimitive, unstable_useThreadMessageIds } from "@assistant-ui/react";
import { Virtualizer } from "virtua";

/**
 * T1 (EGO-FIND-20) — Lista de mensajes del chat con soporte de windowing.
 *
 * ## Por qué NO `ThreadPrimitive.MessageByIndex`
 * `MessageByIndex` resuelve el mensaje por **índice** contra el store de
 * assistant-ui (`aui.thread.message({index})` → `useClientLookup`). El
 * `<Virtualizer>` itera un array que, en este renderer, es el estado local de
 * React (`messages`), que adelanta al store en un tick durante el streaming.
 * Al añadir un turno, el índice renderizado puede exceder
 * `thread.messages.length` → throw `useClientLookup: index N out of bounds`,
 * que rompía el chat completo a partir del turno 31 (≈60+ mensajes).
 *
 * ## Patrón elegido (el que documenta la propia librería)
 * `unstable_useThreadMessageIds()` + `ThreadPrimitive.Unstable_MessageById`:
 *  - `unstable_useThreadMessageIds` devuelve los ids **del store**, con
 *    identidad estable entre actualizaciones de contenido (streaming). Es el
 *    mismo origen de verdad que usa `ThreadPrimitive.Messages` (rama no
 *    virtualizada), de modo que ambas ramas se comportan igual.
 *  - `Unstable_MessageById` resuelve por id y **devuelve `null` en vez de
 *    lanzar** cuando el id todavía no existe en el store. Con `data` tomado
 *    del store, ese caso no puede desmembrar el hilo.
 *
 * ## `itemSize`
 * `itemSize` es solo la **estimación inicial** del alto de un item: virtua
 * mide el alto real de cada item con `ResizeObserver` en cuanto se monta
 * (ver `virtua/lib/core/index.js`). No impone un alto fijo; con
 * `content-visibility: auto` + `contain-intrinsic-size` (ya presentes en cada
 * burbuja) el salto de scroll se mantiene acotado.
 */

export type ChatMessageRole = "user" | "assistant";

/**
 * Configuración de componentes que aceptan `ThreadPrimitive.Messages` y
 * `ThreadPrimitive.Unstable_MessageById`. Réplica explícita del tipo de la
 * librería (`MessagesComponentConfig`), que no está exportado por
 * `@assistant-ui/react`.
 *
 * `UserMessage` y `AssistantMessage` son obligatorios (así en la librería);
 * el resto son opcionales.
 */
export interface ChatMessageComponents {
  Message?: ComponentType;
  EditComposer?: ComponentType;
  UserEditComposer?: ComponentType;
  AssistantEditComposer?: ComponentType;
  SystemEditComposer?: ComponentType;
  UserMessage: ComponentType;
  AssistantMessage: ComponentType;
  SystemMessage?: ComponentType;
}

export interface ChatMessageListProps {
  /** Rol por id de mensaje (derivado del estado local, que va un tick por delante). */
  roleById: ReadonlyMap<string, ChatMessageRole>;
  /** Configuración de componentes que recibe `ThreadPrimitive.*`. */
  components: ChatMessageComponents;
  /** Contenedor con scroll (el `ThreadPrimitive.Viewport`). */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Umbral de mensajes a partir del cual se activa la virtualización. */
  threshold: number;
}

export function shouldVirtualizeChat(
  messageCount: number,
  threshold: number
): boolean {
  return messageCount > threshold;
}

function ChatMessageListInner({
  roleById,
  components,
  viewportRef,
  threshold,
}: ChatMessageListProps) {
  const messageIds = unstable_useThreadMessageIds();

  // `keepMounted` mantiene montado el último item (turno activo / streaming)
  // aunque esté fuera del rango visible: sin esto, el mensaje en curso se
  // desmontaría y el streaming se cortaría.
  const keepMounted = useMemo(
    () => (messageIds.length > 0 ? [messageIds.length - 1] : []),
    [messageIds.length]
  );

  if (!shouldVirtualizeChat(messageIds.length, threshold)) {
    return <ThreadPrimitive.Messages components={components} />;
  }

  return (
    <Virtualizer
      scrollRef={viewportRef}
      data={messageIds}
      keepMounted={keepMounted}
      itemSize={120}
    >
      {(messageId: string) => {
        const role = roleById.get(messageId);
        return (
          <div
            key={messageId}
            data-testid="chat-message-turn"
            data-message-id={messageId}
            data-role={role}
            // `contentVisibility`/`containIntrinsicSize` son propiedades CSS de
            // virtualización: no existen como utilidad Tailwind v4.3.3.
            // design-lint: allow
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: role === "user" ? "auto 96px" : "auto 140px",
            }}
          >
            <ThreadPrimitive.Unstable_MessageById
              messageId={messageId}
              components={components}
            />
          </div>
        );
      }}
    </Virtualizer>
  );
}

export const ChatMessageList = memo(ChatMessageListInner);
