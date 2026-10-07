import { useState, useEffect } from "react";
import {
  SidebarSimple,
  Plus,
  MagnifyingGlass,
  FolderSimple,
  FolderSimpleStar,
  Users,
  ChatCircle,
  Shapes,
  PlugsConnected,
  Gear,
  HardDrive,
  Sparkle,
  Terminal,
  X,
  CheckCircle,
} from "@phosphor-icons/react";

export interface ProjectScopeItem {
  id: string;
  name: string;
  badge?: string;
}

export interface SubEgoRosterItem {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: "active" | "idle";
}

export interface SessionHistoryItem {
  id: string;
  title: string;
  timestamp: string;
  projectId: string;
}

interface SidebarProps {
  activeProject: string;
  onSelectProject: (projectId: string) => void;
  activeSubEgo: string;
  onSelectSubEgo: (subEgoId: string) => void;
  onNewSession: () => void;
}

export function Sidebar({
  activeProject,
  onSelectProject,
  activeSubEgo,
  onSelectSubEgo,
  onNewSession,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"models" | "memory" | "gov">("models");

  // Atajo de teclado universal Ctrl+B para colapsar y Ctrl+N para nueva sesión
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewSession();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewSession]);

  const projects: ProjectScopeItem[] = [
    { id: "default", name: "Ego Core", badge: "Activo" },
    { id: "vantadb", name: "VantaDB Engine" },
  ];

  const subEgos: SubEgoRosterItem[] = [
    {
      id: "ego.nucleus",
      name: "Ego Núcleo",
      role: "Orquestador General",
      avatarColor: "bg-ink text-paper",
      status: "active",
    },
    {
      id: "ego.dev",
      name: "Sub-Ego Dev",
      role: "Ingeniería & Código",
      avatarColor: "bg-blue-600 text-white",
      status: "idle",
    },
    {
      id: "ego.product",
      name: "Sub-Ego Producto",
      role: "Specs, PRDs & Roadmap",
      avatarColor: "bg-amber-600 text-white",
      status: "idle",
    },
    {
      id: "ego.marketing",
      name: "Sub-Ego Marketing",
      role: "Estrategia & Contenido",
      avatarColor: "bg-purple-600 text-white",
      status: "idle",
    },
  ];

  const sessions: SessionHistoryItem[] = [
    {
      id: "s_arch",
      title: "Arquitectura del Sistema Operativo Cognitivo",
      timestamp: "Hoy",
      projectId: "default",
    },
    {
      id: "s_vdb",
      title: "Inicialización de Persistencia VantaDB L0-L3",
      timestamp: "Hoy",
      projectId: "default",
    },
    {
      id: "s_tools",
      title: "Diseño de conectores Nivel A y MCP",
      timestamp: "Ayer",
      projectId: "default",
    },
  ];

  // 1. MODO COLAPSADO (Navigation Rail compacto de 54px)
  if (isCollapsed) {
    return (
      <aside className="flex h-full w-[54px] shrink-0 flex-col items-center justify-between border-r border-hairline bg-panel py-3 select-none">
        {/* Superior: Toggle y Nuevo */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setIsCollapsed(false)}
            title="Expandir barra lateral (Ctrl+B)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <SidebarSimple size={18} />
          </button>

          <button
            onClick={onNewSession}
            title="Nueva sesión (Ctrl+N)"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-paper hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} weight="bold" />
          </button>

          <div className="h-px w-6 bg-hairline my-1" />

          {/* Iconos de acceso directo */}
          <button
            onClick={() => setIsCollapsed(false)}
            title="Proyectos de Memoria"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <FolderSimple size={18} />
          </button>

          <button
            onClick={() => setIsCollapsed(false)}
            title="Roster de Sub-Egos"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors relative"
          >
            <Users size={18} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </button>

          <button
            onClick={() => setIsCollapsed(false)}
            title="Historial de Sesiones"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <ChatCircle size={18} />
          </button>

          <button
            onClick={() => setIsCollapsed(false)}
            title="Artifacts del Canvas"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <Shapes size={18} />
          </button>

          <button
            onClick={() => setIsCollapsed(false)}
            title="Servidores MCP & Tools"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <PlugsConnected size={18} />
          </button>
        </div>

        {/* Inferior: Configuración y Estado */}
        <div className="flex flex-col items-center gap-3">
          <div
            title="VantaDB persistente activo"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
          >
            <HardDrive size={13} />
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Configuración de Ego"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <Gear size={18} />
          </button>

          <div
            title="Eros Nessy (Owner)"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-raised text-ink text-[11px] font-bold border border-hairline"
          >
            EN
          </div>
        </div>
      </aside>
    );
  }

  // 2. MODO EXPANDIDO (Sidebar Completo de 260px)
  return (
    <>
      <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-hairline bg-panel select-none">
        {/* Cabecera del Sidebar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-ink text-paper font-mono text-[10px] font-bold">
              E
            </div>
            <span className="text-xs font-semibold tracking-tight text-ink">Ego Navigation</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onNewSession}
              title="Nueva conversación (Ctrl+N)"
              className="flex h-7 items-center gap-1 rounded bg-raised hover:bg-raised/80 px-2 text-[11px] font-medium text-ink border border-hairline transition-colors"
            >
              <Plus size={13} weight="bold" />
              <span>Nuevo</span>
            </button>

            <button
              onClick={() => setIsCollapsed(true)}
              title="Colapsar barra lateral (Ctrl+B)"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-raised hover:text-ink transition-colors"
            >
              <SidebarSimple size={16} />
            </button>
          </div>
        </div>

        {/* Buscador Rápido de Memoria */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5 text-xs text-faint focus-within:border-ink/40 transition-colors">
            <MagnifyingGlass size={14} className="text-dim" />
            <input
              type="text"
              placeholder="Buscar recuerdos (Ctrl+K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-ink placeholder:text-dim focus:outline-none"
            />
          </div>
        </div>

        {/* Cuerpo del Sidebar con Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-4">
          {/* Bloque 1: Proyectos de Memoria */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Proyectos (Memory Scope)</span>
              <button title="Crear nuevo proyecto" className="hover:text-ink">
                <Plus size={12} />
              </button>
            </div>
            <div className="space-y-0.5">
              {projects.map((p) => {
                const isSelected = activeProject === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-raised text-ink font-medium border border-hairline"
                        : "text-faint hover:bg-raised/60 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isSelected ? (
                        <FolderSimpleStar size={14} className="text-amber-400 shrink-0" />
                      ) : (
                        <FolderSimple size={14} className="text-dim shrink-0" />
                      )}
                      <span className="truncate">{p.name}</span>
                    </div>
                    {p.badge && (
                      <span className="rounded bg-emerald-950/80 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 border border-emerald-800/40">
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 2: Roster de Sub-Egos */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Sub-Egos Especialistas</span>
              <span className="text-[10px] font-mono text-faint">{subEgos.length}</span>
            </div>
            <div className="space-y-0.5">
              {subEgos.map((ego) => {
                const isSelected = activeSubEgo === ego.id;
                return (
                  <button
                    key={ego.id}
                    onClick={() => onSelectSubEgo(ego.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-raised text-ink font-medium border border-hairline"
                        : "text-faint hover:bg-raised/60 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${ego.avatarColor}`}
                      >
                        {ego.name.charAt(ego.name.startsWith("Sub-Ego") ? 8 : 0)}
                      </div>
                      <div className="flex flex-col text-left truncate">
                        <span className="truncate text-xs leading-none">{ego.name}</span>
                        <span className="text-[10px] text-dim truncate">{ego.role}</span>
                      </div>
                    </div>
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        ego.status === "active" ? "bg-emerald-500" : "bg-dim"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 3: Historial de Sesiones */}
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Sesiones Recientes</span>
            </div>
            <div className="space-y-0.5">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-faint hover:bg-raised/60 hover:text-ink transition-colors text-left"
                >
                  <div className="flex items-center gap-2 truncate">
                    <ChatCircle size={13} className="text-dim shrink-0" />
                    <span className="truncate text-xs">{s.title}</span>
                  </div>
                  <span className="text-[10px] text-dim shrink-0 ml-1">{s.timestamp}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bloque 4: Superficies del Canvas & Herramientas */}
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-dim uppercase">
              <span>Espacio & Herramientas</span>
            </div>
            <div className="space-y-0.5 text-xs text-faint">
              <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-raised/60 hover:text-ink transition-colors">
                <Shapes size={14} className="text-dim" />
                <span>Artifacts del Canvas</span>
              </button>
              <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-raised/60 hover:text-ink transition-colors">
                <PlugsConnected size={14} className="text-dim" />
                <span>MCP Servers & Tools</span>
              </button>
              <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-raised/60 hover:text-ink transition-colors">
                <Terminal size={14} className="text-dim" />
                <span>Conectores Nivel A (Git/FS)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pie del Sidebar: Configuración y Usuario */}
        <div className="border-t border-hairline p-2 bg-paper/60 space-y-1">
          <div className="flex items-center justify-between px-2 py-1 text-[10px] text-dim font-mono">
            <span>VantaDB 0.8.0</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LSM WAL
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gear size={15} />
              <span>Configuración</span>
            </div>
            <span className="font-mono text-[10px] text-dim">Ctrl+,</span>
          </button>

          <div className="flex items-center justify-between rounded px-2 py-1.5 text-xs border border-hairline/60 bg-raised/40">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper text-[10px] font-bold">
                EN
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-ink leading-none">Eros Nessy</span>
                <span className="text-[10px] text-dim">Local Sovereign Owner</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal de Configuración del Sistema */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
          <div className="flex h-[480px] w-[620px] flex-col rounded-lg border border-hairline bg-panel text-ink shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-hairline px-4 bg-paper">
              <div className="flex items-center gap-2">
                <Gear size={16} />
                <span className="text-xs font-semibold">Configuración de Ego</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-faint hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pestañas de Ajustes */}
            <div className="flex flex-1 min-h-0">
              <div className="w-40 border-r border-hairline bg-paper/40 p-2 space-y-1">
                <button
                  onClick={() => setActiveSettingsTab("models")}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors ${
                    activeSettingsTab === "models"
                      ? "bg-raised text-ink font-medium"
                      : "text-faint hover:bg-raised/50"
                  }`}
                >
                  <Sparkle size={14} />
                  <span>Model Router</span>
                </button>
                <button
                  onClick={() => setActiveSettingsTab("memory")}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors ${
                    activeSettingsTab === "memory"
                      ? "bg-raised text-ink font-medium"
                      : "text-faint hover:bg-raised/50"
                  }`}
                >
                  <HardDrive size={14} />
                  <span>VantaDB Motor</span>
                </button>
                <button
                  onClick={() => setActiveSettingsTab("gov")}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors ${
                    activeSettingsTab === "gov"
                      ? "bg-raised text-ink font-medium"
                      : "text-faint hover:bg-raised/50"
                  }`}
                >
                  <CheckCircle size={14} />
                  <span>Gobernanza HITL</span>
                </button>
              </div>

              {/* Contenido de la Pestaña */}
              <div className="flex-1 p-4 overflow-y-auto text-xs space-y-3">
                {activeSettingsTab === "models" && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-ink text-sm">Enrutamiento de Modelos (AI SDK v7)</h3>
                    <p className="text-faint leading-relaxed">
                      Ego utiliza un Model Router heurístico desacoplado. Soporta ejecución offline local
                      mediante Ollama (`http://localhost:11434`) o endpoints compatibles con OpenAI / DeepSeek.
                    </p>
                    <div className="rounded border border-hairline bg-paper p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">Proveedor Activo</span>
                        <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-400 font-mono">
                          Mock Determinista (P0-Alpha)
                        </span>
                      </div>
                      <p className="text-[11px] text-dim">
                        Sin consumo de tokens externos en pruebas locales. Respuestas automáticas de verificación.
                      </p>
                    </div>
                  </div>
                )}

                {activeSettingsTab === "memory" && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-ink text-sm">Almacenamiento Local VantaDB</h3>
                    <p className="text-faint leading-relaxed">
                      Persistencia real mediante binding nativo de Rust (`NativeVantaDB`, Fjall LSM con WAL y fsync).
                    </p>
                    <div className="rounded border border-hairline bg-paper p-3 space-y-1.5 font-mono text-[11px]">
                      <div className="text-dim">Ruta en Disco:</div>
                      <div className="text-ink truncate bg-raised p-1.5 rounded">
                        %APPDATA%\Ego\ego_memory.vdb
                      </div>
                      <div className="text-dim pt-2">Namespaces Activos:</div>
                      <div className="text-emerald-400">
                        gov/audit, gov/sub_egos, session/turns, kb/docs
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === "gov" && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-ink text-sm">Políticas de Aprobación Humana (HITL)</h3>
                    <p className="text-faint leading-relaxed">
                      Principio 6: Ninguna acción sensible (escritura en disco, git push, shell exec) se
                      ejecuta sin confirmación explícita.
                    </p>
                    <div className="rounded border border-hairline bg-paper p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Aprobación de Comandos de Shell</span>
                        <span className="text-emerald-400 font-medium">Requerida</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Límite de Tokens por Llamada</span>
                        <span className="font-mono text-dim">4,000 tokens</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex h-11 shrink-0 items-center justify-end border-t border-hairline px-4 bg-paper">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="rounded bg-ink px-3 py-1 text-xs font-semibold text-paper hover:opacity-90 transition-opacity"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
