import type { EventBus } from "@ego/events";
import type { ModelRouter } from "@ego/models";
import {
  DailyStateSummary,
  SuggestedGoal,
  SuggestedGoalSchema,
} from "./types.js";

export class GoalPrioritizer {
  private eventBus?: EventBus;

  constructor(options?: { eventBus?: EventBus }) {
    this.eventBus = options?.eventBus;
  }

  /**
   * Priorización determinista local de objetivos ($0 costo de tokens y <5 ms) (DS-04).
   * Evalúa heurísticas basadas en estado del sistema: alertas de seguridad, HITL y tareas.
   */
  public prioritizeDeterministic(summary: DailyStateSummary): SuggestedGoal[] {
    const goals: SuggestedGoal[] = [];

    // 1. Alertas de seguridad en cuarentena (Máxima prioridad)
    if (summary.quarantineAlertsCount > 0) {
      goals.push({
        id: "goal-quarantine",
        title: `Resolver ${summary.quarantineAlertsCount} alerta(s) en cuarentena preventiva`,
        priority: "high",
        reason: "Archivos o datos externos aislados requieren revisión de seguridad antes de su asimilación.",
      });
    }

    // 2. Aprobaciones humanas pendientes (HITL)
    if (summary.pendingApprovalsCount > 0) {
      goals.push({
        id: "goal-approvals",
        title: `Revisar ${summary.pendingApprovalsCount} acción(es) pendiente(s) de aprobación (HITL)`,
        priority: "high",
        reason: "Herramientas o mutaciones sensibles en espera de autorización explícita.",
      });
    }

    // 3. Tareas en segundo plano en progreso o pendientes
    if (summary.pendingTasksCount > 0) {
      goals.push({
        id: "goal-pending-tasks",
        title: `Supervisar ejecución de ${summary.pendingTasksCount} tarea(s) en segundo plano`,
        priority: "normal",
        reason: "Sub-Egos y tareas de fondo tienen procesos activos pendientes de conclusión.",
      });
    }

    // 4. Auditoría de costos si el consumo diario supera umbral razonable
    if (summary.estimatedCostUsd > 1.0 || summary.totalTokensToday > 100000) {
      goals.push({
        id: "goal-audit-consumption",
        title: "Revisar umbral de consumo de tokens y presupuesto de inferencia",
        priority: "normal",
        reason: `El consumo actual supera el umbral diario ($${summary.estimatedCostUsd.toFixed(2)} USD / ${summary.totalTokensToday} tokens).`,
      });
    }

    // 5. Meta por defecto si el tablero está despejado
    if (goals.length === 0) {
      goals.push({
        id: "goal-general-plan",
        title: "Definir los objetivos de la jornada en el Dynamic Workspace",
        priority: "normal",
        reason: "El sistema se encuentra en estado óptimo sin alertas ni aprobaciones pendientes.",
      });
    }

    this.emitEvent(goals, "deterministic");
    return goals;
  }

  /**
   * Refinamiento cognitivo opcional con IA bajo demanda (DS-04).
   * Solo consume tokens si el usuario lo solicita explícitamente. Degrada a determinista si falla.
   */
  public async refineWithAI(
    summary: DailyStateSummary,
    router?: ModelRouter,
    promptOverride?: string
  ): Promise<SuggestedGoal[]> {
    if (!router) {
      return this.prioritizeDeterministic(summary);
    }

    const deterministicGoals = this.prioritizeDeterministic(summary);

    const systemPrompt =
      "Eres el planificador ejecutivo de Ego. Analiza el estado del sistema y devuelve una lista JSON de 2 a 4 objetivos prioritarios para la jornada. Cada objetivo debe tener { id: string, title: string, priority: 'high' | 'normal', reason: string } estrictamente.";

    const userPrompt =
      promptOverride ||
      `Estado del día ${summary.date}:
- Tareas completadas: ${summary.completedTasksCount}
- Tareas pendientes: ${summary.pendingTasksCount}
- Aprobaciones pendientes: ${summary.pendingApprovalsCount}
- Alertas cuarentena: ${summary.quarantineAlertsCount}
- Tokens consumidos: ${summary.totalTokensToday} (Coste: $${summary.estimatedCostUsd} USD)
- Decisiones recientes: ${JSON.stringify(summary.recentDecisions.map((d) => d.title))}
- Metas sugeridas base: ${JSON.stringify(deterministicGoals)}

Devuelve únicamente un bloque JSON array con los objetivos sugeridos.`;

    try {
      const response = await router.generateText("fast-classifier", {
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 500,
        temperature: 0.2,
      });

      const text = response.text.trim();
      // Extraer bloque JSON
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validated: SuggestedGoal[] = [];
          for (const item of parsed) {
            const val = SuggestedGoalSchema.safeParse(item);
            if (val.success) {
              validated.push(val.data);
            }
          }

          if (validated.length > 0) {
            this.emitEvent(validated, "ai-refined");
            return validated;
          }
        }
      }
    } catch (err) {
      console.warn("[GoalPrioritizer] Error en refinamiento con IA, degradando a determinista:", err);
    }

    // Degradación segura
    return deterministicGoals;
  }

  private emitEvent(goals: SuggestedGoal[], mode: "deterministic" | "ai-refined"): void {
    if (this.eventBus) {
      this.eventBus.emit(
        "daily.state.synthesized",
        { goals, mode },
        { source: "GoalPrioritizer" }
      );
    }
  }
}
