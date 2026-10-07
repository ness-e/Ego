import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import {
  EgoMemoryAdapter,
  EgoMemoryLifecycle,
  SubEgoManifest,
  createSubEgoId,
} from "@ego/memory";
import { ModelRouter, ModelMessage } from "@ego/models";
import {
  MemoryOpSchema,
  CreateSubEgoSchema,
  ApproveActionSchema,
} from "./ipc/schema.js";

let adapter: EgoMemoryAdapter;
let lifecycle: EgoMemoryLifecycle;
let modelRouter: ModelRouter;
let win: BrowserWindow | null = null;

export async function createWindow(): Promise<void> {
  const dbPath = join(app.getPath("userData"), "ego_memory.vdb");
  adapter = new EgoMemoryAdapter(dbPath);
  await adapter.init();

  lifecycle = new EgoMemoryLifecycle(adapter);
  await lifecycle.startSession("session_init", "default");

  modelRouter = new ModelRouter();

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
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription) => {
    console.error(`[Electron Window] Error al cargar HTML: ${errorDescription} (${errorCode})`);
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

  // 3. Gobernanza HITL con validación Zod
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
  ipcMain.handle(
    "ipc.llm.stream",
    async (_e, req: { prompt: string; sessionId?: string; systemPrompt?: string }) => {
      const sessionId = req.sessionId || lifecycle.currentSessionId || "default_session";
      const turnId = `turn_${Date.now()}`;

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
    }
  );

  ipcMain.handle("ipc.snapshots", async () => ({
    ok: true,
    dbPath,
    operational: adapter.ready,
  }));

  // Carga de la aplicación (Vite Dev Server en desarrollo o bundle compilado)
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const htmlPath = join(app.getAppPath(), "renderer/dist/index.html");
    console.log(`[Ego Desktop] Cargando interfaz de usuario: ${htmlPath}`);
    await win.loadFile(htmlPath);
  }
  win.show();
  win.focus();
}

void app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
