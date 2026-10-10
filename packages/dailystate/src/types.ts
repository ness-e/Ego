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
  pendingApprovalsCount: z.number().int().nonnegative(),
  decisionsCount: z.number().int().nonnegative(),
  quarantineAlertsCount: z.number().int().nonnegative(),
  totalTokensToday: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  p99LatencyMs: z.number().nonnegative().default(0),
  recentDecisions: z.array(RecentDecisionSchema),
  suggestedGoals: z.array(SuggestedGoalSchema),
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
