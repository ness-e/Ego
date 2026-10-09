import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import {
  EgoMemoryAdapter,
  EgoMemoryLifecycle,
  SubEgoManifest,
  createSubEgoId,
} from "@ego/memory";
import { ModelRouter, ModelMessage } from "@ego/models";
import { ToolRegistry } from "@ego/tools";
import { McpManager, SkillScanner } from "@ego/integrations";
import {
  MemoryOpSchema,
  CreateSubEgoSchema,
  ApproveActionSchema,
  ResolveApprovalSchema,
  ChatStreamSchema,
  AddMcpServerSchema,
  RemoveMcpServerSchema,
  ToggleMcpServerSchema,
  ListToolsFilterSchema,
  ScanSkillsSchema,
} from "./ipc/schema.js";
import { ApprovalEngine, PendingApproval } from "@ego/execution";

let adapter: EgoMemoryAdapter;
let lifecycle: EgoMemoryLifecycle;
let modelRouter: ModelRouter;
let approvalEngine: ApprovalEngine;
let toolRegistry: ToolRegistry;
let mcpManager: McpManager;
let skillScanner: SkillScanner;
let win: BrowserWindow | null = null;

export async function createWindow(): Promise<void> {
  const dbPath = join(app.getPath("userData"), "ego_memory.vdb");
  adapter = new EgoMemoryAdapter(dbPath);
  await adapter.init();

  lifecycle = new EgoMemoryLifecycle(adapter);
  await lifecycle.startSession("session_init", "default");

  modelRouter = new ModelRouter();

  toolRegistry = new ToolRegistry();
  mcpManager = new McpManager(toolRegistry);
  skillScanner = new SkillScanner();

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

  // 2. Canales de Sub-Egos con validación Zod
  ipcMain.handle("ipc.subegos.list", async () => {
    return adapter.listSubEgos();
  });

  ipcMain.handle("ipc.subegos.create", async (_e, rawReq: unknown) => {
    const parseResult = CreateSubEgoSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de creación inválida: ${parseResult.error.message}`);
    }

    const req = parseResult.data;
    const subEgoId = createSubEgoId(req.name);
    const manifest: SubEgoManifest = {
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
        maxTokensPerCall: 4000,
        maxDailyCostUsd: 2.0,
        requiresApprovalAboveUsd: 0.5,
      },
      trigger: "manual",
      state: "active",
    };

    await adapter.registerSubEgo(manifest);
    return manifest;
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

  // 4. Ciclo de Streaming Conversacional + Memoria Unificada (CORE-03, CORE-04, CORE-12)
  ipcMain.handle("ipc.llm.stream", async (_e, rawReq: unknown) => {
    const parseResult = ChatStreamSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de chat inválida: ${parseResult.error.message}`);
    }
    const req = parseResult.data;

    const sessionId = req.sessionId || lifecycle.currentSessionId || "default_session";
    const turnId = `turn_${Date.now()}`;

    try {
      // FASE 2: Pre-Turn Context Assembly & Recall (Prefetch + Glifo 🧠)
      const { contextText, recallStatus } = await lifecycle.assemblePreTurn(req.prompt);

      // Informar a la UI del estado de memoria inyectada
      win?.webContents.send("ipc.chat.recall_status", recallStatus);

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

      // Ejecutar streaming a través del ModelRouter
      const streamResult = await modelRouter.streamText(
        "general-chat",
        { messages },
        (chunk) => {
          win?.webContents.send("ipc.chat.delta", chunk);
        }
      );

      // FASE 4: Post-Turn Synchronization (Persistencia inmutable L1 en VantaDB)
      const recalledKeys = recallStatus.hits.map((h) => `${h.namespace}:${h.key}`);
      await lifecycle.syncTurn(sessionId, turnId, req.prompt, streamResult.text, recalledKeys);

      return {
        ok: true,
        turnId,
        text: streamResult.text,
        recallStatus,
        usage: streamResult.usage,
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      win?.webContents.send("ipc.chat.error", { turnId, error: errorMsg });
      throw new Error(`[Cognitive Runtime Error]: ${errorMsg}`);
    }
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
