/**
 * T3 (Ola 5) — Canal IPC `ipc.llm.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { LlmCancelSchema } from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.llm.*`. */
export function registerLlmIpc(deps: IpcDeps): void {
  const {
    handleLlmStream,
    llmAbortControllers,
    pushTurnCancelled,
  } = deps;

  ipcMain.handle("ipc.llm.stream", async (_e, rawReq: unknown) => {
    return handleLlmStream(rawReq);
  });

  ipcMain.handle("ipc.llm.cancel", async (_e, rawReq: unknown) => {
    // T4 (EGO-FIND-31) — fail-CLOSED: un payload inválido se RECHAZA.
    // Antes (fail-open) un Zod fallido dejaba `turnId === undefined`, lo que
    // abortaba TODOS los turnos activos del proceso en vez de rechazar la
    // petición. Ahora solo se abortan todos cuando el payload es `{}`/
    // `undefined` EXPLÍCITAMENTE (cancelación global deliberada).
    const parsed = LlmCancelSchema.safeParse(rawReq ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: `Solicitud de cancelación inválida: ${parsed.error.message}`,
      };
    }
    const turnId = parsed.data?.turnId;
    const targets = turnId ? [turnId] : [...llmAbortControllers.keys()];
    const cancelled: string[] = [];
    for (const id of targets) {
      const ctrl = llmAbortControllers.get(id);
      if (!ctrl) continue;
      try {
        ctrl.abort();
      } catch {
        // noop: abort best-effort
      }
      cancelled.push(id);
      pushTurnCancelled(id);
    }
    return {
      ok: true,
      cancelled,
      ...(cancelled.length === 0 ? { note: "sin turnos activos" } : {}),
    };
  });
}
