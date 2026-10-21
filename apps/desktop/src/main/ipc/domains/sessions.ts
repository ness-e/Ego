/**
 * T3 (Ola 5) — Canal IPC `ipc.sessions.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { forkSession } from "@ego/memory";
import {
  SessionsListSchema,
  SessionGetSchema,
  SessionResumeSchema,
  SessionForkSchema,
  SessionHandoffSchema,
} from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.sessions.*`. */
export function registerSessionsIpc(deps: IpcDeps): void {
  const {
    adapter,
    eventBus,
    lifecycle,
  } = deps;

  ipcMain.handle("ipc.sessions.list", async (_e, rawReq: unknown) => {
    const parseResult = SessionsListSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const limit = parseResult.data?.limit ?? 100;
    const projectScope = parseResult.data?.projectScope;
    const turns = await adapter.list("session/turns", Math.min(limit * 10, 1000));
    const bySession = new Map<string, { turnCount: number; lastTimestamp: number; projectScope?: string }>();
    for (const t of turns) {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const payload = t.payload as Record<string, unknown> | null;
      const sid =
        (typeof meta["sessionId"] === "string" && meta["sessionId"]) ||
        (payload && typeof payload["sessionId"] === "string" ? (payload["sessionId"] as string) : "") ||
        t.key.split(":")[0] ||
        "unknown";
      if (projectScope && meta["projectScope"] !== projectScope) continue;
      const ts =
        (typeof meta["timestamp"] === "number" && meta["timestamp"]) ||
        (payload && typeof payload["timestamp"] === "number" ? (payload["timestamp"] as number) : 0);
      const prev = bySession.get(sid) ?? { turnCount: 0, lastTimestamp: 0 };
      bySession.set(sid, {
        turnCount: prev.turnCount + 1,
        lastTimestamp: Math.max(prev.lastTimestamp, ts),
        ...(typeof meta["projectScope"] === "string" ? { projectScope: meta["projectScope"] as string } : {}),
      });
    }
    const sessions = [...bySession.entries()]
      .map(([sessionId, info]) => ({ sessionId, ...info }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      .slice(0, limit);
    return { ok: true, sessions };
  });

  ipcMain.handle("ipc.sessions.get", async (_e, rawReq: unknown) => {
    const parseResult = SessionGetSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { sessionId } = parseResult.data;
    const turns = await adapter.list("session/turns", 1000);
    const mine = turns
      .filter((t) => {
        const meta = (t.metadata ?? {}) as Record<string, unknown>;
        if (meta["sessionId"] === sessionId) return true;
        const payload = t.payload as Record<string, unknown> | null;
        if (payload && payload["sessionId"] === sessionId) return true;
        return t.key === sessionId || t.key.startsWith(`${sessionId}:`);
      })
      .map((t) => ({ key: t.key, payload: t.payload, metadata: t.metadata }));
    if (mine.length === 0) {
      return { ok: false, error: `Sesión '${sessionId}' no encontrada o sin turnos.` };
    }
    return { ok: true, sessionId, turns: mine };
  });

  ipcMain.handle("ipc.sessions.resume", async (_e, rawReq: unknown) => {
    const parseResult = SessionResumeSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { sessionId } = parseResult.data;
    const turns = await adapter.list("session/turns", 1000);
    const mine = turns.filter((t) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      if (meta["sessionId"] === sessionId) return true;
      const payload = t.payload as Record<string, unknown> | null;
      if (payload && payload["sessionId"] === sessionId) return true;
      return t.key === sessionId || t.key.startsWith(`${sessionId}:`);
    });
    if (mine.length === 0) {
      return { ok: false, error: `Sesión '${sessionId}' no encontrada o sin turnos.` };
    }
    const projectScope =
      (mine[0]?.metadata as Record<string, unknown> | undefined)?.["projectScope"];
    await lifecycle.startSession(
      sessionId,
      typeof projectScope === "string" && projectScope ? projectScope : "default"
    );
    return { ok: true, sessionId, turnCount: mine.length, resumed: true };
  });

  ipcMain.handle("ipc.sessions.fork", async (_e, rawReq: unknown) => {
    const parseResult = SessionForkSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { fromSessionId, toSessionId, summary, findings, files, issues } = parseResult.data;
    const gate = eventBus.evaluateSessionStart(toSessionId);
    if (!gate.allow) {
      return { ok: false, denied: true, error: `Fork bloqueado por hook (motivo '${gate.reason}').` };
    }
    try {
      const handoff = await forkSession(
        { fromSessionId, toSessionId, summary, findings, files, issues },
        { adapter, createCheckpoint: (taskId, snapshot) => lifecycle.createMicroCheckpoint(taskId, snapshot) }
      );
      const validated = SessionHandoffSchema.safeParse(handoff);
      if (!validated.success) {
        return { ok: false, error: `Handoff inválido: ${validated.error.message}` };
      }
      eventBus.recordSessionEnd(fromSessionId);
      try {
        await adapter.recordAudit("session_fork", "ego.governance", {
          from: handoff.from,
          to: handoff.to,
          copiedTurns: handoff.copiedTurns,
          checkpointId: handoff.checkpointId,
        }, handoff.to);
      } catch {
        // noop: auditoría best-effort, el fork ya se aplicó
      }
      return { ok: true, handoff: validated.data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
