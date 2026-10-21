/**
 * T3 (Ola 5) — Canal IPC `ipc.subegos.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { createSubEgoId } from "@ego/memory";
import {
  SubEgoFactory,
  fromMemoryManifest,
  type SubEgoCreateInput,
  type SubEgoManifest,
} from "@ego/subegos";
import {
  CreateSubEgoSchema,
  ToggleSubEgoStateSchema,
  UpdateSubEgoSchema,
  RemoveSubEgoSchema,
} from "../../../ipc/schema.js";

import {
  CANONICAL_SPECIALIST_SUBEGOS,
  buildCanonicalSpecialistManifests,
  seedCanonicalSubEgos,
} from "../canonical-specialists.js";
import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.subegos.*`. */
export function registerSubegosIpc(deps: IpcDeps): void {
  const {
    adapter,
    eventBus,
    subEgoRegistry,
    win,
  } = deps;

  ipcMain.handle("ipc.subegos.list", async () => {
    try {
      let list = await subEgoRegistry.list();
      if (!list || list.length === 0) {
        const fromAdapter = await adapter.listSubEgos();
        list = fromAdapter.map((m) => fromMemoryManifest(m));
      }
      if (!list || list.length === 0) {
        await seedCanonicalSubEgos(adapter, subEgoRegistry);
        list = await subEgoRegistry.list();
        if (!list || list.length === 0) {
          const fromAdapter = await adapter.listSubEgos();
          list = fromAdapter.map((m) => fromMemoryManifest(m));
        }
        if (!list || list.length === 0) {
          // Fallback degradado: los manifiestos canónicos (con ID DSEK-03
          // válido) en vez de las specs crudas, para que el renderer siempre
          // reciba IDs que el catálogo y el guard de memoria reconocen.
          const fallbackManifests = buildCanonicalSpecialistManifests();
          return fallbackManifests.length > 0
            ? fallbackManifests
            : CANONICAL_SPECIALIST_SUBEGOS;
        }
      }
      return list;
    } catch (err) {
      console.warn("[Ego Main] Error al listar Sub-Egos:", err);
      try {
        const fallbackList = await adapter.listSubEgos();
        if (fallbackList && fallbackList.length > 0) return fallbackList;
      } catch {}
      const fallbackManifests = buildCanonicalSpecialistManifests();
      return fallbackManifests.length > 0 ? fallbackManifests : CANONICAL_SPECIALIST_SUBEGOS;
    }
  });

  ipcMain.handle("ipc.subegos.getTemplates", async () => {
    return SubEgoFactory.listTemplates();
  });

  ipcMain.handle("ipc.subegos.create", async (_e, rawReq: unknown) => {
    const parseResult = CreateSubEgoSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de creación de Sub-Ego inválida: ${parseResult.error.message}`);
    }

    const req = parseResult.data;
    let manifest: SubEgoManifest;

    if ("mode" in req && req.mode === "template") {
      manifest = SubEgoFactory.fromTemplate(req.templateId, {
        name: req.name,
        ...(req.overrides as Partial<SubEgoCreateInput>),
      });
    } else if ("mode" in req && req.mode === "declaration") {
      manifest = SubEgoFactory.fromRawDeclaration(req.rawText, req.format);
    } else {
      const subEgoId = createSubEgoId(req.name);
      // Rama custom: construye la forma mínima de persistencia y la promueve
      // al tipo canónico vía `fromMemoryManifest` (HIG-03-F2, sin casts).
      manifest = fromMemoryManifest({
        id: subEgoId,
        name: req.name,
        role: req.role,
        description: req.instructions,
        systemPrompt: req.instructions,
        creator: "user",
        createdAtMs: Date.now(),
        namespaces: {
          read: ["kb/docs", `egos/${subEgoId}/*`],
          write: [`egos/${subEgoId}/*`, "quarantine/pending"],
        },
        tools: req.tools || ["memory_recall", "propose_draft"],
        budget: {
          maxTokensPerCall: req.budget?.maxTokensPerCall ?? 4000,
          maxDailyCostUsd: req.budget?.maxDailyCostUsd ?? 2.0,
          requiresApprovalAboveUsd: req.budget?.requiresApprovalAboveUsd ?? 0.5,
        },
        trigger: "manual",
        state: "active",
      });
    }

    // El registry valida en runtime (`validateSubEgoManifest`); el manifiesto
    // ya es del tipo canónico `@ego/subegos` (HIG-03-F2).
    await subEgoRegistry.register(manifest);
    try {
      await adapter.registerSubEgo(manifest);
    } catch {
      // noop
    }

    eventBus?.emit("subego.registered", {
      subEgoId: manifest.id,
      name: manifest.name,
      role: manifest.role,
      createdAt: Date.now(),
    }, {
      source: "desktop.ipc.subegos.create",
      severity: "info",
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId: manifest.id, action: "created" });
    }

    return manifest;
  });

  ipcMain.handle("ipc.subegos.toggleState", async (_e, rawReq: unknown) => {
    const parseResult = ToggleSubEgoStateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de alternancia de estado inválida: ${parseResult.error.message}`);
    }

    const { subEgoId, state } = parseResult.data;
    if (subEgoId === "ego.nucleus") {
      throw new Error("No se puede pausar ni desactivar el núcleo del sistema ('ego.nucleus').");
    }

    let updated: SubEgoManifest;
    if (state === "active") {
      updated = await subEgoRegistry.enable(subEgoId);
    } else {
      updated = await subEgoRegistry.disable(subEgoId);
    }

    eventBus?.emit("subego.state_changed", {
      subEgoId,
      state,
      timestamp: Date.now(),
    }, {
      source: "desktop.ipc.subegos.toggleState",
      severity: "info",
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "state_changed", state });
    }

    return updated;
  });

  ipcMain.handle("ipc.subegos.update", async (_e, rawReq: unknown) => {
    const parsed = UpdateSubEgoSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(
        `[IPC Security] Solicitud de actualización de Sub-Ego inválida: ${parsed.error.message}`
      );
    }
    const { subEgoId, manifest } = parsed.data;
    const existing = await subEgoRegistry.get(subEgoId);
    if (!existing) throw new Error(`Sub-Ego '${subEgoId}' no encontrado.`);

    // `fromMemoryManifest` normaliza el payload plano a manifiesto canónico
    // (validado por `SubEgoRegistry.register`).
    const merged = fromMemoryManifest({
      ...(existing as unknown as Record<string, unknown>),
      ...(manifest as Record<string, unknown>),
      id: subEgoId,
    } as never);
    const registered = await subEgoRegistry.register(merged);
    await adapter.registerSubEgo(registered);

    eventBus?.emit("subego.state_changed", {
      subEgoId,
      state: registered.state,
      timestamp: Date.now(),
    }, { source: "desktop.ipc.subegos.update", severity: "info" });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "updated" });
    }
    return registered;
  });

  ipcMain.handle("ipc.subegos.remove", async (_e, rawReq: unknown) => {
    const parsed = RemoveSubEgoSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(
        `[IPC Security] Solicitud de baja de Sub-Ego inválida: ${parsed.error.message}`
      );
    }
    const { subEgoId } = parsed.data;
    if (subEgoId === "ego.nucleus") {
      throw new Error("No se puede eliminar el núcleo del sistema ('ego.nucleus').");
    }
    // `unregister` respeta los Sub-Egos protegidos y deja auditoría.
    const removed = await subEgoRegistry.unregister(subEgoId);
    if (!removed) {
      throw new Error(`Sub-Ego '${subEgoId}' no encontrado o protegido.`);
    }

    eventBus?.emit("subego.state_changed", {
      subEgoId,
      state: "removed",
      timestamp: Date.now(),
    }, { source: "desktop.ipc.subegos.remove", severity: "info" });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "removed" });
    }
    return true;
  });
}
