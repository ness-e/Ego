// Puente renderer→main. En Electron real usa window.ego (preload);
// fuera de Electron (dev browser) usa mocks ricos para no romper el render.

export interface SubEgoSummary {
  id: string;
  name: string;
  role: string;
  description: string;
  state: "active" | "paused" | "archived";
}

export interface RecallBadgeInfo {
  count: number;
  glyph: string;
  sources: string[];
  tokensEstimate: number;
}

export interface ChatErrorInfo {
  turnId?: string;
  error: string;
  timestamp?: number;
}

export interface PendingApprovalInfo {
  approvalId: string;
  action: {
    sessionId: string;
    subEgoId: string;
    toolName: string;
    callId: string;
    inputDigest: string;
    createdAt: number;
  };
  toolName: string;
  toolCategory: string;
  riskLevel: "safe" | "sensitive" | "destructive";
  arguments: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "timed_out" | "aborted";
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface McpServerInfo {
  id: string;
  name: string;
  config: {
    id: string;
    name: string;
    transport: "stdio" | "sse";
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    toolPrefix?: string;
    timeoutMs?: number;
  };
  status: "disconnected" | "connecting" | "connected" | "error";
  enabled: boolean;
  toolsCount: number;
  lastError?: string;
  tools: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>;
}

export interface ToolSummaryInfo {
  name: string;
  description: string;
  category: string;
  riskLevel: "safe" | "sensitive" | "destructive";
  origin: string;
  mcpServerId?: string;
  requiresApproval: boolean;
}

export interface ScannedSkillInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  directoryPath: string;
  manifestPath: string;
  valid: boolean;
  securityLevel: "safe" | "warning" | "dangerous";
  errors: string[];
  warnings: string[];
  tools: string[];
  permissions: string[];
  tags: string[];
}

export interface ProjectInfo {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
  activeSubEgoId?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  badge?: string;
}

export interface DomainTemplateInfo {
  templateId: string;
  id: string;
  name: string;
  role: string;
  description: string;
  domain?: string;
  instructions: string;
  recommendedTools: string[];
  recommendedCapabilities: string[];
  recommendedResponsibilities: string[];
  autonomy: "supervised" | "semi-autonomous" | "autonomous";
  defaultBudget?: {
    maxTokensPerCall: number;
    maxDailyCostUsd: number;
    requiresApprovalAboveUsd: number;
  };
}

export interface SubEgoDetailInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  instructions?: string;
  systemPrompt?: string;
  state: "active" | "paused" | "archived" | "disabled";
  creator?: string;
  tools?: string[];
  permissions?: string[];
  budget?: {
    maxTokensPerCall?: number;
    maxDailyCostUsd?: number;
    requiresApprovalAboveUsd?: number;
  };
  character?: Record<string, unknown>;
}

export interface ModelConfigInfo {
  activeProvider: "openai" | "anthropic" | "google" | "deepseek" | "ollama" | "mock";
  apiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  deepseekKey?: string;
  baseUrl?: string;
  openaiBaseURL?: string;
  deepseekBaseURL?: string;
  ollamaBaseURL?: string;
  modelName?: string;
}

/**
 * Formas de respuesta de los canales `ipc.daily.*` (F5T11/M26).
 * Espejos locales de los retornos reales de `main.ts` (no se importan tipos de
 * `@ego/*` para no añadir dependencias al renderer). Sobre el `{ok}` uniforme:
 * en `ok:false` solo `error` está garantizado; los campos de éxito describen
 * la respuesta `ok:true`.
 */
export interface DailySummaryPayload {
  date: string;
  pendingApprovalsCount: number;
  [key: string]: unknown;
}

export interface DailySummaryResult {
  ok: boolean;
  error?: string;
  summary: DailySummaryPayload;
}

export interface DailyGoalsResult {
  ok: boolean;
  error?: string;
  goals: unknown;
}

export interface DailyDecisionEntry {
  id: string;
  title: string;
  timestamp: number;
  subEgoId: string;
  impact?: string;
  [key: string]: unknown;
}

export interface DailyDecisionsResult {
  ok: boolean;
  error?: string;
  decisions: DailyDecisionEntry[];
}

