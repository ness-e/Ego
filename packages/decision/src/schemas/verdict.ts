import { z } from 'zod';
import type { DecisionRunContext } from '@ego/execution';

export type { DecisionRunContext };

/**
 * Alias histórico de `DecisionRunContext` (F3T6/H01).
 * El tipo canónico vive en `@ego/execution` (fuente única); este esquema
 * Zod valida en runtime que el wire lo cumple exactamente.
 *
 * @deprecated Usar `DecisionRunContext` importado de `@ego/execution`.
 */
export type AdmittedRunContext = DecisionRunContext;

/**
 * Esquema del contexto inmutable de admisión (OCLW-01).
 * Traza la autoridad de ejecución, profundidad recursiva e identidad de corrida.
 * Valida exactamente `DecisionRunContext` (ver anotación `ZodType`).
 */
export const AdmittedRunContextSchema: z.ZodType<DecisionRunContext, z.ZodTypeDef, unknown> = z.object({
  runId: z.string().uuid(),
  timestamp: z.number().int().positive(),
  depth: z.number().int().min(0).default(0),
  parentRunId: z.string().uuid().optional(),
  origin: z.enum(['user_prompt', 'subego_delegation', 'background_task', 'system']).default('user_prompt')
});

/**
 * Esquema de precondición causal (COUC-03).
 */
export const PreconditionSchema = z.object({
  name: z.string(),
  satisfied: z.boolean(),
  reason: z.string().optional()
});

export type Precondition = z.infer<typeof PreconditionSchema>;

/**
 * Dominios canónicos de Ego.
 */
export const EgoDomainSchema = z.enum([
  'engineering',
  'knowledge',
  'product',
  'analytics',
  'crm',
  'general'
]);

export type EgoDomain = z.infer<typeof EgoDomainSchema>;

/**
 * Esquema canónico del Veredicto de Decisión (DecisionVerdictSchema).
 * Formato de salida estricto de la Decision Intelligence Layer.
 */
export const DecisionVerdictSchema = z.object({
  intentId: z.string().uuid(),
  intentDigest: z.string().length(64), // SHA-256 (COUC-03)
  domain: EgoDomainSchema,
  subEgoId: z.string().min(1),
  namespaceTargets: z.array(z.string()),
  requiresApproval: z.boolean(),
  llmTier: z.enum(['local', 'fast', 'advanced']),
  toolsEnabled: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  decidedBy: z.enum([
    'deterministic_rule',
    'specialized_scorer',
    'structured_llm',
    'fallback_nucleus'
  ]),
  preconditions: z.array(PreconditionSchema),
  admittedRunContext: AdmittedRunContextSchema,
  metadata: z.record(z.unknown()).optional()
});

export type DecisionVerdict = z.infer<typeof DecisionVerdictSchema>;
