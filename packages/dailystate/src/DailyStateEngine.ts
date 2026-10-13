import type { EgoMemoryAdapter } from "@ego/memory";
import type { EventBus } from "@ego/events";
import {
  DailyStateSummary,
  DailyStateSummarySchema,
  DailyStateOptions,
  RecentDecision,
  SuggestedGoal,
} from "./types.js";
import { parseActorId } from "./actorId.js";

export class DailyStateEngine {
  private memory: EgoMemoryAdapter;
  private eventBus?: EventBus;

  constructor(memory: EgoMemoryAdapter, options?: { eventBus?: EventBus }) {
    this.memory = memory;
    this.eventBus = options?.eventBus;
  }

  /**
   * Genera la fecha actual en formato ISO YYYY-MM-DD
   */
  public static getTodayDateString(d: Date = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Síntesis integral del estado del sistema al abrir la app (COUC-06, OCLW-07).
   * Ejecución estrictamente determinista y local ($0 costo de tokens y < 50ms).
   */
  async synthesize(options?: DailyStateOptions): Promise<DailyStateSummary> {
    const targetDate = options?.date || DailyStateEngine.getTodayDateString();
    const maxDecisions = options?.maxRecentDecisions ?? 10;
    const now = Date.now();

    // 1. Recopilar decisiones desde gov/audit
    let decisionsCount = 0;
    const recentDecisions: RecentDecision[] = [];
    try {
      const auditRecords = await this.memory.list("gov/audit", 50);
      decisionsCount = auditRecords.length;

      for (const rec of auditRecords) {
        const payload = (rec.payload || {}) as Record<string, unknown>;
        const metadata = (rec.metadata || {}) as Record<string, unknown>;

        const id = (payload.id as string) || rec.key;
        const title =
          (payload.title as string) ||
          (payload.action as string) ||
          (payload.summary as string) ||
          `Decisión ${id}`;
        const timestamp =
          typeof payload.timestamp === "number"
            ? payload.timestamp
            : typeof metadata.ts === "number"
            ? metadata.ts
            : now;
        const subEgoId = parseActorId(payload, metadata);

        recentDecisions.push({
          id,
          title,
          timestamp,
          subEgoId,
          impact: payload.impact as string | undefined,
        });
      }

      // Ordenar por timestamp descendente
      recentDecisions.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      // Degradación elegante en caso de namespace no inicializado
    }

    // 2. Tareas en segundo plano (tasks/*)
    let completedTasksCount = 0;
    let pendingTasksCount = 0;
    try {
      const taskRecords = await this.memory.list("tasks", 100);
      for (const rec of taskRecords) {
        const payload = (rec.payload || {}) as Record<string, unknown>;
        const status = String(payload.status || payload.state || "").toLowerCase();
        if (status === "completed" || status === "done" || status === "success") {
          completedTasksCount++;
        } else if (
          status === "pending" ||
          status === "running" ||
          status === "in_progress" ||
          status === "queued"
        ) {
          pendingTasksCount++;
        }
      }
    } catch {
      // Degradación elegante
    }

    // 3. Alertas en cuarentena preventiva (quarantine/pending)
    let quarantineAlertsCount = 0;
    try {
      const quarantineRecords = await this.memory.list("quarantine/pending", 100);
      quarantineAlertsCount = quarantineRecords.length;
    } catch {
      // Degradación elegante
    }

    // 4. Aprobaciones pendientes (gov/approvals o approvals)
    let pendingApprovalsCount = 0;
    try {
      const approvalRecords = await this.memory.list("gov/approvals", 100);
      pendingApprovalsCount = approvalRecords.filter((r) => {
        const payload = (r.payload || {}) as Record<string, unknown>;
        return !payload.resolved && payload.status !== "approved" && payload.status !== "rejected";
      }).length;
    } catch {
      // Degradación elegante
    }

    // 5. Métricas de consumo de tokens y costos estimados (metrics/telemetry)
    let totalTokensToday = 0;
    let estimatedCostUsd = 0;
    let p99LatencyMs = 0;
    try {
      const telemetryRecords = await this.memory.list("metrics/telemetry", 100);
      const latencies: number[] = [];

      for (const rec of telemetryRecords) {
        const payload = (rec.payload || {}) as Record<string, unknown>;
        const recDate =
          (payload.date as string) ||
          (typeof payload.timestamp === "number"
            ? DailyStateEngine.getTodayDateString(new Date(payload.timestamp))
            : "");

        if (!recDate || recDate === targetDate) {
          const tokens = Number(payload.tokens || payload.totalTokens || 0);
          const cost = Number(payload.costUsd || payload.cost || 0);
          const latency = Number(payload.latencyMs || 0);

          if (!Number.isNaN(tokens) && tokens > 0) totalTokensToday += tokens;
          if (!Number.isNaN(cost) && cost > 0) estimatedCostUsd += cost;
          if (!Number.isNaN(latency) && latency > 0) latencies.push(latency);
        }
      }

      if (latencies.length > 0) {
        latencies.sort((a, b) => a - b);
        const p99Index = Math.min(
          latencies.length - 1,
          Math.floor(latencies.length * 0.99)
        );
        p99LatencyMs = latencies[p99Index];
      }
    } catch {
      // Degradación elegante
    }

    // 6. Priorización determinista de objetivos del día ($0 costo de tokens)
    const suggestedGoals: SuggestedGoal[] = [];

    if (quarantineAlertsCount > 0) {
      suggestedGoals.push({
        id: "goal-quarantine",
        title: `Resolver ${quarantineAlertsCount} alerta(s) en cuarentena preventiva`,
        priority: "high",
        reason: "Datos o cambios externos aislados requieren revisión de seguridad.",
      });
    }

    if (pendingApprovalsCount > 0) {
      suggestedGoals.push({
        id: "goal-approvals",
        title: `Revisar ${pendingApprovalsCount} acción(es) pendiente(s) de aprobación humana (HITL)`,
        priority: "high",
        reason: "Herramientas de Nivel B/C o mutaciones sensibles en espera de confirmación.",
      });
    }

    if (pendingTasksCount > 0) {
      suggestedGoals.push({
        id: "goal-pending-tasks",
        title: `Supervisar ejecución de ${pendingTasksCount} tarea(s) en segundo plano`,
        priority: "normal",
        reason: "Procesos cognitivos o pipelines en background activos.",
      });
    }

    if (suggestedGoals.length === 0) {
      suggestedGoals.push({
        id: "goal-general-plan",
        title: "Definir los objetivos de la jornada en el Dynamic Workspace",
        priority: "normal",
        reason: "No hay alertas críticas pendientes; sistema listo para nuevas actividades.",
      });
    }

    const summary: DailyStateSummary = {
      date: targetDate,
      timestamp: now,
      completedTasksCount,
      pendingTasksCount,
      pendingApprovalsCount,
      decisionsCount,
      quarantineAlertsCount,
      totalTokensToday,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      p99LatencyMs: Math.round(p99LatencyMs),
      recentDecisions: recentDecisions.slice(0, maxDecisions),
      suggestedGoals,
    };

    // Validar contrato
    const validated = DailyStateSummarySchema.parse(summary);

    if (this.eventBus) {
      this.eventBus.emit("daily.state.synthesized", validated, {
        source: "DailyStateEngine",
      });
    }

    return validated;
  }
}
