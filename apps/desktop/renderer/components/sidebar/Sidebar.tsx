import { useState, useEffect, useCallback, useRef } from "react";
import {
  SidebarSimple,
  Plus,
  MagnifyingGlass,
  FolderSimple,
  FolderSimpleStar,
  Users,
  ChatCircle,
  PlugsConnected,
  Gear,
  HardDrive,
} from "@phosphor-icons/react";
import { McpManagerModal } from "../mcp/McpManagerModal.js";
import { SessionPicker, type SessionItem } from "../SessionPicker.js";
import { useUiStore } from "../ui-kit/store.js";
import { ego, type SubEgoDetailInfo, type ProjectInfo, type SessionSummary } from "../../lib/ego.js";
import { OPEN_SETTINGS_EVENT } from "../omnibar.js";
import { requestOpenOmnibar } from "../omnibar.js";
import { SettingsModal } from "./SettingsModal.js";
import { ProjectsModal } from "./ProjectsModal.js";

export interface SidebarProps {
  activeProject: string;
  onSelectProject: (projectId: string) => void;
  activeSubEgo: string;
  onSelectSubEgo: (subEgoId: string) => void;
  onNewSession: () => void;
  /** T06: notifica colapsos para que App dimensione el SplitPane. */
  onCollapsedChange?: (collapsed: boolean) => void;
}

function rosterInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * T14: mapea un `SessionSummary` del puente `sessions.list` (T13) al
 * `SessionItem` del picker. Sin `sessionId` válido → null (vacío honesto).
 */
function toSessionItem(s: SessionSummary): SessionItem | null {
  if (!s || typeof s.sessionId !== "string" || s.sessionId.length === 0) return null;
  const turnCount = typeof s.turnCount === "number" && Number.isFinite(s.turnCount) ? s.turnCount : 0;
  return {
    id: s.sessionId,
    title: s.sessionId.length > 24 ? `${s.sessionId.slice(0, 24)}…` : s.sessionId,
    preview: turnCount === 1 ? "1 turno" : `${turnCount} turnos`,
    subEgoId: typeof s.projectScope === "string" ? s.projectScope : "",
    updatedAt: typeof s.lastTimestamp === "number" ? s.lastTimestamp : Date.now(),
  };
}

/**
 * T08 (UI-05): sidebar viva. Roster vía `subegos.list()` IPC (sin
 * hardcodeados), proyectos vía `projects.list()` IPC, sesiones vía store +
 * `SessionPicker` real (sin canal `ipc.sessions.*` no hay IPC posible),
 * modales Radix (Settings/Projects), búsqueda delegada al omnibar (Ctrl+K),
 * ajustes vía Ctrl+, . Botones sin acción eliminados (quedan MCP + nuevo).
 */
