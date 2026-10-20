import { useState, useEffect, useCallback, useRef } from "react";
import {
  House,
  Robot,
  ClockCounterClockwise,
  Books,
  PuzzlePiece,
  DotsThree,
  SidebarSimple,
  Plus,
  MagnifyingGlass,
  FolderSimple,
  FolderSimpleStar,
  ChatCircle,
  PlugsConnected,
  Gear,
  ChartBar,
  Sparkle,
  PaintBrush,
  CaretDown,
} from "@phosphor-icons/react";
import { McpManagerModal } from "../mcp/McpManagerModal.js";
import { SessionPicker, type SessionItem } from "../SessionPicker.js";
import { useUiStore } from "../ui-kit/store.js";
import { ego, type SubEgoDetailInfo, type ProjectInfo, type SessionSummary } from "../../lib/ego.js";
import { CharacterBadge } from "../character/CharacterBadge.js";
import { OPEN_SETTINGS_EVENT, requestOpenOmnibar } from "../omnibar.js";
import { SettingsModal } from "./SettingsModal.js";
import { ProjectsModal } from "./ProjectsModal.js";
import { useDesignSystem, resolvePresetKey } from "../canvas/DesignSystemProvider.js";
import { Select } from "../ui-kit/Select.js";

export interface SidebarProps {
  activeProject: string;
  onSelectProject: (projectId: string) => void;
  activeSubEgo: string;
  onSelectSubEgo: (subEgoId: string) => void;
  onNewSession: () => void;
  /** T06: notifica colapsos para que App dimensione el SplitPane. */
  onCollapsedChange?: (collapsed: boolean) => void;
  // Navegación rápida de workspace hacia App.tsx
  activeWorkspaceTab?: "daily" | "domains" | "canvas" | "workbench" | "subegos" | "personalization";
  onSelectWorkspaceTab?: (tab: "daily" | "domains" | "canvas" | "workbench" | "subegos" | "personalization") => void;
  onCloseWorkspace?: () => void;
  workspaceOpen?: boolean;
}

function toSessionItem(s: SessionSummary): SessionItem | null {
  if (!s || typeof s.sessionId !== "string" || s.sessionId.length === 0) return null;
  const turnCount = typeof s.turnCount === "number" && Number.isFinite(s.turnCount) ? s.turnCount : 0;
  return {
    id: s.sessionId,
    title: s.sessionId.length > 24 ? `${s.sessionId.slice(0, 24)}…` : s.sessionId,
    preview: turnCount === 1 ? "1 turno" : `${turnCount} turnos`,
    subEgoId: "",
    scope: typeof s.projectScope === "string" ? s.projectScope : undefined,
    updatedAt: typeof s.lastTimestamp === "number" ? s.lastTimestamp : Date.now(),
  };
}

function VantaDbBadge() {
  return (
    <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] text-dim">
      <span>VantaDB 0.8.0</span>
      <span className="flex items-center gap-1 font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        LSM WAL
      </span>
    </div>
  );
}

