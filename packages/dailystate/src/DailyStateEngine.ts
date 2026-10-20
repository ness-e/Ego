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

/**
 * Registro de memoria tal y como lo devuelve el adapter.
 */
interface MemoryRecord {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Tamaño de página para los barridos paginados (EGO-FIND-52, T9).
 */
const PAGE_SIZE = 100;

/**
 * Tope defensivo de páginas por barrido (evita bucles infinitos si el
 * cursor no avanza).
 */
const MAX_PAGES = 1000;

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
   * Barrido paginado de un namespace completo.
   *
   * EGO-FIND-52 (T9): antes se leía una sola página (`list(ns, 50)`), de modo
   * que los contadores eran la longitud de esa página y `recentDecisions` no
   * contenía necesariamente las decisiones más recientes.
   *
   * Devuelve `null` si el namespace no se pudo leer (queda registrado en
   * `sourcesUnavailable`): el llamante NUNCA debe presentar un 0 como si
   * fuera el estado real.
   */
  private async sweepNamespace(namespace: string): Promise<MemoryRecord[] | null> {
    const adapter = this.memory as EgoMemoryAdapter & {
      listPaged?: (
        namespace: string,
        limit?: number,
        cursor?: number | string
      ) => Promise<{ records: MemoryRecord[]; nextCursor?: number | string }>;
    };

    if (typeof adapter.listPaged === "function") {
      const out: MemoryRecord[] = [];
      let cursor: number | string | undefined;
      let pages = 0;

      while (pages < MAX_PAGES) {
        pages++;
        const page = await adapter.listPaged(namespace, PAGE_SIZE, cursor);
        const records = page?.records ?? [];
        out.push(...records);

        if (!page?.nextCursor || page.nextCursor === cursor || records.length === 0) {
          break;
        }
        cursor = page.nextCursor;
      }
      return out;
    }

    // Fallback para adapters sin paginación (mocks legacy): una sola lectura.
    const records = await this.memory.list(namespace, PAGE_SIZE);
    return records;
  }

  /**
   * Síntesis integral del estado del sistema al abrir la app (COUC-06, OCLW-07).
   * Ejecución estrictamente determinista y local ($0 costo de tokens y < 50ms).
   */
  async synthesize(options?: DailyStateOptions): Promise<DailyStateSummary> {
    const targetDate = options?.date || DailyStateEngine.getTodayDateString();
    const maxDecisions = options?.maxRecentDecisions ?? 10;
    const now = Date.now();

    /** Namespaces que no se pudieron leer (EGO-FIND-52). */
    const sourcesUnavailable: string[] = [];

    // 1. Recopilar decisiones desde gov/audit
    let decisionsCount = 0;
    const recentDecisions: RecentDecision[] = [];
    try {
      const auditRecords = await this.sweepNamespace("gov/audit");
      if (auditRecords === null) {
        sourcesUnavailable.push("gov/audit");
      } else {
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

        // Ordenar por timestamp descendente y conservar solo las N más recientes
        // (ahora sobre el BARRIDO COMPLETO, no sobre la primera página).
        recentDecisions.sort((a, b) => b.timestamp - a.timestamp);
        if (recentDecisions.length > maxDecisions) {
          recentDecisions.length = maxDecisions;
        }
      }
    } catch (err: unknown) {
      sourcesUnavailable.push("gov/audit");
      console.warn(
        `[DailyStateEngine] No se pudo leer 'gov/audit': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // 2. Tareas en segundo plano (tasks/*)
    let completedTasksCount = 0;
    let pendingTasksCount = 0;
    try {
      const taskRecords = await this.sweepNamespace("tasks");
      if (taskRecords === null) {
        sourcesUnavailable.push("tasks");
      } else {
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
      }
    } catch (err: unknown) {
      sourcesUnavailable.push("tasks");
      console.warn(
        `[DailyStateEngine] No se pudo leer 'tasks': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // 3. Alertas en cuarentena preventiva (quarantine/pending)
    let quarantineAlertsCount = 0;
    try {
      const quarantineRecords = await this.sweepNamespace("quarantine/pending");
      if (quarantineRecords === null) {
        sourcesUnavailable.push("quarantine/pending");
      } else {
        quarantineAlertsCount = quarantineRecords.length;
      }
    } catch (err: unknown) {
      sourcesUnavailable.push("quarantine/pending");
      console.warn(
        `[DailyStateEngine] No se pudo leer 'quarantine/pending': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // 4. Aprobaciones pendientes (gov/approvals)
    let pendingApprovalsCount = 0;
    let approvalsKnown = true;
    try {
      const approvalRecords = await this.sweepNamespace("gov/approvals");
      if (approvalRecords === null) {
        sourcesUnavailable.push("gov/approvals");
        approvalsKnown = false;
      } else {
        pendingApprovalsCount = approvalRecords.filter((r) => {
          const payload = (r.payload || {}) as Record<string, unknown>;
          return !payload.resolved && payload.status !== "approved" && payload.status !== "rejected";
        }).length;
      }
    } catch (err: unknown) {
      sourcesUnavailable.push("gov/approvals");
      approvalsKnown = false;
      console.warn(
        `[DailyStateEngine] No se pudo leer 'gov/approvals': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // 5. Métricas de consumo de tokens y costos estimados (metrics/telemetry)
    let totalTokensToday = 0;
    let estimatedCostUsd = 0;
    let p99LatencyMs = 0;
    try {
      const telemetryRecords = await this.sweepNamespace("metrics/telemetry");
      if (telemetryRecords === null) {
        sourcesUnavailable.push("metrics/telemetry");
      } else {
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
          p99LatencyMs = latencies[p99Index] ?? 0;
        }
      }
    } catch (err: unknown) {
      sourcesUnavailable.push("metrics/telemetry");
      console.warn(
        `[DailyStateEngine] No se pudo leer 'metrics/telemetry': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
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
    } else if (!approvalsKnown) {
      // EGO-FIND-52: no se afirma "0 aprobaciones" si no se pudo leer la fuente.
      suggestedGoals.push({
        id: "goal-approvals-unknown",
        title: "Verificar las aprobaciones pendientes (fuente no disponible)",
        priority: "high",
        reason:
          "No se pudo leer 'gov/approvals': el estado de aprobaciones es DESCONOCIDO, no cero.",
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
      // EGO-FIND-52: si la fuente no está disponible, el contador NO es 0.
      // Se marca con -1 (cota inferior indeterminada) y el resumen declara
      // `partial: true` + `sourcesUnavailable`.
      pendingApprovalsCount: approvalsKnown ? pendingApprovalsCount : -1,
      decisionsCount,
      quarantineAlertsCount,
      totalTokensToday,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      p99LatencyMs: Math.round(p99LatencyMs),
      recentDecisions,
      suggestedGoals,
      partial: sourcesUnavailable.length > 0,
      sourcesUnavailable,
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
