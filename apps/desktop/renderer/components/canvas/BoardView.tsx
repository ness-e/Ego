import React from "react";
import type { BoardProps } from "@ego/ui-runtime";

interface BoardViewProps {
  props: BoardProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({ props, onAction }) => {
  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      <div className="pb-3 border-b border-hairline mb-3">
        <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {props.columns.map((col) => (
          <div
            key={col.id}
            className="flex flex-col min-w-[220px] max-w-[260px] flex-1 rounded-lg bg-raised/40 border border-hairline p-2.5"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-hairline/60">
              <span className="font-semibold text-xs text-ink">{col.title}</span>
              <span className="rounded-full bg-hairline px-1.5 py-0.2 text-[10px] font-mono text-dim">
                {col.cards.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px]">
              {col.cards.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-faint">Columna vacía</div>
              ) : (
                col.cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => onAction?.("card_click", { cardId: card.id, columnId: col.id })}
                    className="rounded-md border border-hairline bg-panel p-2.5 shadow-2xs hover:border-ink/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h4 className="text-xs font-medium text-ink leading-snug">{card.title}</h4>
                      {card.tag && (
                        <span className="shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono uppercase bg-raised text-dim border border-hairline">
                          {card.tag}
                        </span>
                      )}
                    </div>
                    {card.description && (
                      <p className="text-[11px] text-faint line-clamp-2 leading-relaxed">
                        {card.description}
                      </p>
                    )}
                    {card.status && (
                      <span className="mt-2 inline-block text-[10px] text-amber-400 font-mono">
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
