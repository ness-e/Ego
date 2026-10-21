import React, { useState } from "react";
import type { RelationViewProps, RelationNode } from "@ego/ui-runtime";
import { GitFork, Circle, ChatCircleDots } from "@phosphor-icons/react";
import { useSelectionContext } from "../../../hooks/useSelectionContext.js";
import { Badge } from "../../ui-kit/Badge.js";
import { Button } from "../../ui-kit/Button.js";

interface RelationViewComponentProps {
  props: RelationViewProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

/**
 * Paleta por tipo de nodo. Cada color sale de un TOKEN del sistema
 * (`--color-*`), nunca de un hex suelto: así el grafo se tematiza con el
 * preset activo (design-system.md §1).
 */
interface NodePalette {
  bg: string;
  border: string;
  text: string;
  fill: string;
  tone: "ok" | "warn" | "info" | "dim";
}

const NODE_PALETTE: Record<RelationNode["type"], NodePalette> = {
  fact: {
    bg: "bg-chart-indigo/10",
    border: "border-chart-indigo/30",
    text: "text-chart-indigo",
    fill: "var(--color-chart-indigo, #818cf8)",
    tone: "info",
  },
  document: {
    bg: "bg-success/10",
    border: "border-success/30",
    text: "text-success",
    fill: "var(--color-success, #10b981)",
    tone: "ok",
  },
  decision: {
    bg: "bg-warning/10",
    border: "border-warning/30",
    text: "text-warning",
    fill: "var(--color-warning, #f59e0b)",
    tone: "warn",
  },
  entity: {
    bg: "bg-chart-violet/10",
    border: "border-chart-violet/30",
    text: "text-chart-violet",
    fill: "var(--color-chart-violet, #a78bfa)",
    tone: "dim",
  },
};

export const RelationView: React.FC<RelationViewComponentProps> = ({ props }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(props.rootNodeId);
  const { sendSelectionToChat } = useSelectionContext();

  const selectedNode = props.nodes.find((n) => n.id === selectedNodeId) || props.nodes[0];

  const nodeColor = (type: RelationNode["type"]): NodePalette =>
    NODE_PALETTE[type] ?? NODE_PALETTE.entity;

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
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-2 text-brand">
            <GitFork size={18} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
              <Badge tone="info">
                {props.nodes.length} nodos / {props.edges.length} aristas
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-faint">Topología causal y linaje de conocimiento</p>
          </div>
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={handleAskAboutGraph}>
          <ChatCircleDots size={14} weight="bold" className="text-brand" />
          <span>Consultar Nodo</span>
        </Button>
      </div>

      {/* Visualización y panel de detalle en 2 columnas */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Grafo visual SVG */}
        <div className="flex min-h-[220px] flex-col justify-between rounded-[var(--radius-card)] border border-hairline bg-raised p-3 md:col-span-2">
          <div className="mb-2 flex flex-wrap gap-2">
            {props.nodes.map((node) => {
              const colors = nodeColor(node.type);
              const isSelected = node.id === selectedNodeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`flex items-center gap-1.5 rounded-[var(--radius-card)] border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    isSelected
                      ? `${colors.bg} ${colors.border} ${colors.text} font-semibold ring-1 ring-hairline`
                      : "border-hairline bg-panel text-dim hover:border-strong hover:text-ink"
                  }`}
                >
                  <Circle size={8} weight="fill" color={colors.fill} />
                  <span className="max-w-[130px] truncate">{node.label}</span>
                </button>
              );
            })}
          </div>

          {/* Lista de conexiones del nodo activo */}
          <div className="mt-2 border-t border-hairline pt-2">
            <span className="font-mono text-xs uppercase tracking-wider text-dim">
              Aristas conectadas:
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {props.edges
                .filter((e) => e.from === selectedNodeId || e.to === selectedNodeId)
                .map((edge, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-hairline bg-panel px-2 py-0.5 font-mono text-xs text-ink"
                  >
                    {edge.from === selectedNodeId ? (
                      <>
                        <span className="text-brand">--({edge.relation})--&gt;</span> {edge.to}
                      </>
                    ) : (
                      <>
                        {edge.from} <span className="text-brand">--({edge.relation})--&gt;</span>
                      </>
                    )}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* Panel lateral de detalle del nodo inspeccionado */}
        {selectedNode && (
          <div className="flex flex-col justify-between rounded-[var(--radius-card)] border border-hairline bg-raised p-3 text-xs">
            <div>
              <div className="mb-2 flex items-center justify-between border-b border-hairline pb-1.5">
                <span className="truncate font-semibold text-ink">{selectedNode.label}</span>
                <Badge tone={nodeColor(selectedNode.type).tone}>{selectedNode.type}</Badge>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-xs uppercase text-dim">ID:</span>
                  <p className="break-all font-mono text-xs text-ink">{selectedNode.id}</p>
                </div>

                {selectedNode.content && (
                  <div>
                    <span className="text-xs uppercase text-dim">Contenido:</span>
                    <p className="line-clamp-4 font-sans text-xs leading-relaxed text-ink">
                      {selectedNode.content}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 border-t border-hairline pt-2 font-mono text-xs text-dim">
              Peso relativo: {selectedNode.weight.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
