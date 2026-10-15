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
 * Esquema de validación para creación de Sub-Egos en sus 3 modalidades (INT-04 / SUB-02)
 */
export const CreateSubEgoSchema = z.union([
  z.object({
    mode: z.literal("custom").optional(),
    name: z.string().min(2).max(50),
    role: z.string().min(2).max(50),
    instructions: z.string().min(10),
    tools: z.array(z.string()).optional(),
    budget: z.object({
      maxTokensPerCall: z.number().int().positive().optional(),
      maxDailyCostUsd: z.number().positive().optional(),
      requiresApprovalAboveUsd: z.number().positive().optional(),
    }).optional(),
  }),
  z.object({
    mode: z.literal("template"),
    templateId: z.string().min(1),
    name: z.string().min(2).max(50).optional(),
    overrides: z.record(z.unknown()).optional(),
  }),
  z.object({
    mode: z.literal("declaration"),
    format: z.enum(["json", "yaml"]),
    rawText: z.string().min(10),
  }),
]);

export type CreateSubEgoRequest = z.infer<typeof CreateSubEgoSchema>;

export const ToggleSubEgoStateSchema = z.object({
  subEgoId: z.string().min(1, "El ID de Sub-Ego no puede estar vacío"),
  state: z.enum(["active", "paused"]),
});

export type ToggleSubEgoStateRequest = z.infer<typeof ToggleSubEgoStateSchema>;

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
 * Esquema de validación para cancelación del turno LLM en curso
 * (`ipc.llm.cancel`). Sin `turnId` aborta todos los turnos activos.
 */
export const LlmCancelSchema = z.object({
  turnId: z.string().min(1).max(128).optional(),
});

export type LlmCancelRequest = z.infer<typeof LlmCancelSchema>;

/**
 * Esquema de validación para configuración de servidores MCP (ACT-11 + STAB-12).
 * Transportes: `stdio` (subproceso local), `sse` (legacy), `streamable-http`
 * (POST JSON-RPC stateless sobre https pública con SSRF fail-closed).
 * Reglas por-transport (fail-closed): http exige `url` https sin credenciales
 * y prohíbe `authorization` en headers (secretos → env/vault); stdio/sse
 * exigen `command` (allowlist H31 en `McpClient`).
 */
export const McpServerConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_\-.:]{1,64}$/, "ID de servidor inválido"),
  name: z.string().min(1).max(100),
  transport: z.enum(["stdio", "sse", "streamable-http"]).default("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  toolPrefix: z.string().optional(),
  timeoutMs: z.number().int().positive().max(300000).optional(),
  url: z.string().max(2048).optional(),
  headers: z.record(z.string().max(4096)).optional(),
}).superRefine((cfg, ctx) => {
  if (cfg.transport === "streamable-http") {
    const raw = (cfg.url ?? "").trim();
    if (raw.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "transport streamable-http exige url" });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "url malformada" });
      return;
    }
    if (parsed.protocol !== "https:") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "solo https permitido (SSRF fail-closed)" });
    }
    if (parsed.username.length > 0 || parsed.password.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "credenciales en URL prohibidas (usar env/vault)" });
    }
    for (const name of Object.keys(cfg.headers ?? {})) {
      const lower = name.toLowerCase();
      if (lower === "authorization" || lower === "proxy-authorization") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["headers"], message: `header "${name}" prohibido (secreto → env/vault)` });
      }
    }
  }
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

/**
 * Approval por-tool MCP + toolsets por perfil (CFG-07).
 * Gobernanza fina sobre `ipc.mcp.*`: reglas por herramienta
 * (`mcp_servers.<server>.tools.<tool>` → allow/ask/deny, deny gana) +
 * toolsets canónicos enable/disable por perfil + doc de reset tras
 * cambio de tools (preserva prompt caching: solo se re-emite el
 * sufijo de tools, el prefijo cacheado queda intacto).
 * Persistencia canónica: VantaDB `gov/settings/mcp_tools` (Zod
 * fail-closed, sin archivos `~/.codex`). Paridad de tipos con
 * `packages/tools/src/toolsets.ts` (duplicado intencional: este módulo
 * lo importa el preload, sin imports de workspace).
 */
