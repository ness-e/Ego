import { useState, useEffect } from "react";
import {
  Sun,
  Sparkle,
  ArrowRight,
  ListBullets,
  CheckCircle,
} from "@phosphor-icons/react";
import { MetricsConsole } from "./MetricsConsole.js";
import { PendingApprovals, PendingApprovalItem } from "./PendingApprovals.js";
import { JournalView } from "./JournalView.js";
import { Button } from "../ui-kit/Button.js";
import { Badge } from "../ui-kit/Badge.js";
import { ego as egoBridge } from "../../lib/ego.js";
import type { DailySummaryPayload, DailyDecisionEntry, PendingApprovalInfo } from "../../lib/ego.js";
import { dailyReportTemplate } from "@ego/ui-runtime";
import { getSharedCanvasBridge } from "../../lib/canvasBridgeSingleton.js";

/**
 * Cáscara canónica de superficie (misma que el Canvas y las vistas de
 * dominio): superficie `bg-panel`, borde hairline, radio del sistema y
 * elevación L1. Antes esta vista mezclaba superficies translúcidas y
 * bordes crudos: de ahí la incoherencia que detectó la auditoría.
 */
const SURFACE =
  "rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]";

export interface DailyDashboardProps {
  onNavigateToCanvas: () => void;
}

/** T06: meta del briefing con guarda de frontera (antes `any`). */
export interface SuggestedGoal {
  id: string;
  title: string;
  priority: string;
  reason: string;
}

function asSuggestedGoals(value: unknown): SuggestedGoal[] {  if (!Array.isArray(value)) return [];
  return value.filter(
    (g): g is SuggestedGoal =>
      typeof g === "object" &&
      g !== null &&
      typeof (g as { id?: unknown }).id === "string" &&
      typeof (g as { title?: unknown }).title === "string",
  );
}

/** T06: el payload diario lleva índice `unknown`; estrecha a número. */
function asMetric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * STAB-10 (noUncheckedIndexedAccess): `split("T")[0]` es `string|undefined`;
 * `slice(0, 10)` devuelve `string` siempre con idéntico resultado.
 */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** T14: `daily.listApprovals` es canónico tras T13 (`EgoBridge.daily`,
 * `DailyApprovalsResult`). Acceso directo tipado con `?.` (sin bridge en
 * tests → no-op honesto, solo HITL en vivo). */
function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** T12: normaliza una aprobación del backend o del bus HITL al ítem del panel. */
function toPendingItem(value: unknown): PendingApprovalItem | null {
  if (!isRecordLike(value)) return null;
  const r = value as Partial<PendingApprovalInfo> & Record<string, unknown>;
  if (typeof r.approvalId !== "string") return null;
  const riskLevel =
    r.riskLevel === "destructive" ? "critical" : r.riskLevel === "sensitive" ? "sensitive" : "normal";
  const actionName =
    typeof r.toolName === "string"
      ? r.toolName
      : typeof r.action === "object" && r.action !== null &&
          typeof (r.action as { toolName?: unknown }).toolName === "string"
        ? (r.action as { toolName: string }).toolName
        : r.approvalId;
  return {
    approvalId: r.approvalId,
    action: actionName,
    riskLevel,
    details: isRecordLike(r.arguments) ? (r.arguments as Record<string, unknown>) : undefined,
    toolName: typeof r.toolName === "string" ? r.toolName : undefined,
    timestamp: typeof r.createdAt === "number" ? r.createdAt : undefined,
  };
}

function toApprovalItems(value: unknown): PendingApprovalItem[] {
  if (!Array.isArray(value)) return [];
  const out: PendingApprovalItem[] = [];
  for (const v of value) {
    const m = toPendingItem(v);
    if (m) out.push(m);
  }
  return out;
}

/**
 * Traduce identificadores crudos de auditoría a lenguaje humano claro.
 */
export function formatDecisionSummary(raw: string): string {
  if (!raw) return "Acción operativa sin descripción";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "dream_consolidation_reinforce") {
    return "Consolidación cognitiva L0–L3 y refuerzo de memoria en VantaDB";
  }
  if (lower === "session_start") {
    return "Inicio de sesión soberana y verificación de índices LSM";
  }
  if (lower === "model_config_saved") {
    return "Actualización de configuración del Model Router";
  }
  if (lower === "tool_execution") {
    return "Ejecución de herramienta de sistema";
  }
  if (lower === "approval_resolved") {
    return "Resolución de solicitud de aprobación HITL";
  }
  if (trimmed.includes("_")) {
    const withSpaces = trimmed.replace(/_/g, " ");
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }
  return trimmed;
}

export interface GroupedDecision {
  id: string;
  subEgoId: string;
  title: string;
  formattedTitle: string;
  impact?: string;
  timestamp: number;
  count: number;
}

