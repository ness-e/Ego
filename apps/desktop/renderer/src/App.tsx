import { useState, useEffect } from "react";
import { TerminalWindow, Palette } from "@phosphor-icons/react";
import { EgoChat } from "../components/ego-chat";
import { CanvasRuntime } from "../components/canvas/CanvasRuntime";
import { DesignSystemProvider, useDesignSystem } from "../components/canvas/DesignSystemProvider";
import { SubEgosView } from "../components/sub-egos";
import { Sidebar } from "../components/sidebar";
import { SubEgoSelector } from "../components/SubEgoSelector";
import { ActivityWidget } from "../components/activity-widget/ActivityWidget";
import { ActivityTray } from "../components/activity-tray/ActivityTray";
import { DailyDashboard } from "../components/daily-state";
import { DomainSelector, type DomainMeta } from "../components/domains/DomainSelector";
import { DomainCanvasView } from "../components/domains/DomainCanvasView";

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
    presetKeys.find((k) => availablePresets[k].id === tokens.id) ?? "default-dark";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Palette size={13} className="text-dim" />
      <select
        value={selectedKey}
        onChange={(e) => applyPreset(e.target.value)}
        className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-mono text-ink border border-hairline focus:outline-none cursor-pointer"
        title="Ego Generative Design System — Tokens"
      >
        {presetKeys.map((k) => (
          <option key={k} value={k}>
            {availablePresets[k].name}
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
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"daily" | "domains" | "canvas" | "subegos">("daily");
  const [sessionNonce, setSessionNonce] = useState(0);

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
    setSessionNonce((prev) => prev + 1);
  };

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
            <span className="font-mono text-[10px] text-dim">Local-First · NativeVantaDB</span>
          </div>
        </header>

        {/* 2. Workspace Dinámico con Sidebar Integrado (Cognitive OS) */}
        <main className="flex flex-1 min-h-0 min-w-0 divide-x divide-hairline">
          {/* Panel 0: Cognitive Navigation Sidebar (Dual Rail & Drawer) */}
          <Sidebar
            activeProject={activeProject}
            onSelectProject={(p) => setActiveProject(p)}
            activeSubEgo={activeSubEgo}
            onSelectSubEgo={(e) => setActiveSubEgo(e)}
            onNewSession={handleNewSession}
          />

          {/* Panel 1: Conversation River (Chat) */}
          <section className="flex flex-1 flex-col min-w-[380px] max-w-[550px] bg-paper">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-3 text-xs text-faint">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink text-xs">Chat</span>
                <SubEgoSelector
                  activeSubEgoId={activeSubEgo}
                  onSelectSubEgo={(id) => setActiveSubEgo(id)}
                />
              </div>
              <span className="text-[10px] text-dim font-mono">River</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <EgoChat key={sessionNonce} projectId={activeProject} subEgoId={activeSubEgo} />
            </div>
          </section>

          {/* Panel 2: Dynamic Canvas (Superficie de Trabajo Interactiva) */}
          <section className="flex flex-1 flex-col min-w-0 bg-panel">
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline px-4 text-xs text-faint">
              <div className="flex items-center gap-2">
                <TerminalWindow size={14} />
                <span className="font-medium text-ink">Dynamic Workspace</span>
                <span className="text-hairline">|</span>
                <DomainSelector
                  domains={CANONICAL_DOMAINS}
                  activeDomainId={activeDomainId}
                  onSelectDomain={(d) => {
                    setActiveDomainId(d);
                    setActiveWorkspaceTab("domains");
                  }}
                />
              </div>
              <div className="flex items-center gap-3">
                <ThemeControl />
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
                <DailyDashboard onNavigateToCanvas={() => setActiveWorkspaceTab("canvas")} />
              )}
              {activeWorkspaceTab === "domains" && (
                <DomainCanvasView domainId={activeDomainId} />
              )}
              {activeWorkspaceTab === "canvas" && <CanvasRuntime projectId={activeProject} />}
              {activeWorkspaceTab === "subegos" && <SubEgosView />}
            </div>
          </section>
        </main>

        {/* 3. Bandeja de Actividad en Segundo Plano (Footer) */}
        <ActivityTray />
      </div>
    </DesignSystemProvider>
  );
}

export default App;
