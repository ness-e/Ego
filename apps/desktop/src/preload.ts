import { contextBridge, ipcRenderer } from "electron";
import type { McpServerConfigRequest } from "./ipc/schema.js";
import type { PendingApproval } from "@ego/execution";

/**
 * Puente tipado de IPC (Preload seguro).
 * El Renderer opera aislado (contextIsolation=true, sandbox=true) y nunca accede
 * directamente a Node.js ni a VantaDB. Sin `any`: cada canal expone su payload
 * exacto y cada evento push su forma suscrita (F5T11/M26).
 */
export interface MemoryBridgeRequest {
  op: string;
  args: unknown[];
}

export interface LlmStreamBridgeRequest {
  prompt: string;
  sessionId?: string;
  systemPrompt?: string;
  projectId?: string;
  subEgoId?: string;
}

export interface ApproveBridgeRequest {
  actionId: string;
  confirmed: boolean;
  notes?: string;
}

export interface ResolveApprovalBridgeRequest {
  approvalId: string;
  approved: boolean;
  reason?: string;
  modifiedArguments?: Record<string, unknown>;
}

export interface ToggleSubEgoBridgeRequest {
  subEgoId: string;
  state: "active" | "paused";
}

export interface ModelsListBridgeRequest {
  provider: "openai" | "anthropic" | "google" | "deepseek" | "ollama";
  refresh?: boolean;
}

export interface EgoFetchBridgeRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface EgoFetchBridgeResult {
  ok: boolean;
  status: number;
  body: string;
}

export interface McpMutateBridgeRequest {
  config: McpServerConfigRequest;
  enabled?: boolean;
}

export interface ProjectChangedEvent {
  activeProjectId: string;
}

export interface SubEgosChangedEvent {
  subEgoId: string;
  action: string;
  state?: string;
}

export interface ChatErrorEvent {
  turnId?: string;
  error: string;
  timestamp?: number;
}

// WIDG-02 (Task3): puente mínimo de la isla flotante. Fuente canónica de
// tipos para `renderer/floating/floating.tsx` (que la importa type-only,
// igual que `window-ego.d.ts`). Sin `any`: payloads exactos.
export type FloatingAttentionState =
  | "hidden"
  | "compact"
  | "expanded"
  | "alert"
  | "hitl_approval";

export interface FloatingStateSnapshot {
  visible: boolean;
  muted: boolean;
  activeSubEgoId?: string;
  attentionState: FloatingAttentionState;
}

export interface EgoFloatingBridge {
  /** Push del manager (`floating:state_changed`); retorna unsubscribe. */
  onState: (callback: (state: FloatingStateSnapshot) => void) => () => void;
  /** Resuelve vía `ipc.approval.resolve` (handler ya existe en main). */
  approve: (approvalId: string) => Promise<unknown>;
  deny: (approvalId: string, reason?: string) => Promise<unknown>;
  /**
   * DEUDA Task4/Task10: el handler `ipc.floating.setMuted` aún no existe en
   * main (fuera de alcance Task3: main.ts prohibido). El invoke rechaza hasta
   * que Task4 lo cablee; el flotante optimista ya refleja `muted` local.
   */
  setMuted: (muted: boolean) => Promise<unknown>;
}

