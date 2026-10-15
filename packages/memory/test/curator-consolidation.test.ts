import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EgoMemoryLifecycle,
  type CuratorConsolidationOptions,
} from "../EgoMemoryLifecycle.js";
import type { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import { QUARANTINE_PENDING_NAMESPACE } from "../QuarantineAwareReads.js";

/**
 * STAB-06 — job curator: consolida `session/turns` stale → `kb/facts`
 * respetando `quarantine/pending`, idempotente, cap sin borrar (STAB-05
 * owns cleanup). TDD RED: el método aún no existe.
 */

interface FakeRow {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

function makeTurn(sessionId: string, turnId: string, timestamp: number): FakeRow {
  return {
    key: `${sessionId}:${turnId}`,
    payload: { sessionId, turnId, timestamp, userPrompt: "hola", assistantReply: "mundo" },
  };
}

describe("EgoMemoryLifecycle curator (STAB-06)", () => {
  const NOW = 1_800_000_000_000;
  const DAY = 86_400_000;
  let liveTurns: FakeRow[];
  let pendingRows: FakeRow[];
  let puts: Array<{ namespace: string; key: string; payload: unknown }>;
  let audits: Array<{ action: string; actor: string; details: unknown }>;
  let lifecycle: EgoMemoryLifecycle;

  beforeEach(() => {
    liveTurns = [];
    pendingRows = [];
    puts = [];
    audits = [];
    const fake = {
      get: vi.fn(async (namespace: string, key: string) => {
        if (namespace === "kb/facts") {
          const hit = puts.find((p) => p.namespace === namespace && p.key === key);
          return hit ? { key, payload: hit.payload } : null;
        }
        if (namespace === QUARANTINE_PENDING_NAMESPACE) {
          const hit = pendingRows.find((r) => r.key === key);
          return hit ? { key, payload: hit.payload, metadata: hit.metadata } : null;
        }
        return null;
      }),
      list: vi.fn(async (namespace: string) => {
        if (namespace === "session/turns") return [...liveTurns];
        if (namespace === "kb/facts") {
          return puts
            .filter((p) => p.namespace === namespace)
            .map((p) => ({ key: p.key, payload: p.payload }));
        }
        if (namespace === QUARANTINE_PENDING_NAMESPACE) return [...pendingRows];
        return [];
      }),
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        const idx = puts.findIndex((p) => p.namespace === item.namespace && p.key === item.key);
        if (idx >= 0) puts[idx] = { namespace: item.namespace, key: item.key, payload: item.payload };
        else puts.push({ namespace: item.namespace, key: item.key, payload: item.payload });
      }),
      recordAudit: vi.fn(async (action: string, actor: string, details: unknown) => {
        audits.push({ action, actor, details });
      }),
    };
    lifecycle = new EgoMemoryLifecycle(fake as unknown as EgoMemoryAdapter);
  });

  const baseOpts: CuratorConsolidationOptions = {
    staleAfterDays: 30,
    maxSnapshots: 50,
    nowMs: NOW,
  };

  it("consolida una sesión stale completa en un fact de kb/facts", async () => {
    liveTurns = [
      makeTurn("s1", "t1", NOW - 40 * DAY),
      makeTurn("s1", "t2", NOW - 31 * DAY),
    ];
    const res = await lifecycle.runCuratorConsolidation(baseOpts);
    expect(res.scanned).toBe(2);
    expect(res.consolidated).toBe(1);
    expect(res.staleSessions).toBe(1);
    const fact = puts.find((p) => p.key === "curator_s1");
    expect(fact?.namespace).toBe("kb/facts");
    expect(fact?.payload).toMatchObject({ sessionId: "s1", turnCount: 2 });
  });

  it("no consolida turnos frescos", async () => {
    liveTurns = [makeTurn("s1", "t1", NOW - 2 * DAY)];
    const res = await lifecycle.runCuratorConsolidation(baseOpts);
    expect(res.consolidated).toBe(0);
    expect(puts.length).toBe(0);
  });

  it("omite filas cuarentenadas sin consolidarlas", async () => {
    liveTurns = [makeTurn("s1", "t1", NOW - 40 * DAY)];
    pendingRows = [
      {
        key: "session/turns:s1:t1",
        payload: { sessionId: "s1", turnId: "t1", timestamp: NOW - 40 * DAY },
        metadata: {
          original_namespace: "session/turns",
          original_key: "s1:t1",
          quarantine_reason: "unverified_source",
        },
      },
    ];
    // La fila live existe pero su gemela en cuarentena marca el mismo turno:
    // el curator solo ve live; la fila cuarentenada pura (sin live) se omite.
    liveTurns = [];
    const res = await lifecycle.runCuratorConsolidation(baseOpts);
    expect(res.skippedQuarantined).toBe(1);
    expect(res.consolidated).toBe(0);
    expect(puts.length).toBe(0);
  });

  it("es idempotente: segunda corrida no duplica facts", async () => {
    liveTurns = [makeTurn("s1", "t1", NOW - 40 * DAY)];
    const first = await lifecycle.runCuratorConsolidation(baseOpts);
    expect(first.consolidated).toBe(1);
    const second = await lifecycle.runCuratorConsolidation(baseOpts);
    expect(second.consolidated).toBe(0);
    expect(puts.filter((p) => p.key === "curator_s1").length).toBe(1);
  });

  it("cap maxSnapshots: al límite no crea facts nuevos y no borra", async () => {
    liveTurns = [makeTurn("s9", "t1", NOW - 40 * DAY)];
    const res = await lifecycle.runCuratorConsolidation({ ...baseOpts, maxSnapshots: 0 });
    expect(res.capped).toBe(true);
    expect(res.skippedCapped).toBe(1);
    expect(res.consolidated).toBe(0);
    expect(puts.length).toBe(0);
  });

  it("registra auditoría del job", async () => {
    liveTurns = [makeTurn("s1", "t1", NOW - 40 * DAY)];
    await lifecycle.runCuratorConsolidation(baseOpts);
    expect(audits.some((a) => a.action === "curator_consolidation")).toBe(true);
  });

  it("startCuratorJob corre el job y stop lo detiene", async () => {
    liveTurns = [makeTurn("s1", "t1", NOW - 40 * DAY)];
    const handle = lifecycle.startCuratorJob({ intervalMs: 10, ...baseOpts });
    await new Promise((r) => setTimeout(r, 80));
    handle.stop();
    const countAfterStop = puts.length;
    expect(countAfterStop).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(puts.length).toBe(countAfterStop);
    lifecycle.stopCuratorJob();
  });
});