export const McpToolsetNameSchema = z.enum([
  "web",
  "search",
  "browser",
  "terminal",
  "file",
  "memory",
  "delegation",
  "cronjob",
]);

export type McpToolsetName = z.infer<typeof McpToolsetNameSchema>;

/** Decisión por-tool: `allow` = approve explícito, `deny` veta (deny gana), `ask` = pide aprobación. */
export const McpToolDecisionSchema = z.enum(["allow", "ask", "deny"]);

export type McpToolDecision = z.infer<typeof McpToolDecisionSchema>;

/** Regla por-tool: match EXACTO `serverId` + `tool` (sin globs; el todo-servidor se gobierna con `ipc.mcp.toggleServer`). */
export const McpToolApprovalRuleSchema = z.object({
  serverId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-.:]{1,64}$/, "ID de servidor inválido"),
  tool: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-.]+$/, "Nombre de tool inválido"),
  decision: McpToolDecisionSchema,
});

export type McpToolApprovalRule = z.infer<typeof McpToolApprovalRuleSchema>;

export const McpToolApprovalsSchema = z.object({
  rules: z.array(McpToolApprovalRuleSchema).max(256).default([]),
});

export type McpToolApprovals = z.infer<typeof McpToolApprovalsSchema>;

/**
 * Toolsets enable/disable por perfil. El `profile` duplica el enum
 * `SubEgoProfileNameSchema` (CFG-03) por orden de declaración (este
 * bloque vive en la sección MCP, anterior a perfiles) y regla no-touch:
 * paridad documentada, sin modificar el schema de perfiles.
 * Semántica (deny gana, ver `toolsets.ts`): `disabled` veta siempre;
 * `enabled: []` = sin restricción allowlist (back-compat).
 */
export const ProfileToolsetsSchema = z.object({
  profile: z.enum(["planner", "reviewer", "researcher", "builder"]),
  enabled: z.array(McpToolsetNameSchema).max(16).default([]),
  disabled: z.array(McpToolsetNameSchema).max(16).default([]),
});

export type ProfileToolsets = z.infer<typeof ProfileToolsetsSchema>;

/**
 * Doc de reset tras cambio de tools: el consumidor debe re-emitir el
 * bloque de tools y versionarlo; `preservePromptCaching: true` obliga a
 * conservar el breakpoint de caché (prefijo estable, solo se invalida el
 * sufijo de tools). Generado por `buildToolsResetDoc` en `@ego/tools`.
 */
export const McpToolsResetDocSchema = z.object({
  version: z.number().int().positive(),
  changedToolsets: z.array(McpToolsetNameSchema).max(16).default([]),
  preservePromptCaching: z.boolean().default(true),
  note: z.string().max(2000).optional(),
});

export type McpToolsResetDoc = z.infer<typeof McpToolsResetDocSchema>;

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

/**
 * Reasoning effort + aliases + review model (CFG-04).
 * Decisión: aliases `fast` = barato (haiku/mini) y `smart` = frontier
 * (opus/sonnet); planner = frontier, hijos = baratos. CFG-04 resuelve
 * los aliases contra el router (`ModelRouter.resolveModelIdOrAlias`).
 * Todo opcional/back-compat: configs existentes parsean igual.
 * `""` = ausente (senders que reenvían spreads con strings vacías).
 */
export const EffortLevelSchema = z.enum(["minimal", "low", "medium", "high", "xhigh"]);

export type EffortLevel = z.infer<typeof EffortLevelSchema>;

const emptyStringToUndefined = (v: unknown): unknown =>
  typeof v === "string" && v.trim().length === 0 ? undefined : v;

/** Id de modelo o alias (`fast`/`smart`): `""` se normaliza a ausente. */
export const ModelIdSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).max(128).optional()
);