export function Sidebar({
  activeProject,
  onSelectProject,
  activeSubEgo,
  onSelectSubEgo,
  onNewSession,
  onCollapsedChange,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isCollapsedRef = useRef(false);
  const notifyCollapsed = useCallback(
    (next: boolean) => {
      isCollapsedRef.current = next;
      setIsCollapsed(next);
      onCollapsedChange?.(next);
    },
    [onCollapsedChange]
  );
  // T12: el rail colapsado expande Y ancla a la sección pedida (nunca botón ciego).
  const expandAndAnchor = useCallback(
    (sectionId: string) => {
      notifyCollapsed(false);
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ block: "nearest" });
      });
    },
    [notifyCollapsed]
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Ctrl+, global abre ajustes (el omnibar emite `ego:open-settings`).
  useEffect(() => {
    const onOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  // Proyectos vivos desde VantaDB (INT-03).
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const loadProjects = useCallback(async () => {
    try {
      const list = await ego().projects.list();
      if (list && list.length > 0) setProjects(list);
    } catch (err) {
      console.warn("[Sidebar] Error al cargar proyectos de VantaDB:", err);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    const unsub = ego().onProjectChanged?.((data) => {
      onSelectProject(data.activeProjectId);
      void loadProjects();
    });
    return () => {
      unsub?.();
    };
  }, [loadProjects, onSelectProject]);

  // Roster vivo desde IPC (T08: elimina los 4 hardcodeados del monolito).
  const [roster, setRoster] = useState<SubEgoDetailInfo[]>([]);
  const loadRoster = useCallback(async () => {
    try {
      const list = await ego().subegos.list();
      if (Array.isArray(list)) setRoster(list);
    } catch (err) {
      console.warn("[Sidebar] Error al cargar roster de Sub-Egos:", err);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
    const unsub = ego().onSubEgosChanged?.(() => void loadRoster());
    return () => {
      unsub?.();
    };
  }, [loadRoster]);

  // Atajos: Ctrl+B colapsa, Ctrl+N nueva sesión (Ctrl+K/, los sirve el omnibar).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        notifyCollapsed(!isCollapsedRef.current);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewSession();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewSession, notifyCollapsed]);

  const sessionPickerOpen = useUiStore((s) => s.sessionPickerOpen);
  const activeSessionId = useUiStore((s) => s.activeSessionId);

  // T14: sesiones reales de `sessions.list` (puente T13) al picker.
  // Sin bridge o ante error: vacío honesto (el picker ya lo muestra).
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    void ego()
      .sessions?.list?.()
      .then((res) => {
        if (cancelled || !res || typeof res !== "object") return;
        const list = (res as { sessions?: unknown }).sessions;
        if (!Array.isArray(list)) return;
        const items: SessionItem[] = [];
        for (const s of list) {
          const mapped = toSessionItem(s as SessionSummary);
          if (mapped) items.push(mapped);
        }
        setSessions(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectProject = useCallback(
    async (id: string) => {
      onSelectProject(id);
      try {
        await ego().projects.select(id);
      } catch (err) {
        console.warn("[Sidebar] Error seleccionando proyecto:", err);
      }
    },
    [onSelectProject]
  );

  // 1. MODO COLAPSADO (Navigation Rail compacto de 54px)
  if (isCollapsed) {
    return (
      <>
        <aside className="flex h-full w-full shrink-0 flex-col items-center justify-between border-r border-hairline bg-panel py-3 select-none">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => notifyCollapsed(false)}
              title="Expandir barra lateral (Ctrl+B)"
              aria-label="Expandir barra lateral"
              className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <SidebarSimple size={18} />
            </button>
            <button
              onClick={onNewSession}
              title="Nueva sesión (Ctrl+N)"
              aria-label="Nueva sesión"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-paper shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus size={16} weight="bold" />
            </button>
            <div className="my-1 h-px w-6 bg-hairline" />
            <button
              onClick={() => expandAndAnchor("sidebar-section-projects")}
              title="Proyectos de Memoria"
              aria-label="Proyectos de Memoria"
              className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <FolderSimple size={18} />
            </button>
            <button
              onClick={() => expandAndAnchor("sidebar-section-roster")}
              title="Roster de Sub-Egos"
              aria-label="Roster de Sub-Egos"
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <Users size={18} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </button>
            <button
              onClick={() => useUiStore.getState().openSessionPicker()}
              title="Historial de Sesiones"
              aria-label="Historial de Sesiones"
              className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <ChatCircle size={18} />
            </button>
            <button
              onClick={() => setIsMcpOpen(true)}
              title="Servidores MCP & Tools"
              aria-label="Servidores MCP y herramientas"
              className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <PlugsConnected size={18} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div
              title="VantaDB persistente activo"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-800/40 bg-emerald-950/60 text-emerald-400"
            >
              <HardDrive size={13} />
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Configuración de Ego"
              aria-label="Configuración de Ego"
              className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <Gear size={18} />
            </button>
            <div
              title="Eros Nessy (Owner)"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-raised text-[11px] font-bold text-ink"
            >
              EN
            </div>
          </div>
        </aside>
        <McpManagerModal isOpen={isMcpOpen} onClose={() => setIsMcpOpen(false)} />
        <SessionPicker
          isOpen={sessionPickerOpen}
          activeSessionId={activeSessionId}
          sessions={sessions}
          onClose={() => useUiStore.getState().closeSessionPicker()}
          onResumeSession={(id) => useUiStore.getState().setActiveSessionId(id)}
        />
      </>
    );
  }

  // 2. MODO EXPANDIDO (Sidebar Completo de 260px)
  return (
    <>
      <aside className="flex h-full w-full shrink-0 flex-col border-r border-hairline bg-panel select-none">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-ink font-mono text-[10px] font-bold text-paper">
              E
            </div>
            <span className="text-xs font-semibold tracking-tight text-ink">Ego Navigation</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewSession}
              title="Nueva conversación (Ctrl+N)"
              className="flex h-7 items-center gap-1 rounded border border-hairline bg-raised px-2 text-[11px] font-medium text-ink transition-colors hover:bg-raised/80"
            >
              <Plus size={13} weight="bold" />
              <span>Nuevo</span>
            </button>
            <button
              onClick={() => notifyCollapsed(true)}
              title="Colapsar barra lateral (Ctrl+B)"
              aria-label="Colapsar barra lateral"
              className="flex h-7 w-7 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <SidebarSimple size={16} />
            </button>
          </div>
        </div>

        {/* Buscador federado: delega al omnibar (Ctrl+K). */}
        <div className="px-3 pt-3 pb-2">
          <button
            type="button"
            onClick={requestOpenOmnibar}
            title="Búsqueda federada (Ctrl+K)"
            className="flex w-full items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5 text-xs text-faint transition-colors focus-within:border-ink/40 hover:border-ink/40"
          >
            <MagnifyingGlass size={14} className="text-dim" />
            <span>Buscar recuerdos (Ctrl+K)…</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
          {/* Bloque 1: Proyectos de Memoria (IPC vivo). */}
          <div id="sidebar-section-projects" className="scroll-mt-2">
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Proyectos (Memory Scope)</span>
              <button
                onClick={() => setIsNewProjectModalOpen(true)}
                title="Crear nuevo proyecto"
                aria-label="Crear nuevo proyecto"
                className="rounded p-0.5 text-dim transition-colors hover:bg-raised hover:text-ink"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="space-y-0.5">
              {projects.length === 0 && (
                <p className="px-2 py-1.5 text-[11px] text-faint italic">
                  Sin proyectos en VantaDB — crea uno con +.
                </p>
              )}
              {projects.map((p) => {
                const isSelected = activeProject === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => void handleSelectProject(p.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? "border border-hairline bg-raised font-medium text-ink"
                        : "text-faint hover:bg-raised/60 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isSelected ? (
                        <FolderSimpleStar size={14} className="shrink-0 text-amber-400" />
                      ) : (
                        <FolderSimple size={14} className="shrink-0 text-dim" />
                      )}
                      <span className="truncate">{p.name}</span>
                    </div>
                    {isSelected && (
                      <span className="rounded border border-emerald-800/40 bg-emerald-950/80 px-1.5 py-0.2 font-mono text-[9px] text-emerald-400">
                        Activo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 2: Roster de Sub-Egos (IPC vivo, sin hardcodeados). */}
          <div id="sidebar-section-roster" className="scroll-mt-2">
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Sub-Egos Especialistas</span>
              <span className="font-mono text-[10px] text-faint">{roster.length}</span>
            </div>
            <div className="space-y-0.5">
              {roster.length === 0 && (
                <p className="px-2 py-1.5 text-[11px] text-faint italic">
                  Sin Sub-Egos registrados en el backend.
                </p>
              )}
              {roster.map((s) => {
                const isSelected = activeSubEgo === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelectSubEgo(s.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? "border border-hairline bg-raised font-medium text-ink"
                        : "text-faint hover:bg-raised/60 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-raised text-[9px] font-bold text-ink">
                        {rosterInitials(s.name)}
                      </div>
                      <div className="flex truncate flex-col text-left">
                        <span className="truncate text-xs leading-none">{s.name}</span>
                        <span className="truncate text-[10px] text-dim">{s.role}</span>
                      </div>
                    </div>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        s.state === "active" ? "bg-emerald-500" : "bg-dim"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 3: Sesión activa + selector real (sin historial hardcodeado). */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Sesión Activa</span>
              <button
                onClick={() => useUiStore.getState().openSessionPicker()}
                title="Abrir selector de sesiones"
                className="rounded px-1 font-mono text-faint normal-case transition-colors hover:bg-raised hover:text-ink"
              >
                Todas
              </button>
            </div>
            <div className="flex w-full items-center gap-2 rounded border border-hairline/60 bg-raised/40 px-2 py-1.5 text-left text-xs text-faint">
              <ChatCircle size={13} className="shrink-0 text-dim" />
              <span className="truncate font-mono text-[11px]">{activeSessionId}</span>
            </div>
          </div>

          {/* Bloque 4: Herramientas (solo acciones reales; muertos eliminados). */}
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Espacio & Herramientas</span>
            </div>
            <div className="space-y-0.5 text-xs text-faint">
              <button
                onClick={() => setIsMcpOpen(true)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-raised/60 hover:text-ink"
              >
                <PlugsConnected size={14} className="text-dim" />
                <span>MCP Servers & Tools</span>
              </button>
              {/* T12: fila muerta "Artifacts del Canvas (vía Chat)" eliminada —
                  era un div sin acción; sin canal de navegación a Canvas en este
                  componente, mostrarla sería un botón muerto. */}
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t border-hairline bg-paper/60 p-2">
          <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] text-dim">
            <span>VantaDB 0.8.0</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              LSM WAL
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-faint transition-colors hover:bg-raised hover:text-ink"
          >
            <div className="flex items-center gap-2">
              <Gear size={15} />
              <span>Configuración</span>
            </div>
            <span className="font-mono text-[10px] text-dim">Ctrl+,</span>
          </button>
          <div className="flex items-center justify-between rounded border border-hairline/60 bg-raised/40 px-2 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-paper">
                EN
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs leading-none font-medium text-ink">Eros Nessy</span>
                <span className="text-[10px] text-dim">Local Sovereign Owner</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ProjectsModal
        open={isNewProjectModalOpen}
        onOpenChange={setIsNewProjectModalOpen}
        onCreated={(id) => {
          onSelectProject(id);
          void loadProjects();
        }}
      />
      <McpManagerModal isOpen={isMcpOpen} onClose={() => setIsMcpOpen(false)} />
      <SessionPicker
        isOpen={sessionPickerOpen}
        activeSessionId={activeSessionId}
        sessions={sessions}
        onClose={() => useUiStore.getState().closeSessionPicker()}
        onResumeSession={(id) => useUiStore.getState().setActiveSessionId(id)}
      />
    </>
  );
}
