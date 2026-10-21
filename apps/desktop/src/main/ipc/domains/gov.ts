/**
 * T3 (Ola 5) — Canal IPC `ipc.gov.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { ApproveActionSchema } from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.gov.*`. */
export function registerGovIpc(deps: IpcDeps): void {
  const {
    adapter,
  } = deps;

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
}
