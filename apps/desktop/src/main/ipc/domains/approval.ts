/**
 * T3 (Ola 5) — Canal IPC `ipc.approval.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { ResolveApprovalSchema } from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.approval.*`. */
export function registerApprovalIpc(deps: IpcDeps): void {
  const {
    approvalEngine,
  } = deps;

  ipcMain.handle("ipc.approval.resolve", async (_e, rawReq: unknown) => {
    const parseResult = ResolveApprovalSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de resolución de aprobación inválida: ${parseResult.error.message}`);
    }

    const { approvalId, approved, reason, modifiedArguments, expectedDigest } = parseResult.data;
    const ok = approvalEngine.resolveApproval(approvalId, {
      approved,
      reason,
      modifiedArguments,
      resolvedBy: "user",
    }, expectedDigest ? { expectedDigest } : undefined);

    return { ok, approvalId, approved, timestamp: Date.now() };
  });
}
