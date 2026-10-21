import { useState, useMemo, memo } from "react";
import { MagnifyingGlass, ChatTeardropText, Check, X, Clock } from "@phosphor-icons/react";
import { fuzzyRank } from "@ego/ui-runtime";
import { Modal } from "./ui-kit/Modal.js";
import { Input } from "./ui-kit/Input.js";
import { Button } from "./ui-kit/Button.js";
import { Badge } from "./ui-kit/Badge.js";

export interface SessionItem {
  id: string;
  title: string;
  preview: string;
  subEgoId: string;
  /** A6: scope de proyecto (`SessionSummary.projectScope`); el badge lo prefiere. */
  scope?: string;
  updatedAt: number;
}

export interface SessionPickerProps {
  isOpen: boolean;
  activeSessionId?: string;
  sessions?: SessionItem[];
  onClose: () => void;
  onResumeSession: (sessionId: string) => void;
}

/**
 * 2026-10-14: sin sesiones reales no se inventan (antes DEFAULT_SESSIONS
 * mostraba 3 falsas). Vacío honesto hasta que exista canal de sesiones.
 */

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

/**
 * T07 (UI-04): sobre ui-kit `Modal` (Radix Dialog — trap de foco + Escape +
 * `role="dialog"` + `aria-modal` nativos). Opciones como `<button>`
 * `role="option"` (activables por teclado) y buscador con `aria-label`.
 */
export const SessionPicker = memo(function SessionPicker({
  isOpen,
  activeSessionId,
  sessions = [],
  onClose,
  onResumeSession,
}: SessionPickerProps) {
  const [search, setSearch] = useState("");

  const rankedSessions = useMemo(() => {
    return fuzzyRank(sessions, search, (s) => `${s.title} ${s.preview} ${s.subEgoId} ${s.scope ?? ""}`);
  }, [sessions, search]);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Selector de Sesiones"
      description="/resume · Sesiones persistentes VantaDB · Enter para abrir"
    >
      {/* Buscador: `Input` del kit (borde `border-strong` + anillo de marca).
          Antes era un subrayado `border-b border-hairline`: el input más débil
          de la app (≈1.1:1 de contraste, sin segundo indicador). */}
      <div className="flex items-center gap-2">
        <MagnifyingGlass size={15} className="shrink-0 text-faint" aria-hidden />
        <Input
          type="text"
          aria-label="Buscar sesión reciente por título o tema"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sesión reciente (ej: kernel, canvas, roadmap)…"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpiar búsqueda de sesiones"
            onClick={() => setSearch("")}
          >
            <X size={14} />
          </Button>
        )}
      </div>

      {/* Lista de sesiones: role=listbox solo con opciones (axe
          aria-required-children); el vacío honesto es bloque neutro.
          Un único `divide-y`: antes había dos anidados y se dibujaba una
          doble línea de separación entre sesiones. */}
      <div>
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-faint">
            Sin sesiones recientes — aparecerán aquí al usar el chat.
          </div>
        ) : (
          <div role="listbox" aria-label="Sesiones recientes" className="divide-y divide-hairline">
            {rankedSessions.length === 0 ? (
              <div className="p-8 text-center text-faint">
                No se encontraron sesiones para &quot;{search}&quot;
              </div>
            ) : (
              rankedSessions.map(({ item }) => {
                const isSelected = item.id === activeSessionId;
                return (
                  // Opción de listbox: el kit no tiene primitive listbox/option y
                  // el `<button role="option">` es lo que exige el patrón ARIA.
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onResumeSession(item.id);
                      onClose();
                    }}
                    className={`flex w-full cursor-pointer items-start justify-between p-3 text-left transition-colors ${
                      isSelected ? "bg-raised" : "hover:bg-raised"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2.5 pr-2">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hairline bg-panel text-faint">
                        <ChatTeardropText size={13} />
                      </div>

                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-ink">{item.title}</span>
                          {(item.scope ?? item.subEgoId) && (
                            <Badge tone="dim">
                              {item.scope ?? item.subEgoId}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-xs text-faint">
                          {item.preview}
                        </p>

                        <div className="mt-1 flex items-center gap-1 font-mono text-xs text-dim">
                          <Clock size={11} />
                          <span>{formatRelativeTime(item.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-1 shrink-0 text-brand">
                        <Check size={16} weight="bold" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  );
});
