/**
 * T4 (VERDICT R3) — Vistas de dominio como componentes de registry.
 *
 * Antes, `DomainCanvasView.tsx` tenía 10 ramas `domainId === "…"`: 5 para
 * cargar datos y 5 para renderizar. Añadir un dominio obligaba a tocar el
 * componente en 10 sitios, y `componentKind` era metadato muerto.
 *
 * Ahora cada dominio es un componente **autosuficiente** (estado + carga +
 * vista) registrado en el registry dinámico bajo su `componentKind`. El
 * padre resuelve el componente por `componentKind`: sin ramas.
 */
import React, { useEffect, useState, Suspense } from "react";
import {
  Code,
  Kanban,
  BookOpen,
  ChartBar,
  Users,
  GitBranch,
  ShieldCheck,
  CheckCircle,
  Plus,
  MagnifyingGlass,
  ArrowRight,
  CurrencyDollar,
} from "@phosphor-icons/react";
import { ego } from "../../lib/ego.js";
import { SmartList } from "../SmartList.js";
import { Select } from "../ui-kit/Select.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";
import { Textarea } from "../ui-kit/Textarea.js";

// T08: recharts (~384KB) fuera del arranque — lazy tras la primera pintura.
const LazyTelemetryChart = React.lazy(() =>
  import("./DomainCharts.js").then((m) => ({ default: m.TelemetryChart }))
);

function ChartFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center font-mono text-xs text-dim">
      Cargando telemetría…
    </div>
  );
}

import {
  flatMapValid,
  isRecord,
  toCrmDeal,
  toCrmSummary,
  toEpicItem,
  toKnowledgeFact,
  toProductItem,
  toWorktreeItem,
  type WorktreeStatusItem,
  type ProductListItem,
  type ProductEpicItem,
  type KnowledgeFact,
  type CrmDealItem,
  type CrmSummary,
} from "./types.js";

/**
 * Cáscara canónica de vista de dominio.
 *
 * Antes cada vista de dominio usaba su propia gramática de superficie (una
 * superficie translucida y un título de nivel 2), que era distinta de la del
 * Canvas (`components/canvas/CardView.tsx`): de ahí la incoherencia que
 * detectó la auditoría de diseño. Ahora TODAS las vistas comparten la misma
 * cáscara (superficie `bg-panel`, borde hairline, radio del sistema, elevación
 * L1) y el mismo nivel de título (`h3 text-sm`) con su subtítulo
 * (`text-xs text-faint`).
 */
const DOMAIN_VIEW_SHELL =
  "space-y-4 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]";

/**
 * Tarjeta interna de una vista de dominio: superficie elevada (`bg-raised`)
 * sobre la cáscara `bg-panel`, con el mismo radio del sistema.
 */
const DOMAIN_CARD = "rounded-[var(--radius-card)] border border-hairline bg-raised p-4";

/**
 * Fila de contenido dentro de una tarjeta: superficie hundida (`bg-panel`)
 * sobre la tarjeta elevada `bg-raised`.
 */
const DOMAIN_ROW = "rounded-[var(--radius-card)] border border-hairline bg-panel";

/**
 * T4 (VERDICT R3) — Vista de engineering (componentKind `engineering_status`).
 *
 * Componente autosuficiente: declara su propio estado, carga sus propios
 * datos del bridge y renderiza su vista. El padre
 * (`DomainCanvasView`) ya NO tiene ramas por `domainId`: resuelve el
 * componente por `componentKind` contra el registry dinámico.
 */
