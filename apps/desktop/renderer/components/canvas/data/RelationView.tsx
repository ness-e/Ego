import React, { useState } from "react";
import type { RelationViewProps, RelationNode } from "@ego/ui-runtime";
import { GitFork, Circle, ChatCircleDots } from "@phosphor-icons/react";
import { useSelectionContext } from "../../../hooks/useSelectionContext.js";

interface RelationViewComponentProps {
  props: RelationViewProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const RelationView: React.FC<RelationViewComponentProps> = ({ props }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(props.rootNodeId);
  const { sendSelectionToChat } = useSelectionContext();

  const selectedNode = props.nodes.find((n) => n.id === selectedNodeId) || props.nodes[0];

  const nodeColor = (type: RelationNode["type"]) => {
    switch (type) {
      case "fact":
        return { bg: "bg-cyan-500/20", border: "border-cyan-500/50", text: "text-cyan-400", fill: "#38bdf8" };
      case "document":
        return { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-400", fill: "#34d399" };
      case "decision":
        return { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-400", fill: "#fbbf24" };
      default:
        return { bg: "bg-purple-500/20", border: "border-purple-500/50", text: "text-purple-400", fill: "#c084fc" };
    }
  };

  const handleAskAboutGraph = () => {
    if (!selectedNode) return;
    const relatedEdges = props.edges.filter(
      (e) => e.from === selectedNode.id || e.to === selectedNode.id
    );
    const summary = `Sobre el nodo [${selectedNode.label}] (${selectedNode.type}):\n${selectedNode.content || "Sin contenido adicional"}\nRelaciones:\n${relatedEdges
      .map((e) => `- ${e.from} --(${e.relation})--> ${e.to}`)
      .join("\n")}`;
    sendSelectionToChat(summary);
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-raised border border-hairline text-purple-400">
            <GitFork size={18} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
              <span className="rounded-full bg-purple-500/15 text-purple-400 px-2 py-0.5 text-[10px] font-mono border border-purple-500/30">
                {props.nodes.length} nodos / {props.edges.length} aristas
              </span>
            </div>
            <p className="text-xs text-dim mt-0.5">Topología causal y linaje de conocimiento</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAskAboutGraph}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-raised hover:bg-zinc-800 text-purple-300 border border-purple-500/30 transition-colors"
        >
          <ChatCircleDots size={14} weight="bold" />
          <span>Consultar Nodo</span>
        </button>
      </div>

      {/* Visualización y panel de detalle en 2 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Grafo visual SVG */}
        <div className="md:col-span-2 rounded-lg bg-raised/30 border border-hairline p-3 flex flex-col justify-between min-h-[220px]">
          <div className="flex flex-wrap gap-2 mb-2">
            {props.nodes.map((node) => {
              const colors = nodeColor(node.type);
              const isSelected = node.id === selectedNodeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? `${colors.bg} ${colors.border} ${colors.text} font-semibold ring-1 ring-white/20`
                      : "bg-raised/70 border-hairline text-dim hover:text-ink hover:bg-raised"
                  }`}
                >
                  <Circle size={8} weight="fill" color={colors.fill} />
                  <span className="truncate max-w-[130px]">{node.label}</span>
                </button>
              );
            })}
          </div>

          {/* Lista de conexiones del nodo activo */}
          <div className="mt-2 pt-2 border-t border-hairline">
            <span className="text-[10px] uppercase text-dim tracking-wider font-mono">
              Aristas conectadas:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {props.edges
                .filter((e) => e.from === selectedNodeId || e.to === selectedNodeId)
                .map((edge, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-zinc-800/80 border border-hairline text-[10px] font-mono text-zinc-300"
                  >
                    {edge.from === selectedNodeId ? (
                      <>
                        <span className="text-cyan-400">--({edge.relation})--&gt;</span> {edge.to}
                      </>
                    ) : (
                      <>
                        {edge.from} <span className="text-cyan-400">--({edge.relation})--&gt;</span>
                      </>
                    )}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* Panel lateral de detalle del nodo inspeccionado */}
        {selectedNode && (
          <div className="rounded-lg bg-raised/50 border border-hairline p-3 flex flex-col justify-between text-xs">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-hairline">
                <span className="font-semibold text-ink truncate">{selectedNode.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono border ${
                    nodeColor(selectedNode.type).bg
                  } ${nodeColor(selectedNode.type).border} ${nodeColor(selectedNode.type).text}`}
                >
                  {selectedNode.type}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-dim uppercase">ID:</span>
                  <p className="font-mono text-[11px] text-ink break-all">{selectedNode.id}</p>
                </div>

                {selectedNode.content && (
                  <div>
                    <span className="text-[10px] text-dim uppercase">Contenido:</span>
                    <p className="text-ink/80 text-xs leading-relaxed font-sans line-clamp-4">
                      {selectedNode.content}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-hairline text-[10px] text-dim font-mono">
              Peso relativo: {selectedNode.weight.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
