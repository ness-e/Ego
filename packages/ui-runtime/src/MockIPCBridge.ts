/**
 * Mock IPC Bridge para iteración aislada de la UI (Patrón Coucou COUC-15 / Mock Bridge).
 * Permite ejecutar y probar los componentes del Dynamic Workspace y la UI en un navegador
 * web estándar sin requerir arrancar Electron ni el proceso principal de Node.js.
 *
 * ⚠️ INSEGURO POR DISEÑO — SOLO TESTS / DEV BROWSER (H17/H18/H19):
 * - Todo vive en memoria del hilo UI, SIN cifrado y SIN keychain.
 * - JAMÁS usar en producción ni como referencia de seguridad.
 * - JAMÁS pasar secretos reales (`apiKey`, tokens): el modo strict los RECHAZA.
 *
 * Modos:
 * - strict (defecto): valida entradas con zod y rechaza operaciones/secretos
 *   desconocidos con Error. Es el modo para tests nuevos.
 * - permissive (`{ permissive: true }`, explícito): compat legacy para tests
 *   viejos que dependen del mock permisivo; emite `console.warn` por llamada
 *   degradada. Migrar esos tests a strict.
 */
import { z } from "zod";

export interface MockIPCBridgeOptions {
  /** Opt-in explícito al comportamiento legacy permisivo. Defecto: false (strict). */
  permissive?: boolean;
}

const MemoryOpSchema = z.object({
  op: z.enum(["get", "put"]),
  args: z.array(z.unknown()),
});

const LlmStreamSchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const SubEgoCreateSchema = z.record(z.unknown());