export function EngineeringStatusView() {
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();

  const [engData, setEngData] = useState<{
    // T12: null = aún sin dato real del backend (nunca rama supuesta).
    branch: string | null;
    clean: boolean;
    staged: string[];
    unstaged: string[];
    worktrees: WorktreeStatusItem[];
  }>({
    branch: null,
    clean: true,
    staged: [],
    unstaged: [],
    worktrees: [],
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
              const res = await bridge.domains?.getEngineeringStatus();
              if (!res) {
                if (mounted) setUiError("Canal domains no disponible en el bridge.");
              } else if (!res.ok) {
                if (mounted) setUiError("No se pudo leer el estado de ingeniería del backend.");
              } else if (mounted) {
                setEngData({
                  branch:
                    typeof res.gitStatus?.branch === "string" ? res.gitStatus.branch : null,
                  clean: res.gitStatus?.clean ?? true,
                  staged: res.gitStatus?.staged || [],
                  unstaged: res.gitStatus?.unstaged || [],
                  worktrees: (res.worktrees ?? []).map(toWorktreeItem),
                });
              }
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
        if (mounted) setUiError("Error al cargar datos del dominio desde el backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, []);


  return (
    <div className={DOMAIN_VIEW_SHELL}>
      {loading && (
        <div className="text-xs text-dim font-mono animate-pulse">
          Sincronizando estado de engineering...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-xs font-mono text-error border border-error/30 bg-error/10 rounded-[var(--radius-card)] px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2">
                  <Code size={20} className="shrink-0 text-brand" />
                  <h3 className="text-sm font-semibold text-ink">Workspace de Ingeniería (ego.dev)</h3>
                </div>
                {/* Subtítulo de la vista: mismo nivel que el Canvas (`text-xs text-faint`). */}
                <p className="mt-0.5 text-xs text-faint">
                  Rama activa, estado del working tree y worktrees aislados.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs bg-raised border border-hairline px-2.5 py-1 rounded-md font-mono text-brand">
                <GitBranch size={14} />
                {engData.branch === null ? (
                  <span className="animate-pulse text-faint">leyendo rama…</span>
                ) : (
                  <span>{engData.branch}</span>
                )}
                <span className={`w-2 h-2 rounded-full ${engData.clean ? "bg-success" : "bg-warning"}`} />
              </div>
            </div>
      
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Estado de Git */}
              <div className={DOMAIN_CARD}>
                <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-2">
                  Estado del Working Tree
                </h4>
                <div className="text-sm">
                  {engData.clean ? (
                    <div className="flex items-center gap-2 text-success py-2">
                      <CheckCircle size={18} />
                      <span>Directorio de trabajo limpio. Sin mutaciones pendientes.</span>
                    </div>
                  ) : (
                    <div className="space-y-1 font-mono text-xs">
                      {engData.unstaged.map((f, i) => (
                        <div key={i} className="text-warning truncate">
                          M {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
      
              {/* Worktrees aislados (HERM-17) */}
              <div className={DOMAIN_CARD}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="min-w-0 text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={16} className="shrink-0 text-brand" />
                    <span className="truncate">Worktrees Aislados (HERM-17)</span>
                  </h4>
                  <span className="shrink-0 text-xs text-faint">
                    {engData.worktrees.length} activos
                  </span>
                </div>
                <p className="text-xs text-faint mb-3">
                  Las mutaciones de código en vuelo se aíslan en ramas temporales para no ensuciar el workspace del usuario.
                </p>
                <div className="space-y-2">
                  {engData.worktrees.map((wt, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-panel border border-hairline px-3 py-2 rounded-[var(--radius-card)] font-mono"
                    >
                      <span className="text-brand truncate max-w-[200px]">{wt.branch}</span>
                      <span className="text-xs text-faint">{wt.isMain ? "Principal" : "Aislado"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
    </div>
  );
}

/**
 * T4 (VERDICT R3) — Vista de product (componentKind `product_backlog`).
 *
 * Componente autosuficiente: declara su propio estado, carga sus propios
 * datos del bridge y renderiza su vista. El padre
 * (`DomainCanvasView`) ya NO tiene ramas por `domainId`: resuelve el
 * componente por `componentKind` contra el registry dinámico.
 */
export function ProductBacklogView() {
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();

  const [productData, setProductData] = useState<{
    items: ProductListItem[];
    epics: ProductEpicItem[];
  }>({ items: [], epics: [] });

  const [showProductForm, setShowProductForm] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductPriority, setNewProductPriority] = useState("high");
  const [newProductStatus, setNewProductStatus] = useState("backlog");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
              const res = await bridge.domains?.productBacklog({ action: "list" });
              if (!res) {
                if (mounted) setUiError("Canal domains no disponible en el bridge.");
              } else if (!res.ok) {
                if (mounted) setUiError("No se pudo leer el backlog de producto del backend.");
              } else if (mounted) {
                // T12: vacío honesto — sin ítems de ejemplo cuando el backend no trae.
                setProductData({
                  items: res.items ? res.items.map(toProductItem) : [],
                  epics: res.epics ? res.epics.map(toEpicItem) : [],
                });
              }
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
        if (mounted) setUiError("Error al cargar datos del dominio desde el backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, []);

const handleCreateProductItem = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newProductTitle.trim()) return;
  const newItem: ProductListItem = {
    id: `p-${Date.now()}`,
    title: newProductTitle.trim(),
    priority: newProductPriority,
    status: newProductStatus,
  };
  try {
    await bridge.domains?.productBacklog?.({
      action: "create",
      payload: newItem,
    });
  } catch {}
  setProductData((prev) => ({
    ...prev,
    items: [newItem, ...prev.items],
  }));
  setNewProductTitle("");
  setShowProductForm(false);
};

  return (
    <div className={DOMAIN_VIEW_SHELL}>
      {loading && (
        <div className="text-xs text-dim font-mono animate-pulse">
          Sincronizando estado de product...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-xs font-mono text-error border border-error/30 bg-error/10 rounded-[var(--radius-card)] px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2">
                  <Kanban size={20} className="shrink-0 text-warning" />
                  <h3 className="text-sm font-semibold text-ink">Tablero de Producto & Backlog (ego.product)</h3>
                </div>
                {/* Subtítulo de la vista: mismo nivel que el Canvas (`text-xs text-faint`). */}
                <p className="mt-0.5 text-xs text-faint">
                  Backlog de producto agrupado por columna y prioridad.
                </p>
              </div>
              <Button
                variant="accent"
                size="md"
                onClick={() => setShowProductForm(!showProductForm)}
                className="shrink-0"
              >
                <Plus size={14} />
                <span>{showProductForm ? "Cerrar" : "Nuevo Ítem"}</span>
              </Button>
            </div>
  
            {showProductForm && (
              <form
                onSubmit={handleCreateProductItem}
                className="bg-raised border border-hairline rounded-[var(--radius-card)] p-3 text-xs flex flex-col gap-2"
              >
                <span className="font-semibold text-ink">Nuevo Ítem del Backlog</span>
                <div className="flex flex-col gap-1">
                  <label htmlFor="product-item-title" className="text-xs text-faint">
                    Título del ítem o historia de usuario
                  </label>
                  <Input
                    id="product-item-title"
                    type="text"
                    placeholder="Título del ítem o historia de usuario..."
                    value={newProductTitle}
                    onChange={(e) => setNewProductTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-faint">Prioridad:</span>
                    <Select
                      ariaLabel="Prioridad"
                      value={newProductPriority}
                      onValueChange={setNewProductPriority}
                      options={[
                        { value: "high", label: "Alta" },
                        { value: "medium", label: "Media" },
                        { value: "low", label: "Baja" },
                      ]}
                      triggerClassName="bg-panel"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-faint">Columna:</span>
                    <Select
                      ariaLabel="Columna"
                      value={newProductStatus}
                      onValueChange={setNewProductStatus}
                      options={[
                        { value: "backlog", label: "Backlog" },
                        { value: "in_progress", label: "En Progreso" },
                        { value: "review", label: "Revisión / QA" },
                        { value: "done", label: "Completado" },
                      ]}
                      triggerClassName="bg-panel"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="accent"
                    size="md"
                    disabled={!newProductTitle.trim()}
                    className="ml-auto"
                  >
                    Guardar Ítem
                  </Button>
                </div>
              </form>
            )}
      
            {productData.items.length === 0 && (
              <p className="text-xs text-faint italic">
                Sin ítems en el backlog — el backend no devolvió datos (vacío honesto, sin ejemplos).
              </p>
            )}
      
            {/* Columnas Kanban */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {["backlog", "in_progress", "review", "done"].map((col) => {
                const colTitles: Record<string, string> = {
                  backlog: "Backlog",
                  in_progress: "En Progreso",
                  review: "Revisión / QA",
                  done: "Completado",
                };
                const colItems = productData.items.filter((i) => i.status === col);
      
                return (
                  <div key={col} className="bg-raised border border-hairline rounded-[var(--radius-card)] p-3 flex flex-col min-h-[220px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                        {colTitles[col]}
                      </span>
                      <span className="text-xs bg-panel text-faint px-1.5 py-0.5 rounded-full font-mono">
                        {colItems.length}
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      {colItems.map((item) => (
                        <div
                          key={item.id}
                          className={`${DOMAIN_ROW} p-2.5 shadow-[var(--ego-elevation-l1)] hover:border-strong transition-colors`}
                        >
                          <div className="text-xs font-medium text-ink">{item.title}</div>
                          <div className="flex items-center justify-between mt-2 text-xs text-faint">
                            <span className="uppercase font-mono text-warning">{item.priority}</span>
                            <span className="text-faint">#item_{item.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
    </div>
  );
}

/**
 * T4 (VERDICT R3) — Vista de knowledge (componentKind `knowledge_facts`).
 *
 * Componente autosuficiente: declara su propio estado, carga sus propios
 * datos del bridge y renderiza su vista. El padre
 * (`DomainCanvasView`) ya NO tiene ramas por `domainId`: resuelve el
 * componente por `componentKind` contra el registry dinámico.
 */
export function KnowledgeFactsView() {
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();

  const [knowledgeData, setKnowledgeData] = useState<KnowledgeFact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // T08: debounce 300ms — antes refetch por tecla.
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [graphNodes, setGraphNodes] = useState<Array<{ id: string; label: string; type: string }>>([]);
  const [graphEdges, setGraphEdges] = useState<Array<{ source: string; target: string; relation: string }>>([]);
  const [quarantineItems, setQuarantineItems] = useState<Array<{ key: string; notice: string; kind: string }>>([]);
  // T12: el canal graphRag existe en el bridge → el bloque se conserva;
  // si algún día falta, se oculta en vez de mostrar un placeholder falso.
  const graphRagAvailable = typeof bridge.knowledge?.graphRag === "function";

  const [showIngestForm, setShowIngestForm] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestType, setIngestType] = useState<"markdown" | "text" | "code">("markdown");
  const [ingestContent, setIngestContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
              const res = await bridge.domains?.knowledgeSearch(debouncedQuery || "vanta");
              if (!res) {
                if (mounted) setUiError("Canal domains no disponible en el bridge.");
              } else if (!res.ok) {
                if (mounted) setUiError("No se pudo buscar en la base de conocimiento del backend.");
              } else if (mounted) {
                setKnowledgeData(flatMapValid(res.results, toKnowledgeFact));
              }
        
              if (bridge.knowledge?.graphRag) {
                try {
                  const gRes = (await bridge.knowledge.graphRag({ query: debouncedQuery || "vanta" })) as {
                    ok?: boolean;
                    nodes?: Array<{ id: string; label: string; type: string }>;
                    edges?: Array<{ source: string; target: string; relation: string }>;
                  };
                  if (mounted && gRes?.ok) {
                    if (Array.isArray(gRes.nodes)) setGraphNodes(gRes.nodes);
                    if (Array.isArray(gRes.edges)) setGraphEdges(gRes.edges);
                  }
                } catch {}
              }
        
              if (bridge.knowledge?.quarantine) {
                try {
                  const qRes = (await bridge.knowledge.quarantine({ action: "list" })) as {
                    ok?: boolean;
                    items?: Array<{ key: string; notice: string; kind: string }>;
                  };
                  if (mounted && qRes?.ok && Array.isArray(qRes.items)) {
                    setQuarantineItems(qRes.items);
                  }
                } catch {}
              }
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
        if (mounted) setUiError("Error al cargar datos del dominio desde el backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, [debouncedQuery]);

const handleIngest = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!ingestTitle.trim() || !ingestContent.trim()) return;
  setIngesting(true);
  setIngestMessage(null);
  try {
    if (bridge.knowledge?.ingest) {
      await bridge.knowledge.ingest({
        title: ingestTitle.trim(),
        type: ingestType,
        content: ingestContent.trim(),
      });
    } else {
      await bridge.memory?.("put", [
        {
          namespace: "kb/docs",
          key: `doc_${Date.now()}`,
          payload: {
            title: ingestTitle.trim(),
            type: ingestType,
            content: ingestContent.trim(),
            createdAt: Date.now(),
          },
        },
      ]);
    }
    setIngestMessage("Documento ingerido exitosamente en VantaDB.");
    setIngestTitle("");
    setIngestContent("");
    setShowIngestForm(false);
    const res = await bridge.domains?.knowledgeSearch(debouncedQuery || "vanta");
    if (res?.ok) {
      setKnowledgeData(flatMapValid(res.results, toKnowledgeFact));
    }
  } catch {
    setIngestMessage("Fallo al ingerir el documento en VantaDB.");
  } finally {
    setIngesting(false);
  }
};

  return (
    <div className={DOMAIN_VIEW_SHELL}>
      {loading && (
        <div className="text-xs text-dim font-mono animate-pulse">
          Sincronizando estado de knowledge...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-xs font-mono text-error border border-error/30 bg-error/10 rounded-[var(--radius-card)] px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2">
                  <BookOpen size={20} className="shrink-0 text-chart-violet" />
                  <h3 className="text-sm font-semibold text-ink">GraphRAG & Base de Conocimiento (ego.researcher)</h3>
                </div>
                {/* Subtítulo de la vista: mismo nivel que el Canvas (`text-xs text-faint`). */}
                <p className="mt-0.5 text-xs text-faint">
                  Hechos verificados en VantaDB, grafo conceptual y bandeja de cuarentena.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="accent"
                  size="md"
                  onClick={() => setShowIngestForm(!showIngestForm)}
                >
                  <Plus size={14} />
                  <span>{showIngestForm ? "Cerrar" : "+ Ingerir Documento"}</span>
                </Button>
                <div className="relative w-64">
                  <MagnifyingGlass
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-2.5 text-faint"
                    aria-hidden
                  />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar facts o conceptos..."
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
  
            {showIngestForm && (
              <form
                onSubmit={handleIngest}
                className="bg-raised border border-hairline rounded-[var(--radius-card)] p-3.5 text-xs flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Ingerir Documento en VantaDB</span>
                  {ingestMessage && (
                    <span className="text-xs text-success font-medium">{ingestMessage}</span>
                  )}
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <label htmlFor="ingest-title" className="text-xs text-faint">
                      Título del documento o nota técnica
                    </label>
                    <Input
                      id="ingest-title"
                      type="text"
                      placeholder="Título del documento o nota técnica..."
                      value={ingestTitle}
                      onChange={(e) => setIngestTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-40">
                    <span className="text-xs text-faint">Tipo</span>
                    <Select
                      ariaLabel="Tipo de documento"
                      value={ingestType}
                      onValueChange={(v) => setIngestType(v as "markdown" | "text" | "code")}
                      options={[
                        { value: "markdown", label: "Markdown" },
                        { value: "text", label: "Texto Plano" },
                        { value: "code", label: "Código" },
                      ]}
                      triggerClassName="bg-panel"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="ingest-content" className="text-xs text-faint">
                    Contenido a persistir e indexar para RAG semántico e híbrido en VantaDB
                  </label>
                  <Textarea
                    id="ingest-content"
                    placeholder="Contenido a persistir e indexar para RAG semántico e híbrido en VantaDB..."
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    rows={3}
                    className="font-mono"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="accent"
                    size="md"
                    loading={ingesting}
                    disabled={!ingestTitle.trim() || !ingestContent.trim()}
                  >
                    {ingesting ? "Ingiriendo en VantaDB..." : "Ingerir en VantaDB"}
                  </Button>
                </div>
              </form>
            )}
      
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={DOMAIN_CARD}>
                <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3">
                  Hechos Verificados en VantaDB (kb/facts)
                </h4>
                <div className="max-h-[300px] overflow-y-auto">
                  <SmartList
                    items={knowledgeData}
                    ariaLabel="Hechos verificados"
                    keyOf={(f) => `${f.source}::${f.claim}`}
                    empty={
                      <p className="py-4 text-center text-xs text-faint">
                        No se encontraron hechos para la búsqueda activa.
                      </p>
                    }
                    renderItem={(fact) => (
                      <div
                        className={`${DOMAIN_ROW} p-2.5 text-xs`}
                      >
                        <div className="font-medium text-ink">{fact.claim}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-faint">
                          <span className="max-w-[200px] truncate font-mono text-chart-violet">
                            Fuente: {fact.source}
                          </span>
                          <span>Confianza: {Math.round(fact.confidence * 100)}%</span>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </div>
      
              {graphRagAvailable ? (
                <div className={`${DOMAIN_CARD} flex flex-col justify-between`}>
                  <div>
                    <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-2">
                      Grafo Conceptual GraphRAG
                    </h4>
                    {graphNodes.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {graphNodes.map((node) => (
                            <div
                              key={node.id}
                              className="flex items-center gap-1.5 rounded-[var(--radius-card)] border border-hairline bg-raised px-2.5 py-1 text-xs"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-chart-violet" />
                              <span className="font-medium text-ink">{node.label}</span>
                              <span className="text-xs text-faint font-mono">({node.type})</span>
                            </div>
                          ))}
                        </div>
                        {graphEdges.length > 0 && (
                          <div className="pt-2 border-t border-hairline space-y-1">
                            <span className="text-xs text-faint font-semibold uppercase tracking-wider">
                              Relaciones detectadas
                            </span>
                            {graphEdges.map((edge, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs font-mono text-dim">
                                <span className="text-chart-violet">{edge.source}</span>
                                <span className="text-faint">──[{edge.relation}]──▶</span>
                                <span className="text-chart-violet">{edge.target}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-faint italic">
                        Sin visualización cableada — el canal graphRag existe pero no
                        devuelve nodos en este kicker (vacío honesto, sin grafo inventado).
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
      
            {/* Bandeja de Cuarentena (SEC-09) */}
            <div className={DOMAIN_CARD}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-warning" />
                  <h4 className="truncate text-xs font-semibold text-ink uppercase tracking-wider">
                    Bandeja de Cuarentena (SEC-09)
                  </h4>
                </div>
                <span className="shrink-0 text-xs text-faint font-mono">
                  {quarantineItems.length} artefactos aislados
                </span>
              </div>
              {quarantineItems.length === 0 ? (
                <p className="text-xs text-faint italic py-1">
                  Sin artefactos en cuarentena — no hay documentos aislados por políticas de seguridad.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {quarantineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between ${DOMAIN_ROW} p-2.5 text-xs`}
                    >
                      <div>
                        <span className="font-mono text-warning font-medium">{item.key}</span>
                        <p className="text-xs text-faint mt-0.5">{item.notice}</p>
                      </div>
                      <span className="text-xs uppercase px-1.5 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/30 font-mono">
                        {item.kind || "Aislado"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
    </div>
  );
}

/**
 * T4 (VERDICT R3) — Vista de analytics (componentKind `analytics_telemetry`).
 *
 * Componente autosuficiente: declara su propio estado, carga sus propios
 * datos del bridge y renderiza su vista. El padre
 * (`DomainCanvasView`) ya NO tiene ramas por `domainId`: resuelve el
 * componente por `componentKind` contra el registry dinámico.
 */
export function AnalyticsTelemetryView() {
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();

  const [analyticsData, setAnalyticsData] = useState<{
    series: Array<Record<string, unknown>>;
    modelDistribution: Array<Record<string, unknown>>;
  }>({ series: [], modelDistribution: [] });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
              const res = await bridge.domains?.analyticsSeries(7);
              if (!res) {
                if (mounted) setUiError("Canal domains no disponible en el bridge.");
              } else if (!res.ok) {
                if (mounted) setUiError("No se pudo leer la telemetría del backend.");
              } else if (mounted) {
                setAnalyticsData({
                  series: (res.series ?? []).filter(isRecord),
                  modelDistribution: (res.modelDistribution ?? []).filter(isRecord),
                });
              }
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
        if (mounted) setUiError("Error al cargar datos del dominio desde el backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, []);


  return (
    <div className={DOMAIN_VIEW_SHELL}>
      {loading && (
        <div className="text-xs text-dim font-mono animate-pulse">
          Sincronizando estado de analytics...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-xs font-mono text-error border border-error/30 bg-error/10 rounded-[var(--radius-card)] px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2">
                  <ChartBar size={20} className="shrink-0 text-success" />
                  <h3 className="text-sm font-semibold text-ink">Telemetría y Métricas de Inferencia (ego.analyst)</h3>
                </div>
                {/* Subtítulo de la vista: mismo nivel que el Canvas (`text-xs text-faint`). */}
                <p className="mt-0.5 text-xs text-faint">
                  Consumo de tokens por jornada durante los últimos 7 días.
                </p>
              </div>
              <span className="shrink-0 text-xs text-faint font-mono">Últimos 7 días</span>
            </div>
  
            <div className={DOMAIN_CARD}>
              <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3">
                Consumo de Tokens por Jornada
              </h4>
              <div className="h-56 w-full">
                <Suspense fallback={<ChartFallback />}>
                  <LazyTelemetryChart
                    data={analyticsData.series}
                    xKey="date"
                    yKey="totalTokens"
                    gradientId="domainTokensGrad"
                    stroke="var(--color-success, #10b981)"
                  />
                </Suspense>
              </div>
            </div>
          </div>
    </div>
  );
}

/**
 * T4 (VERDICT R3) — Vista de crm (componentKind `crm_pipeline`).
 *
 * Componente autosuficiente: declara su propio estado, carga sus propios
 * datos del bridge y renderiza su vista. El padre
 * (`DomainCanvasView`) ya NO tiene ramas por `domainId`: resuelve el
 * componente por `componentKind` contra el registry dinámico.
 */
export function CrmPipelineView() {
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();

  const [crmData, setCrmData] = useState<{
    deals: CrmDealItem[];
    contacts: Array<Record<string, unknown>>;
    summary: CrmSummary;
  }>({
    deals: [],
    contacts: [],
    summary: { totalPipelineUsd: 0, weightedPipelineUsd: 0, dealsCount: 0 },
  });

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
              const res = await bridge.domains?.crmDeals({ action: "list" });
              if (!res) {
                if (mounted) setUiError("Canal domains no disponible en el bridge.");
              } else if (!res.ok) {
                if (mounted) setUiError("No se pudo leer el pipeline de CRM del backend.");
              } else if (mounted) {
                // T12: vacío honesto — sin deals d1-d3 de ejemplo.
                setCrmData({
                  deals: res.deals ? flatMapValid(res.deals, toCrmDeal) : [],
                  contacts: (res.contacts ?? []).filter(isRecord),
                  summary: toCrmSummary(res.summary),
                });
              }
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
        if (mounted) setUiError("Error al cargar datos del dominio desde el backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, []);

const handleUpdateDealStage = async (dealId: string, nextStage: string) => {
  try {
    await bridge.domains?.crmDeals?.({
      action: "updateStage",
      payload: { dealId, stage: nextStage },
    });
    setCrmData((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: nextStage } : d)),
    }));
  } catch {}
};

  return (
    <div className={DOMAIN_VIEW_SHELL}>
      {loading && (
        <div className="text-xs text-dim font-mono animate-pulse">
          Sincronizando estado de crm...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-xs font-mono text-error border border-error/30 bg-error/10 rounded-[var(--radius-card)] px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2">
                  <Users size={20} className="shrink-0 text-error" />
                  <h3 className="text-sm font-semibold text-ink">CRM & Pipeline de Ventas (ego.crm)</h3>
                </div>
                {/* Subtítulo de la vista: mismo nivel que el Canvas (`text-xs text-faint`). */}
                <p className="mt-0.5 text-xs text-faint">
                  Deals por etapa con valor total y valor ponderado por probabilidad.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1 text-ink">
                  <CurrencyDollar size={16} className="text-success" />
                  <span>Total: ${crmData.summary.totalPipelineUsd.toLocaleString()} USD</span>
                </div>
                <div className="text-faint">
                  Ponderado: ${crmData.summary.weightedPipelineUsd.toLocaleString()} USD
                </div>
              </div>
            </div>
      
            {crmData.deals.length === 0 && (
              <p className="text-xs text-faint italic">
                Sin deals en el pipeline — el backend no devolvió datos (vacío honesto, sin ejemplos).
              </p>
            )}
      
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {crmData.deals.map((deal) => {
                const isExpanded = selectedDealId === deal.id;
      
                return (
                  <div
                    key={deal.id}
                    className={`rounded-[var(--radius-card)] border p-4 flex flex-col justify-between transition-colors ${
                      isExpanded ? "border-brand bg-raised" : "border-hairline bg-raised"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono uppercase text-error font-semibold">
                          {deal.stage}
                        </span>
                        <span className="text-xs text-faint">
                          {deal.probabilityPct}% prob
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-ink">{deal.title}</h4>
                    </div>
      
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-hairline space-y-2 text-xs">
                        <div className="flex items-center justify-between text-xs text-faint">
                          <span>Ponderado:</span>
                          <span className="font-mono text-ink">
                            ${Math.round((deal.valueUsd * deal.probabilityPct) / 100).toLocaleString()} USD
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-faint">Cambiar Etapa:</span>
                          <div className="flex flex-wrap gap-1">
                            {["qualified", "proposal", "negotiation", "closed_won"].map((stage) => (
                              <Button
                                key={stage}
                                size="md"
                                variant={deal.stage === stage ? "accent" : "secondary"}
                                onClick={() => handleUpdateDealStage(deal.id, stage)}
                                truncate
                                className="font-mono uppercase"
                              >
                                {stage}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
      
                    <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-success">
                        ${deal.valueUsd.toLocaleString()} USD
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSelectedDealId(isExpanded ? null : deal.id)}
                        aria-label={`Detalle de ${deal.title}`}
                        title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
                      >
                        <ArrowRight
                          size={14}
                          className={isExpanded ? "rotate-90 transition-transform" : "transition-transform"}
                        />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
    </div>
  );
}

/**
 * `componentKind` de cada dominio canónico. Es la ÚNICA tabla que
 * relaciona un dominio con su componente: el resto se resuelve por
 * `componentKind` contra el registry.
 */
export const DOMAIN_COMPONENT_KINDS: Readonly<Record<string, string>> = Object.freeze({
  engineering: "engineering_status",
  product: "product_backlog",
  knowledge: "knowledge_facts",
  analytics: "analytics_telemetry",
  crm: "crm_pipeline",
});
