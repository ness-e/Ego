/**
 * T3 (Ola 5) — Canal IPC `ipc.floating.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { FloatingSetMutedSchema } from "../../../ipc/schema.js";
import { FloatingToggleSchema } from "../../../ipc.js";
import {
  floatingPinnedManually,
  setFloatingAutoShownOnMinimize,
  setFloatingPinnedManually,
} from ".././ipc-state.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.floating.*`. */
export function registerFloatingIpc(deps: IpcDeps): void {
  const {
    ensureFloatMgr,
    floatingSnapshot,
    win,
    windowStateManager,
  } = deps;

  ipcMain.handle("ipc.floating.setMuted", async (_e, rawReq: unknown) => {
    const parseResult = FloatingSetMutedSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    ensureFloatMgr().setMuted(parseResult.data.muted);
    try {
      const current = await windowStateManager.restoreFloatingState();
      await windowStateManager.persistFloatingState({
        ...current,
        muted: parseResult.data.muted,
      });
    } catch {
      // noop: el mute en memoria ya se aplicó
    }
    return { ok: true, muted: parseResult.data.muted };
  });

  ipcMain.handle("ipc.floating.restoreMain", async () => {
    try {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.show();
        win.focus();
      }
      const snap = floatingSnapshot();
      if (!floatingPinnedManually && snap.active === 0 && snap.hitl === 0) {
        ensureFloatMgr().updateState({ attentionState: "hidden" });
        ensureFloatMgr().hide();
        setFloatingAutoShownOnMinimize(false);
      }
      return { ok: true };
    } catch (err) {
      console.warn("[Ego Main] Error en ipc.floating.restoreMain:", err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle("ipc.floating.toggle", async (_e, rawReq: unknown) => {
    // T4 (EGO-FIND-30) — fail-CLOSED con Zod.
    // Antes: `rawReq as { state?: ... }` (type assertion sin validación) que
    // aceptaba CUALQUIER string fuera de la unión y lo propagaba a
    // `updateState({ attentionState })`. Ahora el payload se valida contra
    // `FloatingToggleSchema` y se rechaza si no cumple.
    const parsedToggle = FloatingToggleSchema.safeParse(rawReq);
    if (!parsedToggle.success) {
      return {
        ok: false,
        error: `Estado de la isla flotante inválido: ${parsedToggle.error.message}`,
      };
    }
    try {
      const mgr = ensureFloatMgr();
      const current = mgr.getState();
      const req = parsedToggle.data;

      if (req?.state) {
        if (req.state === "hidden") {
          setFloatingPinnedManually(false);
          setFloatingAutoShownOnMinimize(false);
          mgr.updateState({ attentionState: "hidden" });
          mgr.hide();
        } else {
          setFloatingPinnedManually(true);
          mgr.show();
          mgr.updateState({ attentionState: req.state });
        }
      } else {
        if (current.visible && current.attentionState !== "hidden") {
          setFloatingPinnedManually(false);
          setFloatingAutoShownOnMinimize(false);
          mgr.updateState({ attentionState: "hidden" });
          mgr.hide();
        } else {
          setFloatingPinnedManually(true);
          mgr.show();
          mgr.updateState({ attentionState: "compact" });
        }
      }
      return { ok: true, state: mgr.getState() };
    } catch (err) {
      console.warn("[Ego Main] Error en ipc.floating.toggle:", err);
      return { ok: false, error: String(err) };
    }
  });
}
