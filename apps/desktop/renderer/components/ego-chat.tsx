"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";
import { Warning, X, ArrowClockwise } from "@phosphor-icons/react";
import { ego, RecallBadgeInfo } from "../lib/ego";

function Text({ text }: { text: string }) {
  return <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>;
}

function UserMessage() {
  return (
    <MessagePrimitive.Root style={{ display: "flex", justifyContent: "flex-end", margin: "8px 0" }}>
      <div style={{ background: "#26262b", color: "#f4f4f5", borderRadius: 8, padding: "8px 14px", maxWidth: "80%" }}>
        <MessagePrimitive.Content components={{ Text }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root style={{ display: "flex", margin: "8px 0", flexDirection: "column", gap: 4 }}>
      <div style={{ background: "#111113", border: "1px solid #26262b", borderRadius: 8, padding: "10px 14px", maxWidth: "85%", color: "#f4f4f5" }}>
        <MessagePrimitive.Content components={{ Text }} />
      </div>
    </MessagePrimitive.Root>
  );
}

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: [{ type: "text"; text: string }];
  recall?: RecallBadgeInfo;
  isError?: boolean;
};

interface ActiveChatError {
  message: string;
  prompt: string;
  timestamp: number;
}

let n = 0;
const nid = () => `m${++n}`;

export function EgoChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [latestRecall, setLatestRecall] = useState<RecallBadgeInfo | null>(null);
  const [activeError, setActiveError] = useState<ActiveChatError | null>(null);
  const currentPromptRef = useRef<string>("");

  // Subscripción reactiva a eventos de error de IPC emitidos desde el main process
  useEffect(() => {
    const unsub = ego().onChatError?.((err) => {
      setActiveError({
        message: err.error,
        prompt: currentPromptRef.current || "",
        timestamp: err.timestamp || Date.now(),
      });
    });
    return () => {
      unsub?.();
    };
  }, []);

  const executeTurn = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;
    currentPromptRef.current = promptText;
    setActiveError(null);

    const [u, a] = [nid(), nid()];
    setMessages((prev) => [
      ...prev,
      { id: u, role: "user", content: [{ type: "text", text: promptText }] },
      { id: a, role: "assistant", content: [{ type: "text", text: "Procesando intención y consultando VantaDB…" }] },
    ]);

    try {
      const streamRes = await ego().llmStream({ prompt: promptText });
      if (streamRes.recallStatus) {
        setLatestRecall(streamRes.recallStatus);
      }

      const badgePrefix = streamRes.recallStatus?.count
        ? `${streamRes.recallStatus.glyph} [VantaDB: ${streamRes.recallStatus.count} recuerdos recuperados]\n\n`
        : "";

      const finalReply = badgePrefix + streamRes.text;

      setMessages((prev) =>
        prev.map((x) =>
          x.id === a
            ? {
                ...x,
                content: [{ type: "text", text: finalReply }],
                recall: streamRes.recallStatus,
              }
            : x
        )
      );
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : String(err);
      setActiveError({
        message: errorStr,
        prompt: promptText,
        timestamp: Date.now(),
      });

      setMessages((prev) =>
        prev.map((x) =>
          x.id === a
            ? {
                ...x,
                isError: true,
                content: [{ type: "text", text: `⚠️ Error en ejecución de turno: ${errorStr}` }],
              }
            : x
        )
      );
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (!activeError?.prompt) return;
    const promptToRetry = activeError.prompt;
    executeTurn(promptToRetry);
  }, [activeError, executeTurn]);

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages: (msgs) => setMessages([...msgs]),
    convertMessage: (m) => m,
    onNew: async (m) => {
      const text = m.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      await executeTurn(text);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Banner de Memoria Viva (Hermes RecallStatus + VantaDB) */}
        {latestRecall && latestRecall.count > 0 && (
          <div className="flex items-center gap-2 border-b border-hairline bg-raised/40 px-3 py-1 text-[11px] text-faint">
            <span>{latestRecall.glyph}</span>
            <span>Memoria Activa: {latestRecall.count} fragmentos de {latestRecall.sources.join(", ")}</span>
            <span className="ml-auto font-mono text-[10px] text-dim">~{latestRecall.tokensEstimate} tokens</span>
          </div>
        )}

        <ThreadPrimitive.Viewport style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          <ThreadPrimitive.Empty>
            <div style={{ padding: 40, textAlign: "center", color: "#8e8e93" }}>
              <p style={{ marginBottom: 6, color: "#f4f4f5", fontWeight: 600 }}>Cerebro Operativo de Ego</p>
              <p style={{ fontSize: 13, fontFamily: "monospace", color: "#a1a1aa" }}>
                Haz una pregunta o asigna una tarea a tus Sub-Egos.
              </p>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>

        {/* Tarjeta interactiva de Error de Turno con Reintento (CORE-14) */}
        {activeError && (
          <div className="flex items-center justify-between border-t border-rose-500/30 bg-rose-950/40 px-3.5 py-2 text-xs text-rose-200">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Warning size={15} className="text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-rose-300">Fallo en turno: </span>
                <span className="text-rose-100/90">{activeError.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1 rounded bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
              >
                <ArrowClockwise size={12} weight="bold" />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveError(null)}
                aria-label="Cerrar advertencia"
                className="p-1 text-rose-400 hover:text-rose-200 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <ComposerPrimitive.Root
          style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid #26262b" }}
        >
          <ComposerPrimitive.Input
            autoFocus
            placeholder="Pregunta o instruye a Ego…"
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#111113",
              border: "1px solid #26262b",
              borderRadius: 8,
              color: "#f4f4f5",
              fontSize: 14,
            }}
          />
          <ComposerPrimitive.Send
            style={{
              padding: "10px 18px",
              background: "#f4f4f5",
              color: "#0a0a0b",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Enviar
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
