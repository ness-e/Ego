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
import { Button } from "../ui-kit/Button.js";
import { Menu } from "../ui-kit/Menu.js";
import { Popover } from "../ui-kit/Popover.js";

/**
 * El `Button` del kit renderiza los hijos dentro de un `<span>` interno
 * (`inline-flex min-w-0 items-center gap-1.5`).
 *
 * - Para un icono + etiqueta NO hace falta ningún selector arbitrario: la
 *   prop `icon` renderiza el icono como hermano ANTERIOR a ese `<span>`, de
 *   modo que el `gap-1.5` del base los separa sin acoplar el consumidor al
 *   DOM interno del kit.
 * - Para una fila con un atajo/insignia a la DERECHA (kbd, contador, punto
 *   de estado) está la prop `trailing`: el contenido crece (`flex-1`) y el
 *   slot queda al extremo, **sin `[&>span]:flex` ni `justify-between`**.
 *
 * T1.4 (Ola 4): los 8 sitios que usaban el hack `BTN_SPREAD` migrated a
 * `trailing`, y la constante desaparece. Ya no queda ningún selector
 * arbitrario que reach en el DOM interno del kit.
 */

/**
 * Etiqueta CORTA de cada preset de tema.
 *
 * El nombre completo del preset ("Obsidian Graphite · Slate Oscuro", 32
 * caracteres) no cabe en el trigger del selector: con el ancho máximo de
 * 140 px el texto se partía en 2–3 líneas dentro de un trigger de altura
 * FIJA (`h-8`), desbordándose verticalmente y ensanchando el popover de
 * perfil. Aquí sólo se muestra el nombre corto; el nombre completo se
 * conserva en el `title` del trigger para no perder información.
 */
const THEME_SHORT_LABELS: Record<string, string> = {
  "default-dark": "Obsidian",
  "midnight-cyan": "Midnight",
  "emerald-terminal": "Emerald",
  "amber-warm": "Sepia",
};

/** Nombre corto de un preset; si es desconocido, la parte antes del "·". */
function shortThemeLabel(key: string, fullName: string): string {
  const known = THEME_SHORT_LABELS[key];
  if (known) return known;
  const head = fullName.split("·")[0]?.trim();
  return head && head.length > 0 ? head : key;
}

/**
 * El puente `window.ego` tipado (`EgoBridge`) todavía no expone el canal
 * `floating`; se accede con un tipo estructural mínimo en lugar de `any`.
 */
interface FloatingChannel {
  toggleFloating?: () => void;
}

