import React, { useEffect, useState } from "react";
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ego,
  type EngineeringWorktree,
  type ProductBacklogItem,
  type ProductEpic,
} from "../../lib/ego";

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
  const r = isRecord(v) ? v : {};
  return {
    totalPipelineUsd: asNumber(r.totalPipelineUsd, 48500),
    weightedPipelineUsd: asNumber(r.weightedPipelineUsd, 32550),
    dealsCount: asNumber(r.dealsCount, 3),
  };
}

export const DomainCanvasView: React.FC<DomainCanvasViewProps> = ({ domainId }) => {
  const [loading, setLoading] = useState(false);
  const bridge = ego();

  // Estados específicos de dominio
  const [engData, setEngData] = useState<{
    branch: string;
    clean: boolean;
    staged: string[];
    unstaged: string[];
    worktrees: WorktreeStatusItem[];
  }>({
    branch: "master",
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

    const loadDomainData = async () => {
      try {
        if (domainId === "engineering") {
          const res = await bridge.domains?.getEngineeringStatus();
          if (mounted && res?.ok) {
            setEngData({
              branch: res.gitStatus?.branch || "master",
              clean: res.gitStatus?.clean ?? true,
              staged: res.gitStatus?.staged || [],
              unstaged: res.gitStatus?.unstaged || [],
              worktrees: (res.worktrees ?? []).map(toWorktreeItem),
            });
          }
        } else if (domainId === "product") {
          const res = await bridge.domains?.productBacklog({ action: "list" });
          if (mounted && res?.ok) {
            setProductData({
              items: res.items
                ? res.items.map(toProductItem)
                : [
                    { id: "1", title: "Aislamiento de Worktrees", status: "done", priority: "p0" },
                    { id: "2", title: "Selector Contextual de Dominio", status: "in_progress", priority: "p1" },
                    { id: "3", title: "Conector MCP Oficial GitHub", status: "done", priority: "p1" },
                    { id: "4", title: "Generación Asistida de PRDs", status: "backlog", priority: "p2" },
                  ],
              epics: res.epics
                ? res.epics.map(toEpicItem)
                : [{ id: "e1", title: "Fase 09 — Dominios Funcionales" }],
            });
          }
        } else if (domainId === "knowledge") {
          const res = await bridge.domains?.knowledgeSearch(searchQuery || "vanta");
          if (mounted && res?.ok) {
            setKnowledgeData(flatMapValid(res.results, toKnowledgeFact));
          }
        } else if (domainId === "analytics") {
          const res = await bridge.domains?.analyticsSeries(7);
          if (mounted && res?.ok) {
            setAnalyticsData({
              series: (res.series ?? []).filter(isRecord),
              modelDistribution: (res.modelDistribution ?? []).filter(isRecord),
            });
          }
        } else if (domainId === "crm") {
          const res = await bridge.domains?.crmDeals({ action: "list" });
          if (mounted && res?.ok) {
            const mappedDeals = res.deals ? flatMapValid(res.deals, toCrmDeal) : null;
            setCrmData({
              deals: mappedDeals ?? [
                { id: "d1", title: "Licencia Anual Ego SOC", valueUsd: 25000, stage: "proposal", probabilityPct: 60 },
                { id: "d2", title: "Despliegue Local Privado", valueUsd: 8500, stage: "qualified", probabilityPct: 30 },
                { id: "d3", title: "Consultoría de Arquitectura", valueUsd: 15000, stage: "won", probabilityPct: 100 },
              ],
              contacts: (res.contacts ?? []).filter(isRecord),
              summary: toCrmSummary(res.summary),
            });
          }
        }
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, [domainId, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-paper text-ink overflow-y-auto p-4 space-y-4">
      {loading && (
        <div className="text-[10px] text-dim font-mono animate-pulse">
          Sincronizando estado de {domainId}...
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
              <span>{engData.branch}</span>
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
            <button className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium">
              <Plus size={14} />
              <span>Nuevo Ítem</span>
            </button>
          </div>

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
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {knowledgeData.length === 0 ? (
                  <p className="text-xs text-faint py-4 text-center">
                    No se encontraron hechos para la búsqueda activa.
                  </p>
                ) : (
                  knowledgeData.map((fact, idx) => (
                    <div
                      key={idx}
                      className="bg-paper/80 border border-hairline/80 rounded-lg p-2.5 text-xs"
                    >
                      <div className="text-ink font-medium">{fact.claim}</div>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-faint">
                        <span className="font-mono text-purple-400 truncate max-w-[200px]">
                          Fuente: {fact.source}
                        </span>
                        <span>Confianza: {Math.round(fact.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-raised/60 border border-hairline rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-2">
                  Grafo Conceptual GraphRAG
                </h3>
                <p className="text-xs text-faint mb-4">
                  Visualización bidimensional de aristas semánticas y entidades interconectadas.
                </p>
                <div className="h-44 border border-dashed border-hairline rounded-lg flex items-center justify-center text-faint text-xs font-mono">
                  [Visualizador de Nodos GraphRAG: 3 conceptos vinculados]
                </div>
              </div>
              <div className="text-right mt-3">
                <span className="text-[11px] text-purple-400 font-mono">
                  Búsqueda híbrida BM25 + ONNX activa
                </span>
              </div>
            </div>
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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="domainTokensGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="date" stroke="#737373" fontSize={10} tickLine={false} />
                  <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "8px" }}
                    labelStyle={{ color: "#a3a3a3", fontSize: "11px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalTokens"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#domainTokensGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
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
                  <button className="text-faint hover:text-white transition-colors">
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
