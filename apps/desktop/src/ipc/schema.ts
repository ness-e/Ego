import { z } from "zod";

/**
 * Esquema de validación estricta para operaciones de memoria sobre VantaDB.
 * Prohíbe llamadas a métodos arbitrarios y restringe las operaciones autorizadas.
 */
export const MemoryOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("put"),
    args: z.tuple([
      z.object({
        namespace: z.string().min(1),
        key: z.string().min(1),
        payload: z.unknown(),
        metadata: z.record(z.unknown()).optional(),
        ttl_ms: z.number().int().positive().optional(),
      }),
    ]),
  }),
  z.object({
    op: z.literal("get"),
    args: z.tuple([z.string().min(1), z.string().min(1)]),
  }),
  z.object({
    op: z.literal("delete"),
    args: z.tuple([z.string().min(1), z.string().min(1)]),
  }),
  z.object({
    op: z.literal("searchMulti"),
    args: z.tuple([
      z.array(z.string().min(1)),
      z.string(),
      z.object({
        topK: z.number().int().positive().max(100).optional(),
        excludeSuperseded: z.boolean().optional(),
        minConfidence: z.number().min(0).max(1).optional(),
      }).optional(),
    ]),
  }),
  z.object({
    op: z.literal("listNamespaces"),
    args: z.tuple([]),
  }),
  z.object({
    op: z.literal("recall"),
    args: z.tuple([z.string()]),
  }),
  z.object({
    op: z.literal("recordAudit"),
    args: z.tuple([
      z.string().min(1),
      z.string().min(1),
      z.record(z.unknown()),
      z.string().optional(),
    ]),
  }),
]);

export type MemoryOpRequest = z.infer<typeof MemoryOpSchema>;

/**
 * Esquema de validación para creación de Sub-Egos
 */
export const CreateSubEgoSchema = z.object({
  name: z.string().min(2).max(50),
  role: z.string().min(2).max(50),
  instructions: z.string().min(10),
  tools: z.array(z.string()).optional(),
});

export type CreateSubEgoRequest = z.infer<typeof CreateSubEgoSchema>;

/**
 * Esquema de validación para resolución de aprobaciones HITL (ACT-06, ACT-07).
 */
export const ResolveApprovalSchema = z.object({
  approvalId: z.string().min(1, "El approvalId no puede estar vacío"),
  approved: z.boolean(),
  reason: z.string().optional(),
  modifiedArguments: z.record(z.unknown()).optional(),
});

export type ResolveApprovalRequest = z.infer<typeof ResolveApprovalSchema>;

/**
 * Esquema de validación legacy para aprobación de acciones simples
 */
export const ApproveActionSchema = z.object({
  actionId: z.string().min(1),
  confirmed: z.boolean(),
  notes: z.string().optional(),
});

export type ApproveActionRequest = z.infer<typeof ApproveActionSchema>;

/**
 * Esquema de validación para solicitudes de streaming conversacional LLM
 */
export const ChatStreamSchema = z.object({
  prompt: z.string().min(1, "El prompt no puede estar vacío"),
  sessionId: z.string().optional(),
  systemPrompt: z.string().optional(),
});

export type ChatStreamRequest = z.infer<typeof ChatStreamSchema>;
