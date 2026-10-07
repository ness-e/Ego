"use client";
import { useState } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";
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
};

let n = 0;
const nid = () => `m${++n}`;

export function EgoChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [latestRecall, setLatestRecall] = useState<RecallBadgeInfo | null>(null);

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages: (msgs) => setMessages([...msgs]),
    convertMessage: (m) => m,
    onNew: async (m) => {
      const text = m.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      const [u, a] = [nid(), nid()];

      setMessages((prev) => [
        ...prev,
        { id: u, role: "user", content: [{ type: "text", text }] },
        { id: a, role: "assistant", content: [{ type: "text", text: "Procesando intención y consultando VantaDB…" }] },
      ]);

      try {
        const streamRes = await ego().llmStream({ prompt: text });
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
        setMessages((prev) =>
          prev.map((x) =>
            x.id === a
              ? {
                  ...x,
                  content: [{ type: "text", text: `Error de ejecución cognitiva: ${String(err)}` }],
                }
              : x
          )
        );
      }
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
