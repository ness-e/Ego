import { z } from 'zod';
import { EgoDomainSchema, PreconditionSchema, AdmittedRunContextSchema } from './verdict.js';

/**
 * Esquema de petición de evaluación de intención.
 */
export const IntentRequestSchema = z.object({
  prompt: z.string().min(1),
  projectId: z.string().default('default'),
  workspacePath: z.string().optional(),
  activeSubEgoId: z.string().default('ego.nucleus'),
  runContext: AdmittedRunContextSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

export type IntentRequest = z.infer<typeof IntentRequestSchema>;

/**
 * Entidad extraída de la intención.
 */
export const IntentEntitySchema = z.object({
  type: z.enum(['file', 'git_command', 'query', 'url', 'model', 'task_type', 'variable']),
  value: z.string()
});

export type IntentEntity = z.infer<typeof IntentEntitySchema>;

/**
 * Esquema de intención clasificada con precondiciones causales (COUC-03).
 */
export const ClassifiedIntentSchema = z.object({
  intentId: z.string().uuid(),
  intentDigest: z.string().length(64), // SHA-256
  primaryDomain: EgoDomainSchema,
  secondaryDomains: z.array(EgoDomainSchema).default([]),
  urgency: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  confidence: z.number().min(0).max(1),
  entities: z.array(IntentEntitySchema).default([]),
  suggestedTools: z.array(z.string()).default([]),
  preconditions: z.array(PreconditionSchema).default([]),
  requiresApproval: z.boolean().default(false)
});

export type ClassifiedIntent = z.infer<typeof ClassifiedIntentSchema>;
