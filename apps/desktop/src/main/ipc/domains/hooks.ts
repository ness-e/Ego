/**
 * T3 (Ola 5) — Canal IPC `ipc.hooks.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { HookEvaluateSchema } from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.hooks.*`. */
export function registerHooksIpc(deps: IpcDeps): void {
  const {
    eventBus,
  } = deps;

  ipcMain.handle("ipc.hooks.getStatus", async () => {
    return { ok: true, status: eventBus.getHooksStatus() };
  });

  ipcMain.handle("ipc.hooks.evaluatePreToolUse", async (_e, rawReq: unknown) => {
    const parseResult = HookEvaluateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const decision = eventBus.evaluatePreToolUse(
      parseResult.data.toolName,
      parseResult.data.sessionId
    );
    return { ok: true, decision };
  });

  ipcMain.handle("ipc.hooks.recordPostToolUse", async (_e, rawReq: unknown) => {
    const parseResult = HookEvaluateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const decision = eventBus.recordPostToolUse(
      parseResult.data.toolName,
      parseResult.data.sessionId
    );
    return { ok: true, decision };
  });
}
