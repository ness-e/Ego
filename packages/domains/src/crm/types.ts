import { z } from "zod";

export const CrmContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CrmContact = z.infer<typeof CrmContactSchema>;

export const DealStageSchema = z.enum([
  "lead",
  "qualified",
  "proposal",
  "won",
  "lost",
]);

export type DealStage = z.infer<typeof DealStageSchema>;

export const CrmDealSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  valueUsd: z.number().min(0),
  stage: DealStageSchema.default("lead"),
  contactId: z.string().min(1),
  probabilityPct: z.number().min(0).max(100).default(20),
  expectedCloseDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CrmDeal = z.infer<typeof CrmDealSchema>;

export const InteractionKindSchema = z.enum(["meeting", "email", "call", "note"]);
export type InteractionKind = z.infer<typeof InteractionKindSchema>;

export const CrmInteractionSchema = z.object({
  id: z.string().min(1),
  contactId: z.string().min(1),
  dealId: z.string().optional(),
  kind: InteractionKindSchema,
  summary: z.string().min(1),
  timestamp: z.string(),
});

export type CrmInteraction = z.infer<typeof CrmInteractionSchema>;

export interface PipelineSummary {
  totalPipelineUsd: number;
  weightedPipelineUsd: number;
  stagesCount: Record<DealStage, number>;
  stagesValueUsd: Record<DealStage, number>;
  dealsCount: number;
}
