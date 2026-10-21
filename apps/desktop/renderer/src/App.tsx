import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { TerminalWindow, SidebarSimple, Island, X } from "@phosphor-icons/react";
import { EgoChat } from "../components/ego-chat";
import { Omnibar } from "../components/omnibar";
import { DesignSystemProvider } from "../components/canvas/DesignSystemProvider";
import { Sidebar } from "../components/sidebar";
import { SubEgoSelector } from "../components/SubEgoSelector";
import { ModelPicker, CANONICAL_MODELS, type ModelOption } from "../components/ModelPicker";
import { SplitPane } from "../components/PaneShell";
import { useUiStore, mintSessionId, loadPersistedSessionId } from "../components/ui-kit/store.js";
import { Select } from "../components/ui-kit/Select.js";
import { Button } from "../components/ui-kit/Button.js";
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

/**
 * Recorte del VALOR de un `Select` (Radix) aplicado desde el trigger.
 *
 * ## Por qué hace falta
 * `@radix-ui/react-select` 2.3.8 **descarta el `className`** que se le pasa a
 * `Select.Value`: lo desestructura y no lo reinyecta en el `<span>` que
 * renderiza (`style: { pointerEvents: "none" }` y poco más). Consecuencia
 * medida: el texto largo del trigger se ENVUELVE en varias líneas dentro de
 * una caja de 44 px y pisa la fila superior (`scrollHeight` 45 > `clientHeight`
 * 42 con "Obsidian Graphite · Slate Oscuro").
 *
 * El kit (`components/ui-kit/Select.tsx`) es de propiedad compartida y no se
 * modifica desde aquí, así que el recorte se aplica desde el propio
 * consumidor: el `<span>` del valor es el ÚNICO `<span>` hijo del trigger (el
 * caret es un `<svg>`), de modo que `[&>span]:truncate` lo alcanza sin
 * ambigüedad. `truncate` = `overflow:hidden` + `text-overflow:ellipsis` +
 * `white-space:nowrap` → una sola línea con elipsis.
 */
const SELECT_VALUE_TRUNCATE = "[&>span]:min-w-0 [&>span]:truncate";

/** Pestañas del Dynamic Workspace (unificadas como control segmentado). */
type WorkspaceTab =
  | "daily"
  | "domains"
  | "canvas"
  | "workbench"
  | "subegos"
  | "personalization";

const WORKSPACE_TABS: ReadonlyArray<{ id: WorkspaceTab; label: string }> = [
  { id: "daily", label: "Daily State" },
  { id: "domains", label: "Dominio" },
  { id: "canvas", label: "Canvas" },
  { id: "workbench", label: "Workbench" },
  { id: "subegos", label: "Sub-Egos Fábrica" },
  { id: "personalization", label: "Personalización" },
];

/**
 * El puente `window.ego` tipado (`EgoBridge`) todavía no expone el canal
 * `floating`; se accede con un tipo estructural mínimo en lugar de `any`
 * (la regla del repo prohíbe `any`).
 */
interface FloatingChannel {
  toggleFloating?: () => void;
}

function toggleFloatingCompanion(): void {
  const floating = (window.ego as unknown as { floating?: FloatingChannel }).floating;
  floating?.toggleFloating?.();
}

