import React, { useState } from "react";
import type { DiffProps } from "@ego/ui-runtime";
import { GitDiff, CheckCircle, SplitHorizontal, Rows } from "@phosphor-icons/react";

export interface DiffReviewCardProps {
  props: DiffProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const DiffReviewCard: React.FC<DiffReviewCardProps> = ({ props, onAction }) => {
  const [viewMode, setViewMode] = useState<"split" | "unified">(props.viewMode || "split");
  const [isApproved, setIsApproved] = useState(false);

  const handleApprove = () => {
    setIsApproved(true);
    onAction?.("diff.approve", { filePath: props.filePath });
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      {/* Cabecera del Diff */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline mb-3">
        <div className="flex items-center gap-2">
          <GitDiff size={16} className="text-cyan-400" />
          <h3 className="font-semibold text-sm text-ink">{props.title || "Revisión de Cambios"}</h3>
          <span className="font-mono text-[11px] text-dim bg-raised px-2 py-0.5 rounded border border-hairline">
            {props.filePath}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Contador de cambios */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {props.additionsCount !== undefined && (
              <span className="text-emerald-400 font-semibold">+{props.additionsCount}</span>
            )}
            {props.deletionsCount !== undefined && (
              <span className="text-rose-400 font-semibold">-{props.deletionsCount}</span>
            )}
          </div>

          {/* Toggle Split / Unified */}
          <div className="flex items-center bg-raised rounded p-0.5 border border-hairline text-xs">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`p-1 rounded transition-colors ${
                viewMode === "split" ? "bg-panel text-ink shadow-xs" : "text-dim hover:text-ink"
              }`}
              title="Vista Dividida"
            >
              <SplitHorizontal size={13} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("unified")}
              className={`p-1 rounded transition-colors ${
                viewMode === "unified" ? "bg-panel text-ink shadow-xs" : "text-dim hover:text-ink"
              }`}
              title="Vista Unificada"
            >
              <Rows size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido del Diff */}
      {viewMode === "split" ? (
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="rounded-lg bg-rose-950/20 border border-rose-500/20 p-3 overflow-x-auto">
            <span className="text-[10px] text-rose-400 font-semibold block mb-1 uppercase tracking-wider">
              Original
            </span>
            <pre className="text-rose-200 whitespace-pre-wrap leading-relaxed">
              {props.originalContent}
            </pre>
          </div>
          <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-3 overflow-x-auto">
            <span className="text-[10px] text-emerald-400 font-semibold block mb-1 uppercase tracking-wider">
              Modificado
            </span>
            <pre className="text-emerald-200 whitespace-pre-wrap leading-relaxed">
              {props.modifiedContent}
            </pre>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-paper border border-hairline p-3 font-mono text-xs overflow-x-auto leading-relaxed">
          <div className="text-rose-300 bg-rose-950/30 px-2 py-0.5 rounded mb-1">
            <span className="select-none text-rose-500 font-bold mr-2">-</span>
            {props.originalContent}
          </div>
          <div className="text-emerald-300 bg-emerald-950/30 px-2 py-0.5 rounded">
            <span className="select-none text-emerald-500 font-bold mr-2">+</span>
            {props.modifiedContent}
          </div>
        </div>
      )}

      {/* Pie de acción */}
      <div className="flex items-center justify-between pt-3 border-t border-hairline mt-3 text-xs">
        <span className="text-dim text-[11px]">Revisión solicitada antes de aplicar commit semántico</span>
        <button
          type="button"
          onClick={handleApprove}
          disabled={isApproved}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition-colors ${
            isApproved
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default"
              : "bg-ink text-paper hover:opacity-90"
          }`}
        >
          <CheckCircle size={14} weight="bold" />
          <span>{isApproved ? "Diff Aprobado" : "Aprobar Cambios"}</span>
        </button>
      </div>
    </div>
  );
};
