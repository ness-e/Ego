import React, { useState } from "react";
import type { DiffProps } from "@ego/ui-runtime";
import { GitDiff, CheckCircle, SplitHorizontal, Rows } from "@phosphor-icons/react";
import { Button } from "../../ui-kit/Button.js";

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
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Cabecera del Diff */}
      <div className="mb-3 flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <GitDiff size={16} className="text-brand" />
          <h3 className="text-sm font-semibold text-ink">{props.title || "Revisión de Cambios"}</h3>
          <span className="rounded-md border border-hairline bg-raised px-2 py-0.5 font-mono text-xs text-dim">
            {props.filePath}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Contador de cambios */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {props.additionsCount !== undefined && (
              <span className="font-semibold text-success">+{props.additionsCount}</span>
            )}
            {props.deletionsCount !== undefined && (
              <span className="font-semibold text-error">-{props.deletionsCount}</span>
            )}
          </div>

          {/* Toggle Split / Unified */}
          <div className="flex items-center gap-1 rounded-[var(--radius-card)] border border-hairline bg-raised p-0.5 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={viewMode === "split"}
              aria-label="Vista dividida"
              onClick={() => setViewMode("split")}
              className={viewMode === "split" ? "bg-panel text-ink" : "text-dim hover:text-ink"}
              title="Vista Dividida"
            >
              <SplitHorizontal size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={viewMode === "unified"}
              aria-label="Vista unificada"
              onClick={() => setViewMode("unified")}
              className={viewMode === "unified" ? "bg-panel text-ink" : "text-dim hover:text-ink"}
              title="Vista Unificada"
            >
              <Rows size={13} />
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido del Diff */}
      {viewMode === "split" ? (
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-error/30 bg-error/10 p-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-error">
              Original
            </span>
            <pre className="whitespace-pre-wrap leading-relaxed text-error">
              {props.originalContent}
            </pre>
          </div>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-success/30 bg-success/10 p-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-success">
              Modificado
            </span>
            <pre className="whitespace-pre-wrap leading-relaxed text-success">
              {props.modifiedContent}
            </pre>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-paper p-3 font-mono text-xs leading-relaxed">
          <div className="mb-1 rounded-md bg-error/10 px-2 py-0.5 text-error">
            <span className="mr-2 select-none font-bold text-error">-</span>
            {props.originalContent}
          </div>
          <div className="rounded-md bg-success/10 px-2 py-0.5 text-success">
            <span className="mr-2 select-none font-bold text-success">+</span>
            {props.modifiedContent}
          </div>
        </div>
      )}

      {/* Pie de acción */}
      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs">
        <span className="text-xs text-faint">Revisión solicitada antes de aplicar commit semántico</span>
        <Button
          type="button"
          variant={isApproved ? "secondary" : "primary"}
          size="sm"
          onClick={handleApprove}
          disabled={isApproved}
          className={isApproved ? "border-success text-success" : undefined}
        >
          <CheckCircle size={14} weight="bold" />
          <span>{isApproved ? "Diff Aprobado" : "Aprobar Cambios"}</span>
        </Button>
      </div>
    </div>
  );
};