export type ModelId = z.infer<typeof ModelIdSchema>;

/**
 * STAB-06: esfuerzo de razonamiento portable (subconjunto provider 1:1 con
 * el parámetro `reasoning` de AI SDK v7). Mapea a `EffortLevel` interno
 * solo cuando `effortLevel` está ausente (ver `configureFromSettings`).
 */
export const ReasoningEffortSchema = z.enum(["low", "medium", "high"]);

export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

export const ModelAliasesSchema = z.object({
  fast: ModelIdSchema,
  smart: ModelIdSchema,
});

export type ModelAliases = z.infer<typeof ModelAliasesSchema>;

/**
 * Esquema de configuración de proveedores de modelos y BYOK (INT-02 + Task 10).
 * Forma canónica por proveedor: `<p>Key` (solo escritura por IPC; el main la
 * cifra con `encryptCredential` y persiste `<p>KeyEncrypted`). El getter NUNCA
 * retorna el secreto: solo `maskKey`. `apiKey`/`baseUrl` se conservan como
 * legado de clave única (compat: `""` = sin key, fallback mock intacto).
 * Las keys por proveedor exigen no-vacío cuando están presentes: `""` se
 * rechaza (contrato Task 10: payload sin schema o con key vacía/tipo
 * inválido es rechazado).
 */
export const ModelConfigSchema = z.object({
  activeProvider: z.enum(["openai", "anthropic", "google", "deepseek", "ollama", "mock"]),
  apiKey: z.string().optional(),
  openaiKey: z.string().min(1, "La clave de OpenAI no puede estar vacía").optional(),
  anthropicKey: z.string().min(1, "La clave de Anthropic no puede estar vacía").optional(),
  googleKey: z.string().min(1, "La clave de Google no puede estar vacía").optional(),
  deepseekKey: z.string().min(1, "La clave de DeepSeek no puede estar vacía").optional(),
  baseUrl: z.string().optional(),
  openaiBaseURL: z.string().optional(),
  deepseekBaseURL: z.string().optional(),
  ollamaBaseURL: z.string().optional(),
  modelName: z.string().optional(),
  effortLevel: EffortLevelSchema.optional(),
  /** STAB-06: effort portable; `effortLevel` explícito gana si ambos presentes. */
  reasoningEffort: ReasoningEffortSchema.optional(),
  /** STAB-06: temperatura global del turno (0-2); lo explícito per-call gana. */
  temperature: z.number().min(0).max(2).optional(),
  modelAliases: ModelAliasesSchema.optional(),
  reviewModel: ModelIdSchema,
  availableModels: z.array(z.string().min(1).max(128)).max(32).optional(),
  fallbackModel: ModelIdSchema,
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Esquemas de validación para Knowledge y Memoria a Largo Plazo (Fase 06)
 */
export const KnowledgeIngestSchema = z.object({
  filePath: z.string().optional(),
  content: z.string().optional(),
  title: z.string().optional(),
  mimeType: z.string().default("text/markdown"),
  projectId: z.string().default("default"),
});

export type KnowledgeIngestRequest = z.infer<typeof KnowledgeIngestSchema>;

export const KnowledgeHybridSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(100).default(10),
  minConfidence: z.number().min(0).max(1).default(0.7),
  namespaces: z.array(z.string()).default(["kb/docs", "kb/facts", "gov/audit"]),
});

export type KnowledgeHybridSearchRequest = z.infer<typeof KnowledgeHybridSearchSchema>;

export const KnowledgeGraphRagSchema = z.object({
  query: z.string().min(1),
  maxDepth: z.number().int().positive().max(5).default(2),
  maxDegreePerNode: z.number().int().positive().max(50).default(10),
  maxTotalNodes: z.number().int().positive().max(100).default(20),
  minSimilarity: z.number().min(0).max(1).default(0.7),
});

export type KnowledgeGraphRagRequest = z.infer<typeof KnowledgeGraphRagSchema>;

