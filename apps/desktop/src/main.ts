import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import {
  EgoMemoryAdapter,
  EgoMemoryLifecycle,
  SubEgoManifest,
  createSubEgoId,
} from "@ego/memory";
import { ModelRouter, ModelMessage, OpenAICompatibleProvider } from "@ego/models";
import { ToolRegistry, registerNativeTools, type ToolExecutionContext } from "@ego/tools";
import { McpManager, SkillScanner } from "@ego/integrations";
import { EventBus, StructuredLogger } from "@ego/events";
import { ToolExecutionLoop, type LoopExecutionResult } from "@ego/runtime";
import { ApprovalEngine, ExecutionManager, type PendingApproval } from "@ego/execution";
import {
  SubEgoRegistry,
  SubEgoFactory,
} from "@ego/subegos";
import {
  MemoryOpSchema,
  CreateSubEgoSchema,
  ToggleSubEgoStateSchema,
  ApproveActionSchema,
  ResolveApprovalSchema,
  ChatStreamSchema,
  AddMcpServerSchema,
  RemoveMcpServerSchema,
  ToggleMcpServerSchema,
  ListToolsFilterSchema,
  ScanSkillsSchema,
  ProjectManifestSchema,
  CreateProjectSchema,
  SelectProjectSchema,
  type ProjectManifest,
} from "./ipc/schema.js";

let adapter: EgoMemoryAdapter;
let lifecycle: EgoMemoryLifecycle;
let modelRouter: ModelRouter;
let approvalEngine: ApprovalEngine;
let executionManager: ExecutionManager;
let toolRegistry: ToolRegistry;
let toolLoop: ToolExecutionLoop;
let subEgoRegistry: SubEgoRegistry;
let mcpManager: McpManager;
let skillScanner: SkillScanner;
let eventBus: EventBus;
let structuredLogger: StructuredLogger;
let win: BrowserWindow | null = null;
let activeProjectId: string = "default";

export function getSubEgoRegistry(): SubEgoRegistry {
  return subEgoRegistry;
}

export function getEventBus(): EventBus {
  return eventBus;
}

export function getModelRouter(): ModelRouter {
  return modelRouter;
}

export function getToolRegistry(): ToolRegistry {
  return toolRegistry;
}

export function getToolLoop(): ToolExecutionLoop {
  return toolLoop;
}

export function getApprovalEngine(): ApprovalEngine {
  return approvalEngine;
}

export function getExecutionManager(): ExecutionManager {
  return executionManager;
}

export function getLifecycle(): EgoMemoryLifecycle {
  return lifecycle;
}

export function getActiveProjectId(): string {
  return activeProjectId;
}

export async function getOrCreateDefaultProject(adapterInstance: EgoMemoryAdapter): Promise<ProjectManifest> {
  const existing = await adapterInstance.get("gov/projects", "default");
  if (existing) {
    let payload: unknown = existing;
    if (typeof existing === "object" && existing !== null && "payload" in existing) {
      payload = (existing as { payload: unknown }).payload;
    }
    try {
      return ProjectManifestSchema.parse(payload);
    } catch {
      // noop
    }
  }

  const defaultProject: ProjectManifest = {
    id: "default",
    name: "Ego Core",
    rootPath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
    description: "Proyecto central y entorno de trabajo principal de Ego",
    activeSubEgoId: "ego.nucleus",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };

  await adapterInstance.put({
    namespace: "gov/projects",
    key: "default",
    payload: defaultProject,
    metadata: { name: defaultProject.name, rootPath: defaultProject.rootPath }
  });
  await adapterInstance.put({
    namespace: "projects/default",
    key: "manifest",
    payload: defaultProject,
    metadata: { name: defaultProject.name, rootPath: defaultProject.rootPath }
  });

  return defaultProject;
}

/**
 * Registra proveedores reales y BYOK en el ModelRouter (INT-02).
 */
export function setupModelProviders(router: ModelRouter): void {
  // 1. OpenAI (BYOK vía OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    router.registerProvider(
      new OpenAICompatibleProvider({
        providerId: "openai",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
      })
    );
  }

  // 2. DeepSeek (BYOK vía DEEPSEEK_API_KEY)
  if (process.env.DEEPSEEK_API_KEY) {
    router.registerProvider(
      new OpenAICompatibleProvider({
        providerId: "deepseek",
        baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
      })
    );
  }

  // 3. Ollama (Local Offline por defecto)
  router.registerProvider(
    new OpenAICompatibleProvider({
      providerId: "ollama",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    })
  );
}

