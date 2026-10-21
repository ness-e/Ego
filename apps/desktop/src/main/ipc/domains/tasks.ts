/**
 * T3 (Ola 5) — Canal IPC `ipc.tasks.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  TasksListSchema,
  TasksCancelSchema,
} from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.tasks.*`. */
export function registerTasksIpc(deps: IpcDeps): void {
  const {
    adapter,
    backgroundEngine,
    refreshTrayStatus,
  } = deps;

  ipcMain.handle("ipc.tasks.list", async (_e, rawReq: unknown) => {
    const parseResult = TasksListSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    return { ok: true, tasks: backgroundEngine.listTasks(parseResult.data ?? {}) };
  });

  ipcMain.handle("ipc.tasks.cancel", async (_e, rawReq: unknown) => {
    const parseResult = TasksCancelSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { taskId, reason } = parseResult.data;
    const cancelled = backgroundEngine.cancel(taskId, reason ?? "Cancelled by user");
    if (!cancelled) {
      return { ok: false, error: `Tarea '${taskId}' no encontrada o ya finalizada.` };
    }
    try {
      await adapter.recordAudit("tasks", taskId, { action: "cancel", reason: reason ?? null }, "user");
    } catch {
      // noop: auditoría best-effort, el cancel ya se aplicó
    }
    refreshTrayStatus();
    return { ok: true, taskId };
  });
}
