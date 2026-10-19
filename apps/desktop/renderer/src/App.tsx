import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { TerminalWindow, SidebarSimple } from "@phosphor-icons/react";
import { EgoChat } from "../components/ego-chat";
import { Omnibar } from "../components/omnibar";
import { DesignSystemProvider, useDesignSystem } from "../components/canvas/DesignSystemProvider";
import { Sidebar } from "../components/sidebar";
import { SubEgoSelector } from "../components/SubEgoSelector";
import { ModelPicker, CANONICAL_MODELS, type ModelOption } from "../components/ModelPicker";
import { SplitPane } from "../components/PaneShell";
import { useUiStore, mintSessionId, loadPersistedSessionId } from "../components/ui-kit/store.js";
import { Select } from "../components/ui-kit/Select.js";
import { ego } from "../lib/ego";
import { ActivityWidget } from "../components/activity-widget/ActivityWidget";
import { ActivityTray } from "../components/activity-tray/ActivityTray";
import { DomainSelector, type DomainMeta } from "../components/domains/DomainSelector";
import { getSharedCanvasBridge } from "../hooks/useCanvasBridge.js";

// STAB-09: code-splitting por vista del workspace.
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
const WorkbenchView = lazy(() =>
  import("../components/canvas/WorkbenchView.js").then((m) => ({
    default: m.WorkbenchView,
  }))
);
const PersonalizationView = lazy(() =>
  import("../components/personalization/PersonalizationView.js").then((m) => ({
    default: m.PersonalizationView,
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
  const presetKeys = Object.keys(availablePresets);
  const selectedKey =
    presetKeys.find((k) => availablePresets[k]?.id === tokens.id) ?? "default-dark";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="relative flex items-center">
        <Select
          value={selectedKey}
          onValueChange={(val) => applyPreset(val)}
          ariaLabel="Tema de diseño"
          title="Ego Generative Design System — Tokens"
          className="ego-pill-select font-mono text-[11px] max-w-[155px] truncate min-h-11 min-w-11"
          options={presetKeys.map((k) => ({
            value: k,
            label: availablePresets[k]?.name ?? k,
          }))}
        />
      </div>
    </div>
  );
}

export function App() {
  const [activeProject, setActiveProject] = useState("default");
  const [activeSubEgo, setActiveSubEgo] = useState("ego.nucleus");
  const [activeDomainId, setActiveDomainId] = useState("engineering");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    "daily" | "domains" | "canvas" | "workbench" | "subegos" | "personalization"
  >("daily");

  // Inicia en false por defecto para una vista de Chat pura y despejada (estilo ChatGPT/Claude Desktop)
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(false);
  const [sessionNonce, setSessionNonce] = useState(0);

  // SplitPane dimensiona el sidebar; el colapso lo notifica Sidebar.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Inspector derecho colapsado por defecto.
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);

  const modelPickerOpen = useUiStore((s) => s.modelPickerOpen);
  const activeModelId = useUiStore((s) => s.activeModelId);
  const activeSessionId = useUiStore((s) => s.activeSessionId);
  const activeModelName =
    CANONICAL_MODELS.find((m) => m.id === activeModelId)?.name ?? activeModelId;

  const handleSelectModel = async (model: ModelOption) => {
    useUiStore.getState().setActiveModelId(model.id);
    try {
      const cfg = await ego().settings.getModelConfig();
      await ego().settings.saveModelConfig({ ...cfg, modelName: model.id });
    } catch {
      // sin bridge: el store local conserva la selección
    }
  };

  useEffect(() => {
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
    setActiveProject(p);
    void ego()
      .projects.select(p)
      .catch(() => {});
  }, []);

  const handleSelectDomain = useCallback((d: string) => {
    setActiveDomainId(d);
    setActiveWorkspaceTab("domains");
    setWorkspaceOpen(true);
    void ego()
      .domains?.switch?.(d)
      .catch(() => {});
  }, []);

  useEffect(() => {
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
    const egoBridge = window.ego;
    if (egoBridge?.daily?.isFirstLaunch) {
      egoBridge.daily
        .isFirstLaunch()
        .then((res) => {
          if (res?.ok && res.isFirstLaunch) {
            setActiveWorkspaceTab("daily");
          } else {
            setActiveWorkspaceTab("canvas");
          }
        })
        .catch(() => {
          setActiveWorkspaceTab("canvas");
        });
    }
  }, []);

  const handleNewSession = () => {
    useUiStore.getState().setActiveSessionId(mintSessionId());
    setSessionNonce((prev) => prev + 1);
  };

  useEffect(() => {
    if (!useUiStore.getState().activeSessionId) {
      useUiStore.getState().setActiveSessionId(loadPersistedSessionId() ?? mintSessionId());
    }
  }, []);

  return (
    <DesignSystemProvider>
      <div className="flex h-screen w-screen flex-col bg-paper text-ink overflow-hidden font-sans select-none">
        {/* =========================================================================
            1. Chrome Superior Minimalista (Estilo ChatGPT / Claude Desktop)
            ========================================================================= */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-panel/95 backdrop-blur-md px-3 app-region-drag select-none z-10 gap-3">
          {/* Identidad de la App + Toggle de Sidebar */}
          <div className="flex items-center gap-2.5 app-region-no-drag shrink-0">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title="Mostrar / Ocultar panel lateral (Ctrl+B)"
              aria-label="Conmutar barra lateral"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-dim hover:text-ink hover:bg-raised/70 transition-colors cursor-pointer"
            >
              <SidebarSimple size={15} />
            </button>

            <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>

          {/* Segmented Pill Toggle Central [ Chat | Work ] */}
          <div className="flex items-center justify-center app-region-no-drag flex-1 max-w-xs mx-auto">
            <div className="flex items-center p-0.5 rounded-full bg-[#202024] border border-white/[0.08] shadow-inner text-xs">
              <button
                type="button"
                onClick={() => setWorkspaceOpen(false)}
                className={`rounded-full px-4 py-1 text-xs font-medium transition-all cursor-pointer ${
                  !workspaceOpen
                    ? "bg-white/10 text-white font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceOpen(true)}
                className={`rounded-full px-4 py-1 text-xs font-medium transition-all cursor-pointer ${
                  workspaceOpen
                    ? "bg-white/10 text-white font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Work
              </button>
            </div>
          </div>

          {/* Lado Derecho: Selector de Modelo Activo + Status + Isla */}
          <div className="flex items-center gap-2 text-xs text-faint app-region-no-drag shrink-0">
            <ActivityWidget />

            {/* Selector de modelo activo (requerido por App.test.tsx) */}
            <button
              type="button"
              onClick={() => useUiStore.getState().openModelPicker()}
              title="Selector de modelo (Model Router)"
              aria-label="Selector de modelo activo"
              className="flex max-w-[200px] min-h-11 min-w-11 items-center gap-2 rounded-full border border-hairline bg-raised/90 hover:bg-raised px-2.5 py-1 font-mono text-[10px] text-ink transition-all hover:border-strong shadow-xs cursor-pointer"
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
              title="Mostrar/Ocultar Isla Flotante Companion (Alt+Win+P)"
              aria-label="Mostrar u ocultar Isla Flotante"
              className="flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border border-hairline bg-raised/80 hover:bg-raised px-2.5 py-1 font-sans text-[11px] text-ink transition-all hover:border-strong shadow-xs cursor-pointer"
            >
              <span>🏝️</span>
              <span className="font-medium hidden sm:inline">Isla</span>
            </button>

            {/* Botón Alternar Workspace */}
            <button
              type="button"
              onClick={() => setWorkspaceOpen((v) => !v)}
              title="Alternar panel de Workspace (Ctrl+\)"
              aria-label="Alternar panel de Workspace"
              aria-expanded={workspaceOpen}
              className={`flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[11px] transition-all shadow-xs cursor-pointer ${
                workspaceOpen
                  ? "border-strong bg-raised text-ink font-semibold"
                  : "border-hairline bg-panel text-dim hover:text-ink hover:bg-raised/70"
              }`}
            >
              <SidebarSimple size={13} className="rotate-180" />
              <span>Workspace</span>
            </button>
          </div>
        </header>

        <ModelPicker
          isOpen={modelPickerOpen}
          activeModelId={activeModelId}
          onClose={() => useUiStore.getState().closeModelPicker()}
          onSelectModel={(m) => void handleSelectModel(m)}
        />

        {/* =========================================================================
            2. Contenedor Principal (Dual-Rail Sidebar + Chat + Dynamic Workspace)
            ========================================================================= */}
        <main className="flex flex-1 min-h-0 min-w-0 divide-x divide-hairline">
          {/* Panel 0: Cognitive Navigation Sidebar (Dual Rail & Drawer) */}
          <SplitPane
            key={sidebarCollapsed ? "sidebar-rail" : "sidebar-full"}
            id="app-sidebar"
            side="left"
            defaultWidth={sidebarCollapsed ? 48 : 288}
            minWidth={sidebarCollapsed ? 48 : 240}
            maxWidth={440}
          >
            <Sidebar
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              activeSubEgo={activeSubEgo}
              onSelectSubEgo={(e) => setActiveSubEgo(e)}
              onNewSession={handleNewSession}
              onCollapsedChange={setSidebarCollapsed}
              activeWorkspaceTab={activeWorkspaceTab}
              onSelectWorkspaceTab={(tab) => {
                setActiveWorkspaceTab(tab);
                setWorkspaceOpen(true);
              }}
              onCloseWorkspace={() => setWorkspaceOpen(false)}
              workspaceOpen={workspaceOpen}
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
                <Select
                  ariaLabel="Modelo del chat"
                  title="Modelo del chat (Model Router)"
                  value={
                    CANONICAL_MODELS.some((m) => m.id === activeModelId)
                      ? activeModelId
                      : `custom:${activeModelId}`
                  }
                  onValueChange={(val) => {
                    const found = CANONICAL_MODELS.find((m) => m.id === val);
                    if (found) void handleSelectModel(found);
                  }}
                  className="ego-pill-select font-mono text-[10px] max-w-[140px] truncate text-dim hover:text-ink min-h-11 min-w-11"
                  options={[
                    ...CANONICAL_MODELS.map((m) => ({
                      value: m.id,
                      label: m.name,
                    })),
                    ...(!CANONICAL_MODELS.some((m) => m.id === activeModelId)
                      ? [{ value: `custom:${activeModelId}`, label: `${activeModelId} (custom)` }]
                      : []),
                  ]}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <EgoChat key={sessionNonce} projectId={activeProject} subEgoId={activeSubEgo} sessionId={activeSessionId} />
            </div>
          </section>

          {/* Panel 2: Dynamic Canvas (Superficie de Trabajo Interactiva)
              Accesible en el DOM para pruebas y screen readers vía sr-only cuando workspaceOpen es false */}
          <section
            aria-label="Área de trabajo dinámica"
            className={
              workspaceOpen
                ? "flex flex-1 flex-col min-w-0 bg-panel transition-all duration-200"
                : "sr-only"
            }
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
                {/* Segmented Control para pestañas del workspace */}
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
                  <button
                    onClick={() => {
                      setActiveWorkspaceTab("personalization");
                      setWorkspaceOpen(true);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                      activeWorkspaceTab === "personalization"
                        ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                        : "text-dim hover:text-ink hover:bg-panel/40"
                    }`}
                  >
                    Personalización
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
              {activeWorkspaceTab === "personalization" && (
                <Suspense fallback={<WorkspaceSkeleton label="Personalización" />}>
                  <PersonalizationView />
                </Suspense>
              )}
            </div>
          </section>

          {/* Inspector derecho (SplitPane) */}
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
        {/* Omnibar federado global (Ctrl+K / Ctrl+,) */}
        <Omnibar />
      </div>
    </DesignSystemProvider>
  );
}

export default App;
