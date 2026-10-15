import { describe, it, expect } from "vitest";
import type { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import {
  DEFAULT_SESSION_RETENTION_SETTINGS,
  isSessionStale,
  pruneStaleSessions,
  resolveSessionRetentionSettings,
  selectStaleSessions,
} from "../SessionRetention.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const namespace = "sessions/timelines";

describe("SessionRetention (CFG-05)", () => {
  it("defaults CFG-05: cleanupPeriodDays 30 + autoMemory", () => {
    expect(DEFAULT_SESSION_RETENTION_SETTINGS.cleanupPeriodDays).toBe(30);
    expect(DEFAULT_SESSION_RETENTION_SETTINGS.autoMemory).toBe(true);
  });

  it("resolve rechaza cleanupPeriodDays inválido", () => {
    expect(() => resolveSessionRetentionSettings({ cleanupPeriodDays: 0 })).toThrow();
  });

  it("isSessionStale respeta la frontera de 30 días y nunca poda lo desconocido", () => {
    const now = Date.now();
    expect(isSessionStale(now - 31 * DAY_MS, now, 30)).toBe(true);
    expect(isSessionStale(now - 29 * DAY_MS, now, 30)).toBe(false);
    expect(isSessionStale(0, now, 30)).toBe(false);
  });

  it("selectStaleSessions particiona sin I/O", () => {
    const now = Date.now();
    const { stale, active } = selectStaleSessions(
      [
        { key: "vieja", lastActiveMs: now - 40 * DAY_MS },
        { key: "reciente", lastActiveMs: now - 2 * DAY_MS },
      ],
      now,
      30
    );
    expect(stale.map((s) => s.key)).toEqual(["vieja"]);
    expect(active.map((s) => s.key)).toEqual(["reciente"]);
  });
});

describe("pruneStaleSessions con gateway mock (sin nativo)", () => {
  it("poda la sesión stale de 40 días y conserva la reciente", async () => {
    const now = Date.now();
    const staleTs = now - 40 * DAY_MS;
    const freshTs = now - 2 * DAY_MS;
    const store = new Map<string, { payload: unknown; metadata: Record<string, unknown> }>([
      ["sess-stale-cfg05", { payload: { timestamp: staleTs }, metadata: { ts: staleTs } }],
      ["sess-fresh-cfg05", { payload: { timestamp: freshTs }, metadata: { ts: freshTs } }],
    ]);
    const audits: unknown[] = [];
    const fakeAdapter = {
      list: async () =>
        [...store.entries()].map(([key, v]) => ({ key, payload: v.payload, metadata: v.metadata })),
      delete: async (_ns: string, key: string) => store.delete(key),
      recordAudit: async (_a: string, _b: string, d: unknown) => {
        audits.push(d);
      },
    } as unknown as EgoMemoryAdapter;

    const report = await pruneStaleSessions(
      fakeAdapter,
      { cleanupPeriodDays: 30, autoMemory: true },
      { namespace, nowMs: now }
    );

    expect(report.pruned).toEqual(["sess-stale-cfg05"]);
    expect(report.kept).toEqual(["sess-fresh-cfg05"]);
    expect(report.cleanupPeriodDays).toBe(30);
    expect(store.has("sess-stale-cfg05")).toBe(false);
    expect(store.has("sess-fresh-cfg05")).toBe(true);
    expect(audits).toHaveLength(1);
  });

  it("sin marcas temporales legibles no poda nada (conservador)", async () => {
    const fakeAdapter = {
      list: async () => [{ key: "sin-ts", payload: {}, metadata: {} }],
      delete: async () => {
        throw new Error("no debería llamarse");
      },
      recordAudit: async () => {},
    } as unknown as EgoMemoryAdapter;

    const report = await pruneStaleSessions(fakeAdapter, undefined, { namespace });
    expect(report.pruned).toEqual([]);
    expect(report.kept).toEqual(["sin-ts"]);
  });
});
