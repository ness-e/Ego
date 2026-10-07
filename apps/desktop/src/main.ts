import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { EgoMemoryAdapter, SubEgoManifest, createSubEgoId } from "@ego/memory";
import { MemoryOpSchema, CreateSubEgoSchema, ApproveActionSchema } from "./ipc/schema.js";

let adapter: EgoMemoryAdapter;
let win: BrowserWindow | null = null;

export async function createWindow(): Promise<void> {
  const dbPath = join(app.getPath("userData"), "ego_memory.vdb");
  adapter = new EgoMemoryAdapter(dbPath);
  await adapter.init();

  win = new BrowserWindow({
    width: 1440,
    height: 900,
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

  ipcMain.handle("ipc.llm.stream", async () => {
    return { ok: true, message: "Stream conectado vía Cognitive Runtime" };
  });

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
    await win.loadFile(join(app.getAppPath(), "renderer/dist/index.html"));
  }
}

void app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
