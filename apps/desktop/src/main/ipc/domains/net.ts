/**
 * T3 (Ola 5) — Canal IPC `ipc.net.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { EgoFetchSchema } from "../../../ipc/schema.js";
import {
  egoFetchProxied,
  logInvokeOrigin,
  type InvokeEventLike,
} from "../../security/electron-security.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.net.*`. */
export function registerNetIpc(_deps: IpcDeps): void {

  ipcMain.handle("ipc.net.fetch", async (event, rawReq: unknown) => {
    logInvokeOrigin("ipc.net.fetch", event as unknown as InvokeEventLike);
    const parsed = EgoFetchSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Solicitud egoFetch inválida: ${parsed.error.message}`);
    }
    return egoFetchProxied(parsed.data);
  });
}
