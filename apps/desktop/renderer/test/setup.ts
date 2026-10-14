import { vi, beforeEach } from "vitest";
import type { EgoBridge, SubEgoSummary, ProjectInfo, ModelConfigInfo, McpServerInfo, PendingApprovalInfo } from "../lib/ego.js";

// Habilitar soporte de act() de React 19 en entorno headless
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Emulador MockEgoBridge determinista para pruebas de UI sin Electron vivo (COUC-15 / CANV-12)
 */
export function createMockEgoBridge(): EgoBridge & {
  emitEvent: (event: unknown) => void;
  emitApprovalRequest: (req: PendingApprovalInfo) => void;
  listeners: {
    event: Set<(e: unknown) => void>;
    approval: Set<(r: PendingApprovalInfo) => void>;
  };
} {
  const eventListeners = new Set<(e: unknown) => void>();
  const approvalListeners = new Set<(r: PendingApprovalInfo) => void>();

  const subEgos: SubEgoSummary[] = [
    {
      id: "ego.nucleus",
      name: "Ego Núcleo",
      role: "Orquestador General",
      description: "Supervisa, planifica y orquesta la delegación y memoria del sistema.",
      state: "active",
    },
    {
      id: "ego.developer",
      name: "Ego Dev",
      role: "Ingeniero de Software",
      description: "Especialista en desarrollo y código.",
      state: "active",
    },
  ];

  const projects: ProjectInfo[] = [
    { id: "default", name: "Ego Core", rootPath: "/", badge: "Activo" },
    { id: "proj-2", name: "Test Project", rootPath: "/test" },
  ];

  let currentModelConfig: ModelConfigInfo = {
    activeProvider: "mock",
    apiKey: "",
    baseUrl: "",
    modelName: "mock-core",
  };

  return {
    listeners: {
      event: eventListeners,
      approval: approvalListeners,
    },
    emitEvent: (event: unknown) => {
      eventListeners.forEach((cb) => cb(event));
    },
    emitApprovalRequest: (req: PendingApprovalInfo) => {
      approvalListeners.forEach((cb) => cb(req));
    },
    memory: vi.fn().mockResolvedValue({ ok: true }),
    llmStream: vi.fn().mockResolvedValue({
      ok: true,
      turnId: "mock_turn_test",
      text: "Mock response text",
      recallStatus: { count: 1, glyph: "🧠", sources: ["kb/test"], tokensEstimate: 50 },
    }),
    approve: vi.fn().mockResolvedValue({ ok: true }),
    resolveApproval: vi.fn().mockResolvedValue({
      ok: true,
      approvalId: "app-1",
      approved: true,
      timestamp: Date.now(),
    }),
    snapshots: vi.fn().mockResolvedValue({ ok: true, missing: [] }),
    listSubEgos: vi.fn().mockResolvedValue(subEgos),
    createSubEgo: vi.fn().mockImplementation(async (req) => ({
      id: `ego.${req.name.toLowerCase()}`,
      name: req.name,
      role: req.role,
      description: req.instructions,
      state: "active",
    })),
    subegos: {
      list: vi.fn().mockResolvedValue(
        subEgos.map((s) => ({
          ...s,
          creator: "user",
          tools: ["memory_recall"],
        }))
      ),
      getTemplates: vi.fn().mockResolvedValue([
        {
          id: "developer",
          templateId: "developer",
          name: "Ingeniero de Software",
          role: "Desarrollo",
          description: "Desarrollo y código",
          instructions: "Instrucciones de desarrollo",
          recommendedTools: ["fs_read_file"],
          recommendedCapabilities: ["code"],
          recommendedResponsibilities: ["Codificar"],
          autonomy: "supervised",
        },
      ]),
      create: vi.fn().mockImplementation(async (req) => ({
        id: `ego.${req.name || "custom"}`,
        name: req.name || "Custom",
        role: req.role || "Especialista",
        description: req.instructions || "",
        state: "active",
      })),
      toggleState: vi.fn().mockImplementation(async (req) => ({
        id: req.subEgoId,
        name: req.subEgoId,
        role: "Especialista",
        description: "",
        state: req.state,
      })),
    },
    projects: {
      list: vi.fn().mockResolvedValue(projects),
      create: vi.fn().mockImplementation(async (req) => ({
        id: "proj_new",
        name: req.name,
        rootPath: req.rootPath,
      })),
      select: vi.fn().mockImplementation(async (id) => ({ ok: true, activeProjectId: id })),
      getActive: vi.fn().mockResolvedValue(projects[0]),
      selectFolder: vi.fn().mockResolvedValue("/test/folder"),
    },
    mcp: {
      listServers: vi.fn().mockResolvedValue([]),
      addServer: vi.fn().mockResolvedValue({
        id: "srv",
        name: "srv",
        config: { id: "srv", name: "srv", transport: "stdio", command: "node" },
        status: "connected",
        enabled: true,
        toolsCount: 0,
        tools: [],
      } satisfies McpServerInfo),
      removeServer: vi.fn().mockResolvedValue({ success: true, id: "srv" }),
      toggleServer: vi.fn().mockResolvedValue({
        id: "srv",
        name: "srv",
        config: { id: "srv", name: "srv", transport: "stdio", command: "node" },
        status: "connected",
        enabled: true,
        toolsCount: 0,
        tools: [],
      } satisfies McpServerInfo),
      listTools: vi.fn().mockResolvedValue([]),
    },
    skills: {
      listLocal: vi.fn().mockResolvedValue([]),
    },
    settings: {
      getModelConfig: vi.fn().mockImplementation(async () => currentModelConfig),
      saveModelConfig: vi.fn().mockImplementation(async (cfg) => {
        currentModelConfig = { ...cfg };
        return { ok: true, config: currentModelConfig };
      }),
      getStorageInfo: vi.fn().mockResolvedValue({
        ok: true,
        mock: true,
        userDataDir: "/mock/user-data",
        dbPath: "/mock/user-data/ego_memory.vdb",
        operational: true,
        platform: "mock",
        namespaces: ["session/turns", "gov/settings", "gov/policies"],
      }),
      getGovPolicies: vi.fn().mockResolvedValue({ ok: true, mock: true, policies: [] }),
    },
    models: {
      listProviders: vi.fn().mockResolvedValue({
        ok: true,
        mock: true,
        providers: [
          { id: "openai", configured: false },
          { id: "anthropic", configured: false },
          { id: "google", configured: false },
          { id: "deepseek", configured: false },
          { id: "ollama", configured: true },
          { id: "mock", configured: true },
        ],
      }),
      listModels: vi.fn().mockImplementation(async (req: { provider: string }) => ({
        ok: true,
        mock: true,
        provider: req.provider,
        models: [],
        source: "curated",
      })),
    },
    onEvent: (cb) => {
      eventListeners.add(cb);
      return () => {
        eventListeners.delete(cb);
      };
    },
    onApprovalRequest: (cb: (req: PendingApprovalInfo) => void) => {
      approvalListeners.add(cb);
      return () => {
        approvalListeners.delete(cb);
      };
    },
    tasks: {
      list: vi.fn().mockResolvedValue({ ok: true, mock: true, tasks: [] }),
      cancel: vi.fn().mockImplementation(async (req: { taskId: string }) => ({ ok: true, mock: true, taskId: req.taskId })),
    },
    terminal: {
      spawn: vi.fn().mockResolvedValue({ ok: true, mock: true, sessionId: "term_mock", cwd: "/mock" }),
      stdin: vi.fn().mockResolvedValue({ ok: true, mock: true }),
      kill: vi.fn().mockImplementation(async (req: { sessionId: string }) => ({ ok: true, mock: true, sessionId: req.sessionId })),
    },
    sessions: {
      list: vi.fn().mockResolvedValue({ ok: true, mock: true, sessions: [] }),
      get: vi.fn().mockImplementation(async (req: { sessionId: string }) => ({ ok: true, mock: true, sessionId: req.sessionId })),
      resume: vi.fn().mockImplementation(async (req: { sessionId: string }) => ({ ok: true, mock: true, sessionId: req.sessionId })),
    },
  };
}

// Inyectar en window global para que ego() lo consuma por defecto
const mockBridge = createMockEgoBridge();
(window as unknown as { ego: EgoBridge }).ego = mockBridge;

// Reset global antes de cada test
beforeEach(() => {
  vi.clearAllMocks();
});