function toggleFloatingCompanion(): void {
  const floating = (window.ego as unknown as { floating?: FloatingChannel }).floating;
  floating?.toggleFloating?.();
}

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
    <div className="flex items-center justify-between px-2 py-1 font-mono text-xs text-dim">
      <span>VantaDB 0.8.0</span>
      <span className="flex items-center gap-1 font-semibold text-success">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
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

  // Design system theme tokens (tolerante cuando se monta standalone en tests)
  let designSystem: ReturnType<typeof useDesignSystem> | null = null;
  try {
    designSystem = useDesignSystem();
  } catch {
    designSystem = null;
  }

  // D12: clave canónica del preset activo + su nombre COMPLETO (para el
  // `title` del selector). El texto VISIBLE del selector es el nombre corto
  // (ver `shortThemeLabel`): el completo no cabe en el trigger.
  const activeThemeKey = resolvePresetKey(designSystem?.tokens?.id ?? "") ?? "default-dark";
  const activeThemeFullName =
    designSystem?.availablePresets?.[activeThemeKey]?.name ?? activeThemeKey;

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

  /**
   * Estado visual de los botones del rail y de las filas de lista.
   * La superficie activa sube a `raised` (tarjeta) con texto `ink`; en
   * reposo el texto es `faint` y el hover revela la misma superficie.
   */
  const activeClass = "bg-raised text-ink";
  const idleClass = "text-faint hover:bg-raised hover:text-ink";

  return (
    <div className="flex h-full w-full select-none overflow-hidden bg-paper">
      {/* =========================================================================
          COLUMNA 1: Icon Rail Fijo (ChatGPT Desktop / Codex / Claude Desktop)
          ========================================================================= */}
      <nav
        aria-label="Icon Rail"
        className="w-14 shrink-0 bg-panel border-r border-hairline flex flex-col items-center py-3 justify-between z-20"
      >
        {/* Parte Superior del Rail */}
        <div className="flex flex-col items-center gap-2">
          {/* Botón para expandir si el segundo sidebar está colapsado */}
          {isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => notifyCollapsed(false)}
              title="Expandir barra lateral (Ctrl+B)"
              aria-label="Expandir barra lateral"
              className={`${idleClass} mb-1`}
            >
              <SidebarSimple size={18} />
            </Button>
          )}

          {/* 1. Inicio / Chat */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onCloseWorkspace?.();
            }}
            title="Inicio / Chat"
            aria-label="Inicio / Chat"
            className={`${!workspaceOpen ? activeClass : idleClass}`}
          >
            <House size={20} />
          </Button>

          {/* 2. Sub-Egos Fábrica */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSelectWorkspaceTab?.("subegos");
            }}
            title="Sub-Egos Fábrica"
            aria-label="Sub-Egos Fábrica"
            className={`${
              workspaceOpen && activeWorkspaceTab === "subegos" ? activeClass : idleClass
            }`}
          >
            <Robot size={20} />
          </Button>

          {/* 3. Tareas e Historial (Workbench) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSelectWorkspaceTab?.("workbench");
            }}
            title="Tareas e Historial (Workbench)"
            aria-label="Tareas e Historial"
            className={`${
              workspaceOpen && activeWorkspaceTab === "workbench" ? activeClass : idleClass
            }`}
          >
            <ClockCounterClockwise size={20} />
          </Button>

          {/* 4. Conocimiento y Memoria (Dominio / GraphRAG) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSelectWorkspaceTab?.("domains");
            }}
            title="Conocimiento y Memoria"
            aria-label="Conocimiento y Memoria"
            className={`${
              workspaceOpen && activeWorkspaceTab === "domains" ? activeClass : idleClass
            }`}
          >
            <Books size={20} />
          </Button>

          {/* 5. Personalización (Skills, MCP y Avatares) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSelectWorkspaceTab?.("personalization");
            }}
            title="Personalización (Skills y Complementos MCP)"
            aria-label="Personalización"
            className={`${
              workspaceOpen && activeWorkspaceTab === "personalization" ? activeClass : idleClass
            }`}
          >
            <PuzzlePiece size={20} />
          </Button>

          {/* 6. Botón ••• (Menú Radix con más herramientas) */}
          <Menu
            ariaLabel="Más vistas y herramientas"
            side="right"
            align="start"
            // `data-[state=open]` lo pone Radix en el trigger: el menú
            // abierto se ve activo sin estado propio en React.
            className="data-[state=open]:bg-raised data-[state=open]:text-ink"
            trigger={
              <Button
                variant="ghost"
                size="icon"
                title="Más vistas y herramientas"
                aria-label="Más vistas y herramientas"
                className={idleClass}
              >
                <DotsThree size={20} weight="bold" />
              </Button>
            }
            items={[
              {
                label: "Proyectos y Dominios",
                icon: <FolderSimple size={16} />,
                onSelect: () => onSelectWorkspaceTab?.("domains"),
              },
              {
                label: "Resumen Diario (Daily State)",
                icon: <ChartBar size={16} />,
                onSelect: () => onSelectWorkspaceTab?.("daily"),
              },
              {
                label: "Revisión de código & Terminal",
                icon: <ClockCounterClockwise size={16} />,
                onSelect: () => onSelectWorkspaceTab?.("workbench"),
              },
              {
                label: "Canvas Dinámico",
                icon: <Sparkle size={16} />,
                onSelect: () => onSelectWorkspaceTab?.("canvas"),
              },
            ]}
          />
        </div>

        {/* Parte Inferior del Rail: Avatar de Usuario + Popover de Perfil */}
        <Popover
          side="right"
          align="end"
          ariaLabel="Perfil de usuario y configuración"
          contentClassName="w-64 p-2.5"
          trigger={
            <Button
              variant="secondary"
              size="icon"
              title="Perfil de Eros · Soberano Local"
              aria-label="Perfil de usuario y configuración"
              className="rounded-full border border-hairline bg-raised font-semibold text-ink hover:bg-panel"
            >
              EN
            </Button>
          }
          content={
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 border-b border-hairline pb-2.5 px-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-raised font-bold text-ink text-xs">
                  EN
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-semibold text-ink leading-tight">Eros Nessy</span>
                  <span className="font-mono text-xs text-faint">Soberano Local · Ego Core</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    onSelectWorkspaceTab?.("daily");
                  }}
                  className="w-full justify-start rounded-[var(--radius-card)] text-ink hover:bg-raised"
                  icon={<ChartBar size={15} className="text-faint" />}
                >
                  <span>Uso y telemetría</span>
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    toggleFloatingCompanion();
                  }}
                  trailing={
                    <kbd className="shrink-0 rounded-md bg-raised px-1 py-0.5 font-mono text-xs text-dim">
                      Alt+Win+P
                    </kbd>
                  }
                  className="w-full rounded-[var(--radius-card)] text-ink hover:bg-raised"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Sparkle size={15} className="shrink-0 text-faint" />
                    <span className="truncate">Mostrar mascota (Isla Flotante)</span>
                  </span>
                </Button>

                {/* Selector rápido de Tema. D12: el nombre visible del preset
                    es CORTO ("Obsidian"); el nombre completo ("Obsidian
                    Graphite · Slate Oscuro", 32 chars) se-partía en varias
                    líneas dentro del trigger de altura fija `h-8` y
                    desbordaba la caja. El `title` conserva el nombre
                    completo para no perder información. */}
                <div className="flex items-center justify-between px-2.5 py-1.5 text-ink">
                  <div className="flex items-center gap-2">
                    <PaintBrush size={15} className="text-faint" />
                    <span>Apariencia</span>
                  </div>
                  <Select
                    ariaLabel="Tema de apariencia"
                    value={activeThemeKey}
                    title={activeThemeFullName}
                    onValueChange={(val) => designSystem?.applyPreset?.(val)}
                    options={
                      designSystem?.availablePresets
                        ? Object.keys(designSystem.availablePresets).map((k) => ({
                            value: k,
                            label: shortThemeLabel(k, designSystem.availablePresets[k]?.name ?? k),
                          }))
                        : [{ value: "default-dark", label: "Obsidian" }]
                    }
                    className="max-w-[140px] text-xs"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setIsSettingsOpen(true);
                  }}
                  trailing={
                    <kbd className="shrink-0 rounded-md bg-raised px-1 py-0.5 font-mono text-xs text-dim">
                      Ctrl+,
                    </kbd>
                  }
                  className="w-full rounded-[var(--radius-card)] text-ink hover:bg-raised"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Gear size={15} className="shrink-0 text-faint" />
                    <span className="truncate">Configuración</span>
                  </span>
                </Button>
              </div>
            </div>
          }
        />
      </nav>

      {/* =========================================================================
          COLUMNA 2: Sidebar Contextual Limpio (Colapsable con Ctrl+B o botón)
          ========================================================================= */}
      {!isCollapsed && (
        <aside
          aria-label="Navegación principal"
          className="w-60 shrink-0 bg-panel border-r border-hairline flex flex-col h-full min-w-0 flex-1 select-none"
        >
          {/* Cabecera Superior: Ego Core ⌄ + Buscador + Colapsar */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-hairline px-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-ink flex items-center gap-1">
                Ego Core
                <CaretDown size={12} className="text-faint" />
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={requestOpenOmnibar}
                title="Buscar en memoria (Ctrl+K)"
                aria-label="Buscar en memoria (Ctrl+K)"
                className={idleClass}
              >
                <MagnifyingGlass size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => notifyCollapsed(true)}
                title="Colapsar panel (Ctrl+B)"
                aria-label="Colapsar panel"
                className={idleClass}
              >
                <SidebarSimple size={15} />
              </Button>
            </div>
          </div>

          {/* Botón Nueva Sesión / Chat Nuevo (Fila limpia estilo ChatGPT) */}
          <div className="p-2.5 pb-1">
            <Button
              variant="secondary"
              size="md"
              onClick={onNewSession}
              title="Nueva conversación (Ctrl+N)"
              className="w-full justify-start rounded-[var(--radius-card)] font-medium"
              icon={<Plus size={14} weight="bold" className="text-faint" />}
            >
              <span>Nueva sesión</span>
            </Button>
          </div>

          {/* Buscador de Recuerdos explícito (para tests y accesibilidad) */}
          <div className="px-2.5 py-1">
            <Button
              variant="secondary"
              size="md"
              onClick={requestOpenOmnibar}
              title="Búsqueda federada (Ctrl+K)"
              trailing={
                <kbd className="shrink-0 rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-xs text-dim">
                  Ctrl+K
                </kbd>
              }
              className="w-full rounded-[var(--radius-card)] font-normal text-faint hover:text-ink"
            >
              <span className="flex min-w-0 items-center gap-2">
                <MagnifyingGlass size={13} className="shrink-0 text-dim" />
                <span className="truncate">Buscar recuerdos (Ctrl+K)</span>
              </span>
            </Button>
          </div>

          {/* Contenedor con Scroll de Proyectos, Sub-Egos y Recientes */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
            {/* 1. SECCIÓN PROYECTOS */}
            <div id="sidebar-section-projects">
              {/* D15: cabecera de sección de ALTURA FIJA (44 px). Antes era
                  `min-h-11` + `pb-1`: con el botón `+` de 44 px dentro, la
                  fila medía 48 px reales y rompía el ritmo de las cabeceras
                  del resto de la app. `h-11` sin `pb-1` la deja en 44 px. */}
                <div className="flex h-11 items-center justify-between px-2 text-xs font-semibold tracking-wider text-dim uppercase">
                  <span>Proyectos</span>
                  {/* T3 (Ola 4): el margen negativo del botón `+` compensa el
                      `px-2` de la cabecera (-8 px) para que su borde derecho
                      caiga en el mismo sitio que el de las filas de abajo
                      (`w-full` sobre el contenido del padre, sin padding).
                      Con `-mr-3` se salía 4 px de la caja de la cabecera: la
                      auditoría de diseño lo reportaba como DESBORDE real
                      (no era un falso positivo del halo `animate-ping`, que sí
                      lo era y ya está filtrado en la medición). */}
                  <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNewProjectModalOpen(true)}
                  title="Crear nuevo proyecto"
                  aria-label="Crear nuevo proyecto"
                  className="-mr-2 text-dim hover:bg-raised hover:text-ink"
                >
                  <Plus size={14} />
                </Button>
              </div>

              <div className="space-y-0.5">
                {projects.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-dim italic">
                    Sin proyectos — crea uno con +.
                  </p>
                )}
                {projects.map((p) => {
                  const isSelected = activeProject === p.id;
                  return (
                    <Button
                      key={p.id}
                      variant="ghost"
                      size="md"
                      onClick={() => void handleSelectProject(p.id)}
                      trailing={
                        isSelected ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        ) : null
                      }
                      className={`w-full rounded-[var(--radius-card)] ${
                        isSelected
                          ? "bg-raised text-ink font-medium"
                          : "text-faint hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {isSelected ? (
                          <FolderSimpleStar size={14} className="shrink-0 text-brand" />
                        ) : (
                          <FolderSimple size={14} className="shrink-0 text-dim" />
                        )}
                        <span className="truncate text-left">{p.name}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* 2. SECCIÓN SUB-EGOS CON CHARACTER BADGE 36PX */}
            <div id="sidebar-section-roster">
              <div className="flex h-11 items-center justify-between px-2 text-xs font-semibold tracking-wider text-dim uppercase">
                <span>Sub-Egos</span>
                <span className="font-mono text-xs text-dim">{roster.length}</span>
              </div>

              <div className="space-y-1">
                {roster.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-dim italic">
                    Sin Sub-Egos registrados.
                  </p>
                )}
                {roster.map((s) => {
                  const isSelected = activeSubEgo === s.id;
                  return (
                    <Button
                      key={s.id}
                      variant="ghost"
                      size="md"
                      onClick={() => onSelectSubEgo(s.id)}
                      trailing={
                        <span
                          title={s.state === "active" ? "Sub-Ego Activo" : "En espera"}
                          // D17: el punto de estado es una SUPERFICIE, no un
                          // borde. `bg-strong` (`--color-strong` = #71717a) es el
                          // token de borde interactivo; para el estado "en
                          // espera" corresponde el token apagado `bg-dim`.
                          className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                            s.state === "active" ? "bg-success" : "bg-dim"
                          }`}
                        />
                      }
                      className={`w-full rounded-[var(--radius-card)] ${
                        isSelected
                          ? "bg-raised text-ink font-medium"
                          : "text-faint hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-paper">
                          <CharacterBadge subEgoId={s.id} size={36} state="idle" />
                        </span>
                        <span className="flex min-w-0 flex-col text-left font-sans">
                          <span className="truncate text-xs font-semibold text-ink">{s.name}</span>
                          <span className="truncate text-xs text-faint">{s.role}</span>
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* 3. SECCIÓN RECIENTES */}
            <div>
              <div className="flex h-11 items-center justify-between px-2 text-xs font-semibold tracking-wider text-dim uppercase">
                <span>Recientes</span>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => useUiStore.getState().openSessionPicker()}
                  title="Historial de sesiones"
                  className="rounded-md px-1.5 font-normal normal-case text-faint hover:bg-raised hover:text-ink"
                >
                  Ver todas
                </Button>
              </div>

              <div className="space-y-0.5">
                {sessions.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-dim italic">
                    Sin sesiones recientes
                  </p>
                ) : (
                  sessions.slice(0, 5).map((session) => {
                    const isCurrent = activeSessionId === session.id;
                    return (
                      <Button
                        key={session.id}
                        variant="ghost"
                        size="md"
                        onClick={() => void handleResumeSession(session.id)}
                        trailing={
                          <span className="shrink-0 font-mono text-xs text-dim">
                            {session.preview}
                          </span>
                        }
                        className={`w-full rounded-[var(--radius-card)] ${
                          isCurrent
                            ? "bg-raised text-ink font-medium"
                            : "text-faint hover:bg-raised hover:text-ink"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <ChatCircle size={13} className="shrink-0 text-dim" />
                          <span className="truncate text-left text-xs">{session.title}</span>
                        </span>
                      </Button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. HERRAMIENTAS Y MCP */}
            <div>
              <div className="flex h-11 items-center px-2 text-xs font-semibold tracking-wider text-dim uppercase">
                <span>Herramientas</span>
              </div>
              <div className="space-y-0.5">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsMcpOpen(true)}
                  className="w-full justify-start rounded-[var(--radius-card)] text-faint hover:bg-raised hover:text-ink"
                  icon={<PlugsConnected size={14} className="text-dim" />}
                >
                  <span>MCP Servers & Tools</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Footer del Contextual Sidebar */}
          <div className="border-t border-hairline bg-paper p-2 space-y-1">
            <VantaDbBadge />
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsSettingsOpen(true)}
              trailing={
                <span className="shrink-0 font-mono text-xs text-dim">Ctrl+,</span>
              }
              className="w-full rounded-[var(--radius-card)] text-faint hover:bg-raised hover:text-ink"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Gear size={15} className="shrink-0 text-dim" />
                <span>Configuración</span>
              </span>
            </Button>
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