export interface DailySnapshotResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface DailyFirstLaunchResult {
  ok: boolean;
  error?: string;
  isFirstLaunch: boolean;
}

export interface DailyJournalResult {
  ok: boolean;
  error?: string;
  date: string;
  content: string;
}

export interface DailyBatchResolveResult {
  ok: boolean;
  error?: string;
  resolved: Array<{ approvalId: string; ok: boolean }>;
}

export interface DailyApprovalsResult {
  ok: boolean;
  error?: string;
  approvals: PendingApprovalInfo[];
}

/**
 * Formas de respuesta de `ipc.sessions.*` (T13).
 * Fuente documentada: agregación de `session/turns` vía adapter
 * (sin store dedicado; ver handlers en `main.ts`).
 */
export interface SessionSummary {
  sessionId: string;
  turnCount: number;
  lastTimestamp: number;
  projectScope?: string;
}

export interface SessionsListResult {
  ok: boolean;
  error?: string;
  sessions: SessionSummary[];
}

export interface SessionDetailResult {
  ok: boolean;
  error?: string;
  sessionId: string;
  turns?: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>;
  turnCount?: number;
  resumed?: boolean;
}

export interface BackgroundTaskInfo {
  taskId: string;
  status: string;
  [key: string]: unknown;
}

export interface TasksListResult {
  ok: boolean;
  error?: string;
  tasks: BackgroundTaskInfo[];
  mock?: boolean;
}

export interface TerminalSpawnResult {
  ok: boolean;
  error?: string;
  denied?: boolean;
  sessionId?: string;
  cwd?: string;
  mock?: boolean;
}

export interface StorageInfoResult {
  ok: boolean;
  error?: string;
  userDataDir?: string;
  dbPath?: string;
  operational?: boolean;
  platform?: string;
  namespaces?: string[];
  mock?: boolean;
}

export interface GovPoliciesResult {
  ok: boolean;
  error?: string;
  policies: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>;
  mock?: boolean;
}

export interface ModelKeyProbeInfo {
  verified: boolean;
  warn?: string;
  networkUnreachable?: boolean;
}

/**
 * Formas de respuesta de los canales `ipc.domains.*` (F5T11/M26).
 * Espejos locales de `GitStatusSummary`, `WorkspaceInspection`, `WorktreeInfo`
 * (`packages/domains/src/engineering/`) y de `BacklogItem`/`Epic`
 * (`packages/domains/src/product/types.ts`).
 */