/** Skeleton de carga de un panel del workspace (Suspense fallback). */
function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Cargando ${label}`}
      className="animate-pulse space-y-3 p-2"
    >
      <div className="h-4 w-1/3 rounded-[var(--radius-card)] bg-raised" />
      <div className="h-24 rounded-[var(--radius-card)] border border-hairline bg-panel" />
      <div className="h-16 rounded-[var(--radius-card)] border border-hairline bg-panel" />
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

/**
 * D1 — El selector de tema **NO** vive en la cabecera del Workspace.
 *
 * ## Por qué se eliminó de aquí
 * En la cabecera del Workspace el grupo de la derecha (selector de tema +
 * Inspector + navegación) medía 788 px dentro de un panel de 663 px: las 6
 * pestañas quedaban 456 px FUERA del viewport y sólo se veía "Daily State".
 *
 * El selector de tema ya está en el **popover de perfil** (avatar de usuario,
 * esquina inferior izquierda del rail → sección "Apariencia"), así que
 * duplicarlo en la cabecera del workspace no aportaba nada y sí robaba el
 * ancho que necesitan las pestañas. Además su etiqueta ("Obsidian Graphite ·
 * Slate Oscuro") se desbordaba a 3 líneas dentro del trigger de 44 px (D2).
 *
 * `ThemeControl` se elimina por completo: mantener un componente muerto
 * "por si acaso" es deuda, no diseño.
 */

/**
 * D12 — UNA sola fuente de verdad para el modelo: `useUiStore.activeModelId`.
 *
 * ## El problema medido
 * La app mostraba TRES indicadores de modelo con DOS valores distintos:
 * · cabecera global  → "Claude 3.7 Sonnet" (`Selector de modelo activo`)
 * · cabecera del chat → "Claude 3.7 Sonnet" (`Modelo del chat`)
 * · composer         → "Llama 3.2 Local"  (`Seleccionar modelo de lenguaje`)
 *
 * La causa era que el composer mantenía su PROPIO `selectedModel` y el
 * catálogo de modelos lo sobrescribía con el primer modelo disponible
 * (`loaded[0]`), mientras las cabeceras leían el store global. Ahora los
 * tres leen el MISMO valor (`useUiStore.activeModelId`) y el catálogo sólo
 * puebla el menú: el composer ya no puede divergir de las cabeceras.
 *
 * ## Cómo se etiqueta el ÁMBITO
 * Como los tres indicadores muestran el mismo valor, se les pone nombre
 * explícito para que el usuario sepa qué está mirando:
 * · global  → "Modelo activo global" (el valor por defecto de la app)
 * · chat    → "Modelo de esta sesión" (el mismo valor, en el ámbito del hilo)
 * · composer→ "Modelo con el que se ejecutará el próximo turno"
 */
function ChatPanelHeader({
  activeSubEgo,
  onSelectSubEgo,
  activeModelId,
  onSelectModel,
}: {
  activeSubEgo: string;
  onSelectSubEgo: (id: string) => void;
  activeModelId: string;
  onSelectModel: (model: ModelOption) => void;
}) {
  const modelValue = CANONICAL_MODELS.some((m) => m.id === activeModelId)
    ? activeModelId
    : `custom:${activeModelId}`;
  const modelOptions = [
    ...CANONICAL_MODELS.map((m) => ({ value: m.id, label: m.name })),
    ...(!CANONICAL_MODELS.some((m) => m.id === activeModelId)
      ? [{ value: `custom:${activeModelId}`, label: `${activeModelId} (custom)` }]
      : []),
  ];
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-paper px-3.5 text-xs text-faint">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-xs font-semibold text-ink">Chat</span>
        <SubEgoSelector
          activeSubEgoId={activeSubEgo}
          onSelectSubEgo={(id) => onSelectSubEgo(id)}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          ariaLabel="Modelo de esta sesión"
          title="Modelo de esta sesión — el mismo que el modelo activo global (Model Router)"
          value={modelValue}
          onValueChange={(val) => {
            const found = CANONICAL_MODELS.find((m) => m.id === val);
            if (found) onSelectModel(found);
          }}
          // `truncate` + `whitespace-nowrap` (vía `SELECT_VALUE_TRUNCATE`):
          // sin esto la etiqueta larga se envuelve y desborda la fila (D2).
          // 190 px es lo que necesita "Claude 3.7 Sonnet" en mono 12 px con
          // el caret: la cabecera del chat mide 560 px por defecto, así que
          // el nombre se lee COMPLETO sin recortarse.
          className={`${SELECT_VALUE_TRUNCATE} min-h-11 min-w-11 max-w-[190px] whitespace-nowrap rounded-full font-mono text-xs text-dim hover:text-ink`}
          options={modelOptions}
        />
      </div>
    </div>
  );
}

export function App() {
  const [activeProject, setActiveProject] = useState("default");
  const [activeSubEgo, setActiveSubEgo] = useState("ego.nucleus");
  const [activeDomainId, setActiveDomainId] = useState("engineering");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("daily");

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
  // T8 (EGO-FIND-73): `useMemo` para el nombre del modelo — antes se
  // recalculaba en cada render del shell.
  const activeModelName = useMemo(
    () => CANONICAL_MODELS.find((m) => m.id === activeModelId)?.name ?? activeModelId,
    [activeModelId]
  );

  const handleSelectModel = useCallback(async (model: ModelOption) => {
    useUiStore.getState().setActiveModelId(model.id);
    try {
      const cfg = await ego().settings.getModelConfig();
      await ego().settings.saveModelConfig({ ...cfg, modelName: model.id });
    } catch {
      // sin bridge: el store local conserva la selección
    }
  }, []);

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
            Altura del shell unificada en h-11 (44 px) — el rail, esta cabecera
            y los sub-headers deben compartir la misma altura o las barras
            dejan de alinearse entre vistas.
            ========================================================================= */}
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-panel px-3 z-10 app-region-drag select-none">
          {/* Identidad de la App + Toggle de Sidebar */}
          <div className="flex items-center gap-2.5 app-region-no-drag shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title="Mostrar / Ocultar panel lateral (Ctrl+B)"
              aria-label="Conmutar barra lateral"
              icon={<SidebarSimple size={15} />}
              className="text-dim hover:text-ink"
            />

            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ink shadow-[var(--ego-elevation-l1)]">
                <span className="font-mono text-xs font-bold text-paper">E</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xs font-semibold tracking-tight text-ink">Ego</span>
                  <span className="rounded-full border border-brand/30 bg-brand/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand">
                    SOC
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Segmented Pill Toggle Central [ Chat | Work ] */}
          <div className="flex items-center justify-center app-region-no-drag flex-1 max-w-xs mx-auto">
            <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-raised p-0.5 text-xs">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setWorkspaceOpen(false)}
                aria-pressed={!workspaceOpen}
                className={`rounded-full px-4 ${
                  !workspaceOpen
                    ? "bg-raised text-ink font-semibold shadow-[var(--ego-elevation-l1)]"
                    : "text-faint hover:text-ink"
                }`}
              >
                Chat
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setWorkspaceOpen(true)}
                aria-pressed={workspaceOpen}
                className={`rounded-full px-4 ${
                  workspaceOpen
                    ? "bg-raised text-ink font-semibold shadow-[var(--ego-elevation-l1)]"
                    : "text-faint hover:text-ink"
                }`}
              >
                Work
              </Button>
            </div>
          </div>

          {/* Lado Derecho: Selector de Modelo Activo + Status + Isla */}
          <div className="flex items-center gap-2 text-xs text-faint app-region-no-drag shrink-0">
            <ActivityWidget />

            {/* Selector de modelo activo (requerido por App.test.tsx).
                D12: es el valor GLOBAL; el composer y la cabecera del chat
                muestran el mismo valor (ver `ChatPanelHeader`). */}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => useUiStore.getState().openModelPicker()}
              title="Modelo activo global (Model Router)"
              aria-label="Selector de modelo activo"
              truncate
              icon={
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
              }
              className="min-h-11 min-w-11 max-w-[200px] rounded-full border-hairline bg-raised px-2.5 font-mono text-xs hover:border-strong hover:bg-panel"
            >
              <span className="min-w-0 truncate font-medium">{activeModelName}</span>
            </Button>

            {/* Botón Isla Flotante Companion */}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => toggleFloatingCompanion()}
              title="Mostrar/Ocultar Isla Flotante Companion (Alt+Win+P)"
              aria-label="Mostrar u ocultar Isla Flotante"
              icon={<Island size={14} />}
              className="min-h-11 min-w-11 rounded-full border-hairline bg-raised px-2.5 font-sans text-xs hover:border-strong hover:bg-panel"
            >
              <span className="hidden font-medium sm:inline">Isla</span>
            </Button>

            {/* Botón Alternar Workspace */}
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setWorkspaceOpen((v) => !v)}
              title="Alternar panel de Workspace (Ctrl+\)"
              aria-label="Alternar panel de Workspace"
              aria-expanded={workspaceOpen}
              icon={<SidebarSimple size={13} className="rotate-180" />}
              className={`min-h-11 min-w-11 rounded-full border border-hairline bg-panel px-2.5 font-sans text-xs ${
                workspaceOpen
                  ? "border-strong bg-raised font-semibold text-ink"
                  : "text-dim hover:bg-raised hover:text-ink"
              }`}
            >
              <span>Workspace</span>
            </Button>
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

          {/* Panel 1: Conversation River (Chat)
              T15 (EGO-FIND-62): el reparto Chat ↔ Canvas lo decide el
              usuario. Antes el chat tenía ancho FIJO (46%, 420–680 px)
              cuando el workspace está abierto: no había forma de darle
              más espacio. Se reutiliza el primitive del proyecto
              `SplitPane` (divisor `role="separator"` operable por teclado,
              límites elásticos y persistencia en localStorage) en vez de
              añadir una dependencia nueva (principio D3 del owner). */}
          {workspaceOpen ? (
            <SplitPane
              id="app-chat"
              side="left"
              defaultWidth={560}
              minWidth={360}
              maxWidth={900}
            >
              <section
                aria-label="Chat"
                className="flex h-full min-w-0 flex-col bg-paper"
              >
                <ChatPanelHeader
                  activeSubEgo={activeSubEgo}
                  onSelectSubEgo={setActiveSubEgo}
                  activeModelId={activeModelId}
                  onSelectModel={(m) => void handleSelectModel(m)}
                />
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <EgoChat
                    key={sessionNonce}
                    projectId={activeProject}
                    subEgoId={activeSubEgo}
                    sessionId={activeSessionId}
                  />
                </div>
              </section>
            </SplitPane>
          ) : (
            <section
              aria-label="Chat"
              className="flex flex-1 min-w-0 flex-col bg-paper"
            >
              <ChatPanelHeader
                activeSubEgo={activeSubEgo}
                onSelectSubEgo={setActiveSubEgo}
                activeModelId={activeModelId}
                onSelectModel={(m) => void handleSelectModel(m)}
              />
              <div className="flex-1 min-h-0 overflow-y-auto">
                <EgoChat
                  key={sessionNonce}
                  projectId={activeProject}
                  subEgoId={activeSubEgo}
                  sessionId={activeSessionId}
                />
              </div>
            </section>
          )}

          {/* Panel 2: Dynamic Canvas (Superficie de Trabajo Interactiva)
              Accesible en el DOM para pruebas y screen readers vía sr-only cuando workspaceOpen es false */}
          <section
            aria-label="Área de trabajo dinámica"
            className={
              workspaceOpen
                ? "flex flex-1 flex-col min-w-0 bg-panel transition-opacity duration-200"
                : "sr-only"
            }
          >
            {/* ─────────────────────────────────────────────────────────────
                D1 — Cabecera del Workspace en DOS filas.

                MEDICIÓN (antes): con el viewport en 1512 px y el chat en su
                ancho por defecto (560 px), el panel del workspace mide 663 px.
                El grupo de la derecha (`flex items-center gap-2.5 shrink-0`)
                medía 788 px = selector de tema (155) + Inspector (75) + nav
                (537), y la nav empezaba en `left=1430`: 456 px del
                viewport, 6 pestañas fuera y sólo "Daily State" visible.

                CAUSA: en UNA sola fila de 44 px no caben (a) el título + el
                selector de dominio (307 px), (b) el Inspector (75 px) y (c)
                las 6 pestañas (537 px): 919 px en 631 px útiles. Ningún
                recorte de padding lo arreglaba.

                SOLUCIÓN:
                1. El selector de tema se elimina de aquí (ya vive en el
                   popover de perfil) → −165 px.
                2. La navegación de vistas baja a su PROPIA fila de 44 px,
                   con el ancho completo del panel (607 px útiles) para el
                   segmented control (536 px) → las 6 pestañas caben.
                3. `min-w-0` + `overflow-x-auto` en la fila: si el usuario
                   arrastra el chat a 900 px (workspace ≈ 324 px), la barra
                   degrada a scroll horizontal en vez de desbordar.
                ───────────────────────────────────────────────────────────── */}
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 text-xs text-faint min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <TerminalWindow size={14} className="shrink-0 text-dim" />
                <span className="whitespace-nowrap font-medium text-ink">Dynamic Workspace</span>
                <span className="text-dim">|</span>
                <DomainSelector
                  domains={CANONICAL_DOMAINS}
                  activeDomainId={activeDomainId}
                  onSelectDomain={handleSelectDomain}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setInspectorCollapsed((prev) => !prev)}
                  title="Conmutar inspector (Ctrl+I)"
                  aria-expanded={!inspectorCollapsed}
                  aria-label="Conmutar inspector"
                  className={`rounded-full border border-hairline px-2.5 ${
                    !inspectorCollapsed
                      ? "border-strong bg-raised font-semibold text-ink"
                      : "text-dim hover:bg-raised hover:text-ink"
                  }`}
                >
                  Inspector
                </Button>
              </div>
            </div>

            {/* Barra de vistas: fila propia con el ancho completo del panel. */}
            <div className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-hairline px-3 min-w-0">
              <nav
                aria-label="Navegación de vistas del espacio de trabajo"
                className="flex min-w-0 shrink-0 items-center gap-0.5 rounded-[var(--radius-card)] border border-hairline bg-raised p-0.5"
              >
                {WORKSPACE_TABS.map((tab) => {
                  const isActive = activeWorkspaceTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        setActiveWorkspaceTab(tab.id);
                        setWorkspaceOpen(true);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={`shrink-0 whitespace-nowrap rounded-md px-2.5 ${
                        isActive
                          ? "bg-panel font-semibold text-ink shadow-[var(--ego-elevation-l1)]"
                          : "text-dim hover:bg-panel hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </Button>
                  );
                })}
              </nav>
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
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-hairline px-3 text-xs">
                <span className="font-semibold text-ink">Inspector</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setInspectorCollapsed(true)}
                  title="Cerrar inspector (Ctrl+I)"
                  aria-label="Cerrar inspector"
                  icon={<X size={14} />}
                  className="text-faint hover:bg-raised hover:text-ink"
                />
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 text-xs text-faint">
                <div className="ego-surface-l2 rounded-[var(--radius-card)] p-2.5">
                  <p className="font-semibold text-ink">Sesión activa</p>
                  <p className="mt-1 truncate font-mono text-xs text-dim">
                    {activeSessionId ?? "Sin sesión"}
                  </p>
                </div>
                <div className="ego-surface-l2 rounded-[var(--radius-card)] p-2.5">
                  <p className="font-semibold text-ink">Proyecto</p>
                  <p className="mt-1 truncate font-mono text-xs text-dim">{activeProject}</p>
                </div>
                <div className="ego-surface-l2 rounded-[var(--radius-card)] p-2.5">
                  <p className="font-semibold text-ink">Sub-Ego</p>
                  <p className="mt-1 truncate font-mono text-xs text-dim">{activeSubEgo}</p>
                </div>
                <div className="ego-surface-l2 rounded-[var(--radius-card)] p-2.5">
                  <p className="font-semibold text-ink">Modelo</p>
                  <p className="mt-1 truncate font-mono text-xs text-dim">{activeModelName}</p>
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