export const KnowledgeQuarantineActionSchema = z.object({
  action: z.enum(["list", "promote", "reject", "purge"]),
  factId: z.string().optional(),
  reason: z.string().optional(),
  promotedBy: z.string().default("user"),
});

export type KnowledgeQuarantineActionRequest = z.infer<typeof KnowledgeQuarantineActionSchema>;

export const KnowledgeAsOfSchema = z.object({
  targetTime: z.number(),
  namespace: z.string().default("kb/facts"),
  subject: z.string().optional(),
  limit: z.number().int().positive().default(100),
});

export type KnowledgeAsOfRequest = z.infer<typeof KnowledgeAsOfSchema>;

export const KnowledgeExplainArtifactSchema = z.object({
  filePath: z.string().min(1),
});

export type KnowledgeExplainArtifactRequest = z.infer<typeof KnowledgeExplainArtifactSchema>;

/**
 * Esquemas de validación para Daily State (Fase 08)
 */
export const DailyStateGetSummarySchema = z.object({
  date: z.string().optional(),
});

export type DailyStateGetSummaryRequest = z.infer<typeof DailyStateGetSummarySchema>;

export const DailyStateRefineGoalsSchema = z.object({
  date: z.string().optional(),
});

export type DailyStateRefineGoalsRequest = z.infer<typeof DailyStateRefineGoalsSchema>;

export const DailyStateGetDecisionsSchema = z.object({
  limit: z.number().int().positive().optional(),
  since: z.number().optional(),
  subEgoId: z.string().optional(),
});

export type DailyStateGetDecisionsRequest = z.infer<typeof DailyStateGetDecisionsSchema>;

export const DailyStateResolveApprovalsBatchSchema = z.object({
  approvals: z.array(
    z.object({
      approvalId: z.string().min(1),
      approved: z.boolean(),
      reason: z.string().optional(),
    })
  ),
});

export type DailyStateResolveApprovalsBatchRequest = z.infer<typeof DailyStateResolveApprovalsBatchSchema>;

