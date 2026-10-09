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

export interface EgoBridge {
  memory: (op: string, args: unknown[]) => Promise<unknown>;
  llmStream: (req: { prompt: string; sessionId?: string; systemPrompt?: string }) => Promise<{
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
  mcp: {
    listServers: () => Promise<McpServerInfo[]>;
    addServer: (req: { config: any; enabled?: boolean }) => Promise<McpServerInfo>;
    removeServer: (req: { id: string }) => Promise<{ success: boolean; id: string }>;
    toggleServer: (req: { id: string; enabled: boolean }) => Promise<McpServerInfo>;
    listTools: (filter?: { query?: string; riskLevel?: string; serverId?: string }) => Promise<ToolSummaryInfo[]>;
  };
  skills: {
    listLocal: (req?: { searchPaths?: string[]; projectRoot?: string }) => Promise<ScannedSkillInfo[]>;
  };
  onChatDelta?: (callback: (chunk: { type: string; delta?: string }) => void) => () => void;
  onRecallStatus?: (callback: (status: RecallBadgeInfo) => void) => () => void;
  onChatError?: (callback: (err: ChatErrorInfo) => void) => () => void;
  onApprovalRequest?: (callback: (req: PendingApprovalInfo) => void) => () => void;
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
};

export function ego(): EgoBridge {
  if (typeof window !== "undefined" && (window as unknown as { ego?: EgoBridge }).ego) {
    const rawEgo = (window as unknown as { ego: EgoBridge }).ego;
    return {
      ...rawEgo,
      memory: (op, args) => rawEgo.memory(op as unknown as string, args),
    };
  }
  return mock;
}