export function Sidebar({
  activeProject,
  onSelectProject,
  activeSubEgo,
  onSelectSubEgo,
  onNewSession,
  onCollapsedChange,
  activeWorkspaceTab,
  onSelectWorkspaceTab,
  onCloseWorkspace,
  workspaceOpen,
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Popovers del primer Icon Rail
  const [dotsMenuOpen, setDotsMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const dotsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Design system theme tokens (tolerante cuando se monta standalone en tests)
  let designSystem: ReturnType<typeof useDesignSystem> | null = null;
  try {
    designSystem = useDesignSystem();
  } catch {
    designSystem = null;
  }

  // Cerrar popovers al hacer click fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dotsRef.current && !dotsRef.current.contains(e.target as Node)) {
        setDotsMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Ctrl+, global abre ajustes
  useEffect(() => {
    const onOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  // Proyectos vivos desde VantaDB (INT-03)
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

  // Roster vivo desde IPC
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

  // Atajos: Ctrl+B colapsa/expande contextual sidebar, Ctrl+N nueva sesión
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

  // Sesiones activas del proyecto
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    void ego()
      .sessions?.list?.({ projectScope: activeProject })
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
  }, [activeProject]);

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

  const handleResumeSession = useCallback(async (id: string) => {
    try {
      const res = await ego().sessions?.resume?.({ sessionId: id });
      if (res && res.ok === true) {
        useUiStore.getState().setActiveSessionId(id);
      } else {
        console.warn("[Sidebar] Resume rechazado:", res?.error ?? "sin detalle");
      }
    } catch (err) {
      console.warn("[Sidebar] Error reanudando sesión:", err);
    }
  }, []);

  return (
    <div className="flex h-full w-full select-none overflow-hidden bg-[#111113]">
      {/* =========================================================================
          COLUMNA 1: Icon Rail Fijo (ChatGPT Desktop / Codex / Claude Desktop)
          ========================================================================= */}
      <nav
        aria-label="Icon Rail"
        className="w-14 shrink-0 bg-[#111113] border-r border-white/[0.06] flex flex-col items-center py-3 justify-between z-20"
      >
        {/* Parte Superior del Rail */}
        <div className="flex flex-col items-center gap-2">
          {/* Botón para expandir si el segundo sidebar está colapsado */}
          {isCollapsed && (
            <button
              type="button"
              onClick={() => notifyCollapsed(false)}
              title="Expandir barra lateral (Ctrl+B)"
              aria-label="Expandir barra lateral"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mb-1"
            >
              <SidebarSimple size={18} />
            </button>
          )}

          {/* 1. Inicio / Chat */}
          <button
            type="button"
            onClick={() => {
              onCloseWorkspace?.();
            }}
            title="Inicio / Chat"
            aria-label="Inicio / Chat"
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
              !workspaceOpen
                ? "bg-white/10 text-white shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <House size={20} />
          </button>

          {/* 2. Sub-Egos Fábrica */}
          <button
            type="button"
            onClick={() => {
              onSelectWorkspaceTab?.("subegos");
            }}
            title="Sub-Egos Fábrica"
            aria-label="Sub-Egos Fábrica"
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
              workspaceOpen && activeWorkspaceTab === "subegos"
                ? "bg-white/10 text-white shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Robot size={20} />
          </button>

          {/* 3. Tareas e Historial (Workbench) */}
          <button
            type="button"
            onClick={() => {
              onSelectWorkspaceTab?.("workbench");
            }}
            title="Tareas e Historial (Workbench)"
            aria-label="Tareas e Historial"
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
              workspaceOpen && activeWorkspaceTab === "workbench"
                ? "bg-white/10 text-white shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <ClockCounterClockwise size={20} />
          </button>

          {/* 4. Conocimiento y Memoria (Dominio / GraphRAG) */}
          <button
            type="button"
            onClick={() => {
              onSelectWorkspaceTab?.("domains");
            }}
            title="Conocimiento y Memoria"
            aria-label="Conocimiento y Memoria"
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
              workspaceOpen && activeWorkspaceTab === "domains"
                ? "bg-white/10 text-white shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Books size={20} />
          </button>

          {/* 5. Personalización (Skills, MCP y Avatares) */}
          <button
            type="button"
            onClick={() => {
              onSelectWorkspaceTab?.("personalization");
            }}
            title="Personalización (Skills y Complementos MCP)"
            aria-label="Personalización"
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
              workspaceOpen && activeWorkspaceTab === "personalization"
                ? "bg-white/10 text-white shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <PuzzlePiece size={20} />
          </button>

          {/* 6. Botón ••• (Popover con más herramientas) */}
          <div className="relative" ref={dotsRef}>
            <button
              type="button"
              onClick={() => setDotsMenuOpen(!dotsMenuOpen)}
              title="Más vistas y herramientas"
              aria-label="Más vistas y herramientas"
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
                dotsMenuOpen
                  ? "bg-white/15 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <DotsThree size={20} weight="bold" />
            </button>

            {/* Popover Flotante de los 3 Puntos */}
            {dotsMenuOpen && (
              <div className="absolute left-14 top-0 z-50 w-56 rounded-2xl bg-[#1e1e22] border border-white/10 p-2 shadow-2xl text-xs space-y-1 backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Espacio de Trabajo
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspaceTab?.("domains");
                    setDotsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <FolderSimple size={16} className="text-zinc-400" />
                  <span>Proyectos y Dominios</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspaceTab?.("daily");
                    setDotsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <ChartBar size={16} className="text-zinc-400" />
                  <span>Resumen Diario (Daily State)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspaceTab?.("workbench");
                    setDotsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <ClockCounterClockwise size={16} className="text-zinc-400" />
                  <span>Revisión de código & Terminal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspaceTab?.("canvas");
                    setDotsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <Sparkle size={16} className="text-zinc-400" />
                  <span>Canvas Dinámico</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Parte Inferior del Rail: Avatar de Usuario + Popover de Perfil */}
        <div className="relative flex flex-col items-center gap-2" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            title="Perfil de Eros · Soberano Local"
            aria-label="Perfil de usuario y configuración"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-700/80 hover:bg-zinc-600 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs border border-white/10"
          >
            EN
          </button>

          {/* Popover Flotante de Perfil */}
          {profileMenuOpen && (
            <div className="absolute left-14 bottom-0 z-50 w-64 rounded-2xl bg-[#1e1e22] border border-white/10 p-2.5 shadow-2xl text-xs space-y-2 backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-2.5 px-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 font-bold text-white text-xs border border-white/10">
                  EN
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-semibold text-white leading-tight">Eros Nessy</span>
                  <span className="text-[10px] text-zinc-400 font-mono">Soberano Local · Ego Core</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspaceTab?.("daily");
                    setProfileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <ChartBar size={15} className="text-zinc-400" />
                  <span>Uso y telemetría</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    (window as any).ego?.floating?.toggleFloating?.();
                    setProfileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sparkle size={15} className="text-zinc-400" />
                    <span>Mostrar mascota (Isla Flotante)</span>
                  </div>
                  <kbd className="rounded bg-white/10 px-1 py-0.2 font-mono text-[9px] text-zinc-400">
                    Alt+Win+P
                  </kbd>
                </button>

                {/* Selector rápido de Tema */}
                <div className="flex items-center justify-between px-2.5 py-1.5 text-zinc-300">
                  <div className="flex items-center gap-2">
                    <PaintBrush size={15} className="text-zinc-400" />
                    <span>Apariencia</span>
                  </div>
                  <Select
                    ariaLabel="Tema de apariencia"
                    value={
                      resolvePresetKey(designSystem?.tokens?.id ?? "") ?? "default-dark"
                    }
                    onValueChange={(val) => designSystem?.applyPreset?.(val)}
                    options={
                      designSystem?.availablePresets
                        ? Object.keys(designSystem.availablePresets).map((k) => ({
                            value: k,
                            label: designSystem.availablePresets[k]?.name ?? k,
                          }))
                        : [{ value: "default-dark", label: "Default Dark" }]
                    }
                    className="min-h-11 min-w-11 max-w-[140px] text-[10px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setProfileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Gear size={15} className="text-zinc-400" />
                    <span>Configuración</span>
                  </div>
                  <kbd className="rounded bg-white/10 px-1 py-0.2 font-mono text-[9px] text-zinc-400">
                    Ctrl+,
                  </kbd>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* =========================================================================
          COLUMNA 2: Sidebar Contextual Limpio (Colapsable con Ctrl+B o botón)
          ========================================================================= */}
      {!isCollapsed && (
        <aside
          aria-label="Navegación principal"
          className="w-60 shrink-0 bg-[#161618] border-r border-white/[0.06] flex flex-col h-full min-w-0 flex-1 select-none"
        >
          {/* Cabecera Superior: Ego Core ⌄ + Buscador + Colapsar */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-white flex items-center gap-1">
                Ego Core
                <CaretDown size={12} className="text-zinc-400" />
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={requestOpenOmnibar}
                title="Buscar en memoria (Ctrl+K)"
                aria-label="Buscar en memoria (Ctrl+K)"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <MagnifyingGlass size={15} />
              </button>
              <button
                type="button"
                onClick={() => notifyCollapsed(true)}
                title="Colapsar panel (Ctrl+B)"
                aria-label="Colapsar panel"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SidebarSimple size={15} />
              </button>
            </div>
          </div>

          {/* Botón Nueva Sesión / Chat Nuevo (Fila limpia estilo ChatGPT) */}
          <div className="p-2.5 pb-1">
            <button
              type="button"
              onClick={onNewSession}
              title="Nueva conversación (Ctrl+N)"
              className="flex w-full items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-3 py-2 text-xs font-medium text-white transition-colors cursor-pointer shadow-xs border border-white/[0.04]"
            >
              <Plus size={14} weight="bold" className="text-zinc-300" />
              <span>Nueva sesión</span>
            </button>
          </div>

          {/* Buscador de Recuerdos explícito (para tests y accesibilidad) */}
          <div className="px-2.5 py-1">
            <button
              type="button"
              onClick={requestOpenOmnibar}
              title="Búsqueda federada (Ctrl+K)"
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2 truncate">
                <MagnifyingGlass size={13} className="text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                <span className="truncate text-[11px]">Buscar recuerdos (Ctrl+K)</span>
              </div>
              <kbd className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400 border border-white/10">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Contenedor con Scroll de Proyectos, Sub-Egos y Recientes */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
            {/* 1. SECCIÓN PROYECTOS */}
            <div id="sidebar-section-projects">
              <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                <span>Proyectos</span>
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(true)}
                  title="Crear nuevo proyecto"
                  aria-label="Crear nuevo proyecto"
                  className="flex items-center justify-center rounded p-1 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="space-y-0.5">
                {projects.length === 0 && (
                  <p className="px-2 py-1.5 text-[11px] text-zinc-500 italic">
                    Sin proyectos — crea uno con +.
                  </p>
                )}
                {projects.map((p) => {
                  const isSelected = activeProject === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void handleSelectProject(p.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-white/10 text-white font-medium border border-white/10"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isSelected ? (
                          <FolderSimpleStar size={14} className="shrink-0 text-amber-400" />
                        ) : (
                          <FolderSimple size={14} className="shrink-0 text-zinc-500" />
                        )}
                        <span className="truncate text-left">{p.name}</span>
                      </div>
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. SECCIÓN SUB-EGOS CON CHARACTER BADGE 36PX */}
            <div id="sidebar-section-roster">
              <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                <span>Sub-Egos</span>
                <span className="font-mono text-[10px] text-zinc-600">{roster.length}</span>
              </div>

              <div className="space-y-1">
                {roster.length === 0 && (
                  <p className="px-2 py-1.5 text-[11px] text-zinc-500 italic">
                    Sin Sub-Egos registrados.
                  </p>
                )}
                {roster.map((s) => {
                  const isSelected = activeSubEgo === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSubEgo(s.id)}
                      className={`flex w-full items-center justify-between rounded-xl p-2 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-white/10 text-white font-medium border border-white/10 shadow-xs"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/40 border border-white/[0.08] overflow-hidden">
                          <CharacterBadge subEgoId={s.id} size={36} state="idle" />
                        </div>
                        <div className="flex truncate flex-col text-left font-sans">
                          <span className="truncate text-xs font-semibold text-white">{s.name}</span>
                          <span className="truncate text-[10px] text-zinc-400">{s.role}</span>
                        </div>
                      </div>

                      <span
                        title={s.state === "active" ? "Sub-Ego Activo" : "En espera"}
                        className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                          s.state === "active"
                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                            : "bg-zinc-600"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. SECCIÓN RECIENTES */}
            <div>
              <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                <span>Recientes</span>
                <button
                  type="button"
                  onClick={() => useUiStore.getState().openSessionPicker()}
                  title="Historial de sesiones"
                  className="text-zinc-500 hover:text-white text-[10px] cursor-pointer"
                >
                  Ver todas
                </button>
              </div>

              <div className="space-y-0.5">
                {sessions.length === 0 ? (
                  <p className="px-2 py-1 text-[11px] text-zinc-600 italic">
                    Sin sesiones recientes
                  </p>
                ) : (
                  sessions.slice(0, 5).map((session) => {
                    const isCurrent = activeSessionId === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => void handleResumeSession(session.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-white/10 text-white font-medium"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ChatCircle size={13} className="shrink-0 text-zinc-500" />
                          <span className="truncate text-left text-[11px]">{session.title}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {session.preview}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. HERRAMIENTAS Y MCP */}
            <div>
              <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                <span>Herramientas</span>
              </div>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setIsMcpOpen(true)}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <PlugsConnected size={14} className="text-zinc-500" />
                  <span>MCP Servers & Tools</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer del Contextual Sidebar */}
          <div className="border-t border-white/[0.06] bg-[#121214] p-2 space-y-1">
            <VantaDbBadge />
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Gear size={15} />
                <span>Configuración</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">Ctrl+,</span>
            </button>
          </div>
        </aside>
      )}

      {/* Modales Radix Reutilizables */}
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
        activeSessionId={activeSessionId ?? undefined}
        sessions={sessions}
        onClose={() => useUiStore.getState().closeSessionPicker()}
        onResumeSession={(id) => void handleResumeSession(id)}
      />
    </div>
  );
}

export default Sidebar;
