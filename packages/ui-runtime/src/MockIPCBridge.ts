/**
 * Mock IPC Bridge para iteración aislada de la UI (Patrón Coucou COUC-15 / Mock Bridge).
 * Permite ejecutar y probar los componentes del Dynamic Workspace y la UI en un navegador
 * web estándar sin requerir arrancar Electron ni el proceso principal de Node.js.
 */

export interface MockEgoAPI {
  memory: (payload: { op: string; args: unknown[] }) => Promise<unknown>;
  llmStream: (req: { prompt: string; sessionId?: string; systemPrompt?: string }) => Promise<unknown>;
  approve: (req: { actionId: string; confirmed: boolean; notes?: string }) => Promise<unknown>;
  resolveApproval: (req: {
    approvalId: string;
    approved: boolean;
    reason?: string;
    modifiedArguments?: Record<string, unknown>;
  }) => Promise<{ success: boolean }>;
  snapshots: () => Promise<unknown[]>;
  listSubEgos: () => Promise<unknown[]>;
  createSubEgo: (req: unknown) => Promise<unknown>;
  subegos: {
    list: () => Promise<unknown[]>;
    getTemplates: () => Promise<unknown[]>;
    create: (req: unknown) => Promise<unknown>;
    toggleState: (req: { subEgoId: string; state: "active" | "paused" }) => Promise<{ success: boolean }>;
  };
  mcp: {
    listServers: () => Promise<unknown[]>;
    addServer: (req: { config: any; enabled?: boolean }) => Promise<{ success: boolean }>;
    removeServer: (req: { id: string }) => Promise<{ success: boolean }>;
    toggleServer: (req: { id: string; enabled: boolean }) => Promise<{ success: boolean }>;
    listTools: (filter?: { query?: string; riskLevel?: string; serverId?: string }) => Promise<unknown[]>;
  };
  skills: {
    listLocal: (req?: { searchPaths?: string[]; projectRoot?: string }) => Promise<unknown[]>;
  };
  projects: {
    list: () => Promise<unknown[]>;
    create: (req: { name: string; rootPath: string; description?: string; activeSubEgoId?: string }) => Promise<unknown>;
    select: (id: string) => Promise<{ success: boolean }>;
    getActive: () => Promise<unknown>;
    selectFolder: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  settings: {
    getModelConfig: () => Promise<unknown>;
    saveModelConfig: (config: { activeProvider: string; apiKey?: string; baseUrl?: string; modelName?: string }) => Promise<{ success: boolean }>;
  };
  onProjectChanged: (callback: (data: { activeProjectId: string }) => void) => () => void;
  onSubEgosChanged: (callback: (data: { subEgoId: string; action: string; state?: string }) => void) => () => void;
  onChatDelta: (callback: (chunk: unknown) => void) => () => void;
}

export class MockIPCBridge {
  private static mockInstance?: MockEgoAPI;

  /**
   * Genera una implementación en memoria de la API de Electron para el navegador.
   */
  public static createMockApi(): MockEgoAPI {
    const memoryStore = new Map<string, unknown>();
    const projectListeners = new Set<(data: { activeProjectId: string }) => void>();
    const subEgoListeners = new Set<(data: { subEgoId: string; action: string; state?: string }) => void>();
    const chatListeners = new Set<(chunk: unknown) => void>();

    const activeProject = {
      id: "mock_proj_01",
      name: "Mock Workspace Project",
      rootPath: "/mock/workspace",
      description: "Proyecto de simulación en navegador web",
    };

    return {
      memory: async (payload) => {
        if (payload.op === "get") {
          return memoryStore.get(String(payload.args[0])) ?? null;
        }
        if (payload.op === "put") {
          memoryStore.set(String(payload.args[0]), payload.args[1]);
          return { success: true };
        }
        return null;
      },
      llmStream: async (req) => {
        return { text: `[Mock LLM Response for: "${req.prompt.slice(0, 40)}..."]` };
      },
      approve: async () => ({ approved: true }),
      resolveApproval: async () => ({ success: true }),
      snapshots: async () => [],
      listSubEgos: async () => [
        { id: "subego_mock_1", name: "Researcher Sub-Ego", role: "researcher", state: "active" },
        { id: "subego_mock_2", name: "Developer Sub-Ego", role: "developer", state: "active" },
      ],
      createSubEgo: async (req: any) => ({ id: `subego_${Date.now()}`, ...req }),
      subegos: {
        list: async () => [
          { id: "subego_mock_1", name: "Researcher Sub-Ego", role: "researcher", state: "active" },
          { id: "subego_mock_2", name: "Developer Sub-Ego", role: "developer", state: "active" },
        ],
        getTemplates: async () => [
          { id: "template_code", name: "Software Engineer", role: "developer" },
        ],
        create: async (req: any) => ({ id: `subego_${Date.now()}`, ...req }),
        toggleState: async (req) => {
          for (const l of subEgoListeners) {
            l({ subEgoId: req.subEgoId, action: "toggleState", state: req.state });
          }
          return { success: true };
        },
      },
      mcp: {
        listServers: async () => [{ id: "mock_mcp_git", name: "git-mcp", status: "connected" }],
        addServer: async () => ({ success: true }),
        removeServer: async () => ({ success: true }),
        toggleServer: async () => ({ success: true }),
        listTools: async () => [{ name: "mock_tool_1", description: "Herramienta simulada" }],
      },
      skills: {
        listLocal: async () => [{ name: "mock-skill", description: "Habilidad mock" }],
      },
      projects: {
        list: async () => [activeProject],
        create: async (req) => ({ id: `proj_${Date.now()}`, ...req }),
        select: async (id) => {
          for (const l of projectListeners) {
            l({ activeProjectId: id });
          }
          return { success: true };
        },
        getActive: async () => activeProject,
        selectFolder: async () => ({ canceled: false, filePaths: ["/mock/workspace"] }),
      },
      settings: {
        getModelConfig: async () => ({ activeProvider: "mock-provider", modelName: "mock-model-1" }),
        saveModelConfig: async () => ({ success: true }),
      },
      onProjectChanged: (cb) => {
        projectListeners.add(cb);
        return () => projectListeners.delete(cb);
      },
      onSubEgosChanged: (cb) => {
        subEgoListeners.add(cb);
        return () => subEgoListeners.delete(cb);
      },
      onChatDelta: (cb) => {
        chatListeners.add(cb);
        return () => chatListeners.delete(cb);
      },
    };
  }

  /**
   * Instala el MockIPCBridge en `window.ego` si no nos encontramos dentro de Electron.
   */
  public static installIfMissing(): boolean {
    const globalObj = typeof globalThis !== "undefined" ? (globalThis as any) : undefined;
    if (!globalObj) return false;

    if (globalObj.ego) {
      return false; // Ya está presente la API nativa de Electron
    }

    if (!this.mockInstance) {
      this.mockInstance = this.createMockApi();
    }

    globalObj.ego = this.mockInstance;
    return true;
  }
}
