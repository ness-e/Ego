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

  const { lineCount, estimatedSeconds } = useMemo(() => {
    if (!combinedText) return { lineCount: 0, estimatedSeconds: 0 };
    const lines = combinedText.split("\n").length;
    const chars = combinedText.length;
    // Estimación realista de tiempo de procesamiento cognitivo (~60 car/seg o mín 1s)
    const seconds = Math.max(1, Math.round(chars / 65));
    return { lineCount: lines, estimatedSeconds: seconds };
  }, [combinedText]);

  if (!combinedText) return null;

  return (
    <div className="my-2 rounded-2xl border border-white/10 bg-[#161822]/70 overflow-hidden text-xs transition-colors hover:border-white/20 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-3.5 py-2 text-faint hover:text-ink cursor-pointer transition-colors select-none group"
      >
        <div className="flex items-center gap-2 font-medium">
          <Sparkle size={13} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="text-ink font-medium text-[11.5px]">Razonamiento del Sub-Ego</span>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9.5px] text-faint font-mono">
            {estimatedSeconds}s · {lineCount} {lineCount === 1 ? "línea" : "líneas"}
          </span>
        </div>
        <CaretRight
          size={12}
          className={`text-dim transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-ink/80 font-mono whitespace-pre-wrap leading-relaxed bg-[#11121a]/80 max-h-80 overflow-y-auto">
          {combinedText}
        </div>
      )}
    </div>
  );
};
