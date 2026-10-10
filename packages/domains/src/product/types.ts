import { z } from "zod";

export const BacklogItemStatusSchema = z.enum([
  "backlog",
  "in_progress",
  "review",
  "done",
  "blocked",
]);

export type BacklogItemStatus = z.infer<typeof BacklogItemStatusSchema>;

export const BacklogItemPrioritySchema = z.enum(["p0", "p1", "p2", "p3"]);
export type BacklogItemPriority = z.infer<typeof BacklogItemPrioritySchema>;

export const BacklogItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  epicId: z.string().optional(),
  status: BacklogItemStatusSchema.default("backlog"),
  priority: BacklogItemPrioritySchema.default("p1"),
  acceptanceCriteria: z.array(z.string()).default([]),
  assignedSubEgoId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BacklogItem = z.infer<typeof BacklogItemSchema>;

export const EpicStatusSchema = z.enum(["planning", "active", "completed"]);
export type EpicStatus = z.infer<typeof EpicStatusSchema>;

export const EpicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: EpicStatusSchema.default("planning"),
  targetQuarter: z.string().optional(),
  itemIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Epic = z.infer<typeof EpicSchema>;

export const ProductPrdSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  problemStatement: z.string().min(1),
  solutionOverview: z.string().min(1),
  userPersonas: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).min(1),
  successMetrics: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  version: z.number().int().positive().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductPrd = z.infer<typeof ProductPrdSchema>;
