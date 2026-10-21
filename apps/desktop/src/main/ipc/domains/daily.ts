/**
 * T3 (Ola 5) — Canal IPC `ipc.daily.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  DailyStateGetSummarySchema,
  DailyStateRefineGoalsSchema,
  DailyStateGetDecisionsSchema,
  DailyStateResolveApprovalsBatchSchema,
  DailyStateJournalSchema,
  DailyStateFirstLaunchSchema,
  DailyGetSnapshotSchema,
  DailyListSnapshotsSchema,
  DailyListApprovalsSchema,
} from "../../../ipc/schema.js";
import { DailyStateEngine } from "@ego/dailystate";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.daily.*`. */
export function registerDailyIpc(deps: IpcDeps): void {
  const {
    adapter,
    approvalEngine,
    dailyStateEngine,
    dailyStatePersistence,
    decisionsFeed,
    goalPrioritizer,
    modelRouter,
  } = deps;

  ipcMain.handle("ipc.daily.getSummary", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateGetSummarySchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const summary = await dailyStateEngine.synthesize({ date: parseResult.data.date });
    return { ok: true, summary };
  });

  ipcMain.handle("ipc.daily.refineGoals", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateRefineGoalsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const summary = await dailyStateEngine.synthesize({ date: parseResult.data.date });
    const goals = await goalPrioritizer.refineWithAI(summary, modelRouter);
    return { ok: true, goals };
  });

  ipcMain.handle("ipc.daily.getDecisions", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateGetDecisionsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const decisions = await decisionsFeed.getDecisions(parseResult.data);
    return { ok: true, decisions };
  });

  ipcMain.handle("ipc.daily.saveSnapshot", async () => {
    const summary = await dailyStateEngine.synthesize();
    const snapshot = await dailyStatePersistence.saveSnapshot(summary);
    return { ok: true, snapshot };
  });

  ipcMain.handle("ipc.daily.getSnapshot", async (_e, rawReq: unknown) => {
    const parseResult = DailyGetSnapshotSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const dateStr = parseResult.data ?? DailyStateEngine.getTodayDateString();
    const snapshot = await dailyStatePersistence.getSnapshot(dateStr);
    return { ok: true, snapshot };
  });

  ipcMain.handle("ipc.daily.listSnapshots", async (_e, rawReq: unknown) => {
    const parseResult = DailyListSnapshotsSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const lim = parseResult.data ?? 30;
    const snapshots = await dailyStatePersistence.listSnapshots(lim);
    return { ok: true, snapshots };
  });

  ipcMain.handle("ipc.daily.isFirstLaunch", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateFirstLaunchSchema.safeParse(rawReq || {});
    const date = parseResult.success ? parseResult.data.date : undefined;
    const isFirstLaunch = await dailyStatePersistence.isFirstLaunchOfDay(date);
    return { ok: true, isFirstLaunch };
  });

  ipcMain.handle("ipc.daily.journal", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateJournalSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    if (req.action === "get") {
      const record = (await adapter.get("journal", req.date))?.payload;
      let content = "";
      if (record && typeof record === "object" && "content" in record) {
        content = String((record as { content: unknown }).content || "");
      } else if (typeof record === "string") {
        content = record;
      }
      return { ok: true, date: req.date, content };
    } else {
      await adapter.put({
        namespace: "journal",
        key: req.date,
        payload: { date: req.date, content: req.content || "", updatedAt: Date.now() },
        metadata: { date: req.date, agent_id: "user", ts: Date.now() },
      });
      return { ok: true, date: req.date, content: req.content };
    }
  });

  ipcMain.handle("ipc.daily.resolveApprovalsBatch", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateResolveApprovalsBatchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const results = [];
    for (const item of parseResult.data.approvals) {
      const ok = approvalEngine.resolveApproval(item.approvalId, {
        approved: item.approved,
        reason: item.reason,
        resolvedBy: "user",
      });
      results.push({ approvalId: item.approvalId, ok });
    }
    return { ok: true, resolved: results };
  });

  ipcMain.handle("ipc.daily.listApprovals", async (_e, rawReq: unknown) => {
    const parseResult = DailyListApprovalsSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const limit = parseResult.data?.limit ?? 100;
    const approvals = approvalEngine.listPendingApprovals().slice(0, limit);
    return { ok: true, approvals };
  });
}