export function groupConsecutiveDecisions(items: DailyDecisionEntry[]): GroupedDecision[] {
  if (!items || items.length === 0) return [];
  const groups: GroupedDecision[] = [];

  for (const item of items) {
    const formatted = formatDecisionSummary(item.title);
    const last = groups[groups.length - 1];
    if (
      last &&
      last.subEgoId === item.subEgoId &&
      last.formattedTitle === formatted &&
      last.impact === item.impact
    ) {
      last.count += 1;
      if (item.timestamp > last.timestamp) {
        last.timestamp = item.timestamp;
      }
    } else {
      groups.push({
        id: item.id,
        subEgoId: item.subEgoId,
        title: item.title,
        formattedTitle: formatted,
        impact: item.impact,
        timestamp: item.timestamp,
        count: 1,
      });
    }
  }

  return groups;
}

export function DailyDashboard({ onNavigateToCanvas }: DailyDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummaryPayload | null>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [decisions, setDecisions] = useState<DailyDecisionEntry[]>([]);
  const [journalContent, setJournalContent] = useState("");
  const [isRefiningGoals, setIsRefiningGoals] = useState(false);
  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);
  // T12: error honesto (sustituye al summary inventado con meta supuesta).
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Carga inicial del estado diario
  useEffect(() => {
    let mounted = true;

    async function loadDailyData() {
      try {
        setLoading(true);
        setDailyError(null);
        const ego = window.ego;
        if (!ego?.daily) {
          // T12: sin canal daily no hay datos — error honesto, nunca summary inventado.
          if (mounted) {
            setSummary(null);
            setDailyError(
              "Canal daily no disponible en el bridge — sin datos de la jornada (vacío honesto)."
            );
          }
          return;
        }

        const [summaryRes, firstLaunchRes, decisionsRes] = await Promise.all([
          ego.daily.getSummary(),
          ego.daily.isFirstLaunch(),
          ego.daily.getDecisions({ limit: 15 }),
        ]);

        if (mounted) {
          if (summaryRes?.ok) {
            setSummary(summaryRes.summary);
          } else {
            setSummary(null);
            setDailyError(
              summaryRes?.error || "No se pudo leer el resumen diario del backend."
            );
          }
          if (firstLaunchRes?.ok) setIsFirstLaunch(firstLaunchRes.isFirstLaunch);
          if (decisionsRes?.ok) setDecisions(decisionsRes.decisions || []);

          // Cargar Journal del día
          const today = summaryRes?.summary?.date || todayISO();
          const journalRes = await ego.daily.journal({ action: "get", date: today });
          if (journalRes?.ok && mounted) {
            setJournalContent(journalRes.content || "");
          }

          // T14: aprobaciones reales vía `daily.listApprovals` canónico (T13).
          try {
            const listRes = await egoBridge().daily?.listApprovals?.();
            if (isRecordLike(listRes) && mounted) {
              const items = toApprovalItems(listRes.approvals);
              if (items.length > 0) {
                setApprovals((prev) => {
                  const known = new Set(prev.map((a) => a.approvalId));
                  return [...prev, ...items.filter((i) => !known.has(i.approvalId))];
                });
              }
            }
          } catch (listErr) {
            console.warn("[DailyDashboard] Sin listado de aprobaciones:", listErr);
          }

          // T08: sin aprobaciones falsas — `appr-pending-init` eliminado.
          // Sin canal de listado `ipc.daily.*`, la lista solo muestra
          // aprobaciones reales resueltas/pendientes vía HITL (vacío honesto).
        }
      } catch (err) {
        console.warn("[DailyDashboard] Error al cargar daily state:", err);
        if (mounted) {
          setSummary(null);
          setDailyError("Error al cargar el estado diario desde el backend.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDailyData();
    return () => {
      mounted = false;
    };
  }, []);

  // T12: viva vía HITL — las solicitudes del bus entran a la bandeja en tiempo real.
  useEffect(() => {
    const unsub = window.ego?.onApprovalRequest?.((req) => {
      const item = toPendingItem(req);
      if (!item) return;
      setApprovals((prev) =>
        prev.some((a) => a.approvalId === item.approvalId) ? prev : [...prev, item]
      );
    });
    return () => {
      unsub?.();
    };
  }, []);

  const handleRefineGoalsWithAI = async () => {
    setIsRefiningGoals(true);
    try {
      const ego = window.ego;
      if (ego?.daily?.refineGoals) {
        const res = await ego.daily.refineGoals({ date: summary?.date });
        if (res?.ok && res.goals) {
          setSummary((prev) => ({
            date: prev?.date ?? todayISO(),
            pendingApprovalsCount: prev?.pendingApprovalsCount ?? 0,
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
    const grouped = groupConsecutiveDecisions(decisions);
    return grouped
      .map(
        (d) =>
          `- **${d.subEgoId}**: ${d.formattedTitle}${d.count > 1 ? ` (×${d.count})` : ""} (${d.impact || "Operativo"})`
      )
      .join("\n");
  };

  const handleResolveApproval = async (approvalId: string, approved: boolean) => {
    const ego = window.ego;
    if (ego?.daily?.resolveApprovalsBatch) {
      await ego.daily.resolveApprovalsBatch({
        approvals: [{ approvalId, approved }],
      });
      setApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
      setSummary((prev) => ({
        date: prev?.date ?? todayISO(),
        pendingApprovalsCount: Math.max(0, (prev?.pendingApprovalsCount ?? 1) - 1),
        ...prev,
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
      setSummary((prev) => ({
        date: prev?.date ?? todayISO(),
        pendingApprovalsCount: Math.max(0, (prev?.pendingApprovalsCount ?? 0) - items.length),
        ...prev,
      }));
    }
  };

  const handleSaveDailySnapshot = async () => {
    const ego = window.ego;
    if (ego?.daily?.saveSnapshot) {
      const res = await ego.daily.saveSnapshot();
      // T12: navegar al Canvas solo ante snapshot ok real.
      if (res?.ok) {
        setIsFirstLaunch(false);
        try {
          const activeBriefing = {
            date: summary?.date || todayISO(),
            summaryText: (summary?.summaryText as string) || (summary?.summary as string) || "",
            metrics: {
              totalTokensToday: asMetric(summary?.totalTokensToday),
              estimatedCostUsd: asMetric(summary?.estimatedCostUsd),
            },
            completedOvernight: Array.isArray(summary?.completedOvernight)
              ? summary.completedOvernight
              : Array.from({ length: asMetric(summary?.completedTasksCount) }),
            pendingApprovals: approvals,
          };

          const manifests =
            typeof dailyReportTemplate === "function"
              ? (dailyReportTemplate as any)({
                  date: activeBriefing.date,
                  summaryText: activeBriefing.summaryText || "Sin resumen disponible.",
                  totalTokens: activeBriefing.metrics.totalTokensToday,
                  costUsd: activeBriefing.metrics.estimatedCostUsd,
                  completedTasks: activeBriefing.completedOvernight.length,
                  pendingApprovals: activeBriefing.pendingApprovals.length,
                })
              : ((dailyReportTemplate as any)?.components ?? []);

          if (Array.isArray(manifests) && manifests.length > 0) {
            const bridge = getSharedCanvasBridge();
            if (typeof bridge.applyA2UISurfaceUpdate === "function") {
              bridge.applyA2UISurfaceUpdate({
                surfaceId: "main",
                components: manifests,
              });
            } else {
              for (const m of manifests) {
                bridge.injectComponent(m);
              }
            }
          }
        } catch (injectErr) {
          console.warn("[DailyDashboard] Error generando o inyectando reporte diario en Canvas:", injectErr);
        }
        onNavigateToCanvas();
      } else {
        setDailyError(res?.error || "No se pudo guardar el snapshot diario — sin navegar al Canvas.");
      }
      return;
    }
    setDailyError("Canal daily no disponible — sin snapshot ni navegación al Canvas.");
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="flex items-center gap-2 text-xs font-mono text-dim">
          <div className="h-2 w-2 rounded-full bg-brand animate-ping" />
          <span>Sintetizando estado operativo de la jornada...</span>
        </div>
      </div>
    );
  }

  return (
    // `@container`: el reparto en columnas del briefing lo decide el ancho
    // REAL del panel, no el del viewport. Antes `lg:grid-cols-2` partía en
    // dos columnas aunque el panel midiera 200 px (el workspace es una
    // columna estrecha junto al chat), y la Consola de Consumo quedaba
    // con 91 px: sus 4 tarjetas de KPI se esprimían hasta cortar las
    // etiquetas a media palabra.
    <div className="@container mx-auto flex max-w-6xl flex-col gap-5 p-2 pb-10">
      {/* T12: error honesto visible en vez de datos inventados. */}
      {dailyError && (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-error/30 bg-error/10 px-3 py-2 font-mono text-xs text-error"
        >
          {dailyError}
        </div>
      )}
      {/* 1. Header de Bienvenida & Ritual Matutino en Tarjeta Bento */}
      <div className={`${SURFACE} p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-card)] bg-raised text-brand border border-hairline">
              <Sun size={20} weight="bold" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink tracking-tight">
                Briefing Diario · {summary?.date || "Jornada Actual"}
              </h2>
              <span className="text-xs text-faint">
                {isFirstLaunch
                  ? "Primer inicio de la jornada — Reconstrucción de contexto activa"
                  : "Sesión operativa en curso — Snapshots sincronizados con VantaDB"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* La flecha va DESPUÉS de la etiqueta a propósito: es una
                señal de "continúa en…" (hacia el Canvas), no un icono
                representativo de la acción. Por eso no usa la prop `icon`
                (que dibuja un icono PRECEDENTE). */}
            <Button
              variant="accent"
              size="md"
              onClick={handleSaveDailySnapshot}
              className="shrink-0 whitespace-nowrap"
            >
              Ir al Canvas
              <ArrowRight size={14} weight="bold" />
            </Button>
          </div>
        </div>

        {/* 2. Objetivos sugeridos para la jornada — "well" hundido
            (`bg-paper`) dentro de la tarjeta `bg-panel`. */}
        <div className="mt-1 rounded-[var(--radius-card)] border border-hairline bg-paper p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ListBullets size={15} className="text-dim" />
              <h3 className="text-sm font-semibold text-ink">
                Priorización de Objetivos del Día
              </h3>
            </div>

            <Button
              variant="secondary"
              size="md"
              icon={<Sparkle size={13} className="text-brand" />}
              onClick={handleRefineGoalsWithAI}
              disabled={isRefiningGoals}
              title="Gastar inferencia para sintetizar recomendaciones de alto nivel"
              className="shrink-0 whitespace-nowrap"
            >
              {isRefiningGoals ? "Refinando con IA..." : "Refinar con IA"}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 @[480px]:grid-cols-2">
            {asSuggestedGoals(summary?.suggestedGoals).length === 0 && (
              <p className="text-xs text-faint italic py-1">
                Sin objetivos sugeridos — el backend no devolvió metas (vacío honesto).
              </p>
            )}
            {asSuggestedGoals(summary?.suggestedGoals).map((goal) => (
              <div
                key={goal.id}
                className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5 hover:border-strong transition-colors"
              >
                <CheckCircle
                  size={16}
                  className={goal.priority === "high" ? "text-brand mt-0.5" : "text-dim mt-0.5"}
                  weight={goal.priority === "high" ? "bold" : "regular"}
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-ink truncate">{goal.title}</span>
                    {goal.priority === "high" && <Badge tone="warn">Alta</Badge>}
                  </div>
                  <span className="text-xs text-faint mt-0.5 leading-normal">{goal.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Grid de dos columnas principales. El corte a 2 columnas es de
          CONTENEDOR (≥ 720 px): por debajo, el briefing se apila en una
          sola columna para que cada bloque conserve un ancho legible. */}
      <div className="grid grid-cols-1 gap-5 @[720px]:grid-cols-2">
        {/* Columna Izquierda: Decisiones Feed & Journal */}
        <div className="flex flex-col gap-4">
          {/* Feed de Decisiones Flat (sin box-in-box y con deduplicación visual) */}
          <div className={SURFACE}>
            <div className="flex items-center justify-between pb-2 border-b border-hairline">
              <h3 className="text-sm font-semibold text-ink">
                Decisiones Acordadas Recientes ({decisions.length})
              </h3>
              <span className="font-mono text-xs text-faint">gov/audit · Inmutable</span>
            </div>

            <div className="divide-y divide-hairline max-h-56 overflow-y-auto">
              {decisions.length === 0 ? (
                <div className="text-xs text-faint italic p-3 text-center font-sans">
                  No se registran decisiones recientes en el proyecto actual.
                </div>
              ) : (
                groupConsecutiveDecisions(decisions).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 py-2 px-1 text-xs hover:bg-raised transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-dim shrink-0">
                        {new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-xs text-dim shrink-0">
                        {d.subEgoId}
                      </span>
                      <span className="text-xs text-ink truncate font-sans font-medium">
                        {d.formattedTitle}
                      </span>
                      {d.count > 1 && (
                        <span className="rounded-full bg-raised border border-hairline px-1.5 py-0.5 font-mono text-xs font-bold text-dim shrink-0">
                          ×{d.count}
                        </span>
                      )}
                    </div>
                    {d.impact && (
                      <span className="text-xs text-faint shrink-0 font-sans">
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
            date={summary?.date || todayISO()}
            initialContent={journalContent}
            onSave={handleSaveJournal}
            onInsertDailyDecisions={handleInsertDecisionsIntoJournal}
          />
        </div>

        {/* Columna Derecha: Consola de Métricas Recharts & Aprobaciones HITL */}
        <div className="flex flex-col gap-4">
          {/* MetricsConsole */}
          <MetricsConsole
            totalTokensToday={asMetric(summary?.totalTokensToday)}
            estimatedCostUsd={asMetric(summary?.estimatedCostUsd)}
            p99LatencyMs={asMetric(summary?.p99LatencyMs)}
            completedTasksCount={asMetric(summary?.completedTasksCount)}
            pendingTasksCount={asMetric(summary?.pendingTasksCount)}
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
