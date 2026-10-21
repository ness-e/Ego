import React from "react";
import type { BoardProps } from "@ego/ui-runtime";
import { Badge } from "../ui-kit/Badge.js";

interface BoardViewProps {
  props: BoardProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({ props, onAction }) => {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      <div className="mb-3 border-b border-hairline pb-3">
        <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {props.columns.map((col) => (
          <div
            key={col.id}
            className="flex min-w-[220px] max-w-[260px] flex-1 flex-col rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5"
          >
            <div className="mb-2 flex items-center justify-between border-b border-hairline pb-2">
              <span className="text-xs font-semibold text-ink">{col.title}</span>
              <Badge tone="dim">{col.cards.length}</Badge>
            </div>

            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
              {col.cards.length === 0 ? (
                <div className="py-6 text-center text-xs text-faint">Columna vacía</div>
              ) : (
                col.cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => onAction?.("card_click", { cardId: card.id, columnId: col.id })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAction?.("card_click", { cardId: card.id, columnId: col.id });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer rounded-md border border-hairline bg-panel p-2.5 shadow-[var(--ego-elevation-l1)] transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <div className="mb-1 flex items-start justify-between gap-1">
                      <h4 className="text-xs font-medium leading-snug text-ink">{card.title}</h4>
                      {card.tag && <Badge tone="info">{card.tag}</Badge>}
                    </div>
                    {card.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-faint">
                        {card.description}
                      </p>
                    )}
                    {card.status && (
                      <span className="mt-2 inline-block font-mono text-xs text-warning">
                        ● {card.status}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
