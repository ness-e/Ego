import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { TerminalWindow, MagnifyingGlass, SidebarSimple } from "@phosphor-icons/react";
import { EgoChat } from "../components/ego-chat";
import { Omnibar, requestOpenOmnibar } from "../components/omnibar";
import { DesignSystemProvider, useDesignSystem } from "../components/canvas/DesignSystemProvider";
import { Sidebar } from "../components/sidebar";
import { SubEgoSelector } from "../components/SubEgoSelector";
import { ModelPicker, CANONICAL_MODELS, type ModelOption } from "../components/ModelPicker";
import { SplitPane } from "../components/PaneShell";
import { useUiStore, mintSessionId, loadPersistedSessionId } from "../components/ui-kit/store.js";
import { ego } from "../lib/ego";
import { ActivityWidget } from "../components/activity-widget/ActivityWidget";
import { ActivityTray } from "../components/activity-tray/ActivityTray";
import { DomainSelector, type DomainMeta } from "../components/domains/DomainSelector";
import { getSharedCanvasBridge } from "../hooks/useCanvasBridge.js";

// STAB-09: code-splitting por vista del workspace. Los paneles pesados
// (Canvas/Daily/SubEgos/Domains) cargan bajo demanda; el shell + chat +
// workbench quedan en el chunk inicial. Los chunks `vendor-*` de
// `manualChunks` no se tocan (solo particionan `node_modules`).
const CanvasRuntime = lazy(() =>
  import("../components/canvas/CanvasRuntime").then((m) => ({ default: m.CanvasRuntime }))
);
const SubEgosView = lazy(() =>
  import("../components/sub-egos").then((m) => ({ default: m.SubEgosView }))
);
const DailyDashboard = lazy(() =>
  import("../components/daily-state").then((m) => ({ default: m.DailyDashboard }))
);
const DomainCanvasView = lazy(() =>
  import("../components/domains/DomainCanvasView").then((m) => ({
    default: m.DomainCanvasView,
  }))
);
// STAB-09 nota de alcance: el contrato nombra 4 paneles; WorkbenchView (5º
// tab del mismo workspace) se incluye con el mismo patrón porque el entry
// superaba el budget DIST-03 de 1MB por 0.15% con solo 4 lazy.
const WorkbenchView = lazy(() =>
  import("../components/canvas/WorkbenchView.js").then((m) => ({
    default: m.WorkbenchView,
  }))
);

