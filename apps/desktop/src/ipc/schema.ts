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
  projectId: z.string().optional(),
  subEgoId: z.string().optional(),
});

export type ChatStreamRequest = z.infer<typeof ChatStreamSchema>;

/**
 * Esquema de validación para configuración de servidores MCP locales (ACT-11).
 */
export const McpServerConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_\-.:]{1,64}$/, "ID de servidor inválido"),
  name: z.string().min(1).max(100),
  transport: z.enum(["stdio", "sse"]).default("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  toolPrefix: z.string().optional(),
  timeoutMs: z.number().int().positive().max(300000).optional(),
});

export type McpServerConfigRequest = z.infer<typeof McpServerConfigSchema>;

export const AddMcpServerSchema = z.object({
  config: McpServerConfigSchema,
  enabled: z.boolean().optional().default(true),
});

export type AddMcpServerRequest = z.infer<typeof AddMcpServerSchema>;

export const RemoveMcpServerSchema = z.object({
  id: z.string().min(1),
});

export type RemoveMcpServerRequest = z.infer<typeof RemoveMcpServerSchema>;

export const ToggleMcpServerSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

export type ToggleMcpServerRequest = z.infer<typeof ToggleMcpServerSchema>;

export const ListToolsFilterSchema = z.object({
  query: z.string().optional(),
  riskLevel: z.enum(["safe", "sensitive", "destructive"]).optional(),
  serverId: z.string().optional(),
});

export type ListToolsFilterRequest = z.infer<typeof ListToolsFilterSchema>;

export const ScanSkillsSchema = z.object({
  searchPaths: z.array(z.string()).optional(),
  projectRoot: z.string().optional(),
});

export type ScanSkillsRequest = z.infer<typeof ScanSkillsSchema>;

/**
 * Esquema de validación y persistencia de entidad Project (INT-03).
 */
export const ProjectManifestSchema = z.object({
  id: z.string().min(3).regex(/^(default|proj_[a-z0-9_-]+)$/, "ID de proyecto debe ser 'default' o comenzar con 'proj_'"),
  name: z.string().min(1, "El nombre del proyecto no puede estar vacío").max(100),
  rootPath: z.string().min(1, "La ruta del proyecto no puede estar vacía"),
  description: z.string().optional(),
  activeSubEgoId: z.string().default("ego.nucleus"),
  createdAtMs: z.number().int().positive().default(() => Date.now()),
  updatedAtMs: z.number().int().positive().default(() => Date.now()),
  metadata: z.record(z.unknown()).optional(),
});

export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "El nombre no puede estar vacío").max(100),
  rootPath: z.string().min(1, "La ruta de la carpeta no puede estar vacía"),
  description: z.string().optional(),
  activeSubEgoId: z.string().optional(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;

export const SelectProjectSchema = z.object({
  id: z.string().min(1, "El ID de proyecto no puede estar vacío"),
});

export type SelectProjectRequest = z.infer<typeof SelectProjectSchema>;

