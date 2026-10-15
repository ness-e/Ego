import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { TerminalWindow, Palette } from "@phosphor-icons/react";
import { EgoChat } from "../components/ego-chat";
import { Omnibar } from "../components/omnibar";
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
      <Palette size={13} className="text-dim" />
      <select
        value={selectedKey}
        onChange={(e) => applyPreset(e.target.value)}
        aria-label="Tema de diseño"
        className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-mono text-ink border border-hairline focus:outline-none cursor-pointer"
        title="Ego Generative Design System — Tokens"
      >
        {presetKeys.map((k) => (
          <option key={k} value={k}>
            {availablePresets[k]?.name ?? k}
          </option>
        ))}
      </select>
    </div>
  );
}

export function App() {
  const [activeProject, setActiveProject] = useState("default");
  const [activeSubEgo, setActiveSubEgo] = useState("ego.nucleus");
  const [activeDomainId, setActiveDomainId] = useState("engineering");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"daily" | "domains" | "canvas" | "workbench" | "subegos">("daily");
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
    void ego()
      .domains?.switch?.(d)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // A4: Ctrl+I conmuta el inspector derecho (sin robar Ctrl+B/Ctrl+N).
    const onKeyDown = (e: KeyboardEvent) => {
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
        {/* 1. System Chrome Header con Ego Activity Widget Integrado */}
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-hairline bg-panel px-4 app-region-drag">
          {/* Identidad de la App */}
          <div className="flex items-center gap-2 app-region-no-drag">
            <div className="h-4 w-4 rounded-full bg-ink flex items-center justify-center">
              <span className="font-mono text-[9px] font-bold text-paper">E</span>
            </div>
            <span className="text-xs font-semibold tracking-tight">Ego</span>
            <span className="text-[11px] text-faint">· Cognitive OS</span>
          </div>

          {/* Ego Activity Widget (Superficie Canónica de Telemetría y HITL) */}
          <ActivityWidget />

          {/* Indicadores Auxiliares */}
          <div className="flex items-center gap-3 text-xs text-faint app-region-no-drag">
            {/* T06: ModelPicker montado en el header (proveedor real vía settings). */}
            <button
              type="button"
              onClick={() => useUiStore.getState().openModelPicker()}
              title="Selector de modelo (Model Router)"
              className="flex max-w-[220px] items-center gap-1.5 rounded border border-hairline bg-raised px-2 py-0.5 font-mono text-[10px] text-dim transition-colors hover:text-ink"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="truncate">{activeModelName}</span>
            </button>
            <span className="font-mono text-[10px] text-dim">Local-First · NativeVantaDB</span>
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
          <section aria-label="Chat" className="flex flex-1 flex-col min-w-[380px] max-w-[550px] bg-paper">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-3 text-xs text-faint">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink text-xs">Chat</span>
                <SubEgoSelector
                  activeSubEgoId={activeSubEgo}
                  onSelectSubEgo={(id) => setActiveSubEgo(id)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-dim font-mono">River</span>
                {/* Selector de modelo en el chat (estilo claude/codex): escribe
                    settings.modelName y el router lo honra (T02-dynamic). Incluye
                    el activo aunque sea un ID personalizado fuera del catálogo. */}
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
                  className="max-w-[170px] truncate rounded border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[10px] text-dim hover:text-ink focus:border-ink/50 focus:outline-none"
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
          <section aria-label="Área de trabajo dinámica" className="flex flex-1 flex-col min-w-0 bg-panel">
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline px-4 text-xs text-faint">
              <div className="flex items-center gap-2">
                <TerminalWindow size={14} />
                <span className="font-medium text-ink">Dynamic Workspace</span>
                <span className="text-hairline">|</span>
                <DomainSelector
                  domains={CANONICAL_DOMAINS}
                  activeDomainId={activeDomainId}
                  onSelectDomain={handleSelectDomain}
                />
              </div>
              <div className="flex items-center gap-3">
                <ThemeControl />
                <button
                  type="button"
                  onClick={() => setInspectorCollapsed((prev) => !prev)}
                  title="Conmutar inspector (Ctrl+I)"
                  aria-expanded={!inspectorCollapsed}
                  aria-label="Conmutar inspector"
                  className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                    !inspectorCollapsed
                      ? "bg-raised text-ink font-semibold border border-hairline"
                      : "text-dim hover:text-ink"
                  }`}
                >
                  Inspector
                </button>
                <div className="flex items-center gap-1 border-l border-hairline pl-2">
                  <button
                    onClick={() => setActiveWorkspaceTab("daily")}
                    className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                      activeWorkspaceTab === "daily"
                        ? "bg-raised text-ink font-semibold border border-hairline"
                        : "text-dim hover:text-ink"
                    }`}
                  >
                    Daily State
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab("domains")}
                    className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                      activeWorkspaceTab === "domains"
                        ? "bg-raised text-ink font-semibold border border-hairline"
                        : "text-dim hover:text-ink"
                    }`}
                  >
                    Dominio
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab("canvas")}
                    className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                      activeWorkspaceTab === "canvas"
                        ? "bg-raised text-ink font-semibold border border-hairline"
                        : "text-dim hover:text-ink"
                    }`}
                  >
                    Canvas
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab("workbench")}
                    className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                      activeWorkspaceTab === "workbench"
                        ? "bg-raised text-ink font-semibold border border-hairline"
                        : "text-dim hover:text-ink"
                    }`}
                  >
                    Workbench
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab("subegos")}
                    className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                      activeWorkspaceTab === "subegos"
                        ? "bg-raised text-ink font-semibold border border-hairline"
                        : "text-dim hover:text-ink"
                    }`}
                  >
                    Sub-Egos Fábrica
                  </button>
                </div>
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
              defecto). Superficie de detalle del hilo activo: sesión, proyecto
              y Sub-Ego sin lógica de negocio (solo presentación). */}
          <SplitPane
            id="app-inspector"
            side="right"
            defaultWidth={300}
            minWidth={240}
            maxWidth={480}
            isCollapsed={inspectorCollapsed}
          >
            <aside className="flex h-full flex-col bg-panel" aria-label="Inspector">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline px-3 text-xs">
                <span className="font-medium text-ink">Inspector</span>
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
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-[11px] text-faint">
                <div className="rounded border border-hairline bg-paper p-2">
                  <p className="font-semibold text-ink">Sesión activa</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-dim">
                    {activeSessionId ?? "Sin sesión"}
                  </p>
                </div>
                <div className="rounded border border-hairline bg-paper p-2">
                  <p className="font-semibold text-ink">Proyecto</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-dim">{activeProject}</p>
                </div>
                <div className="rounded border border-hairline bg-paper p-2">
                  <p className="font-semibold text-ink">Sub-Ego</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-dim">{activeSubEgo}</p>
                </div>
                <div className="rounded border border-hairline bg-paper p-2">
                  <p className="font-semibold text-ink">Modelo</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-dim">{activeModelName}</p>
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