/**
 * Procesa una solicitud de chat ejecutando el ciclo cognitivo ToolExecutionLoop con
 * streaming, persistencia inmutable en VantaDB y control de ejecución (INT-01).
 */
export async function handleLlmStream(rawReq: unknown): Promise<{
  ok: boolean;
  turnId: string;
  text: string;
  recallStatus: any;
  usage?: any;
  status: string;
}> {
  const parseResult = ChatStreamSchema.safeParse(rawReq);
  if (!parseResult.success) {
    throw new Error(`[IPC Security] Solicitud de chat inválida: ${parseResult.error.message}`);
  }
  const req = parseResult.data;

  const sessionId = req.sessionId || lifecycle?.currentSessionId || "default_session";
  const turnId = `turn_${Date.now()}`;
  const turnStartTime = Date.now();

  eventBus?.emit("task.started", {
    taskId: turnId,
    startedAt: turnStartTime,
  }, {
    source: "desktop.ipc.llm.stream",
    sessionId,
    traceId: turnId,
    severity: "info",
  });

  try {
    // FASE 2: Pre-Turn Context Assembly & Recall (Prefetch + Glifo 🧠)
    const { contextText, recallStatus } = await lifecycle.assemblePreTurn(req.prompt);

    // Informar a la UI del estado de memoria inyectada
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.recall_status", recallStatus);
    }

    // Ensamblar mensajes para el modelo
    const messages: ModelMessage[] = [];
    const systemInstruction = [
      "Eres Ego, un Sistema Operativo Cognitivo de élite, riguroso, analítico y local-first.",
      req.systemPrompt || "",
      contextText,
    ]
      .filter(Boolean)
      .join("\n\n");

    messages.push({ role: "system", content: systemInstruction });
    messages.push({ role: "user", content: req.prompt });

    const execContext: ToolExecutionContext = {
      callId: turnId,
      sessionId,
      projectId: req.projectId || "default_project",
      subEgoId: req.subEgoId || "ego.nucleus",
    };

    // Ejecutar loop cognitivo multi-turno a través de ToolExecutionLoop (INT-01)
    const loopResult: LoopExecutionResult = await toolLoop.run({
      messages,
      context: execContext,
      role: "general-chat",
      systemPrompt: systemInstruction,
      traceId: turnId,
      eventBus
    });

    const finalText = loopResult.finalText || "";

    // Retransmitir texto final hacia la UI
    if (finalText && win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.delta", {
        type: "text",
        text: finalText,
        delta: finalText
      });
    }

    // FASE 4: Post-Turn Synchronization (Persistencia inmutable L1 en VantaDB)
    const recalledKeys = recallStatus.hits.map((h) => `${h.namespace}:${h.key}`);
    await lifecycle.syncTurn(sessionId, turnId, req.prompt, finalText, recalledKeys);

    eventBus?.emit("task.completed", {
      taskId: turnId,
      durationMs: Date.now() - turnStartTime,
      result: { turnId, textLength: finalText.length, usage: loopResult.usage, steps: loopResult.steps },
    }, {
      source: "desktop.ipc.llm.stream",
      sessionId,
      traceId: turnId,
      severity: "info",
    });

    return {
      ok: loopResult.status === "completed",
      turnId,
      text: finalText,
      recallStatus,
      usage: loopResult.usage,
      status: loopResult.status
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.error", { turnId, error: errorMsg });
    }

    eventBus?.emit("task.failed", {
      taskId: turnId,
      error: errorMsg,
      code: "STREAM_ERROR",
    }, {
      source: "desktop.ipc.llm.stream",
      sessionId,
      traceId: turnId,
      severity: "error",
    });

    throw new Error(`[Cognitive Runtime Error]: ${errorMsg}`);
  }
}