const ModelConfigSchema = z.object({
  activeProvider: z.string().min(1),
  baseUrl: z.string().optional(),
  modelName: z.string().optional(),
});

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
    addServer: (req: { config: Record<string, unknown>; enabled?: boolean }) => Promise<{ success: boolean }>;
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
   * Strict por defecto; `{ permissive: true }` solo como puente de migración.
   */
  public static createMockApi(options?: MockIPCBridgeOptions): MockEgoAPI {
    const strict = options?.permissive !== true;
    const memoryStore = new Map<string, unknown>();
    const projectListeners = new Set<(data: { activeProjectId: string }) => void>();
    const subEgoListeners = new Set<(data: { subEgoId: string; action: string; state?: string }) => void>();
    const chatListeners = new Set<(chunk: unknown) => void>();
    let modelConfig: Record<string, unknown> = {
      activeProvider: "mock-provider",
      modelName: "mock-model-1",
    };

    const rejectOrWarn = (message: string): null => {
      if (strict) {
        throw new Error(`[MockIPCBridge:strict] ${message}`);
      }
      console.warn(`[MockIPCBridge:permissive] ${message} (modo legacy; migrar a strict)`);
      return null;
    };

    const warnLegacy = (message: string): void => {
      console.warn(`[MockIPCBridge:permissive] ${message} (modo legacy; migrar a strict)`);
    };

    const activeProject = {
      id: "mock_proj_01",
      name: "Mock Workspace Project",
      rootPath: "/mock/workspace",
      description: "Proyecto de simulación en navegador web",
    };

    return {
      memory: async (payload) => {
        const parsed = MemoryOpSchema.safeParse(payload);
        if (!parsed.success) {
          rejectOrWarn(`memory: payload inválido (op esperada 'get'|'put'): ${parsed.error.message}`);
          return null;
        }
        if (parsed.data.op === "get") {
          return memoryStore.get(String(parsed.data.args[0])) ?? null;
        }
        memoryStore.set(String(parsed.data.args[0]), parsed.data.args[1]);
        return { success: true };
      },
      llmStream: async (req) => {
        const parsed = LlmStreamSchema.safeParse(req);
        if (!parsed.success) {
          if (strict) {
            throw new Error(`[MockIPCBridge:strict] llmStream: prompt requerido no vacío: ${parsed.error.message}`);
          }
          warnLegacy(`llmStream: prompt inválido: ${parsed.error.message}`);
          const fallbackPrompt = typeof req?.prompt === "string" ? req.prompt : "";
          return { text: `[Mock LLM Response for: "${fallbackPrompt.slice(0, 40)}..."]` };
        }
        return { text: `[Mock LLM Response for: "${parsed.data.prompt.slice(0, 40)}..."]` };
      },
      approve: async () => ({ approved: true }),
      resolveApproval: async () => ({ success: true }),
      snapshots: async () => [],
      listSubEgos: async () => [
        { id: "subego_mock_1", name: "Researcher Sub-Ego", role: "researcher", state: "active" },
        { id: "subego_mock_2", name: "Developer Sub-Ego", role: "developer", state: "active" },
      ],
      createSubEgo: async (req: unknown) => {
        const parsed = SubEgoCreateSchema.safeParse(req);
        if (!parsed.success) {
          if (strict) {
            throw new Error(`[MockIPCBridge:strict] createSubEgo: se esperaba objeto: ${parsed.error.message}`);
          }
          warnLegacy(`createSubEgo: entrada no-objeto: ${parsed.error.message}`);
          return { id: `subego_${Date.now()}` };
        }
        return { id: `subego_${Date.now()}`, ...parsed.data };
      },
      subegos: {
        list: async () => [
          { id: "subego_mock_1", name: "Researcher Sub-Ego", role: "researcher", state: "active" },
          { id: "subego_mock_2", name: "Developer Sub-Ego", role: "developer", state: "active" },
        ],
        getTemplates: async () => [
          { id: "template_code", name: "Software Engineer", role: "developer" },
        ],
        create: async (req: unknown) => {
          const parsed = SubEgoCreateSchema.safeParse(req);
          if (!parsed.success) {
            if (strict) {
              throw new Error(`[MockIPCBridge:strict] subegos.create: se esperaba objeto: ${parsed.error.message}`);
            }
            warnLegacy(`subegos.create: entrada no-objeto: ${parsed.error.message}`);
            return { id: `subego_${Date.now()}` };
          }
          return { id: `subego_${Date.now()}`, ...parsed.data };
        },
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
        // NUNCA expone apiKey: el mock no custodia secretos (H19).
        getModelConfig: async () => ({ ...modelConfig }),
        saveModelConfig: async (config) => {
          if (config && typeof config === "object" && "apiKey" in config && config.apiKey !== undefined) {
            if (strict) {
              throw new Error("[MockIPCBridge:strict] settings.saveModelConfig: apiKey en claro rechazada; el mock no custodia secretos.");
            }
            // Permissive legacy: warn + SANITIZAR (jamás persistir el secreto).
            warnLegacy("settings.saveModelConfig: apiKey en claro ignorada; no se persiste.");
            const { apiKey: _dropped, ...rest } = config as Record<string, unknown>;
            const parsedRest = ModelConfigSchema.safeParse(rest);
            if (parsedRest.success) {
              const { activeProvider, baseUrl, modelName } = parsedRest.data;
              modelConfig = { activeProvider, ...(baseUrl ? { baseUrl } : {}), ...(modelName ? { modelName } : {}) };
            }
            return { success: true };
          }
          const parsed = ModelConfigSchema.safeParse(config);
          if (!parsed.success) {
            if (strict) {
              throw new Error(`[MockIPCBridge:strict] settings.saveModelConfig: config inválida: ${parsed.error.message}`);
            }
            warnLegacy(`settings.saveModelConfig: config inválida: ${parsed.error.message}`);
            return { success: true };
          }
          const { activeProvider, baseUrl, modelName } = parsed.data;
          modelConfig = { activeProvider, ...(baseUrl ? { baseUrl } : {}), ...(modelName ? { modelName } : {}) };
          return { success: true };
        },
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
    const globalObj =
      typeof globalThis !== "undefined"
        ? (globalThis as unknown as Record<string, unknown>)
        : undefined;
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
