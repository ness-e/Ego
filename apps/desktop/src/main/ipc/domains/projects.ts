/**
 * T3 (Ola 5) — Canal IPC `ipc.projects.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import {
  ipcMain,
  dialog,
} from "electron";
import { stat } from "node:fs/promises";
import {
  ProjectManifestSchema,
  CreateProjectSchema,
  SelectProjectSchema,
  type ProjectManifest,
  SelectFolderRedeemSchema,
} from "../../../ipc/schema.js";
import {
  issueFolderToken,
  logInvokeOrigin,
  redeemFolderToken,
  type InvokeEventLike,
} from "../../security/electron-security.js";
import {
  activeProjectId,
  setActiveProjectId,
} from ".././ipc-state.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.projects.*`. */
export function registerProjectsIpc(deps: IpcDeps): void {
  const {
    adapter,
    eventBus,
    getOrCreateDefaultProject,
    win,
  } = deps;

  ipcMain.handle("ipc.projects.list", async () => {
    try {
      const defaultProj = await getOrCreateDefaultProject(adapter);
      const records = await adapter.list("gov/projects", 100);
      const projectsMap = new Map<string, ProjectManifest>();
      projectsMap.set("default", defaultProj);

      for (const rec of records) {
        let payload: unknown = rec.payload;
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
    } catch (fsErr) {
      const detail = fsErr instanceof Error ? fsErr.message : String(fsErr);
      throw new Error(`Ruta de directorio inaccesible o inexistente: ${detail}`);
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
    setActiveProjectId(id);
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.projects.changed", { activeProjectId: id });
    }

    eventBus?.emit("project.switched", {
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

  ipcMain.handle("ipc.projects.selectFolder", async (event) => {
    logInvokeOrigin("ipc.projects.selectFolder", event as unknown as InvokeEventLike);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Seleccionar Carpeta del Proyecto",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const folderPath = result.filePaths[0] as string;
    const token = issueFolderToken(folderPath);
    return { token };
  });

  ipcMain.handle("ipc.projects.selectFolderRedeem", async (event, rawReq: unknown) => {
    logInvokeOrigin("ipc.projects.selectFolderRedeem", event as unknown as InvokeEventLike);
    const parsed = SelectFolderRedeemSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Token de carpeta inválido: ${parsed.error.message}`);
    }
    return redeemFolderToken(parsed.data.token);
  });
}
