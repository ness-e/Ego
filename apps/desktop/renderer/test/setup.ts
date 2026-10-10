import { vi } from "vitest";
import type { EgoBridge, SubEgoSummary, ProjectInfo, ModelConfigInfo } from "../lib/ego.js";

// Habilitar soporte de act() de React 19 en entorno headless
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Emulador MockEgoBridge determinista para pruebas de UI sin Electron vivo (COUC-15 / CANV-12)
 */
export function createMockEgoBridge(): EgoBridge & {
  emitEvent: (event: unknown) => void;
  emitApprovalRequest: (req: unknown) => void;
  listeners: {
    event: Set<(e: unknown) => void>;
    approval: Set<(r: unknown) => void>;
  };
} {
  const eventListeners = new Set<(e: unknown) => void>();
  const approvalListeners = new Set<(r: unknown) => void>();

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
    emitApprovalRequest: (req: unknown) => {
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
      addServer: vi.fn().mockResolvedValue({} as any),
      removeServer: vi.fn().mockResolvedValue({ success: true, id: "srv" }),
      toggleServer: vi.fn().mockResolvedValue({} as any),
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
    },
    onEvent: (cb) => {
      eventListeners.add(cb);
      return () => {
        eventListeners.delete(cb);
      };
    },
    onApprovalRequest: (cb) => {
      approvalListeners.add(cb);
      return () => {
        approvalListeners.delete(cb);
      };
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
