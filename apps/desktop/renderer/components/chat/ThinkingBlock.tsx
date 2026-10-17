import React, { useState, useMemo } from "react";
import { Sparkle, CaretRight } from "@phosphor-icons/react";

export interface ThinkingBlockProps {
  thoughts: string[];
  initialOpen?: boolean;
}

/**
 * ThinkingBlock — Acordeón elegante para bloques de razonamiento (<thinking>).
 * Permite al usuario inspeccionar el proceso cognitivo del Sub-Ego de forma colapsable.
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thoughts,
  initialOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const combinedText = useMemo(() => thoughts.join("\n\n").trim(), [thoughts]);

  const { lineCount, charCount } = useMemo(() => {
    if (!combinedText) return { lineCount: 0, charCount: 0 };
    const lines = combinedText.split("\n").length;
    const chars = combinedText.length;
    return { lineCount: lines, charCount: chars };
  }, [combinedText]);

  if (!combinedText) return null;

  return (
    <div className="my-2.5 rounded-xl border border-hairline bg-raised/40 overflow-hidden text-xs transition-colors hover:border-dim/50">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-3 py-2 text-faint hover:text-ink cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-2 font-medium">
          <Sparkle size={14} className="text-amber-400 shrink-0" />
          <span className="text-ink font-medium">Razonamiento del Sub-Ego</span>
          <span className="rounded-full bg-panel/80 px-2 py-0.5 text-[10px] text-faint font-mono">
            {lineCount} {lineCount === 1 ? "línea" : "líneas"} · {charCount} car.
          </span>
        </div>
        <CaretRight
          size={12}
          className={`text-dim transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-hairline px-3.5 py-3 text-[11px] text-faint font-mono whitespace-pre-wrap leading-relaxed bg-panel/60 max-h-80 overflow-y-auto">
          {combinedText}
        </div>
      )}
    </div>
  );
};