export const DailyStateJournalSchema = z.object({
  action: z.enum(["get", "save"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().optional(),
});

export type DailyStateJournalRequest = z.infer<typeof DailyStateJournalSchema>;

export const DailyStateFirstLaunchSchema = z.object({
  date: z.string().optional(),
});

export type DailyStateFirstLaunchRequest = z.infer<typeof DailyStateFirstLaunchSchema>;

/**
 * Esquemas de validación para Dominios Funcionales (Fase 09 / DOM-08)
 */
export const DomainGetSchema = z.object({
  domainId: z.string().min(1),
});

export type DomainGetRequest = z.infer<typeof DomainGetSchema>;

export const DomainSwitchSchema = z.object({
  domainId: z.string().min(1),
  viewId: z.string().optional(),
});

export type DomainSwitchRequest = z.infer<typeof DomainSwitchSchema>;

export const DomainEngineeringStatusSchema = z.object({
  workspaceRoot: z.string().optional(),
});

export type DomainEngineeringStatusRequest = z.infer<typeof DomainEngineeringStatusSchema>;

export const DomainProductBacklogSchema = z.object({
  action: z.enum(["list", "create", "updateStatus"]),
  payload: z.unknown().optional(),
});

export type DomainProductBacklogRequest = z.infer<typeof DomainProductBacklogSchema>;

export const DomainKnowledgeSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export type DomainKnowledgeSearchRequest = z.infer<typeof DomainKnowledgeSearchSchema>;

export const DomainAnalyticsSeriesSchema = z.object({
  days: z.number().int().positive().optional(),
});

export type DomainAnalyticsSeriesRequest = z.infer<typeof DomainAnalyticsSeriesSchema>;

export const DomainCrmDealsSchema = z.object({
  action: z.enum(["list", "create", "updateStage", "summary"]),
  payload: z.unknown().optional(),
});

export type DomainCrmDealsRequest = z.infer<typeof DomainCrmDealsSchema>;

/**
 * Esquemas de validación para canales IPC sin schema dedicado (SEC-02).
 * Cubren los 5 handlers que validaban con coerción manual (`typeof`)
 * en vez de Zod: límites sin acotar, fechas sin formato, projectId
 * vacío y paquetes de importación sin forma (estos últimos aceptaban
 * `string`, lo que exponía `fs.readFile` a paths del renderer).
 */
export const DecisionListAuditsSchema = z.number().int().positive().max(500).optional();

export type DecisionListAuditsRequest = z.infer<typeof DecisionListAuditsSchema>;

export const KnowledgeExportSchema = z.string().min(1).max(128).optional();

export type KnowledgeExportRequest = z.infer<typeof KnowledgeExportSchema>;

export const KnowledgeImportSchema = z.object({
  version: z.string().min(1),
  projectId: z.string().min(1),
  exportedAt: z.number().optional(),
  checksum: z.string().min(1),
  totalRecords: z.number().int().nonnegative().optional(),
  records: z
    .array(
      z.object({
        namespace: z.string().min(1),
        key: z.string().min(1),
        payload: z.unknown(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .max(100000),
});

export type KnowledgeImportRequest = z.infer<typeof KnowledgeImportSchema>;

export const DailyGetSnapshotSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    // STAB-10 (noUncheckedIndexedAccess): el regex garantiza 3 partes
    // numéricas; el guard es defensivo y nunca dispara en runtime.
    if (y === undefined || m === undefined || d === undefined) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Fecha calendario inválida")
  .optional();

export type DailyGetSnapshotRequest = z.infer<typeof DailyGetSnapshotSchema>;

export const DailyListSnapshotsSchema = z.number().int().positive().max(500).optional();

export type DailyListSnapshotsRequest = z.infer<typeof DailyListSnapshotsSchema>;

/**
 * Esquemas T03: tareas en background + terminal viva (validación Zod en main,
 * fail-closed: sin schema válido → rechazado antes de tocar motores/procesos).
 */
export const TasksListSchema = z
  .object({
    status: z
      .array(
        z.enum([
          "submitted",
          "queued",
          "running",
          "paused",
          "completed",
          "failed",
          "cancelled",
        ])
      )
      .optional(),
    subEgoId: z.string().min(1).max(128).optional(),
    priority: z.array(z.enum(["low", "normal", "high", "critical"])).optional(),
    limit: z.number().int().positive().max(500).optional(),
  })
  .optional();

export type TasksListRequest = z.infer<typeof TasksListSchema>;

export const TasksCancelSchema = z.object({
  taskId: z.string().min(1).max(256),
  reason: z.string().max(500).optional(),
});

export type TasksCancelRequest = z.infer<typeof TasksCancelSchema>;

/**
 * Esquema Task4 (D2): silenciado del flotante desde el renderer
 * (`window.egoFloating.setMuted` → `ipc.floating.setMuted`).
 * Cierra la deuda documentada en `preload.ts:105-111` (Task3).
 */
export const FloatingSetMutedSchema = z.object({
  muted: z.boolean(),
});

export type FloatingSetMutedRequest = z.infer<typeof FloatingSetMutedSchema>;

export const TerminalSpawnSchema = z.object({
  command: z.string().min(1).max(8000),
  cwd: z.string().min(1).max(1024).optional(),
  timeoutMs: z.number().int().positive().max(300_000).optional(),
});

export type TerminalSpawnRequest = z.infer<typeof TerminalSpawnSchema>;

export const TerminalStdinSchema = z.object({
  sessionId: z.string().min(1).max(128),
  data: z.string().max(65_536),
});

export type TerminalStdinRequest = z.infer<typeof TerminalStdinSchema>;

export const TerminalKillSchema = z.object({
  sessionId: z.string().min(1).max(128),
});

export type TerminalKillRequest = z.infer<typeof TerminalKillSchema>;

/**
 * Esquemas T13: sesiones conversacionales + aprobaciones pendientes +
 * info de storage y políticas de gobierno (validación Zod en main,
 * fail-closed: sin schema válido → rechazado antes de tocar motores).
 * Fuente de sesiones: `session/turns` vía adapter (EgoMemoryLifecycle solo
 * guarda el activeSessionId en memoria; no hay store dedicado — los
 * handlers agregan turns por sessionId y lo documentan).
 */
export const SessionsListSchema = z
  .object({
    limit: z.number().int().positive().max(500).optional(),
    projectScope: z.string().min(1).max(128).optional(),
  })
  .optional();

export type SessionsListRequest = z.infer<typeof SessionsListSchema>;

export const SessionGetSchema = z.object({
  sessionId: z.string().min(1).max(128),
});

export type SessionGetRequest = z.infer<typeof SessionGetSchema>;

export const SessionResumeSchema = z.object({
  sessionId: z.string().min(1).max(128),
});

export type SessionResumeRequest = z.infer<typeof SessionResumeSchema>;

/**
 * STAB-12: fork de sesión conversacional + handoff formal.
 * `forkSession` copia los turnos `session/turns` de `fromSessionId` a un
 * `toSessionId` nuevo y crea un micro-checkpoint; el handoff
 * `{from,to,summary,findings,files,issues,checkpointId}` viaja validado
 * (fail-closed: sin schema válido → rechazado antes de tocar memoria).
 */
export const SessionForkSchema = z.object({
  fromSessionId: z.string().min(1).max(128),
  toSessionId: z.string().min(1).max(128),
  summary: z.string().min(1).max(4000),
  findings: z.array(z.string().min(1).max(1000)).max(100).default([]),
  files: z.array(z.string().min(1).max(1024)).max(100).default([]),
  issues: z.array(z.string().min(1).max(1000)).max(100).default([]),
});

export type SessionForkRequest = z.infer<typeof SessionForkSchema>;

export const SessionHandoffSchema = SessionForkSchema.extend({
  checkpointId: z.string().min(1).max(128),
  copiedTurns: z.number().int().nonnegative(),
  createdAtMs: z.number().int().positive(),
});

export type SessionHandoff = z.infer<typeof SessionHandoffSchema>;

/**
 * STAB-12: evaluación/observación de hooks vía IPC (CFG-09).
 * El renderer solo pide veredictos/estado; los comandos se validan y
 * ejecutan en main (fail-closed). `toolName` inválido → rechazado.
 */
export const HookEvaluateSchema = z.object({
  toolName: z.string().min(1).max(256),
  sessionId: z.string().min(1).max(128).optional(),
});

export type HookEvaluateRequest = z.infer<typeof HookEvaluateSchema>;

export const DailyListApprovalsSchema = z
  .object({
    limit: z.number().int().positive().max(500).optional(),
  })
  .optional();

export type DailyListApprovalsRequest = z.infer<typeof DailyListApprovalsSchema>;

/**
 * Esquemas T15: catálogo live de modelos por proveedor (validación Zod en
 * main, fail-closed: provider inválido → rechazado antes de tocar la red).
 * `refresh` fuerza refetch (bypassa cache memoria + VantaDB `gov/catalog`).
 */
export const ModelProviderIdSchema = z.enum(["openai", "anthropic", "google", "deepseek", "ollama"]);

export type ModelProviderIdRequest = z.infer<typeof ModelProviderIdSchema>;

export const ModelsListSchema = z.object({
  provider: ModelProviderIdSchema,
  refresh: z.boolean().optional().default(false),
});

export type ModelsListRequest = z.infer<typeof ModelsListSchema>;

/**
 * Hardening IPC — token opaco single-use para `selectFolder` + origen por
 * invoke + fetch-proxy mínimo. Todo input del renderer se valida con Zod
 * (fail-closed); la firma pública no cambia (meta de origen la deriva el
 * main desde `senderFrame`, nunca la envía el renderer).
 */
export const SelectFolderRedeemSchema = z.object({
  token: z.string().uuid(),
});

export type SelectFolderRedeemRequest = z.infer<typeof SelectFolderRedeemSchema>;

/** Meta de origen por invoke: `senderFrame` URL + timestamp (derivada en main). */
export const IpcOriginMetaSchema = z.object({
  frameUrl: z.string().min(1).max(2048),
  timestamp: z.number().int().positive(),
});

export type IpcOriginMeta = z.infer<typeof IpcOriginMetaSchema>;

/**
 * Fetch-proxy mínimo en main (`ipc.net.fetch`). Solo `https:` o loopback
 * local; el `Authorization` lo inyecta el main desde safeStorage y nunca
 * viaja al renderer (la respuesta solo trae `status`/`body` saneados).
 */
export const EgoFetchSchema = z.object({
  url: z.string().url().max(2048),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string().max(4096)).optional(),
  body: z.string().max(1_000_000).optional(),
  timeoutMs: z.number().int().positive().max(60_000).optional(),
});

export type EgoFetchRequest = z.infer<typeof EgoFetchSchema>;

/**
 * Perfiles nombrados de Sub-Ego (CFG-03).
 * Bundle nombrado planner/reviewer/researcher/builder: modelo + sandbox +
 * aprobación + toolsets, persistido en VantaDB `gov/settings/profiles`.
 * Sin archivos `~/.codex`: la fuente canónica es Zod + VantaDB.
 * `model` acepta alias semántico (`frontier`/`cheap`); CFG-04 resuelve
 * aliases contra el router (planner = frontier, hijos = baratos).
 */
export const SubEgoProfileSandboxSchema = z.enum(["read-only", "workspace", "full"]);

export type SubEgoProfileSandbox = z.infer<typeof SubEgoProfileSandboxSchema>;

export const SubEgoProfileApprovalSchema = z.enum(["never", "on-write", "always"]);

export type SubEgoProfileApproval = z.infer<typeof SubEgoProfileApprovalSchema>;

export const SubEgoProfileNameSchema = z.enum(["planner", "reviewer", "researcher", "builder"]);

export type SubEgoProfileName = z.infer<typeof SubEgoProfileNameSchema>;

export const SubEgoProfileSchema = z.object({
  name: SubEgoProfileNameSchema,
  model: z.string().min(1).max(128),
  sandbox: SubEgoProfileSandboxSchema,
  approval: SubEgoProfileApprovalSchema,
  toolsets: z.array(z.string().min(1).max(64)).max(32).default([]),
  description: z.string().max(500).optional(),
});

export type SubEgoProfile = z.infer<typeof SubEgoProfileSchema>;

export const CreateSubEgoProfileSchema = SubEgoProfileSchema;

export type CreateSubEgoProfileRequest = z.infer<typeof CreateSubEgoProfileSchema>;

export const GetSubEgoProfileSchema = z.object({
  name: SubEgoProfileNameSchema,
});

export type GetSubEgoProfileRequest = z.infer<typeof GetSubEgoProfileSchema>;

export const DeleteSubEgoProfileSchema = z.object({
  name: SubEgoProfileNameSchema,
});

export type DeleteSubEgoProfileRequest = z.infer<typeof DeleteSubEgoProfileSchema>;

export const ListSubEgoProfilesSchema = z
  .object({
    sandbox: SubEgoProfileSandboxSchema.optional(),
    approval: SubEgoProfileApprovalSchema.optional(),
  })
  .optional();

export type ListSubEgoProfilesRequest = z.infer<typeof ListSubEgoProfilesSchema>;

/**
 * Política de permisos + approvals (CFG-06).
 * Decisión owner 2026-10-16: `defaultMode: "acceptEdits"`, approvals
 * `mode: "smart"` + `timeoutSec: 60` + `cronMode: "deny"`, deny gana.
 * Persistencia canónica: VantaDB `gov/settings/permissions` (Zod + adapter,
 * sin archivos `~/.codex`). Se combina con `ApprovalEngine` + `riskLevel`
 * existentes: el deny de esta política veta antes de llegar al engine.
 */
export const PermissionDecisionSchema = z.enum(["allow", "ask", "deny"]);

export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;

/** Regla de permiso: `pattern` matchea por subcadena contra tool o path. */
export const PermissionRuleSchema = z.object({
  pattern: z.string().min(1).max(1024),
  decision: PermissionDecisionSchema,
});

export type PermissionRule = z.infer<typeof PermissionRuleSchema>;

export const PermissionsPolicySchema = z.object({
  defaultMode: z.enum(["read-only", "acceptEdits", "full-access"]).default("acceptEdits"),
  rules: z.array(PermissionRuleSchema).max(128).default([]),
  additionalDirectories: z.array(z.string().min(1).max(1024)).max(32).default([]),
});

export type PermissionsPolicy = z.infer<typeof PermissionsPolicySchema>;

export const ApprovalsConfigSchema = z.object({
  mode: z.enum(["manual", "smart", "off"]).default("smart"),
  timeoutSec: z.number().int().positive().max(600).default(60),
  cronMode: PermissionDecisionSchema.default("deny"),
});

export type ApprovalsConfig = z.infer<typeof ApprovalsConfigSchema>;

export const PermissionsSettingsSchema = z.object({
  permissions: PermissionsPolicySchema.default({
    defaultMode: "acceptEdits",
    rules: [],
    additionalDirectories: [],
  }),
  approvals: ApprovalsConfigSchema.default({
    mode: "smart",
    timeoutSec: 60,
    cronMode: "deny",
  }),
});

export type PermissionsSettings = z.infer<typeof PermissionsSettingsSchema>;

/**
 * Voz STT/TTS opt-in con kill switch (VOICE-01).
 * Cierra el TODO VOICE de CFG-12 (`ego-chat.tsx`: `VoiceCapabilityState` +
 * botón 🎙 disabled). Decisión: WebSpeech/`speechSynthesis` locales por
 * defecto (sin costo, sin red); groq-whisper/edge-nube opcionales cuando hay
 * key configurada en main. El renderer NUNCA ve secretos: este schema no
 * tiene campos `*Key`; el main inyecta la auth desde safeStorage/env y solo
 * retorna texto/estado. Kill switch `disableVoice` deny-gana: veta STT y TTS
 * aunque haya opt-in. `privacyAcknowledged` registra que el usuario vio el
 * notice ("el audio se envía al proveedor solo al dictar/leer").
 */
export const VoiceSttFormatSchema = z.enum(["webm", "wav", "mp3"]);

export type VoiceSttFormat = z.infer<typeof VoiceSttFormatSchema>;

export const VoiceSttSchema = z.object({
  /** Audio base64 (tope ≈5MB binarios; el dictado local WebSpeech no usa este canal). */
  audioB64: z.string().min(1, "El audio no puede estar vacío").max(7_000_000),
  format: VoiceSttFormatSchema.default("webm"),
  language: z.string().min(2).max(12).optional(),
});

export type VoiceSttRequest = z.infer<typeof VoiceSttSchema>;

export const VoiceTtsSchema = z.object({
  text: z.string().min(1, "El texto no puede estar vacío").max(5000),
  voice: z.string().min(1).max(128).optional(),
  rate: z.number().min(0.5).max(2).optional(),
});

export type VoiceTtsRequest = z.infer<typeof VoiceTtsSchema>;

export const VoiceSttProviderSchema = z.enum(["webspeech", "groq"]);

export type VoiceSttProvider = z.infer<typeof VoiceSttProviderSchema>;

export const VoiceTtsProviderSchema = z.enum(["speechSynthesis", "edge"]);

export type VoiceTtsProvider = z.infer<typeof VoiceTtsProviderSchema>;

export const VoiceSettingsSchema = z.object({
  /** Kill switch global: true veta STT y TTS (deny-gana sobre opt-in). */
  disableVoice: z.boolean().default(false),
  sttProvider: VoiceSttProviderSchema.default("webspeech"),
  ttsProvider: VoiceTtsProviderSchema.default("speechSynthesis"),
  privacyAcknowledged: z.boolean().default(false),
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

