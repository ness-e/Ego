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
import {
  ego,
  type EngineeringWorktree,
  type ProductBacklogItem,
  type ProductEpic,
} from "../../lib/ego";
import { SmartList } from "../SmartList.js";

// T08: recharts (~384KB) fuera del arranque — lazy tras la primera pintura.
const LazyTelemetryChart = React.lazy(() =>
  import("./DomainCharts.js").then((m) => ({ default: m.TelemetryChart }))
);

function ChartFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center font-mono text-[11px] text-dim">
      Cargando telemetría…
    </div>
  );
}

interface DomainCanvasViewProps {
  domainId: string;
}

/**
 * T06: tipos de dominio (antes 8× `any`). Proyecciones mínimas de lo que
 * renderiza la vista + guardas de frontera para respuestas IPC (`unknown`).
 */
export interface WorktreeStatusItem {
  branch: string;
  isMain: boolean;
}

export interface ProductListItem {
  id: string;
  title: string;
  status: string;
  priority: string;
}

export interface ProductEpicItem {
  id: string;
  title: string;
}

export interface KnowledgeFact {
  claim: string;
  source: string;
  confidence: number;
}

export interface CrmDealItem {
  id: string;
  title: string;
  stage: string;
  probabilityPct: number;
  valueUsd: number;
}