/** Skeleton de carga de un panel del workspace (Suspense fallback). */
function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Cargando ${label}`}
      className="animate-pulse space-y-3 p-2"
    >
      <div className="h-4 w-1/3 rounded bg-raised" />
      <div className="h-24 rounded border border-hairline bg-panel" />
      <div className="h-16 rounded border border-hairline bg-panel" />
    </div>
  );
}

const CANONICAL_DOMAINS: DomainMeta[] = [
  { id: "engineering", name: "Engineering", description: "Árbol de código, Git worktrees e inspección", icon: "code", defaultSubEgoId: "ego.dev" },
  { id: "product", name: "Product", description: "Backlog, épicas, roadmap y PRDs", icon: "kanban", defaultSubEgoId: "ego.product" },
  { id: "knowledge", name: "Knowledge", description: "GraphRAG, búsqueda híbrida y síntesis", icon: "book-open", defaultSubEgoId: "ego.researcher" },
  { id: "analytics", name: "Analytics", description: "Telemetría, consumo de tokens y métricas", icon: "bar-chart", defaultSubEgoId: "ego.analyst" },
  { id: "crm", name: "CRM & Sales", description: "Pipeline de ventas, contactos y deals", icon: "users", defaultSubEgoId: "ego.crm" },
];

function ThemeControl() {
  const { tokens, applyPreset, availablePresets } = useDesignSystem();
  // T05: el select trabaja con CLAVES de preset; el value anterior
  // (tokens.id, p.ej. "theme-default-dark") no matcheaba ninguna option y
  // los presets no conmutaban desde la UI.
  const presetKeys = Object.keys(availablePresets);
  const selectedKey =
    presetKeys.find((k) => availablePresets[k]?.id === tokens.id) ?? "default-dark";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="relative flex items-center">
        <select
          value={selectedKey}
          onChange={(e) => applyPreset(e.target.value)}
          aria-label="Tema de diseño"
          className="ego-pill-select font-mono text-[11px] max-w-[155px] truncate"
          title="Ego Generative Design System — Tokens"
        >
          {presetKeys.map((k) => (
            <option key={k} value={k}>
              {availablePresets[k]?.name ?? k}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function App() {
  const [activeProject, setActiveProject] = useState("default");
  const [activeSubEgo, setActiveSubEgo] = useState("ego.nucleus");
  const [activeDomainId, setActiveDomainId] = useState("engineering");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"daily" | "domains" | "canvas" | "workbench" | "subegos">("daily");
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(true);
  const [sessionNonce, setSessionNonce] = useState(0);
  // T06: el SplitPane dimensiona el sidebar; el colapso lo notifica Sidebar.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // A4: inspector derecho colapsado por defecto (SplitPane reutilizado,
  // sin tocar PaneShell). Toggle en la workspace bar + Ctrl+I.
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const modelPickerOpen = useUiStore((s) => s.modelPickerOpen);
  const activeModelId = useUiStore((s) => s.activeModelId);
  // T18: la sesión activa vive en el store (la fija el resume del Sidebar);
  // EgoChat la hidrata vía `sessions.get` al cambiar.
  const activeSessionId = useUiStore((s) => s.activeSessionId);
  const activeModelName =
    CANONICAL_MODELS.find((m) => m.id === activeModelId)?.name ?? activeModelId;

  const handleSelectModel = async (model: ModelOption) => {
    useUiStore.getState().setActiveModelId(model.id);
    // T06: persiste solo modelName (el provider lo gobierna BYOK/settings,
    // Task 8). El ModelRouter real vive en main y lee esta config.
    try {
      const cfg = await ego().settings.getModelConfig();
      await ego().settings.saveModelConfig({ ...cfg, modelName: model.id });
    } catch {
      // sin bridge: el store local conserva la selección
    }
  };

  useEffect(() => {
    // T06: restaura el modelo persistido si matchea el catálogo canónico.
    ego()
      .settings.getModelConfig()
      .then((cfg) => {
        if (cfg?.modelName && CANONICAL_MODELS.some((m) => m.id === cfg.modelName)) {
          useUiStore.getState().setActiveModelId(cfg.modelName);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // T14: restore del proyecto activo + sincronía del dominio con el backend
    // (puentes T13). Sin bridge o ante error: se conservan los defaults locales.
    let cancelled = false;
    ego()
      .projects.getActive()
      .then((p) => {
        if (!cancelled && p && typeof (p as { id?: unknown }).id === "string") {
          setActiveProject((p as { id: string }).id);
        }
      })
      .catch(() => {});
    void ego()
      .domains?.switch?.("engineering")
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Apertura automática del Workspace cuando llega un evento del CanvasBridge
  useEffect(() => {
    const bridge = getSharedCanvasBridge();
    const unsub = bridge.on("*", () => {
      setWorkspaceOpen(true);
    });
    return () => {
      unsub();
    };
  }, []);

  const handleSelectProject = useCallback((p: string) => {
    // T14: persistir el cambio (Sidebar también lo persiste; doble llamada inocua).
    setActiveProject(p);
    void ego()
      .projects.select(p)
      .catch(() => {});
  }, []);

  const handleSelectDomain = useCallback((d: string) => {
    // T14: DomainSelector → `ego().domains.switch(d)` (puente T13).
    setActiveDomainId(d);
    setActiveWorkspaceTab("domains");
    setWorkspaceOpen(true);
    void ego()
      .domains?.switch?.(d)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Atajos de teclado: Ctrl+I (inspector) y Ctrl+\ (conmutar Workspace)
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setWorkspaceOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInspectorCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    // Al abrir Ego: si es el primer inicio del día, abrir en Daily State (COUC-06).
    // Si no, restaurar última pestaña ("canvas" por defecto).
    const ego = window.ego;
    if (ego?.daily?.isFirstLaunch) {
      ego.daily.isFirstLaunch().then((res) => {
        if (res?.ok && res.isFirstLaunch) {
          setActiveWorkspaceTab("daily");
        } else {
          setActiveWorkspaceTab("canvas");
        }
      }).catch(() => {
        setActiveWorkspaceTab("canvas");
      });
    }
  }, []);

  const handleNewSession = () => {
    // 2026-10-15: hilo nuevo = id fresco (antes null → los turnos caían al
    // bucket del lifecycle y el historial por sesión jamás se acumulaba).
    // El remount por nonce no rehidrata nada: el id aún no tiene turnos.
    useUiStore.getState().setActiveSessionId(mintSessionId());
    setSessionNonce((prev) => prev + 1);
  };

  useEffect(() => {
    // 2026-10-15: continuidad del hilo entre arranques. Si nunca hubo uno,
    // se acuña (todo lo escrito queda namespaced y reanudable desde el picker).
    if (!useUiStore.getState().activeSessionId) {
      useUiStore.getState().setActiveSessionId(loadPersistedSessionId() ?? mintSessionId());
    }
  }, []);

  return (
    <DesignSystemProvider>
      <div className="flex h-screen w-screen flex-col bg-paper text-ink overflow-hidden font-sans select-none">
        {/* 1. System Chrome Header con Ego Activity Widget Integrado + Omnibar Capsule */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-panel/95 backdrop-blur-md px-4 app-region-drag select-none z-10 gap-3">
          {/* Identidad de la App */}
          <div className="flex items-center gap-2.5 app-region-no-drag shrink-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ink shadow-xs">
              <span className="font-mono text-[10px] font-bold text-paper">E</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-semibold tracking-tight text-ink">Ego</span>
                <span className="rounded-full bg-brand/15 border border-brand/30 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-brand">
                  SOC
                </span>
              </div>
              <span className="text-[10px] text-dim leading-none pt-0.5">Cognitive OS</span>
            </div>
          </div>

          {/* Omnibar Launcher Capsule interactivo estilo Raycast/Linear */}
          <div className="flex items-center justify-center app-region-no-drag flex-1 max-w-md px-2">
            <button
              type="button"
              onClick={() => requestOpenOmnibar()}
              aria-label="Abrir Omnibar de búsqueda federada"
              title="Búsqueda federada (Ctrl+K)"
              className="flex w-full max-w-[340px] items-center justify-between rounded-full border border-hairline bg-raised/80 hover:bg-raised px-3 py-1 text-xs text-faint transition-all duration-150 hover:border-strong hover:text-ink shadow-xs cursor-pointer group"
            >
              <div className="flex items-center gap-2 truncate">
                <MagnifyingGlass size={13} className="text-dim group-hover:text-brand transition-colors shrink-0" />
                <span className="truncate text-[11px]">Buscar en memoria, comandos y herramientas...</span>
              </div>
              <kbd className="ml-2 shrink-0 rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-dim border border-hairline/80 shadow-2xs">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Ego Activity Widget + Selector de Modelo Activo + Status */}
          <div className="flex items-center gap-2.5 text-xs text-faint app-region-no-drag shrink-0">
            <ActivityWidget />
            {/* T06: ModelPicker montado en el header (proveedor real vía settings) */}
            <button
              type="button"
              onClick={() => useUiStore.getState().openModelPicker()}
              title="Selector de modelo (Model Router)"
              aria-label="Selector de modelo activo"
              className="flex max-w-[220px] items-center gap-2 rounded-full border border-hairline bg-raised/90 hover:bg-raised px-2.5 py-1 font-mono text-[10px] text-ink transition-all hover:border-strong shadow-xs cursor-pointer"
            >
              <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              <span className="truncate font-medium">{activeModelName}</span>
            </button>

            {/* Botón Isla Flotante Companion */}
            <button
              type="button"
              onClick={() => (window as any).ego?.floating?.toggleFloating?.()}
              title="Mostrar/Ocultar Isla Flotante Companion"
              aria-label="Mostrar u ocultar Isla Flotante"
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised/80 hover:bg-raised px-2.5 py-1 font-sans text-[11px] text-ink transition-all hover:border-strong shadow-xs cursor-pointer"
            >
              <span>🏝️</span>
              <span className="font-medium">Isla</span>
            </button>

            {/* Botón Alternar Workspace */}
            <button
              type="button"
              onClick={() => setWorkspaceOpen((v) => !v)}
              title="Alternar panel de Workspace (Ctrl+\)"
              aria-label="Alternar panel de Workspace"
              aria-expanded={workspaceOpen}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[11px] transition-all shadow-xs cursor-pointer ${
                workspaceOpen
                  ? "border-strong bg-raised text-ink font-semibold"
                  : "border-hairline bg-panel text-dim hover:text-ink hover:bg-raised/70"
              }`}
            >
              <SidebarSimple size={13} className="rotate-180" />
              <span>Workspace</span>
            </button>

            <span className="hidden xl:inline-flex font-mono text-[10px] text-dim pl-1">
              Local-First · NativeVantaDB
            </span>
          </div>
        </header>
        <ModelPicker
          isOpen={modelPickerOpen}
          activeModelId={activeModelId}
          onClose={() => useUiStore.getState().closeModelPicker()}
          onSelectModel={(m) => void handleSelectModel(m)}
        />

        {/* 2. Workspace Dinámico con Sidebar Integrado (Cognitive OS) */}
        <main className="flex flex-1 min-h-0 min-w-0 divide-x divide-hairline">
          {/* Panel 0: Cognitive Navigation Sidebar (Dual Rail & Drawer) */}
          {/* T06: SplitPane real con persistencia (antes solo en tests). El key
              re-ancla el ancho al colapsar/expandir (documentado en T06.md). */}
          <SplitPane
            key={sidebarCollapsed ? "sidebar-rail" : "sidebar-full"}
            id="app-sidebar"
            side="left"
            defaultWidth={sidebarCollapsed ? 54 : 260}
            minWidth={sidebarCollapsed ? 54 : 200}
            maxWidth={420}
          >
            <Sidebar
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              activeSubEgo={activeSubEgo}
              onSelectSubEgo={(e) => setActiveSubEgo(e)}
              onNewSession={handleNewSession}
              onCollapsedChange={setSidebarCollapsed}
            />
          </SplitPane>

          {/* Panel 1: Conversation River (Chat) */}
          <section
            aria-label="Chat"
            className={`flex flex-col bg-paper transition-all duration-200 ${
              workspaceOpen
                ? "w-[46%] min-w-[420px] max-w-[680px]"
                : "flex-1 w-full min-w-0"
            }`}
          >
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-3.5 text-xs text-faint bg-paper">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink text-xs">Chat</span>
                <SubEgoSelector
                  activeSubEgoId={activeSubEgo}
                  onSelectSubEgo={(id) => setActiveSubEgo(id)}
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Selector de modelo en el chat: escribe settings.modelName */}
                <select
                  aria-label="Modelo del chat"
                  title="Modelo del chat (Model Router)"
                  value={
                    CANONICAL_MODELS.some((m) => m.id === activeModelId)
                      ? activeModelId
                      : `custom:${activeModelId}`
                  }
                  onChange={(e) => {
                    const found = CANONICAL_MODELS.find((m) => m.id === e.target.value);
                    // La opción custom es el valor actual: elegirla es no-op.
                    if (found) void handleSelectModel(found);
                  }}
                  className="ego-pill-select font-mono text-[10px] max-w-[140px] truncate text-dim hover:text-ink border border-hairline bg-raised/60 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                >
                  {CANONICAL_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {!CANONICAL_MODELS.some((m) => m.id === activeModelId) && (
                    <option value={`custom:${activeModelId}`}>{activeModelId} (custom)</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <EgoChat key={sessionNonce} projectId={activeProject} subEgoId={activeSubEgo} sessionId={activeSessionId} />
            </div>
          </section>

          {/* Panel 2: Dynamic Canvas (Superficie de Trabajo Interactiva) */}
          <section
            aria-label="Área de trabajo dinámica"
            className={workspaceOpen ? "flex flex-1 flex-col min-w-0 bg-panel" : "hidden"}
          >
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-4 text-xs text-faint gap-2 overflow-x-auto min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <TerminalWindow size={14} className="text-dim" />
                <span className="font-medium text-ink whitespace-nowrap">Dynamic Workspace</span>
                <span className="text-hairline">|</span>
                <DomainSelector
                  domains={CANONICAL_DOMAINS}
                  activeDomainId={activeDomainId}
                  onSelectDomain={handleSelectDomain}
                />
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <ThemeControl />
                <button
                  type="button"
                  onClick={() => setInspectorCollapsed((prev) => !prev)}
                  title="Conmutar inspector (Ctrl+I)"
                  aria-expanded={!inspectorCollapsed}
                  aria-label="Conmutar inspector"
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors cursor-pointer shrink-0 border ${
                    !inspectorCollapsed
                      ? "bg-raised text-ink font-semibold border-strong shadow-xs"
                      : "border-hairline text-dim hover:text-ink hover:bg-raised/60"
                  }`}
                >
                  Inspector
                </button>
                {/* Segmented Control / Pill Bar moderno para pestañas del workspace */}
                <nav
                  aria-label="Navegación de vistas del espacio de trabajo"
                  className="flex items-center p-0.5 rounded-lg bg-raised/80 border border-hairline gap-0.5 shrink-0"
                >
                  <button
                    onClick={() => {
                      setActiveWorkspaceTab("daily");
                      setWorkspaceOpen(true);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                      activeWorkspaceTab === "daily"
                        ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                        : "text-dim hover:text-ink hover:bg-panel/40"
                    }`}
                  >
                    Daily State
                  </button>
                  <button
                    onClick={() => {
                      setActiveWorkspaceTab("domains");
                      setWorkspaceOpen(true);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                      activeWorkspaceTab === "domains"
                        ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                        : "text-dim hover:text-ink hover:bg-panel/40"
                    }`}
                  >
                    Dominio
                  </button>
                  <button
                    onClick={() => {
                      setActiveWorkspaceTab("canvas");
                      setWorkspaceOpen(true);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                      activeWorkspaceTab === "canvas"
                        ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                        : "text-dim hover:text-ink hover:bg-panel/40"
                    }`}
                  >
                    Canvas
                  </button>
                  <button
                    onClick={() => {
                      setActiveWorkspaceTab("workbench");
                      setWorkspaceOpen(true);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                      activeWorkspaceTab === "workbench"
                        ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                        : "text-dim hover:text-ink hover:bg-panel/40"
                    }`}
                  >
                    Workbench
                  </button>
                  <button
                    onClick={() => {
                      setActiveWorkspaceTab("subegos");
                      setWorkspaceOpen(true);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                      activeWorkspaceTab === "subegos"
                        ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                        : "text-dim hover:text-ink hover:bg-panel/40"
                    }`}
                  >
                    Sub-Egos Fábrica
                  </button>
                </nav>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {activeWorkspaceTab === "daily" && (
                <Suspense fallback={<WorkspaceSkeleton label="Daily State" />}>
                  <DailyDashboard onNavigateToCanvas={() => setActiveWorkspaceTab("canvas")} />
                </Suspense>
              )}
              {activeWorkspaceTab === "domains" && (
                <Suspense fallback={<WorkspaceSkeleton label="Dominio" />}>
                  <DomainCanvasView domainId={activeDomainId} />
                </Suspense>
              )}
              {activeWorkspaceTab === "canvas" && (
                <Suspense fallback={<WorkspaceSkeleton label="Canvas" />}>
                  <CanvasRuntime projectId={activeProject} />
                </Suspense>
              )}
              {activeWorkspaceTab === "workbench" && (
                <Suspense fallback={<WorkspaceSkeleton label="Workbench" />}>
                  <WorkbenchView />
                </Suspense>
              )}
              {activeWorkspaceTab === "subegos" && (
                <Suspense fallback={<WorkspaceSkeleton label="Sub-Egos" />}>
                  <SubEgosView />
                </Suspense>
              )}
            </div>
          </section>

          {/* A4: Inspector derecho (SplitPane reutilizado, colapsado por
              defecto). Superficie de detalle del hilo activo con tarjetas volumétricas L2. */}
          <SplitPane
            id="app-inspector"
            side="right"
            defaultWidth={300}
            minWidth={240}
            maxWidth={480}
            isCollapsed={inspectorCollapsed}
          >
            <aside className="flex h-full flex-col bg-panel" aria-label="Inspector">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-3 text-xs">
                <span className="font-semibold text-ink">Inspector</span>
                <button
                  type="button"
                  onClick={() => setInspectorCollapsed(true)}
                  title="Cerrar inspector (Ctrl+I)"
                  aria-label="Cerrar inspector"
                  className="rounded p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-faint transition-colors hover:bg-raised hover:text-ink"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 text-[11px] text-faint">
                <div className="ego-surface-l2 rounded-lg p-2.5">
                  <p className="font-semibold text-ink">Sesión activa</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-dim">
                    {activeSessionId ?? "Sin sesión"}
                  </p>
                </div>
                <div className="ego-surface-l2 rounded-lg p-2.5">
                  <p className="font-semibold text-ink">Proyecto</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-dim">{activeProject}</p>
                </div>
                <div className="ego-surface-l2 rounded-lg p-2.5">
                  <p className="font-semibold text-ink">Sub-Ego</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-dim">{activeSubEgo}</p>
                </div>
                <div className="ego-surface-l2 rounded-lg p-2.5">
                  <p className="font-semibold text-ink">Modelo</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-dim">{activeModelName}</p>
                </div>
              </div>
            </aside>
          </SplitPane>
        </main>

        {/* 3. Bandeja de Actividad en Segundo Plano (Footer) */}
        <ActivityTray />
        {/* T08: omnibar federado global (Ctrl+K / Ctrl+,). */}
        <Omnibar />
      </div>
    </DesignSystemProvider>
  );
}

export default App;
