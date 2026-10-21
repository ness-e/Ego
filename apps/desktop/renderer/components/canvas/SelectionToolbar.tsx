import React from "react";
import { useSelectionContext } from "../../hooks/useSelectionContext.js";
import { ChatCircleDots, Copy, X } from "@phosphor-icons/react";
import { Button } from "../ui-kit/Button.js";

export const SelectionToolbar: React.FC = () => {
  const { selection, sendSelectionToChat, clearSelection } = useSelectionContext();

  if (!selection || !selection.rect) {
    return null;
  }

  // Posicionar la barra justo arriba del cuadro de selección.
  // El desplazamiento (56 px) deja libre la barra: mide 44 px (botón
  // sólo-icono) + el padding del contenedor.
  const top = Math.max(10, selection.rect.top - 56);
  const left = Math.max(10, selection.rect.left + selection.rect.width / 2 - 120);

  const handleCopy = () => {
    navigator.clipboard?.writeText(selection.text);
    clearSelection();
  };

  return (
    <div
      // Excepción estructural EGO-DL-004 (lista blanca de `design-lint.cjs`,
      // regla R2): el punto de anclaje depende del rectángulo de la selección
      // medido en runtime; Tailwind no puede expresar coordenadas dinámicas.
      // La supresión la hace la entrada de la lista blanca, no este comentario.
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 flex animate-in items-center gap-1 rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-1 text-xs text-ink shadow-[var(--ego-elevation-l2)] fade-in zoom-in-95 select-none duration-150"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => sendSelectionToChat()}
        aria-label="Preguntar a Sub-Ego sobre la selección"
        className="text-ink hover:bg-panel hover:text-ink"
      >
        <ChatCircleDots size={14} className="text-brand" weight="bold" />
        <span>Preguntar a Sub-Ego</span>
      </Button>

      <div className="h-3 w-[1px] bg-hairline" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        title="Copiar selección"
        aria-label="Copiar selección"
        className="text-ink hover:bg-panel hover:text-ink"
      >
        <Copy size={13} />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={clearSelection}
        title="Cerrar"
        aria-label="Descartar selección"
        className="text-faint hover:bg-panel hover:text-ink"
      >
        <X size={13} />
      </Button>
    </div>
  );
};