export interface EngineeringGitStatus {
  branch: string;
  clean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface EngineeringInspection {
  workspaceRoot: string;
  isGitRepo: boolean;
  currentBranch?: string;
  projectType: "node" | "rust" | "python" | "go" | "generic";
  manifestFiles: string[];
  detectedLinters: string[];
  detectedFormatters: string[];
  detectedTesters: string[];
}

export interface EngineeringWorktree {
  id: string;
  repoRoot: string;
  branch: string;
  worktreePath: string;
  createdAt: string;
  isMain: boolean;
}

export interface ProductBacklogItem {
  id: string;
  title: string;
  description: string;
  epicId?: string;
  status: string;
  priority: string;
  acceptanceCriteria: string[];
  assignedSubEgoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductEpic {
  id: string;
  title: string;
  description: string;
  status: string;
  targetQuarter?: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DomainsResult {
  ok: boolean;
  error?: string;
  domains?: Array<Record<string, unknown>>;
  domain?: unknown;
  domainId?: string;
  activeViewId?: string;
  defaultSubEgoId?: string;
  workspaceRoot?: string;
  inspection?: EngineeringInspection;
  gitStatus?: EngineeringGitStatus;
  worktrees?: EngineeringWorktree[];
  items?: ProductBacklogItem[];
  epics?: ProductEpic[];
  item?: ProductBacklogItem;
  results?: unknown[];
  series?: unknown[];
  modelDistribution?: unknown[];
  namespaceStats?: unknown[];
  deals?: unknown[];
  contacts?: unknown[];
  summary?: unknown;
  deal?: unknown;
}

export interface LlmStreamRequest {
  prompt: string;
  sessionId?: string;
  systemPrompt?: string;
  projectId?: string;
  subEgoId?: string;
}

export interface EgoBridge {
  memory: (op: string, args: unknown[]) => Promise<unknown>;
  llmStream: (req: LlmStreamRequest) => Promise<{
    ok: boolean;
    turnId: string;
    text: string;
    recallStatus: RecallBadgeInfo;
    usage?: unknown;
  }>;
  approve: (req: { actionId: string; confirmed: boolean; notes?: string }) => Promise<unknown>;
  resolveApproval: (req: {
    approvalId: string;
    approved: boolean;
    reason?: string;
    modifiedArguments?: Record<string, unknown>;
  }) => Promise<{ ok: boolean; approvalId: string; approved: boolean; timestamp: number }>;
  snapshots: () => Promise<unknown>;
  listSubEgos: () => Promise<SubEgoSummary[]>;
  createSubEgo: (req: { name: string; role: string; instructions: string; tools?: string[] }) => Promise<SubEgoSummary>;
  subegos: {
    list: () => Promise<SubEgoDetailInfo[]>;
    getTemplates: () => Promise<DomainTemplateInfo[]>;
    create: (req: {
      mode?: "custom" | "template" | "declaration";
      name?: string;
      role?: string;
      instructions?: string;
      tools?: string[];
      budget?: { maxTokensPerCall?: number; maxDailyCostUsd?: number };
      templateId?: string;
      overrides?: Record<string, unknown>;
      format?: "json" | "yaml";
      rawText?: string;
    }) => Promise<SubEgoDetailInfo>;
    toggleState: (req: { subEgoId: string; state: "active" | "paused" }) => Promise<SubEgoDetailInfo>;
  };
  projects: {
    list: () => Promise<ProjectInfo[]>;
    create: (req: { name: string; rootPath: string; description?: string; activeSubEgoId?: string }) => Promise<ProjectInfo>;
    select: (id: string) => Promise<{ ok: boolean; activeProjectId: string }>;
    getActive: () => Promise<ProjectInfo>;
    selectFolder: () => Promise<string | null>;
  };
  mcp: {
    listServers: () => Promise<McpServerInfo[]>;
    addServer: (req: { config: McpServerInfo["config"]; enabled?: boolean }) => Promise<McpServerInfo>;
    removeServer: (req: { id: string }) => Promise<{ success: boolean; id: string }>;
    toggleServer: (req: { id: string; enabled: boolean }) => Promise<McpServerInfo>;
    listTools: (filter?: { query?: string; riskLevel?: string; serverId?: string }) => Promise<ToolSummaryInfo[]>;
  };
  skills: {
    listLocal: (req?: { searchPaths?: string[]; projectRoot?: string }) => Promise<ScannedSkillInfo[]>;
  };
  settings: {
    getModelConfig: () => Promise<ModelConfigInfo>;
    saveModelConfig: (config: ModelConfigInfo) => Promise<{ ok: boolean; config: ModelConfigInfo; probe?: ModelKeyProbeInfo }>;
    getStorageInfo: () => Promise<StorageInfoResult>;
    getGovPolicies: () => Promise<GovPoliciesResult>;
  };
  // T13: tasks/terminal existían en main sin puente; sesiones,
  // aprobaciones pendientes, storage y policies son canales nuevos.
  tasks: {
    list: (req?: { status?: string[]; subEgoId?: string; limit?: number }) => Promise<TasksListResult>;
    cancel: (req: { taskId: string; reason?: string }) => Promise<{ ok: boolean; taskId?: string; error?: string }>;
  };
  terminal: {
    spawn: (req: { command: string; cwd?: string; timeoutMs?: number }) => Promise<TerminalSpawnResult>;
    stdin: (req: { sessionId: string; data: string }) => Promise<{ ok: boolean; error?: string }>;
    kill: (req: { sessionId: string }) => Promise<{ ok: boolean; sessionId?: string; error?: string }>;
  };
  sessions: {
    list: (req?: { limit?: number; projectScope?: string }) => Promise<SessionsListResult>;
    get: (req: { sessionId: string }) => Promise<SessionDetailResult>;
    resume: (req: { sessionId: string }) => Promise<SessionDetailResult>;
  };
  daily?: {
    getSummary: (req?: { date?: string }) => Promise<DailySummaryResult>;
    refineGoals: (req?: { date?: string }) => Promise<DailyGoalsResult>;
    getDecisions: (req?: { limit?: number; since?: number; subEgoId?: string }) => Promise<DailyDecisionsResult>;
    saveSnapshot: () => Promise<DailySnapshotResult>;
    getSnapshot: (date?: string) => Promise<DailySnapshotResult>;
    listSnapshots: (limit?: number) => Promise<DailySnapshotResult>;
    isFirstLaunch: (req?: { date?: string }) => Promise<DailyFirstLaunchResult>;
    journal: (req: { action: "get" | "save"; date: string; content?: string }) => Promise<DailyJournalResult>;
    resolveApprovalsBatch: (req: {
      approvals: Array<{ approvalId: string; approved: boolean; reason?: string }>;
    }) => Promise<DailyBatchResolveResult>;
    listApprovals: (req?: { limit?: number }) => Promise<DailyApprovalsResult>;
  };
  domains?: {
    list: () => Promise<DomainsResult>;
    get: (domainId: string) => Promise<DomainsResult>;
    switch: (domainId: string, viewId?: string) => Promise<DomainsResult>;
    getEngineeringStatus: (workspaceRoot?: string) => Promise<DomainsResult>;
    productBacklog: (req: { action: "list" | "create" | "updateStatus"; payload?: unknown }) => Promise<DomainsResult>;
    knowledgeSearch: (query: string, limit?: number) => Promise<DomainsResult>;
    analyticsSeries: (days?: number) => Promise<DomainsResult>;
    crmDeals: (req?: { action: "list" | "create" | "updateStage" | "summary"; payload?: unknown }) => Promise<DomainsResult>;
  };
  // F5T10/H25: puentea ipc.decision.* e ipc.knowledge.* (antes sin preload).
  decision?: {
    evaluate: (req: unknown) => Promise<unknown>;
    listAudits: (limit?: number) => Promise<unknown>;
    telemetry: () => Promise<unknown>;
  };
  knowledge?: {
    ingest: (req: unknown) => Promise<unknown>;
    hybridSearch: (req: unknown) => Promise<unknown>;
    graphRag: (req: unknown) => Promise<unknown>;
    quarantine: (req: unknown) => Promise<unknown>;
    asOf: (req: unknown) => Promise<unknown>;
    explainArtifact: (req: unknown) => Promise<unknown>;
    exportPackage: (projectId?: string) => Promise<unknown>;
    importPackage: (pkg: unknown) => Promise<unknown>;
  };
  onChatDelta?: (callback: (chunk: { type: string; delta?: string }) => void) => () => void;
  onRecallStatus?: (callback: (status: RecallBadgeInfo) => void) => () => void;
  onChatError?: (callback: (err: ChatErrorInfo) => void) => () => void;
  onApprovalRequest?: (callback: (req: PendingApprovalInfo) => void) => () => void;
  onProjectChanged?: (callback: (data: { activeProjectId: string }) => void) => () => void;
  onSubEgosChanged?: (callback: (data: { subEgoId: string; action: string; state?: string }) => void) => () => void;
  onEvent?: (callback: (event: unknown) => void) => () => void;
}

const mockSubEgos: SubEgoSummary[] = [
  {
    id: "ego.copywriter",
    name: "Ego Copywriter",
    role: "Redactor B2B",
    description: "Genera propuestas y correos de prospección alineados al tono de marca.",
    state: "active",
  },
  {
    id: "ego.code-reviewer",
    name: "Ego Code Reviewer",
    role: "Auditor Técnico",
    description: "Inspecciona cambios y revisa cumplimiento de estándares de arquitectura.",
    state: "active",
  },
];

const mock: EgoBridge = {
  memory: async (op: string, args: unknown[]) => {
    if (op === "searchMulti" || op === "recall") {
      return [
        {
          score: 0.94,
          record: {
            namespace: "kb/docs",
            key: "tarifa-base-2026",
            payload: JSON.stringify({
              titulo: "Límite de tarifas y política de precios 2026",
              contenido: "El límite de tarifa base para servicios de consultoría se fijó en $150 USD/hora con aprobación requerida para descuentos >15%.",
              estado: "aprobado",
            }),
          },
        },
      ];
    }
    return { ok: true, mock: true, op, args };
  },
  llmStream: async (req) => ({
    ok: true,
    turnId: `mock_turn_${Date.now()}`,
    text: `[Respuesta Mock Local]: Procesada instrucción "${req.prompt.slice(0, 40)}..."`,
    recallStatus: {
      count: 2,
      glyph: "🧠",
      sources: ["kb/docs", "kb/facts"],
      tokensEstimate: 140,
    },
  }),
  approve: async (args) => ({ ok: true, mock: true, args }),
  resolveApproval: async (req) => ({
    ok: true,
    approvalId: req.approvalId,
    approved: req.approved,
    timestamp: Date.now(),
  }),
  snapshots: async () => ({ ok: true, mock: true, missing: [] }),
  listSubEgos: async () => mockSubEgos,
  createSubEgo: async (req) => {
    const nuevo: SubEgoSummary = {
      id: `ego.${req.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: req.name,
      role: req.role,
      description: req.instructions,
      state: "active",
    };
    mockSubEgos.push(nuevo);
    return nuevo;
  },
  subegos: {
    list: async () => [
      {
        id: "ego.nucleus",
        name: "Ego Núcleo",
        role: "Orquestador General",
        description: "Supervisa, planifica y orquesta la delegación y memoria del sistema.",
        state: "active",
        creator: "ego-nucleus",
        tools: ["memory_recall", "delegate_task"],
        budget: { maxTokensPerCall: 8000, maxDailyCostUsd: 10.0, requiresApprovalAboveUsd: 2.0 },
      },
      {
        id: "ego.dev",
        name: "Sub-Ego Dev",
        role: "Ingeniería & Código",
        description: "Especialista en desarrollo, depuración, refactorización y pruebas.",
        state: "active",
        creator: "template",
        tools: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
        budget: { maxTokensPerCall: 4000, maxDailyCostUsd: 5.0, requiresApprovalAboveUsd: 1.0 },
      },
      {
        id: "ego.copywriter",
        name: "Ego Copywriter",
        role: "Redactor B2B",
        description: "Genera propuestas y correos de prospección alineados al tono de marca.",
        state: "active",
        creator: "user",
        tools: ["memory_recall"],
        budget: { maxTokensPerCall: 4000, maxDailyCostUsd: 2.0, requiresApprovalAboveUsd: 0.5 },
      },
    ],
    getTemplates: async () => [
      {
        id: "developer",
        templateId: "developer",
        name: "Ingeniero de Software",
        role: "Desarrollo y Arquitectura de Software",
        description: "Diseña, codifica, depura y refactoriza componentes con rigor técnico y pruebas.",
        domain: "engineering",
        instructions: "Actúa como un Ingeniero de Software Principal. Diseña código modular, tipado y testeado.",
        recommendedTools: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
        recommendedCapabilities: ["code_generation", "code_review", "debugging"],
        recommendedResponsibilities: ["Implementar features", "Resolver bugs", "Escribir tests"],
        autonomy: "supervised",
        defaultBudget: { maxTokensPerCall: 4000, maxDailyCostUsd: 5.0, requiresApprovalAboveUsd: 1.0 },
      },
      {
        id: "researcher",
        templateId: "researcher",
        name: "Investigador Cognitivo",
        role: "Investigación y Extracción de Hechos",
        description: "Explora documentación, sintetiza hallazgos y organiza la base de conocimiento.",
        domain: "knowledge",
        instructions: "Investiga exhaustivamente con fuentes primarias y sin inventar hechos.",
        recommendedTools: ["memory_recall", "fs_read_file"],
        recommendedCapabilities: ["deep_research", "synthesis"],
        recommendedResponsibilities: ["Investigar APIs", "Generar resúmenes técnicos"],
        autonomy: "supervised",
        defaultBudget: { maxTokensPerCall: 4000, maxDailyCostUsd: 3.0, requiresApprovalAboveUsd: 0.5 },
      },
      {
        id: "product_manager",
        templateId: "product_manager",
        name: "Gerente de Producto",
        role: "Specs, PRDs y Roadmap",
        description: "Define requerimientos, historias de usuario y priorización de backlog.",
        domain: "product",
        instructions: "Estructura requerimientos claros según metodología Shape Up y métricas de éxito.",
        recommendedTools: ["memory_recall", "fs_read_file", "fs_write_file"],
        recommendedCapabilities: ["spec_writing", "prioritization"],
        recommendedResponsibilities: ["Escribir specs", "Validar criterios de aceptación"],
        autonomy: "supervised",
        defaultBudget: { maxTokensPerCall: 4000, maxDailyCostUsd: 3.0, requiresApprovalAboveUsd: 0.5 },
      },
    ],
    create: async (req: {
      name?: string;
      role?: string;
      instructions?: string;
      tools?: string[];
    }) => {
      const id = `ego.${req.name ? req.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "custom"}`;
      const nuevo: SubEgoDetailInfo = {
        id,
        name: req.name || "Nuevo Sub-Ego",
        role: req.role || "Especialista",
        description: req.instructions || "Sub-Ego creado interactivamente",
        state: "active",
        creator: "user",
        tools: req.tools || ["memory_recall"],
      };
      return nuevo;
    },
    toggleState: async ({ subEgoId, state }: { subEgoId: string; state: "active" | "paused" }) => {
      return {
        id: subEgoId,
        name: subEgoId,
        role: "Especialista",
        description: "",
        state,
      };
    },
  },
  projects: {
    list: async () => [
      { id: "default", name: "Ego Core", rootPath: "/", badge: "Activo" },
      { id: "vantadb", name: "VantaDB Engine", rootPath: "/vantadb" },
    ],
    create: async (req) => ({
      id: `proj_${Date.now().toString(36)}`,
      name: req.name,
      rootPath: req.rootPath,
      description: req.description,
      activeSubEgoId: req.activeSubEgoId || "ego.nucleus",
    }),
    select: async (id) => ({ ok: true, activeProjectId: id }),
    getActive: async () => ({ id: "default", name: "Ego Core", rootPath: "/", badge: "Activo" }),
    selectFolder: async () => "/mock/folder",
  },
  mcp: {
    listServers: async () => [
      {
        id: "github-mcp",
        name: "GitHub Official MCP",
        config: {
          id: "github-mcp",
          name: "GitHub Official MCP",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          toolPrefix: "gh",
        },
        status: "connected",
        enabled: true,
        toolsCount: 2,
        tools: [
          { name: "get_issue", description: "Lee issues de GitHub", inputSchema: {} },
          { name: "create_pull_request", description: "Crea pull requests", inputSchema: {} },
        ],
      },
    ],
    addServer: async (req) => ({
      id: req.config.id,
      name: req.config.name,
      config: req.config,
      status: "connected",
      enabled: req.enabled ?? true,
      toolsCount: 0,
      tools: [],
    }),
    removeServer: async (req) => ({ success: true, id: req.id }),
    toggleServer: async (req) => ({
      id: req.id,
      name: req.id,
      config: { id: req.id, name: req.id, transport: "stdio", command: "node" },
      status: req.enabled ? "connected" : "disconnected",
      enabled: req.enabled,
      toolsCount: 0,
      tools: [],
    }),
    listTools: async () => [
      {
        name: "fs_read_file",
        description: "Lee archivos del disco",
        category: "filesystem",
        riskLevel: "safe",
        origin: "native",
        requiresApproval: false,
      },
      {
        name: "fs_write_file",
        description: "Escribe archivos en el workspace",
        category: "filesystem",
        riskLevel: "sensitive",
        origin: "native",
        requiresApproval: true,
      },
    ],
  },
  skills: {
    listLocal: async () => [
      {
        id: "code-reviewer",
        name: "Code Reviewer",
        description: "Skill de revisión estática de código",
        directoryPath: ".ego/skills/code-reviewer",
        manifestPath: ".ego/skills/code-reviewer/SKILL.md",
        valid: true,
        securityLevel: "safe",
        errors: [],
        warnings: [],
        tools: ["git_diff"],
        permissions: ["filesystem:read"],
        tags: ["engineering"],
      },
    ],
  },
  settings: {
    getModelConfig: async () => ({
      activeProvider: "mock",
      apiKey: "",
      baseUrl: "",
      modelName: "mock-core",
    }),
    saveModelConfig: async (config) => ({ ok: true, config }),
    getStorageInfo: async () => ({
      ok: true,
      mock: true,
      userDataDir: "/mock/user-data",
      dbPath: "/mock/user-data/ego_memory.vdb",
      operational: true,
      platform: "mock",
      namespaces: ["session/turns", "gov/settings", "gov/policies"],
    }),
    getGovPolicies: async () => ({ ok: true, mock: true, policies: [] }),
  },
  tasks: {
    list: async () => ({ ok: true, mock: true, tasks: [] }),
    cancel: async (req) => ({ ok: true, mock: true, taskId: req.taskId } as { ok: boolean; taskId?: string; error?: string }),
  },
  terminal: {
    spawn: async () => ({ ok: true, mock: true, sessionId: "term_mock", cwd: "/mock" }),
    stdin: async () => ({ ok: true, mock: true } as { ok: boolean; error?: string }),
    kill: async (req) => ({ ok: true, mock: true, sessionId: req.sessionId }),
  },
  sessions: {
    list: async () => ({
      ok: true,
      mock: true,
      sessions: [{ sessionId: "mock_session", turnCount: 1, lastTimestamp: Date.now() }],
    }),
    get: async (req) => ({ ok: true, mock: true, sessionId: req.sessionId, turns: [] }),
    resume: async (req) => ({ ok: true, mock: true, sessionId: req.sessionId, turnCount: 0, resumed: true }),
  },
  decision: {
    evaluate: async (req) => ({ ok: true, mock: true, req }),
    listAudits: async () => ({ ok: true, mock: true, audits: [] }),
    telemetry: async () => ({ ok: true, mock: true, summary: null }),
  },
  knowledge: {
    ingest: async (req) => ({ ok: true, mock: true, req }),
    hybridSearch: async () => ({ ok: true, mock: true, hits: [] }),
    graphRag: async () => ({ ok: true, mock: true, context: null }),
    quarantine: async (req) => ({ ok: true, mock: true, req }),
    asOf: async () => ({ ok: true, mock: true, facts: [] }),
    explainArtifact: async () => ({ ok: true, mock: true, explanation: null }),
    exportPackage: async () => ({ ok: true, mock: true, pkg: null }),
    importPackage: async (pkg) => ({ ok: true, mock: true, pkg }),
  },
  daily: {
    getSummary: async () => ({ ok: true, mock: true, summary: { date: "mock", pendingApprovalsCount: 0 } }),
    refineGoals: async () => ({ ok: true, mock: true, goals: [] }),
    getDecisions: async () => ({ ok: true, mock: true, decisions: [] }),
    saveSnapshot: async () => ({ ok: true, mock: true }),
    getSnapshot: async () => ({ ok: true, mock: true }),
    listSnapshots: async () => ({ ok: true, mock: true }),
    isFirstLaunch: async () => ({ ok: true, mock: true, isFirstLaunch: false }),
    journal: async (req) => ({ ok: true, mock: true, date: req.date, content: req.content ?? "" }),
    resolveApprovalsBatch: async () => ({ ok: true, mock: true, resolved: [] }),
    listApprovals: async () => ({ ok: true, mock: true, approvals: [] }),
  },
  onEvent: () => () => {},
};

export function ego(): EgoBridge {
  if (typeof window !== "undefined" && (window as unknown as { ego?: EgoBridge }).ego) {
    const rawEgo = (window as unknown as { ego: EgoBridge }).ego;
    return {
      ...rawEgo,
      // T01: preload ya expone memory(op, args) unificado; reenvío directo.
      memory: (op, args) => rawEgo.memory(op, args),
      // T01: el preload devuelve unknown; el adaptador lo tipa a la vista rica.
      llmStream: (req) => rawEgo.llmStream(req),
    };
  }
  return mock;
}
