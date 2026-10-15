import { useState, useMemo, memo } from "react";
import { MagnifyingGlass, ChatTeardropText, Check, X, Clock } from "@phosphor-icons/react";
import { fuzzyRank } from "@ego/ui-runtime";
import { Modal } from "./ui-kit/Modal.js";

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
      {/* Buscador */}
      <div className="flex items-center gap-2 border-b border-hairline px-1 pb-2.5">
        <MagnifyingGlass size={15} className="text-faint shrink-0" aria-hidden />
        <input
          type="text"
          aria-label="Buscar sesión reciente por título o tema"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sesión reciente (ej: kernel, canvas, roadmap)…"
          className="flex-1 bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none"
        />
        {search && (
          <button
            type="button"
            aria-label="Limpiar búsqueda de sesiones"
            onClick={() => setSearch("")}
            className="rounded p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-faint hover:text-ink hover:bg-raised transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista de sesiones: role=listbox solo con opciones (axe
          aria-required-children); el vacío honesto es bloque neutro. */}
      <div className="divide-y divide-hairline">
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
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onResumeSession(item.id);
                  onClose();
                }}
                className={`flex w-full items-start justify-between p-3 cursor-pointer transition-colors text-left ${
                  isSelected ? "bg-raised/80" : "hover:bg-raised/40"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-hairline bg-panel text-faint">
                    <ChatTeardropText size={13} />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink truncate">{item.title}</span>
                      {(item.scope ?? item.subEgoId) && (
                        <span className="rounded bg-panel px-1 py-0.2 text-[9px] font-mono text-faint border border-hairline">
                          {item.scope ?? item.subEgoId}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-[11px] text-faint truncate">
                      {item.preview}
                    </p>

                    <div className="mt-1 flex items-center gap-1 text-[10px] text-dim font-mono">
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
