import React, { useState } from "react";
import type { RecordViewProps } from "@ego/ui-runtime";
import { Database, ClockCounterClockwise, ChatCircleDots } from "@phosphor-icons/react";
import { useSelectionContext } from "../../../hooks/useSelectionContext.js";

interface RecordViewComponentProps {
  props: RecordViewProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const RecordView: React.FC<RecordViewComponentProps> = ({ props }) => {
  const [activeTab, setActiveTab] = useState<"content" | "chunks" | "metadata" | "lineage">("content");
  const { sendSelectionToChat } = useSelectionContext();

  const stateBadge = {
    active: { label: "Activo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    quarantined: { label: "En Cuarentena", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    superseded: { label: "Sustituido (Histórico)", color: "bg-raised text-faint border-hairline" },
  }[props.state || "active"];

  const handleAskSubEgo = () => {
    const summary = `Sobre el registro [${props.recordKey}] (${props.namespace}):\n${props.payload}`;
    sendSelectionToChat(summary);
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-raised border border-hairline text-cyan-400">
            <Database size={18} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${stateBadge.color}`}>
                {stateBadge.label}
              </span>
              {typeof props.confidence === "number" && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-raised text-dim border border-hairline">
                  {(props.confidence * 100).toFixed(0)}% confianza
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-dim mt-0.5">
              {props.namespace} / <span className="text-ink">{props.recordKey}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAskSubEgo}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-raised hover:bg-panel text-cyan-300 border border-cyan-500/30 transition-colors"
          >
            <ChatCircleDots size={14} weight="bold" />
            <span>Consultar</span>
          </button>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="flex items-center gap-2 border-b border-hairline mb-3 pb-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={`px-2 py-1 rounded transition-colors ${
            activeTab === "content" ? "text-cyan-400 bg-cyan-500/10" : "text-dim hover:text-ink"
          }`}
        >
          Contenido Principal
        </button>
        {props.chunks && props.chunks.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("chunks")}
            className={`px-2 py-1 rounded transition-colors ${
              activeTab === "chunks" ? "text-cyan-400 bg-cyan-500/10" : "text-dim hover:text-ink"
            }`}
          >
            Fragmentos ({props.chunks.length})
          </button>
        )}
        {props.metadata && Object.keys(props.metadata).length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("metadata")}
            className={`px-2 py-1 rounded transition-colors ${
              activeTab === "metadata" ? "text-cyan-400 bg-cyan-500/10" : "text-dim hover:text-ink"
            }`}
          >
            Metadatos
          </button>
        )}
        {props.lineage && props.lineage.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("lineage")}
            className={`px-2 py-1 rounded transition-colors ${
              activeTab === "lineage" ? "text-cyan-400 bg-cyan-500/10" : "text-dim hover:text-ink"
            }`}
          >
            Linaje Causal
          </button>
        )}
      </div>

      {/* Contenido de la pestaña activa */}
      {activeTab === "content" && (
        <div className="rounded-lg bg-raised/40 p-3 border border-hairline text-xs text-ink/90 whitespace-pre-wrap leading-relaxed font-sans font-normal">
          {props.payload}
        </div>
      )}

      {activeTab === "chunks" && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {props.chunks.map((chunk) => (
            <div key={chunk.id} className="rounded-lg bg-raised/50 p-2.5 border border-hairline text-xs">
              <div className="flex items-center justify-between text-[10px] text-dim font-mono mb-1">
                <span>
                  Chunk #{chunk.index} {chunk.tokenCount ? `(${chunk.tokenCount} tokens)` : ""}
                </span>
                {chunk.headingPath && chunk.headingPath.length > 0 && (
                  <span className="text-cyan-400 truncate max-w-[200px]">
                    {chunk.headingPath.join(" > ")}
                  </span>
                )}
              </div>
              <p className="text-ink/85 whitespace-pre-wrap font-sans">{chunk.content}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "metadata" && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-raised/50 p-3 border border-hairline text-xs font-mono">
          {Object.entries(props.metadata || {}).map(([key, value]) => (
            <div key={key} className="flex flex-col truncate">
              <span className="text-[10px] text-dim uppercase">{key}</span>
              <span className="font-medium text-ink truncate">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "lineage" && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {props.lineage.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-raised border border-hairline text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <ClockCounterClockwise size={13} className="text-cyan-400" />
                <span className="text-dim uppercase text-[10px]">{item.relation}</span>
                <span className="text-ink font-semibold">{item.targetKey}</span>
              </div>
              {item.timestamp && (
                <span className="text-[10px] text-faint">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