export interface EgoPreloadBridge {
  memory: (op: string, args: unknown[]) => Promise<unknown>;
  llmStream: (req: LlmStreamBridgeRequest) => Promise<unknown>;
  // A1: cancelación real del turno en curso (`ipc.llm.cancel` en main).
  // `turnId` opcional: sin él se abortan todos los turnos activos.
  llmCancel: (req?: { turnId?: string }) => Promise<unknown>;
  approve: (req: ApproveBridgeRequest) => Promise<unknown>;
  resolveApproval: (req: ResolveApprovalBridgeRequest) => Promise<unknown>;
  snapshots: () => Promise<unknown>;
  listSubEgos: () => Promise<unknown>;
  createSubEgo: (req: unknown) => Promise<unknown>;
  subegos: {
    list: () => Promise<unknown>;
    getTemplates: () => Promise<unknown>;
    create: (req: unknown) => Promise<unknown>;
    toggleState: (req: ToggleSubEgoBridgeRequest) => Promise<unknown>;
  };
  mcp: {
    listServers: () => Promise<unknown>;
    addServer: (req: McpMutateBridgeRequest) => Promise<unknown>;
    removeServer: (req: { id: string }) => Promise<unknown>;
    toggleServer: (req: { id: string; enabled: boolean }) => Promise<unknown>;
    listTools: (filter?: { query?: string; riskLevel?: string; serverId?: string }) => Promise<unknown>;
  };
  skills: {
    listLocal: (req?: { searchPaths?: string[]; projectRoot?: string }) => Promise<unknown>;
  };
  projects: {
    list: () => Promise<unknown>;
    create: (req: { name: string; rootPath: string; description?: string; activeSubEgoId?: string }) => Promise<unknown>;
    select: (id: string) => Promise<unknown>;
    getActive: () => Promise<unknown>;
    selectFolder: () => Promise<unknown>;
  };
  settings: {
    getModelConfig: () => Promise<unknown>;
    saveModelConfig: (config: {
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
      reasoningEffort?: "low" | "medium" | "high";
      temperature?: number;
    }) => Promise<unknown>;
    getStorageInfo: () => Promise<unknown>;
    getGovPolicies: () => Promise<unknown>;
    getPermissions: () => Promise<unknown>;
    savePermissions: (settings: unknown) => Promise<unknown>;
  };
  onProjectChanged: (callback: (data: ProjectChangedEvent) => void) => () => void;
  onSubEgosChanged: (callback: (data: SubEgosChangedEvent) => void) => () => void;
  onChatDelta: (callback: (chunk: unknown) => void) => () => void;
  onRecallStatus: (callback: (status: unknown) => void) => () => void;
  onChatError: (callback: (err: ChatErrorEvent) => void) => () => void;
  onApprovalRequest: (callback: (req: PendingApproval) => void) => () => void;
  onEvent: (callback: (event: unknown) => void) => () => void;
  // F5T10/H25: los handlers ipc.decision.* e ipc.knowledge.* existían en main
  // sin puente al renderer (superficie muerta). Se puentean con validación
  // Zod en main; el renderer nunca compone secretos en estos canales.
  decision: {
    evaluate: (req: unknown) => Promise<unknown>;
    listAudits: (limit?: number) => Promise<unknown>;
    telemetry: () => Promise<unknown>;
  };
  knowledge: {
    ingest: (req: unknown) => Promise<unknown>;
    hybridSearch: (req: unknown) => Promise<unknown>;
    graphRag: (req: unknown) => Promise<unknown>;
    quarantine: (req: unknown) => Promise<unknown>;
    asOf: (req: unknown) => Promise<unknown>;
    explainArtifact: (req: unknown) => Promise<unknown>;
    exportPackage: (projectId?: string) => Promise<unknown>;
    importPackage: (pkg: unknown) => Promise<unknown>;
  };
  daily: {
    getSummary: (req?: { date?: string }) => Promise<unknown>;
    refineGoals: (req?: { date?: string }) => Promise<unknown>;
    getDecisions: (req?: { limit?: number; since?: number; subEgoId?: string }) => Promise<unknown>;
    saveSnapshot: () => Promise<unknown>;
    getSnapshot: (date?: string) => Promise<unknown>;
    listSnapshots: (limit?: number) => Promise<unknown>;
    isFirstLaunch: (req?: { date?: string }) => Promise<unknown>;
    journal: (req: { action: "get" | "save"; date: string; content?: string }) => Promise<unknown>;
    resolveApprovalsBatch: (req: {
      approvals: Array<{ approvalId: string; approved: boolean; reason?: string }>;
    }) => Promise<unknown>;
    listApprovals: (req?: { limit?: number }) => Promise<unknown>;
  };
  domains: {
    list: () => Promise<unknown>;
    get: (domainId: string) => Promise<unknown>;
    switch: (domainId: string, viewId?: string) => Promise<unknown>;
    getEngineeringStatus: (workspaceRoot?: string) => Promise<unknown>;
    productBacklog: (req: { action: "list" | "create" | "updateStatus"; payload?: unknown }) => Promise<unknown>;
    knowledgeSearch: (query: string, limit?: number) => Promise<unknown>;
    analyticsSeries: (days?: number) => Promise<unknown>;
    crmDeals: (req?: { action: "list" | "create" | "updateStage" | "summary"; payload?: unknown }) => Promise<unknown>;
  };
  // T13: tasks/terminal existían en main (main.ts:3082-3200) sin puente
  // (superficie muerta); sesiones/aprobaciones/storage/policies son nuevos.
  tasks: {
    list: (req?: unknown) => Promise<unknown>;
    cancel: (req: { taskId: string; reason?: string }) => Promise<unknown>;
  };
  terminal: {
    spawn: (req: { command: string; cwd?: string; timeoutMs?: number }) => Promise<unknown>;
    stdin: (req: { sessionId: string; data: string }) => Promise<unknown>;
    kill: (req: { sessionId: string }) => Promise<unknown>;
  };
  sessions: {
    list: (req?: { limit?: number; projectScope?: string }) => Promise<unknown>;
    get: (req: { sessionId: string }) => Promise<unknown>;
    resume: (req: { sessionId: string }) => Promise<unknown>;
  };
  // T15: catálogo live de modelos por proveedor (keys solo en main; el
  // renderer recibe IDs + `configured`, nunca secretos).
  models: {
    listProviders: () => Promise<unknown>;
    listModels: (req: ModelsListBridgeRequest) => Promise<unknown>;
  };
  // Fetch-proxy mínimo en main: inyecta Authorization desde safeStorage,
  // reintenta 1 vez tras 401; el token nunca llega al renderer.
  net: {
    fetch: (req: EgoFetchBridgeRequest) => Promise<EgoFetchBridgeResult>;
  };
  // CFG-09: hooks de ciclo de vida Pre/PostToolUse. El renderer solo pide
  // evaluación/estado; los comandos se validan y ejecutan en main
  // (fail-closed). Canales: `ipc.hooks.*` (handlers en main).
  hooks: {
    getStatus: () => Promise<unknown>;
    evaluatePreToolUse: (req: { toolName: string; sessionId?: string }) => Promise<unknown>;
    recordPostToolUse: (req: { toolName: string; sessionId?: string }) => Promise<unknown>;
  };
  // WIDG-02 (Task3): superficie flotante (`window.egoFloating`).
  floating: EgoFloatingBridge;
}