export async function createWindow(): Promise<void> {
  const dbPath = join(app.getPath("userData"), "ego_memory.vdb");
  adapter = new EgoMemoryAdapter(dbPath);
  await adapter.init();

  lifecycle = new EgoMemoryLifecycle(adapter);
  await lifecycle.startSession("session_init", "default");

  modelRouter = new ModelRouter();
  setupModelProviders(modelRouter);

  eventBus = new EventBus();
  structuredLogger = new StructuredLogger({
    minSeverity: "info",
    outputStream: (line) => console.log(`[Ego EventLog] ${line}`)
  });
  structuredLogger.attachToEventBus(eventBus);

  toolRegistry = new ToolRegistry();
  registerNativeTools(toolRegistry, {
    workspacePath: process.env.EGO_WORKSPACE_PATH || process.cwd()
  });

  mcpManager = new McpManager(toolRegistry);
  skillScanner = new SkillScanner();
  subEgoRegistry = new SubEgoRegistry(adapter);

  // Restaurar servidores MCP persistidos en VantaDB si existen (gov/mcp_servers)
  try {
    const savedServers = await adapter.searchMulti(["gov/mcp_servers"], "", { topK: 50 });
    for (const hit of savedServers) {
      if (!hit.record) continue;
      let rawPayload = hit.record.payload;
      if (typeof rawPayload === "string") {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch {
          // Si no es JSON plano, se ignora
        }
      }
      const item = rawPayload as { config?: any; enabled?: boolean } | undefined;
      if (item && item.config) {
        await mcpManager.registerServer(item.config, item.enabled ?? true);
      }
    }
  } catch (err) {
    console.warn("[Ego Main] Advertencia al restaurar servidores MCP de VantaDB:", err);
  }

  approvalEngine = new ApprovalEngine({
    mode: "standard",
    onApprovalRequested: (pending: PendingApproval) => {
      win?.webContents.send("ipc.approval.request", pending);
    },
  });

  executionManager = new ExecutionManager({
    maxConcurrentExecutions: 5,
    defaultTimeoutMs: 60_000
  });

  toolLoop = new ToolExecutionLoop(modelRouter, toolRegistry, {
    executionManager,
    approvalEngine,
    eventBus,
    maxSteps: 8,
    defaultRole: "general-chat",
    onToolCall: (call) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("ipc.chat.delta", {
          type: "tool_call",
          callId: call.id,
          toolName: call.name,
          arguments: call.arguments
        });
      }
    },
    onToolResult: (res) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("ipc.chat.delta", {
          type: "tool_result",
          callId: res.callId,
          toolName: res.toolName,
          success: res.success,
          output: res.output,
          error: res.error
        });
      }
    }
  });

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    frame: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0b",
      symbolColor: "#f4f4f5",
      height: 38,
    },
    backgroundColor: "#0a0a0b",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Retransmitir eventos hacia Chromium Renderer (Activity Widget, Observabilidad)
  eventBus.onAny((event) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", event);
    }
  });

  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [L${level}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on("did-finish-load", () => {
    console.log("[Electron Window] HTML y recursos cargados exitosamente en Chromium.");
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron Window] Error al cargar HTML (${errorCode}): ${errorDescription} en ${validatedURL}`);
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[Electron Window] Proceso renderer terminado: ${details.reason} (exitCode: ${details.exitCode})`);
  });

  // 1. Canal de Operaciones de Memoria VantaDB (Validación estricta Zod — SEC-02)
  ipcMain.handle("ipc.memory", async (_e, rawPayload: unknown) => {
    const parseResult = MemoryOpSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Payload de memoria inválido: ${parseResult.error.message}`);
    }

    const { op, args } = parseResult.data;
    switch (op) {
      case "put": {
        const item = args[0];
        return adapter.put({
          namespace: item.namespace,
          key: item.key,
          payload: item.payload,
          metadata: item.metadata,
          ttl_ms: item.ttl_ms,
        });
      }
      case "get":
        return adapter.get(args[0], args[1]);
      case "delete":
        return adapter.delete(args[0], args[1]);
      case "searchMulti":
        return adapter.searchMulti(args[0], args[1], args[2]);
      case "listNamespaces":
        return adapter.listNamespaces();
      case "recall":
        return adapter.recall(args[0]);
      case "recordAudit":
        return adapter.recordAudit(args[0], args[1], args[2], args[3]);
      default: {
        const _exhaustive: never = op;
        throw new Error(`Operación no implementada: ${_exhaustive}`);
      }
    }
  });

  // 2. Canales de Sub-Egos con validación Zod y Fábrica Inteligente (INT-04 / SUB-02)
  ipcMain.handle("ipc.subegos.list", async () => {
    try {
      const list = await subEgoRegistry.list();
      if (list && list.length > 0) return list;
      return adapter.listSubEgos();
    } catch (err) {
      console.warn("[Ego Main] Error al listar Sub-Egos:", err);
      return adapter.listSubEgos();
    }
  });

  ipcMain.handle("ipc.subegos.getTemplates", async () => {
    return SubEgoFactory.listTemplates();
  });

  ipcMain.handle("ipc.subegos.create", async (_e, rawReq: unknown) => {
    const parseResult = CreateSubEgoSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de creación de Sub-Ego inválida: ${parseResult.error.message}`);
    }

    const req = parseResult.data;
    let manifest: SubEgoManifest;

    if ("mode" in req && req.mode === "template") {
      manifest = SubEgoFactory.fromTemplate(req.templateId, {
        name: req.name,
        ...(req.overrides as any),
      }) as unknown as SubEgoManifest;
    } else if ("mode" in req && req.mode === "declaration") {
      manifest = SubEgoFactory.fromRawDeclaration(req.rawText, req.format) as unknown as SubEgoManifest;
    } else {
      const subEgoId = createSubEgoId(req.name);
      manifest = {
        id: subEgoId,
        name: req.name,
        role: req.role,
        description: req.instructions,
        systemPrompt: req.instructions,
        creator: "user",
        createdAtMs: Date.now(),
        namespaces: {
          read: ["kb/docs", `egos/${subEgoId}/*`],
          write: [`egos/${subEgoId}/*`, "quarantine/pending"],
        },
        tools: req.tools || ["memory_recall", "propose_draft"],
        budget: {
          maxTokensPerCall: req.budget?.maxTokensPerCall ?? 4000,
          maxDailyCostUsd: req.budget?.maxDailyCostUsd ?? 2.0,
          requiresApprovalAboveUsd: req.budget?.requiresApprovalAboveUsd ?? 0.5,
        },
        trigger: "manual",
        state: "active",
      };
    }

    await subEgoRegistry.register(manifest as any);
    try {
      await adapter.registerSubEgo(manifest as any);
    } catch {
      // noop
    }

    eventBus?.emit("subego.registered" as any, {
      subEgoId: manifest.id,
      name: manifest.name,
      role: manifest.role,
      createdAt: Date.now(),
    }, {
      source: "desktop.ipc.subegos.create",
      severity: "info",
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId: manifest.id, action: "created" });
    }

    return manifest;
  });

  ipcMain.handle("ipc.subegos.toggleState", async (_e, rawReq: unknown) => {
    const parseResult = ToggleSubEgoStateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de alternancia de estado inválida: ${parseResult.error.message}`);
    }

    const { subEgoId, state } = parseResult.data;
    if (subEgoId === "ego.nucleus") {
      throw new Error("No se puede pausar ni desactivar el núcleo del sistema ('ego.nucleus').");
    }

    let updated: SubEgoManifest;
    if (state === "active") {
      updated = (await subEgoRegistry.enable(subEgoId)) as unknown as SubEgoManifest;
    } else {
      updated = (await subEgoRegistry.disable(subEgoId)) as unknown as SubEgoManifest;
    }

    eventBus?.emit("subego.state_changed" as any, {
      subEgoId,
      state,
      timestamp: Date.now(),
    }, {
      source: "desktop.ipc.subegos.toggleState",
      severity: "info",
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "state_changed", state });
    }

    return updated;
  });

  // 3. Gobernanza HITL con validación Zod (ACT-06, ACT-07)
  ipcMain.handle("ipc.approval.resolve", async (_e, rawReq: unknown) => {
    const parseResult = ResolveApprovalSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de resolución de aprobación inválida: ${parseResult.error.message}`);
    }

    const { approvalId, approved, reason, modifiedArguments } = parseResult.data;
    const ok = approvalEngine.resolveApproval(approvalId, {
      approved,
      reason,
      modifiedArguments,
      resolvedBy: "user",
    });

    return { ok, approvalId, approved, timestamp: Date.now() };
  });

  ipcMain.handle("ipc.gov.approve", async (_e, rawReq: unknown) => {
    const parseResult = ApproveActionSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de aprobación inválida: ${parseResult.error.message}`);
    }

    const { actionId, confirmed } = parseResult.data;
    if (confirmed) {
      await adapter.promote(actionId);
    }
    return { ok: true, actionId, confirmed, timestamp: Date.now() };
  });

  // 4. Ciclo de Streaming Conversacional + Memoria Unificada con Tool Calling (INT-01 / CORE-03)
  ipcMain.handle("ipc.llm.stream", async (_e, rawReq: unknown) => {
    return handleLlmStream(rawReq);
  });



  // 4. Canales IPC de MCP Servers & Marketplace (ACT-11)
  ipcMain.handle("ipc.mcp.listServers", async () => {
    return mcpManager.listServers();
  });

  ipcMain.handle("ipc.mcp.addServer", async (_e, rawReq: unknown) => {
    const parseResult = AddMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Configuración de servidor MCP inválida: ${parseResult.error.message}`);
    }

    const { config, enabled } = parseResult.data;
    const runtimeState = await mcpManager.registerServer(config, enabled);

    try {
      await adapter.put({
        namespace: "gov/mcp_servers",
        key: config.id,
        payload: { config, enabled },
        metadata: { updatedAtMs: Date.now() },
      });
    } catch (persistErr) {
      console.warn(`[Ego Main] Error al persistir servidor MCP '${config.id}' en VantaDB:`, persistErr);
    }

    return runtimeState;
  });

  ipcMain.handle("ipc.mcp.removeServer", async (_e, rawReq: unknown) => {
    const parseResult = RemoveMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de eliminación MCP inválida: ${parseResult.error.message}`);
    }

    const { id } = parseResult.data;
    const removed = await mcpManager.removeServer(id);

    try {
      await adapter.delete("gov/mcp_servers", id);
    } catch (delErr) {
      console.warn(`[Ego Main] Error al borrar servidor MCP '${id}' en VantaDB:`, delErr);
    }

    return { success: removed, id };
  });

  ipcMain.handle("ipc.mcp.toggleServer", async (_e, rawReq: unknown) => {
    const parseResult = ToggleMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de alternar MCP inválida: ${parseResult.error.message}`);
    }

    const { id, enabled } = parseResult.data;
    const state = await mcpManager.toggleServer(id, enabled);

    try {
      const existing = (await adapter.get("gov/mcp_servers", id)) as { payload?: unknown } | null;
      if (existing && existing.payload && typeof existing.payload === "object") {
        const payload = existing.payload as { config: any; enabled?: boolean };
        payload.enabled = enabled;
        await adapter.put({
          namespace: "gov/mcp_servers",
          key: id,
          payload,
          metadata: { updatedAtMs: Date.now() },
        });
      }
    } catch (updateErr) {
      console.warn(`[Ego Main] Error al actualizar estado de servidor MCP '${id}' en VantaDB:`, updateErr);
    }

    return state;
  });

  ipcMain.handle("ipc.mcp.listTools", async (_e, rawReq: unknown) => {
    const parseResult = ListToolsFilterSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Filtro de herramientas inválido: ${parseResult.error.message}`);
    }

    const filter = parseResult.data;
    const tools = mcpManager.listTools(filter);

    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
      origin: t.origin,
      mcpServerId: t.mcpServerId,
      requiresApproval: t.requiresApproval ?? (t.riskLevel === "destructive" || t.riskLevel === "sensitive"),
    }));
  });

  // 5. Canales IPC de Skills Locales (HERM-19 / ACT-11)
  ipcMain.handle("ipc.skills.listLocal", async (_e, rawReq: unknown) => {
    const parseResult = ScanSkillsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Parámetros de escaneo de skills inválidos: ${parseResult.error.message}`);
    }

    return skillScanner.scan(parseResult.data);
  });

  // 6. Canales IPC de Entidad Project y Aislamiento de Contexto (INT-03)
  ipcMain.handle("ipc.projects.list", async () => {
    try {
      const defaultProj = await getOrCreateDefaultProject(adapter);
      const searchRes = await adapter.searchMulti(["gov/projects"], "", { topK: 100, excludeSuperseded: false });
      const projectsMap = new Map<string, ProjectManifest>();
      projectsMap.set("default", defaultProj);

      for (const hit of searchRes) {
        if (!hit.record) continue;
        let payload: unknown = hit.record.payload;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            // noop
          }
        }
        const parseRes = ProjectManifestSchema.safeParse(payload);
        if (parseRes.success) {
          projectsMap.set(parseRes.data.id, parseRes.data);
        }
      }

      return Array.from(projectsMap.values());
    } catch (err) {
      console.warn("[Ego Main] Error al listar proyectos:", err);
      return [
        {
          id: "default",
          name: "Ego Core",
          rootPath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
          activeSubEgoId: "ego.nucleus",
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        }
      ];
    }
  });

  ipcMain.handle("ipc.projects.create", async (_e, rawReq: unknown) => {
    const parseResult = CreateProjectSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de creación de proyecto inválida: ${parseResult.error.message}`);
    }

    const { name, rootPath, description, activeSubEgoId } = parseResult.data;

    // Validar existencia de la carpeta en disco
    try {
      const stats = await stat(rootPath);
      if (!stats.isDirectory()) {
        throw new Error(`La ruta '${rootPath}' no es un directorio válido.`);
      }
    } catch (fsErr: any) {
      throw new Error(`Ruta de directorio inaccesible o inexistente: ${fsErr.message}`);
    }

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

    const id = `proj_${slug}_${Date.now().toString(36)}`;
    const now = Date.now();

    const manifest: ProjectManifest = {
      id,
      name,
      rootPath,
      description: description || `Proyecto ${name} gestionado por Ego`,
      activeSubEgoId: activeSubEgoId || "ego.nucleus",
      createdAtMs: now,
      updatedAtMs: now,
    };

    const validated = ProjectManifestSchema.parse(manifest);

    // Persistencia dual: catálogo gov/projects y raíz projects/<id>/manifest
    await adapter.put({
      namespace: "gov/projects",
      key: validated.id,
      payload: validated,
      metadata: { name: validated.name, rootPath: validated.rootPath, createdAtMs: now }
    });

    await adapter.put({
      namespace: `projects/${validated.id}`,
      key: "manifest",
      payload: validated,
      metadata: { name: validated.name, rootPath: validated.rootPath, createdAtMs: now }
    });

    return validated;
  });

  ipcMain.handle("ipc.projects.select", async (_e, rawReq: unknown) => {
    const parseResult = SelectProjectSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de selección de proyecto inválida: ${parseResult.error.message}`);
    }

    const { id } = parseResult.data;
    activeProjectId = id;

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.projects.changed", { activeProjectId: id });
    }

    eventBus?.emit("project.switched" as any, {
      projectId: id,
      timestamp: Date.now()
    }, {
      source: "desktop.ipc.projects.select",
      severity: "info"
    });

    return { ok: true, activeProjectId: id };
  });

  ipcMain.handle("ipc.projects.getActive", async () => {
    const defaultProj = await getOrCreateDefaultProject(adapter);
    if (activeProjectId === "default") return defaultProj;

    const record = await adapter.get("gov/projects", activeProjectId);
    if (record) {
      let payload: unknown = record;
      if (typeof record === "object" && record !== null && "payload" in record) {
        payload = (record as { payload: unknown }).payload;
      }
      try {
        return ProjectManifestSchema.parse(payload);
      } catch {
        // noop
      }
    }
    return defaultProj;
  });

  ipcMain.handle("ipc.projects.selectFolder", async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Seleccionar Carpeta del Proyecto",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("ipc.snapshots", async () => ({
    ok: true,
    dbPath,
    operational: adapter.ready,
  }));

  // Carga de la aplicación (Vite Dev Server en desarrollo o bundle compilado)
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log(`[Ego Desktop] Conectando a Vite Dev Server: ${process.env.VITE_DEV_SERVER_URL}`);
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const htmlPath = join(app.getAppPath(), "renderer/dist/index.html");
    console.log(`[Ego Desktop] Cargando interfaz de usuario: ${htmlPath}`);
    try {
      await win.loadFile(htmlPath);
    } catch (loadErr) {
      console.error("[Ego Desktop] Error al ejecutar win.loadFile:", loadErr);
    }
  }

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  win.show();
  win.focus();
  if (isDev) {
    win.setAlwaysOnTop(true);
    win.setAlwaysOnTop(false);
  }
}

if (app && typeof app.whenReady === "function") {
  void app.whenReady().then(async () => {
    try {
      await createWindow();
    } catch (err) {
      console.error("[Electron Main] Error crítico durante la inicialización:", err);
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