export interface CrmSummary {
  totalPipelineUsd: number;
  weightedPipelineUsd: number;
  dealsCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function flatMapValid<T>(arr: unknown[] | undefined, fn: (v: unknown) => T | null): T[] {
  if (!arr) return [];
  const out: T[] = [];
  for (const v of arr) {
    const m = fn(v);
    if (m) out.push(m);
  }
  return out;
}

function toWorktreeItem(v: EngineeringWorktree): WorktreeStatusItem {
  return { branch: v.branch, isMain: v.isMain };
}

function toProductItem(v: ProductBacklogItem): ProductListItem {
  return { id: v.id, title: v.title, status: v.status, priority: v.priority };
}

function toEpicItem(v: ProductEpic): ProductEpicItem {
  return { id: v.id, title: v.title };
}

function toKnowledgeFact(v: unknown): KnowledgeFact | null {
  if (!isRecord(v) || typeof v.claim !== "string") return null;
  return {
    claim: v.claim,
    source: asString(v.source, "desconocida"),
    confidence: asNumber(v.confidence),
  };
}

function toCrmDeal(v: unknown): CrmDealItem | null {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  return {
    id: v.id,
    title: asString(v.title, v.id),
    stage: asString(v.stage, "qualified"),
    probabilityPct: asNumber(v.probabilityPct),
    valueUsd: asNumber(v.valueUsd),
  };
}

function toCrmSummary(v: unknown): CrmSummary {
  // T12: sin cifras inventadas — lo ausente es cero, no un pipeline supuesto.
  const r = isRecord(v) ? v : {};
  return {
    totalPipelineUsd: asNumber(r.totalPipelineUsd, 0),
    weightedPipelineUsd: asNumber(r.weightedPipelineUsd, 0),
    dealsCount: asNumber(r.dealsCount, 0),
  };
}

export const DomainCanvasView: React.FC<DomainCanvasViewProps> = ({ domainId }) => {
  const [loading, setLoading] = useState(false);
  // T12: error honesto de carga (nunca datos inventados como sustituto).
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();
  // T12: el canal graphRag existe en el bridge → el bloque se conserva;
  // si algún día falta, se oculta en vez de mostrar un placeholder falso.
  const graphRagAvailable = typeof bridge.knowledge?.graphRag === "function";

  // Estados específicos de dominio
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

  const [productData, setProductData] = useState<{
    items: ProductListItem[];
    epics: ProductEpicItem[];
  }>({ items: [], epics: [] });

  const [knowledgeData, setKnowledgeData] = useState<KnowledgeFact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // T08: debounce 300ms — antes refetch por tecla (deps `[domainId, searchQuery]`).
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [analyticsData, setAnalyticsData] = useState<{
    series: Array<Record<string, unknown>>;
    modelDistribution: Array<Record<string, unknown>>;
  }>({ series: [], modelDistribution: [] });

  const [crmData, setCrmData] = useState<{
    deals: CrmDealItem[];
    contacts: Array<Record<string, unknown>>;
    summary: CrmSummary;
  }>({
    deals: [],
    contacts: [],
    summary: { totalPipelineUsd: 0, weightedPipelineUsd: 0, dealsCount: 0 },
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
        if (domainId === "engineering") {
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
        } else if (domainId === "product") {
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
        } else if (domainId === "knowledge") {
          const res = await bridge.domains?.knowledgeSearch(debouncedQuery || "vanta");
          if (!res) {
            if (mounted) setUiError("Canal domains no disponible en el bridge.");
          } else if (!res.ok) {
            if (mounted) setUiError("No se pudo buscar en la base de conocimiento del backend.");
          } else if (mounted) {
            setKnowledgeData(flatMapValid(res.results, toKnowledgeFact));
          }
        } else if (domainId === "analytics") {
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
        } else if (domainId === "crm") {
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
  }, [domainId, debouncedQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-paper text-ink overflow-y-auto p-4 space-y-4">
      {loading && (
        <div className="text-[10px] text-dim font-mono animate-pulse">
          Sincronizando estado de {domainId}...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-[11px] font-mono text-rose-300 border border-rose-500/30 bg-rose-950/30 rounded-lg px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
      {/* ======================================================== */}
      {/* 1. VISTA DE INGENIERÍA (DOM-01 / HERM-17)                 */}
      {/* ======================================================== */}
      {domainId === "engineering" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <Code size={20} className="text-cyan-400" />
              <h2 className="text-base font-semibold">Workspace de Ingeniería (ego.dev)</h2>
            </div>
            <div className="flex items-center gap-2 text-xs bg-raised border border-hairline px-2.5 py-1 rounded-md font-mono text-cyan-300">
              <GitBranch size={14} />
              {engData.branch === null ? (
                <span className="animate-pulse text-faint">leyendo rama…</span>
              ) : (
                <span>{engData.branch}</span>
              )}
              <span className={`w-2 h-2 rounded-full ${engData.clean ? "bg-emerald-500" : "bg-amber-500"}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Estado de Git */}
            <div className="bg-raised/60 border border-hairline rounded-xl p-4">
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-2">
                Estado del Working Tree
              </h3>
              <div className="text-sm">
                {engData.clean ? (
                  <div className="flex items-center gap-2 text-emerald-400 py-2">
                    <CheckCircle size={18} />
                    <span>Directorio de trabajo limpio. Sin mutaciones pendientes.</span>
                  </div>
                ) : (
                  <div className="space-y-1 font-mono text-xs">
                    {engData.unstaged.map((f, i) => (
                      <div key={i} className="text-amber-400 truncate">
                        M {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Worktrees aislados (HERM-17) */}
            <div className="bg-raised/60 border border-hairline rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-faint uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-cyan-400" />
                  <span>Worktrees Aislados (HERM-17)</span>
                </h3>
                <span className="text-xs text-faint">
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
                    className="flex items-center justify-between text-xs bg-paper/80 border border-hairline px-3 py-2 rounded-lg font-mono"
                  >
                    <span className="text-cyan-300 truncate max-w-[200px]">{wt.branch}</span>
                    <span className="text-[10px] text-faint">{wt.isMain ? "Principal" : "Aislado"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. VISTA DE PRODUCTO (DOM-02)                             */}
      {/* ======================================================== */}
      {domainId === "product" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <Kanban size={20} className="text-amber-400" />
              <h2 className="text-base font-semibold">Tablero de Producto & Backlog (ego.product)</h2>
            </div>
            {/* T12: crear sin formulario inventaría datos → deshabilitado honesto
                hasta que el canal productBacklog/create tenga UI de alta real. */}
            <button
              disabled
              aria-disabled="true"
              title="Crear ítem no disponible: el backend no expone alta con formulario en este canal"
              className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-300/50 border border-amber-500/20 px-3 py-1.5 rounded-lg font-medium cursor-not-allowed"
            >
              <Plus size={14} />
              <span>Nuevo Ítem</span>
            </button>
          </div>

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
                <div key={col} className="bg-raised/60 border border-hairline/80 rounded-xl p-3 flex flex-col min-h-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                      {colTitles[col]}
                    </span>
                    <span className="text-[10px] bg-raised text-faint px-1.5 py-0.5 rounded-full font-mono">
                      {colItems.length}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1">
                    {colItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-paper/80 border border-hairline/80 rounded-lg p-2.5 shadow-xs hover:border-dim transition-colors"
                      >
                        <div className="text-xs font-medium text-ink">{item.title}</div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-faint">
                          <span className="uppercase font-mono text-amber-400">{item.priority}</span>
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
      )}

      {/* ======================================================== */}
      {/* 3. VISTA DE CONOCIMIENTO (DOM-03)                         */}
      {/* ======================================================== */}
      {domainId === "knowledge" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-purple-400" />
              <h2 className="text-base font-semibold">GraphRAG & Base de Conocimiento (ego.researcher)</h2>
            </div>
            <div className="relative w-64">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar facts o conceptos..."
                className="w-full bg-raised border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-faint focus:outline-hidden focus:border-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-raised/60 border border-hairline rounded-xl p-4">
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">
                Hechos Verificados en VantaDB (kb/facts)
              </h3>
              <div className="max-h-[300px] overflow-y-auto">
                <SmartList
                  items={knowledgeData}
                  ariaLabel="Hechos verificados"
                  keyOf={(_f, idx) => idx}
                  empty={
                    <p className="py-4 text-center text-xs text-faint">
                      No se encontraron hechos para la búsqueda activa.
                    </p>
                  }
                  renderItem={(fact, idx) => (
                    <div
                      key={idx}
                      className="bg-paper/80 border border-hairline/80 rounded-lg p-2.5 text-xs"
                    >
                      <div className="font-medium text-ink">{fact.claim}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-faint">
                        <span className="max-w-[200px] truncate font-mono text-purple-400">
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
              <div className="bg-raised/60 border border-hairline rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-2">
                    Grafo Conceptual GraphRAG
                  </h3>
                  <p className="text-xs text-faint italic">
                    Sin visualización cableada — el canal graphRag existe pero no
                    devuelve nodos en este kicker (vacío honesto, sin grafo inventado).
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. VISTA DE ANALÍTICA (DOM-04)                            */}
      {/* ======================================================== */}
      {domainId === "analytics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <ChartBar size={20} className="text-emerald-400" />
              <h2 className="text-base font-semibold">Telemetría y Métricas de Inferencia (ego.analyst)</h2>
            </div>
            <span className="text-xs text-faint font-mono">Últimos 7 días</span>
          </div>

          <div className="bg-raised/60 border border-hairline rounded-xl p-4">
            <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">
              Consumo de Tokens por Jornada
            </h3>
            <div className="h-56 w-full">
              <Suspense fallback={<ChartFallback />}>
                <LazyTelemetryChart
                  data={analyticsData.series}
                  xKey="date"
                  yKey="totalTokens"
                  gradientId="domainTokensGrad"
                  stroke="#10b981"
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. VISTA DE CRM / SALES (DOM-05)                          */}
      {/* ======================================================== */}
      {domainId === "crm" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-rose-400" />
              <h2 className="text-base font-semibold">CRM & Pipeline de Ventas (ego.crm)</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1 text-ink">
                <CurrencyDollar size={16} className="text-emerald-400" />
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
            {crmData.deals.map((deal) => (
              <div
                key={deal.id}
                className="bg-raised/60 border border-hairline rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase text-rose-400 font-semibold">
                      {deal.stage}
                    </span>
                    <span className="text-[10px] text-faint">
                      {deal.probabilityPct}% prob
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-ink">{deal.title}</h4>
                </div>
                <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    ${deal.valueUsd.toLocaleString()} USD
                  </span>
                  {/* T12: detalle sin canal → deshabilitado honesto, nunca botón muerto. */}
                  <button
                    disabled
                    aria-disabled="true"
                    aria-label={`Detalle de ${deal.title} no disponible`}
                    title="Detalle del deal no disponible en este canal"
                    className="text-faint/40 cursor-not-allowed"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
