import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { EgoMemoryAdapter } from "../../../packages/memory/EgoMemoryAdapter";
import { SubEgoManifest, createSubEgoId } from "../../../packages/memory/sub-egos";

let adapter: EgoMemoryAdapter;
let win: BrowserWindow | null = null;

function checkPrereqs(): string[] {
  const missing: string[] = [];
  for (const cmd of ["python", "python3"]) {
    try {
      execFileSync(cmd, ["--version"], { stdio: "ignore" });
      return missing;
    } catch {
      /* probar siguiente */
    }
  }
  missing.push("python");
  return missing;
}

type EgoOp = { op: string; args: unknown[] };

export async function createWindow(): Promise<void> {
  const missing = checkPrereqs();
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
    },
  });

  // 1. Canal de Operaciones de Memoria VantaDB
  ipcMain.handle("ipc.memory", async (_e, { op, args }: EgoOp) => {
    const fn = (adapter as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[op];
    if (typeof fn !== "function") throw new Error(`op desconocida: ${op}`);
    return fn.apply(adapter, args);
  });

  // 2. Canales de Sub-Egos
  ipcMain.handle("ipc.subegos.list", async () => {
    return adapter.listSubEgos();
  });

  ipcMain.handle("ipc.subegos.create", async (_e, req: { name: string; role: string; instructions: string; tools?: string[] }) => {
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

  // 3. Gobernanza y Snapshots
  ipcMain.handle("ipc.llm.stream", async () => {
    return { ok: true, message: "Stream conectado vía gateway local" };
  });

  ipcMain.handle("ipc.gov.approve", async (_e, actionId: string) => {
    await adapter.promote(actionId);
    return { ok: true, actionId, approvedAt: Date.now() };
  });

  ipcMain.handle("ipc.snapshots", async () => ({
    ok: true,
    missing,
    dbPath,
    operational: adapter.ready,
  }));

  await win.loadFile(join(app.getAppPath(), "renderer/out/index.html"));
}

void app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
