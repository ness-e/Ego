import React from "react";
import { useSelectionContext } from "../../hooks/useSelectionContext.js";
import { ChatCircleDots, Copy, X } from "@phosphor-icons/react";

export const SelectionToolbar: React.FC = () => {
  const { selection, sendSelectionToChat, clearSelection } = useSelectionContext();

  if (!selection || !selection.rect) {
    return null;
  }

  // Posicionar la barra justo arriba del cuadro de selección
  const top = Math.max(10, selection.rect.top - 42);
  const left = Math.max(10, selection.rect.left + selection.rect.width / 2 - 120);

  const handleCopy = () => {
    navigator.clipboard?.writeText(selection.text);
    clearSelection();
  };

  return (
    <div
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 flex items-center gap-1 bg-ink text-paper px-2 py-1 rounded-lg shadow-xl border border-hairline text-xs animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <button
        type="button"
        onClick={() => sendSelectionToChat()}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-raised transition-colors font-medium text-[11px]"
      >
        <ChatCircleDots size={14} className="text-cyan-300" weight="bold" />
        <span>Preguntar a Sub-Ego</span>
      </button>

      <div className="h-3 w-[1px] bg-hairline" />

      <button
        type="button"
        onClick={handleCopy}
        title="Copiar selección"
        className="p-1 rounded hover:bg-raised text-ink hover:text-ink transition-colors"
      >
        <Copy size={13} />
      </button>

      <button
        type="button"
        onClick={clearSelection}
        title="Cerrar"
        className="p-1 rounded hover:bg-raised text-faint hover:text-ink transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
};
