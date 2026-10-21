/**
 * T3 (Ola 5) — Canal IPC `ipc.memory.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { MemoryOpSchema } from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.memory.*`. */
export function registerMemoryIpc(deps: IpcDeps): void {
  const {
    adapter,
  } = deps;

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
}
