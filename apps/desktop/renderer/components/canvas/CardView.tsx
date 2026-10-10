import React from "react";
import type { CardProps } from "@ego/ui-runtime";

interface CardViewProps {
  props: CardProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const CardView: React.FC<CardViewProps> = ({ props, onAction }) => {
  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
            {props.badge && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase bg-raised text-dim border border-hairline">
                {props.badge}
              </span>
            )}
            {props.status && (
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.2 text-[10px] font-medium border border-emerald-500/30">
                {props.status}
              </span>
            )}
          </div>
          {props.subtitle && <p className="text-xs text-dim mt-0.5">{props.subtitle}</p>}
        </div>
      </div>

      {/* Description */}
      {props.description && (
        <p className="text-xs text-faint mb-3 leading-relaxed">{props.description}</p>
      )}

      {/* Content: Fields */}
      {props.content?.fields && (
        <div className="grid grid-cols-2 gap-2 my-3 rounded-lg bg-raised/50 p-2.5 border border-hairline text-xs font-mono">
          {Object.entries(props.content.fields).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <span className="text-[10px] text-dim uppercase tracking-wider">{key}</span>
              <span className="font-semibold text-ink truncate">
                {value !== null && value !== undefined ? String(value) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Content: Markdown text */}
      {props.content?.markdown && (
        <div className="my-2 text-xs text-ink/90 whitespace-pre-wrap font-sans leading-relaxed">
          {props.content.markdown}
        </div>
      )}

      {/* Actions */}
      {props.actions && props.actions.length > 0 && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline mt-3">
          {props.actions.map((act) => (
            <button
              key={act.actionId}
              type="button"
              onClick={() => onAction?.(act.actionId, act.payload || { cardId: props.id })}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                act.variant === "primary"
                  ? "bg-ink text-paper hover:opacity-90"
                  : act.variant === "danger"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                  : "bg-raised text-ink hover:bg-hairline border border-hairline"
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
