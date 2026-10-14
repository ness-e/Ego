import { useState, useMemo, memo } from "react";
import { MagnifyingGlass, ChatTeardropText, Check, X, Clock } from "@phosphor-icons/react";
import { fuzzyRank } from "@ego/ui-runtime";

export interface SessionItem {
  id: string;
  title: string;
  preview: string;
  subEgoId: string;
  updatedAt: number;
}

export interface SessionPickerProps {
  isOpen: boolean;
  activeSessionId?: string;
  sessions?: SessionItem[];
  onClose: () => void;
  onResumeSession: (sessionId: string) => void;
}

const DEFAULT_SESSIONS: SessionItem[] = [
  {
    id: "sess-kernel-arch",
    title: "Arquitectura del Cognitive Runtime",
    preview: "Revisión de adapters NativeVantaDB y aislamiento de Fjall LSM...",
    subEgoId: "ego.nucleus",
    updatedAt: Date.now() - 1000 * 60 * 15,
  },
  {
    id: "sess-canvas-sync",
    title: "Integración de Dynamic Workspace y Canvas",
    preview: "Discusión sobre PayloadRef y mitigación de sobrecoste DOM...",
    subEgoId: "ego.developer",
    updatedAt: Date.now() - 1000 * 60 * 120,
  },
  {
    id: "sess-product-roadmap",
    title: "Backlog Maestro y Fase 11 Security",
    preview: "Verificación de los 10 principios innegociables y auditoría...",
    subEgoId: "ego.product",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

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

export const SessionPicker = memo(function SessionPicker({
  isOpen,
  activeSessionId = "sess-kernel-arch",
  sessions = DEFAULT_SESSIONS,
  onClose,
  onResumeSession,
}: SessionPickerProps) {
  const [search, setSearch] = useState("");

  const rankedSessions = useMemo(() => {
    return fuzzyRank(sessions, search, (s) => `${s.title} ${s.preview} ${s.subEgoId}`);
  }, [sessions, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-hairline bg-panel shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-xs text-ink"
        role="dialog"
        aria-modal="true"
        aria-label="Selector de Sesiones"
      >
        {/* Cabecera de búsqueda */}
        <div className="flex items-center gap-2 border-b border-hairline px-3.5 py-2.5 bg-raised/40">
          <MagnifyingGlass size={15} className="text-faint shrink-0" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sesión reciente (ej: kernel, canvas, roadmap)…"
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Lista de sesiones */}
        <div className="flex-1 overflow-y-auto divide-y divide-hairline">
          {rankedSessions.length === 0 ? (
            <div className="p-8 text-center text-faint">
              No se encontraron sesiones para "{search}"
            </div>
          ) : (
            rankedSessions.map(({ item }) => {
              const isSelected = item.id === activeSessionId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onResumeSession(item.id);
                    onClose();
                  }}
                  className={`flex items-start justify-between p-3 cursor-pointer transition-colors ${
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
                        <span className="rounded bg-panel px-1 py-0.2 text-[9px] font-mono text-faint border border-hairline">
                          {item.subEgoId}
                        </span>
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
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hairline px-3.5 py-2 bg-raised/20 text-[10px] text-faint font-mono">
          <span>/resume · Sesiones persistentes VantaDB</span>
          <span>Enter para abrir</span>
        </div>
      </div>
    </div>
  );
});
