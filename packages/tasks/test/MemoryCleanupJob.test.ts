import { describe, it, expect, vi } from 'vitest';
import { MemoryCleanupJob } from '../src/MemoryCleanupJob.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function sessionStore() {
  const stale = NOW - 40 * DAY_MS;
  const fresh = NOW - 2 * DAY_MS;
  const timelines = new Map<string, { payload: unknown; metadata: Record<string, unknown> }>([
    ['sess-stale', { payload: { timestamp: stale }, metadata: {} }],
    ['sess-fresh', { payload: { timestamp: fresh }, metadata: {} }],
  ]);
  const turns = new Map<string, { payload: unknown; metadata: Record<string, unknown> }>([
    ['sess-old:turn:1', { payload: { sessionId: 'sess-old', turnId: 'turn:1', timestamp: stale, userPrompt: 'h', assistantReply: 'r', recalledKeys: [] }, metadata: {} }],
    ['sess-new:turn:1', { payload: { sessionId: 'sess-new', turnId: 'turn:1', timestamp: fresh, userPrompt: 'h', assistantReply: 'r', recalledKeys: [] }, metadata: {} }],
  ]);
  return { timelines, turns };
}

function makeAdapter(stores: ReturnType<typeof sessionStore>) {
  return {
    list: vi.fn(async (ns: string) => {
      if (ns === 'sessions/timelines') return [...stores.timelines.entries()].map(([key, v]) => ({ key, payload: v.payload, metadata: v.metadata }));
      if (ns === 'session/turns') return [...stores.turns.entries()].map(([key, v]) => ({ key, payload: v.payload, metadata: v.metadata }));
      return [];
    }),
    delete: vi.fn(async (ns: string, key: string) => {
      if (ns === 'sessions/timelines') return stores.timelines.delete(key);
      if (ns === 'session/turns') return stores.turns.delete(key);
      return false;
    }),
    recordAudit: vi.fn(async () => 'audit:key'),
  };
}

describe('MemoryCleanupJob (STAB-05)', () => {
  it('poda sesiones + turns stale 30d, limpia leases y worktrees, y reporta todo', async () => {
    const stores = sessionStore();
    const adapter = makeAdapter(stores);
    const cleanLeases = vi.fn(() => 3);
    const pruneWorktrees = vi.fn(async () => ({
      repoRoot: '/repo',
      scanned: 2,
      pruned: [{ path: '/repo/.ego-worktrees/subego-old', pruned: true as const, reason: 'orphan-stale' }],
      preserved: [{ path: '/repo/.ego-worktrees/subego-new', pruned: false as const, reason: 'active' as const }],
    }));
    const pruneSnapshots = vi.fn(async () => ({
      directory: '/data', kept: ['a.vdbdump'], pruned: [] as string[], activePreserved: true, maxSnapshots: 50,
    }));

    const job = new MemoryCleanupJob(adapter as never, {
      cleanupPeriodDays: 30,
      cleanExpiredLeases: cleanLeases,
      pruneOrphanWorktrees: pruneWorktrees,
      pruneSnapshots,
    });

    const report = await job.run({ nowMs: NOW });

    expect(report.sessions.pruned).toEqual(['sess-stale']);
    expect(report.sessions.kept).toEqual(['sess-fresh']);
    expect(report.turns.pruned).toEqual(['sess-old:turn:1']);
    expect(report.leasesCleaned).toBe(3);
    expect(report.worktrees?.pruned).toHaveLength(1);
    expect(report.snapshots?.activePreserved).toBe(true);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(cleanLeases).toHaveBeenCalledTimes(1);
  });

  it('hooks opcionales ausentes → secciones null sin lanzar', async () => {
    const stores = sessionStore();
    const job = new MemoryCleanupJob(makeAdapter(stores) as never, { cleanupPeriodDays: 30 });
    const report = await job.run({ nowMs: NOW });
    expect(report.leasesCleaned).toBeNull();
    expect(report.worktrees).toBeNull();
    expect(report.snapshots).toBeNull();
    expect(report.sessions.pruned).toEqual(['sess-stale']);
  });

  it('fallo del hook de leases no tumba el job (fail-safe)', async () => {
    const stores = sessionStore();
    const job = new MemoryCleanupJob(makeAdapter(stores) as never, {
      cleanupPeriodDays: 30,
      cleanExpiredLeases: () => { throw new Error('leases rotos'); },
    });
    const report = await job.run({ nowMs: NOW });
    expect(report.leasesCleaned).toBeNull();
    expect(report.leasesError).toContain('leases rotos');
    expect(report.sessions.pruned).toEqual(['sess-stale']);
  });

  it('rechaza cleanupPeriodDays inválido (fail-fast)', () => {
    const stores = sessionStore();
    expect(() => new MemoryCleanupJob(makeAdapter(stores) as never, { cleanupPeriodDays: 0 })).toThrow();
  });
});
