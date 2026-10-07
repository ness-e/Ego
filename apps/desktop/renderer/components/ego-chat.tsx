"use client";
import { useState } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";
import { ego } from "../lib/ego";

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
    <MessagePrimitive.Root style={{ display: "flex", margin: "8px 0" }}>
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
};

let n = 0;
const nid = () => `m${++n}`;

export function EgoChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
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
        { id: a, role: "assistant", content: [{ type: "text", text: "Consultando memoria VantaDB…" }] },
      ]);

      let reply = "No se encontraron registros previos en memoria para esta consulta.";
      try {
        const r: unknown = await ego().memory("recall", [text, "kb/docs"]);
        if (r) {
          if (typeof r === "object" && r.titulo) {
            reply = `📖 **${r.titulo}**\n\n${r.contenido}\n\n*Estado: ${r.estado} · Fuente: VantaDB kb/docs*`;
          } else if (Array.isArray(r) && r.length > 0) {
            const first = r[0];
            const p = typeof first.record?.payload === "string" ? JSON.parse(first.record.payload) : first.record?.payload;
            reply = `📖 **${p.titulo || "Documento Encontrado"}**\n\n${p.contenido || JSON.stringify(p)}\n\n*Confianza: ${(first.score * 100).toFixed(1)}% · VantaDB BM25/HNSW*`;
          } else {
            reply = typeof r === "string" ? r : JSON.stringify(r, null, 2);
          }
        }
      } catch (err) {
        reply = `Error consultando VantaDB: ${String(err)}`;
      }

      setMessages((prev) =>
        prev.map((x) =>
          x.id === a ? { ...x, content: [{ type: "text", text: reply }] } : x
        )
      );
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <ThreadPrimitive.Viewport style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          <ThreadPrimitive.Empty>
            <div style={{ padding: 40, textAlign: "center", color: "#8e8e93" }}>
              <p style={{ marginBottom: 6, color: "#f4f4f5", fontWeight: 600 }}>Cerebro Operativo de Ego</p>
              <p style={{ fontSize: 13, fontFamily: "monospace", color: "#a1a1aa" }}>
                Prueba preguntar: "¿qué decidimos sobre el límite de tarifa?"
              </p>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>

        <ComposerPrimitive.Root
          style={{ display: "flex", gap: 8, padding: "12px 0 0", borderTop: "1px solid #26262b" }}
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
