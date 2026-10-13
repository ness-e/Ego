import { useState, useEffect } from "react";
import {
  Sun,
  Sparkle,
  ArrowRight,
  ListBullets,
  CheckCircle,
} from "@phosphor-icons/react";
import { MetricsConsole } from "./MetricsConsole";
import { PendingApprovals, PendingApprovalItem } from "./PendingApprovals";
import { JournalView } from "./JournalView";

export interface DailyDashboardProps {
  onNavigateToCanvas: () => void;
}

export function DailyDashboard({ onNavigateToCanvas }: DailyDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [journalContent, setJournalContent] = useState("");
  const [isRefiningGoals, setIsRefiningGoals] = useState(false);
  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);

  // Carga inicial del estado diario
  useEffect(() => {
    let mounted = true;

    async function loadDailyData() {
      try {
        setLoading(true);
        const ego = window.ego;
        if (!ego?.daily) {
          // Fallback seguro si ego.daily no está expuesto
          setSummary({
            date: new Date().toISOString().split("T")[0],
            completedTasksCount: 0,
            pendingTasksCount: 0,
            pendingApprovalsCount: 0,
            decisionsCount: 0,
            quarantineAlertsCount: 0,
            totalTokensToday: 0,
            estimatedCostUsd: 0,
            p99LatencyMs: 0,
            recentDecisions: [],
            suggestedGoals: [
              {
                id: "goal-fallback",
                title: "Planificar los objetivos de la jornada en el Dynamic Workspace",
                priority: "normal",
                reason: "Sistema en estado óptimo sin alertas.",
              },
            ],
          });
          setLoading(false);
          return;
        }

        const [summaryRes, firstLaunchRes, decisionsRes] = await Promise.all([
          ego.daily.getSummary(),
          ego.daily.isFirstLaunch(),
          ego.daily.getDecisions({ limit: 15 }),
        ]);

        if (mounted) {
          if (summaryRes?.ok) setSummary(summaryRes.summary);
          if (firstLaunchRes?.ok) setIsFirstLaunch(firstLaunchRes.isFirstLaunch);
          if (decisionsRes?.ok) setDecisions(decisionsRes.decisions || []);

          // Cargar Journal del día
          const today = summaryRes?.summary?.date || new Date().toISOString().split("T")[0];
          const journalRes = await ego.daily.journal({ action: "get", date: today });
          if (journalRes?.ok && mounted) {
            setJournalContent(journalRes.content || "");
          }

          // Cargar aprobaciones pendientes si las hay
          if (summaryRes?.summary?.pendingApprovalsCount > 0) {
            setApprovals([
              {
                approvalId: "appr-pending-init",
                action: "Ejecución de mutación en filesystem",
                riskLevel: "sensitive",
                details: { path: "src/config.json" },
              },
            ]);
          }
        }
      } catch (err) {
        console.warn("[DailyDashboard] Error al cargar daily state:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDailyData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefineGoalsWithAI = async () => {
    setIsRefiningGoals(true);
    try {
      const ego = window.ego;
      if (ego?.daily?.refineGoals) {
        const res = await ego.daily.refineGoals({ date: summary?.date });
        if (res?.ok && res.goals) {
          setSummary((prev: any) => ({
            ...prev,
            suggestedGoals: res.goals,
          }));
        }
      }
    } catch (err) {
      console.warn("[DailyDashboard] Error refinando metas con IA:", err);
    } finally {
      setIsRefiningGoals(false);
    }
  };

  const handleSaveJournal = async (date: string, content: string) => {
    const ego = window.ego;
    if (ego?.daily?.journal) {
      await ego.daily.journal({ action: "save", date, content });
      setJournalContent(content);
    }
  };

  const handleInsertDecisionsIntoJournal = async (): Promise<string> => {
    if (decisions.length === 0) return "_No se registraron decisiones hoy._";
    return decisions
      .map((d) => `- **${d.subEgoId}**: ${d.title} (${d.impact || "Operativo"})`)
      .join("\n");
  };

  const handleResolveApproval = async (approvalId: string, approved: boolean) => {
    const ego = window.ego;
    if (ego?.daily?.resolveApprovalsBatch) {
      await ego.daily.resolveApprovalsBatch({
        approvals: [{ approvalId, approved }],
      });
      setApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
      setSummary((prev: any) => ({
        ...prev,
        pendingApprovalsCount: Math.max(0, (prev?.pendingApprovalsCount || 1) - 1),
      }));
    }
  };

  const handleResolveApprovalsBatch = async (
    items: Array<{ approvalId: string; approved: boolean }>
  ) => {
    const ego = window.ego;
    if (ego?.daily?.resolveApprovalsBatch) {
      await ego.daily.resolveApprovalsBatch({ approvals: items });
      const resolvedIds = new Set(items.map((i) => i.approvalId));
      setApprovals((prev) => prev.filter((a) => !resolvedIds.has(a.approvalId)));
      setSummary((prev: any) => ({
        ...prev,
        pendingApprovalsCount: Math.max(0, (prev?.pendingApprovalsCount || 0) - items.length),
      }));
    }
  };

  const handleSaveDailySnapshot = async () => {
    const ego = window.ego;
    if (ego?.daily?.saveSnapshot) {
      await ego.daily.saveSnapshot();
      setIsFirstLaunch(false);
    }
    onNavigateToCanvas();
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="flex items-center gap-2 text-xs font-mono text-dim">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
          <span>Sintetizando estado operativo de la jornada...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-2 max-w-6xl mx-auto pb-10">
      {/* 1. Header de Bienvenida & Ritual Matutino */}
      <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-gradient-to-r from-blue-950/20 via-panel to-panel p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sun size={18} weight="bold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">
                Briefing Diario · {summary?.date || "Jornada Actual"}
              </h2>
              <span className="text-[11px] text-faint">
                {isFirstLaunch
                  ? "Primer inicio de la jornada — Reconstrucción de contexto activa"
                  : "Sesión operativa en curso — Snapshots sincronizados con VantaDB"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDailySnapshot}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
            >
              <span>Ir al Canvas</span>
              <ArrowRight size={14} weight="bold" />
            </button>
          </div>
        </div>

        {/* 2. Objetivos sugeridos para la jornada */}
        <div className="mt-2 rounded-lg border border-hairline bg-raised/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ListBullets size={15} className="text-dim" />
              <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                Priorización de Objetivos del Día
              </span>
            </div>

            <button
              onClick={handleRefineGoalsWithAI}
              disabled={isRefiningGoals}
              className="flex items-center gap-1 rounded bg-raised px-2.5 py-1 text-[11px] font-medium text-ink border border-hairline hover:bg-panel transition-colors disabled:opacity-50 cursor-pointer"
              title="Gastar inferencia para sintetizar recomendaciones de alto nivel"
            >
              <Sparkle size={13} className="text-amber-400" />
              {isRefiningGoals ? "Refinando con IA..." : "Refinar con IA"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {summary?.suggestedGoals?.map((goal: any) => (
              <div
                key={goal.id}
                className="flex items-start gap-2.5 rounded border border-hairline bg-panel p-2.5"
              >
                <CheckCircle
                  size={16}
                  className={goal.priority === "high" ? "text-amber-400 mt-0.5" : "text-dim mt-0.5"}
                  weight={goal.priority === "high" ? "bold" : "regular"}
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-ink truncate">{goal.title}</span>
                    {goal.priority === "high" && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold uppercase text-amber-400 border border-amber-500/20">
                        Alta
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-faint mt-0.5">{goal.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Grid de dos columnas principales */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Columna Izquierda: Decisiones Feed & Journal */}
        <div className="flex flex-col gap-4">
          {/* Feed de Decisiones */}
          <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-raised/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Decisiones Acordadas Recientes ({decisions.length})
              </h3>
              <span className="font-mono text-[10px] text-faint">gov/audit · Inmutable</span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
              {decisions.length === 0 ? (
                <span className="text-xs text-faint italic p-3 text-center">
                  No se registran decisiones recientes en el proyecto actual.
                </span>
              ) : (
                decisions.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded border border-hairline bg-panel px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-dim shrink-0">
                        {new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="rounded bg-raised px-1.5 py-0.2 font-mono text-[10px] text-blue-400 border border-hairline shrink-0">
                        {d.subEgoId}
                      </span>
                      <span className="text-xs text-ink truncate font-medium">{d.title}</span>
                    </div>
                    {d.impact && (
                      <span className="text-[10px] text-faint shrink-0 font-mono">
                        {d.impact}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Journal Personal */}
          <JournalView
            date={summary?.date || new Date().toISOString().split("T")[0]}
            initialContent={journalContent}
            onSave={handleSaveJournal}
            onInsertDailyDecisions={handleInsertDecisionsIntoJournal}
          />
        </div>

        {/* Columna Derecha: Consola de Métricas Recharts & Aprobaciones HITL */}
        <div className="flex flex-col gap-4">
          {/* MetricsConsole */}
          <MetricsConsole
            totalTokensToday={summary?.totalTokensToday || 0}
            estimatedCostUsd={summary?.estimatedCostUsd || 0}
            p99LatencyMs={summary?.p99LatencyMs || 0}
            completedTasksCount={summary?.completedTasksCount || 0}
            pendingTasksCount={summary?.pendingTasksCount || 0}
          />

          {/* PendingApprovals */}
          <PendingApprovals
            approvals={approvals}
            onResolveOne={handleResolveApproval}
            onResolveBatch={handleResolveApprovalsBatch}
          />
        </div>
      </div>
    </div>
  );
}
