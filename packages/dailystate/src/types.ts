import { z } from "zod";

export const RecentDecisionSchema = z.object({
  id: z.string(),
  title: z.string(),
  timestamp: z.number(),
  subEgoId: z.string(),
  impact: z.string().optional(),
});

export type RecentDecision = z.infer<typeof RecentDecisionSchema>;

export const SuggestedGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(["high", "normal"]),
  reason: z.string(),
});

export type SuggestedGoal = z.infer<typeof SuggestedGoalSchema>;

export const DailyStateSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato debe ser YYYY-MM-DD"),
  timestamp: z.number(),
  completedTasksCount: z.number().int().nonnegative(),
  pendingTasksCount: z.number().int().nonnegative(),
  /**
   * Aprobaciones pendientes de aprobación humana.
   *
   * EGO-FIND-52 (T9): `-1` significa **DESCONOCIDO** (la fuente
   * `gov/approvals` no se pudo leer). Antes un fallo de lectura producía `0`,
   * que sepresentsaba falsamente como "no hay aprobaciones pendientes".
   * Un valor `>= 0` es un conteo real.
   */
  pendingApprovalsCount: z.number().int().min(-1),
  decisionsCount: z.number().int().nonnegative(),
  quarantineAlertsCount: z.number().int().nonnegative(),
  totalTokensToday: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  p99LatencyMs: z.number().nonnegative().default(0),
  recentDecisions: z.array(RecentDecisionSchema),
  suggestedGoals: z.array(SuggestedGoalSchema),
  /**
   * EGO-FIND-52 (T9): `true` si alguna fuente no pudo leerse o se leyó de
   * forma parcial. Cuando es `true`, los contadores NO deben interpretarse
   * como "no hay nada": son cotas inferiores, no el estado real.
   */
  partial: z.boolean().default(false),
  /**
   * Namespaces que no se pudieron leer (o cuya lectura fue parcial).
   * Vacío ⇔ el resumen es completo.
   */
  sourcesUnavailable: z.array(z.string()).default([]),
});

export type DailyStateSummary = z.infer<typeof DailyStateSummarySchema>;

export const DailySnapshotRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.number(),
  checksum: z.string().length(64), // SHA-256 hex string
  summary: DailyStateSummarySchema,
  journalEntryId: z.string().optional(),
});

export type DailySnapshotRecord = z.infer<typeof DailySnapshotRecordSchema>;

export interface DailyStateOptions {
  date?: string;
  maxRecentDecisions?: number;
  includeTelemetry?: boolean;
}