// T01 (window.ego único): la ÚNICA declaración global de `window.ego` vive en
// `renderer/src/window-ego.d.ts` (vista rica `EgoBridge` + re-export de estos
// tipos canónicos). Se elimina el segundo `declare global` que divergía y
// fusionaba un tipo distinto en el programa renderer.

const egoBridge: EgoPreloadBridge = {
  memory: (op, args) => ipcRenderer.invoke("ipc.memory", { op, args } satisfies MemoryBridgeRequest),
  llmStream: (req) => ipcRenderer.invoke("ipc.llm.stream", req),
  llmCancel: (req?) => ipcRenderer.invoke("ipc.llm.cancel", req ?? {}),
  approve: (req) => ipcRenderer.invoke("ipc.gov.approve", req),
  resolveApproval: (req) => ipcRenderer.invoke("ipc.approval.resolve", req),
  snapshots: () => ipcRenderer.invoke("ipc.snapshots"),
  listSubEgos: () => ipcRenderer.invoke("ipc.subegos.list"),
  createSubEgo: (req) => ipcRenderer.invoke("ipc.subegos.create", req),
  subegos: {
    list: () => ipcRenderer.invoke("ipc.subegos.list"),
    getTemplates: () => ipcRenderer.invoke("ipc.subegos.getTemplates"),
    create: (req) => ipcRenderer.invoke("ipc.subegos.create", req),
    toggleState: (req) => ipcRenderer.invoke("ipc.subegos.toggleState", req),
  },
  mcp: {
    listServers: () => ipcRenderer.invoke("ipc.mcp.listServers"),
    addServer: (req) => ipcRenderer.invoke("ipc.mcp.addServer", req),
    removeServer: (req) => ipcRenderer.invoke("ipc.mcp.removeServer", req),
    toggleServer: (req) => ipcRenderer.invoke("ipc.mcp.toggleServer", req),
    listTools: (filter?) => ipcRenderer.invoke("ipc.mcp.listTools", filter),
  },
  skills: {
    listLocal: (req?) => ipcRenderer.invoke("ipc.skills.listLocal", req),
  },
  projects: {
    list: () => ipcRenderer.invoke("ipc.projects.list"),
    create: (req) => ipcRenderer.invoke("ipc.projects.create", req),
    select: (id) => ipcRenderer.invoke("ipc.projects.select", { id }),
    getActive: () => ipcRenderer.invoke("ipc.projects.getActive"),
    // Token opaco single-use (TTL 60s): el diálogo vive en main, que emite
    // `{ token }`; el canje `selectFolderRedeem` invalida tras un uso y
    // retorna el path. Firma pública intacta: `string | null`.
    selectFolder: async (): Promise<string | null> => {
      const issued: unknown = await ipcRenderer.invoke("ipc.projects.selectFolder");
      if (issued === null || issued === undefined) return null;
      if (typeof issued === "string") return issued;
      const token =
        typeof issued === "object" && issued !== null && "token" in issued
          ? (issued as { token: unknown }).token
          : null;
      if (typeof token !== "string" || token.length === 0) return null;
      const redeemed: unknown = await ipcRenderer.invoke("ipc.projects.selectFolderRedeem", { token });
      return typeof redeemed === "string" ? redeemed : null;
    },
  },
  settings: {
    getModelConfig: () => ipcRenderer.invoke("ipc.settings.getModelConfig"),
    saveModelConfig: (config) => ipcRenderer.invoke("ipc.settings.saveModelConfig", config),
    getStorageInfo: () => ipcRenderer.invoke("ipc.settings.getStorageInfo"),
    getGovPolicies: () => ipcRenderer.invoke("ipc.settings.getGovPolicies"),
    getPermissions: () => ipcRenderer.invoke("ipc.settings.getPermissions"),
    savePermissions: (settings) => ipcRenderer.invoke("ipc.settings.savePermissions", settings),
  },
  onProjectChanged: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, data: ProjectChangedEvent) => callback(data);
    ipcRenderer.on("ipc.projects.changed", sub);
    return () => {
      ipcRenderer.removeListener("ipc.projects.changed", sub);
    };
  },
  onSubEgosChanged: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, data: SubEgosChangedEvent) => callback(data);
    ipcRenderer.on("ipc.subegos.changed", sub);
    return () => {
      ipcRenderer.removeListener("ipc.subegos.changed", sub);
    };
  },
  onChatDelta: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, chunk: unknown) => callback(chunk);
    ipcRenderer.on("ipc.chat.delta", sub);
    return () => {
      ipcRenderer.removeListener("ipc.chat.delta", sub);
    };
  },
  onRecallStatus: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on("ipc.chat.recall_status", sub);
    return () => {
      ipcRenderer.removeListener("ipc.chat.recall_status", sub);
    };
  },
  onChatError: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, err: ChatErrorEvent) => callback(err);
    ipcRenderer.on("ipc.chat.error", sub);
    return () => {
      ipcRenderer.removeListener("ipc.chat.error", sub);
    };
  },
  onApprovalRequest: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, req: PendingApproval) => callback(req);
    ipcRenderer.on("ipc.approval.request", sub);
    return () => {
      ipcRenderer.removeListener("ipc.approval.request", sub);
    };
  },
  onEvent: (callback) => {
    const sub = (_event: Electron.IpcRendererEvent, egoEvent: unknown) => callback(egoEvent);
    ipcRenderer.on("ipc.event", sub);
    return () => {
      ipcRenderer.removeListener("ipc.event", sub);
    };
  },
  decision: {
    evaluate: (req) => ipcRenderer.invoke("ipc.decision.evaluate", req),
    listAudits: (limit?) => ipcRenderer.invoke("ipc.decision.listAudits", limit),
    telemetry: () => ipcRenderer.invoke("ipc.decision.telemetry"),
  },
  knowledge: {
    ingest: (req) => ipcRenderer.invoke("ipc.knowledge.ingest", req),
    hybridSearch: (req) => ipcRenderer.invoke("ipc.knowledge.hybridSearch", req),
    graphRag: (req) => ipcRenderer.invoke("ipc.knowledge.graphRag", req),
    quarantine: (req) => ipcRenderer.invoke("ipc.knowledge.quarantine", req),
    asOf: (req) => ipcRenderer.invoke("ipc.knowledge.asOf", req),
    explainArtifact: (req) => ipcRenderer.invoke("ipc.knowledge.explainArtifact", req),
    exportPackage: (projectId?) => ipcRenderer.invoke("ipc.knowledge.export", projectId),
    importPackage: (pkg) => ipcRenderer.invoke("ipc.knowledge.import", pkg),
  },
  daily: {
    getSummary: (req?) => ipcRenderer.invoke("ipc.daily.getSummary", req),
    refineGoals: (req?) => ipcRenderer.invoke("ipc.daily.refineGoals", req),
    getDecisions: (req?) => ipcRenderer.invoke("ipc.daily.getDecisions", req),
    saveSnapshot: () => ipcRenderer.invoke("ipc.daily.saveSnapshot"),
    getSnapshot: (date?) => ipcRenderer.invoke("ipc.daily.getSnapshot", date),
    listSnapshots: (limit?) => ipcRenderer.invoke("ipc.daily.listSnapshots", limit),
    isFirstLaunch: (req?) => ipcRenderer.invoke("ipc.daily.isFirstLaunch", req),
    journal: (req) => ipcRenderer.invoke("ipc.daily.journal", req),
    resolveApprovalsBatch: (req) => ipcRenderer.invoke("ipc.daily.resolveApprovalsBatch", req),
    listApprovals: (req?) => ipcRenderer.invoke("ipc.daily.listApprovals", req),
  },
  domains: {
    list: () => ipcRenderer.invoke("ipc.domains.list"),
    get: (domainId) => ipcRenderer.invoke("ipc.domains.get", { domainId }),
    switch: (domainId, viewId?) => ipcRenderer.invoke("ipc.domains.switch", { domainId, viewId }),
    getEngineeringStatus: (workspaceRoot?) =>
      ipcRenderer.invoke("ipc.domains.engineering.status", { workspaceRoot }),
    productBacklog: (req) => ipcRenderer.invoke("ipc.domains.product.backlog", req),
    knowledgeSearch: (query, limit?) =>
      ipcRenderer.invoke("ipc.domains.knowledge.search", { query, limit }),
    analyticsSeries: (days?) => ipcRenderer.invoke("ipc.domains.analytics.series", { days }),
    crmDeals: (req?) => ipcRenderer.invoke("ipc.domains.crm.deals", req),
  },
  tasks: {
    list: (req?) => ipcRenderer.invoke("ipc.tasks.list", req),
    cancel: (req) => ipcRenderer.invoke("ipc.tasks.cancel", req),
  },
  terminal: {
    spawn: (req) => ipcRenderer.invoke("ipc.terminal.spawn", req),
    stdin: (req) => ipcRenderer.invoke("ipc.terminal.stdin", req),
    kill: (req) => ipcRenderer.invoke("ipc.terminal.kill", req),
  },
  sessions: {
    list: (req?) => ipcRenderer.invoke("ipc.sessions.list", req),
    get: (req) => ipcRenderer.invoke("ipc.sessions.get", req),
    resume: (req) => ipcRenderer.invoke("ipc.sessions.resume", req),
  },
  models: {
    listProviders: () => ipcRenderer.invoke("ipc.models.listProviders"),
    listModels: (req) => ipcRenderer.invoke("ipc.models.listModels", req),
  },
  net: {
    fetch: (req) => ipcRenderer.invoke("ipc.net.fetch", req),
  },
  hooks: {
    getStatus: () => ipcRenderer.invoke("ipc.hooks.getStatus"),
    evaluatePreToolUse: (req) => ipcRenderer.invoke("ipc.hooks.evaluatePreToolUse", req),
    recordPostToolUse: (req) => ipcRenderer.invoke("ipc.hooks.recordPostToolUse", req),
  },
  floating: {
    onState: (callback) => {
      const sub = (_event: Electron.IpcRendererEvent, state: FloatingStateSnapshot) =>
        callback(state);
      ipcRenderer.on("floating:state_changed", sub);
      return () => {
        ipcRenderer.removeListener("floating:state_changed", sub);
      };
    },
    approve: (approvalId) =>
      ipcRenderer.invoke("ipc.approval.resolve", { approvalId, approved: true }),
    deny: (approvalId, reason?) =>
      ipcRenderer.invoke("ipc.approval.resolve", { approvalId, approved: false, reason }),
    setMuted: (muted) => ipcRenderer.invoke("ipc.floating.setMuted", { muted }),
  },
};

const egoFloatingBridge: EgoFloatingBridge = egoBridge.floating;

contextBridge.exposeInMainWorld("ego", egoBridge);
contextBridge.exposeInMainWorld("egoFloating", egoFloatingBridge);
