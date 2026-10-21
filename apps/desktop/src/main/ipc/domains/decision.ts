/**
 * T3 (Ola 5) — Canal IPC `ipc.decision.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { IntentRequestSchema } from "@ego/decision";
import { DecisionListAuditsSchema } from "../../../ipc/schema.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.decision.*`. */
export function registerDecisionIpc(deps: IpcDeps): void {
  const {
    decisionAuditor,
    decisionRouter,
    decisionTelemetry,
  } = deps;

  ipcMain.handle("ipc.decision.evaluate", async (_e, rawReq: unknown) => {
    const parseResult = IntentRequestSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const t0 = performance.now();
    const verdict = await decisionRouter.decide(parseResult.data);
    const totalMs = Math.round(performance.now() - t0);

    const auditKey = await decisionAuditor.recordVerdict(verdict);

    decisionTelemetry.record({
      runId: verdict.admittedRunContext.runId,
      intentId: verdict.intentId,
      classifyMs: Math.round(totalMs * 0.7),
      subEgoSelectMs: Math.round(totalMs * 0.15),
      preconditionsMs: Math.round(totalMs * 0.15),
      totalDecisionMs: totalMs,
      decidedBy: verdict.decidedBy
    });

    return { ok: true, verdict, auditKey };
  });

  ipcMain.handle("ipc.decision.listAudits", async (_e, rawReq: unknown) => {
    const parseResult = DecisionListAuditsSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const lim = parseResult.data ?? 50;
    const audits = await decisionAuditor.listRecentVerdicts(lim);
    return { ok: true, audits };
  });

  ipcMain.handle("ipc.decision.telemetry", async () => {
    const summary = decisionTelemetry.getSummary();
    return { ok: true, summary };
  });
}
