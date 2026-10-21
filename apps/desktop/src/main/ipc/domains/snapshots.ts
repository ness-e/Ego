/**
 * T3 (Ola 5) — Canal IPC `ipc.snapshots.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.snapshots.*`. */
export function registerSnapshotsIpc(deps: IpcDeps): void {
  const {
    adapter,
    dbPath,
  } = deps;

  ipcMain.handle("ipc.snapshots", async () => ({
    ok: true,
    dbPath,
    operational: adapter.ready,
  }));
}
