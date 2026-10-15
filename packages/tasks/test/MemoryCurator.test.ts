import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryCurator } from '../src/MemoryCurator.js';
import { DreamConsolidator } from '../src/DreamConsolidator.js';

describe('MemoryCurator (CFG-08)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const NOW = 1_800_000_000_000;
  const STALE_TS = NOW - 91 * DAY_MS;
  const FRESH_TS = NOW - 10 * DAY_MS;

  let storage: Map<string, Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>>;
  let mockAdapter: any;

  beforeEach(() => {
    storage = new Map();
    mockAdapter = {
      list: vi.fn(async (ns: string) => storage.get(ns) ?? []),
      put: vi.fn(
        async (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) => {
          const items = storage.get(item.namespace) ?? [];
          const index = items.findIndex((i) => i.key === item.key);
          const row = { key: item.key, payload: item.payload, metadata: item.metadata };
          if (index >= 0) items[index] = row;
          else items.push(row);
          storage.set(item.namespace, items);
          return { routedTo: 'live' };
        }
      ),
      delete: vi.fn(async () => true),
      recordAudit: vi.fn(async () => 'audit:key'),
    };
  });

  it('rechaza opciones inválidas (fail-fast)', () => {
    expect(() => new MemoryCurator(mockAdapter, { intervalHours: 0 })).toThrow();
    expect(() => new MemoryCurator(mockAdapter, { staleAfterDays: -1 })).toThrow();
  });

  it('consolida stale >90d como superseded y deja intacto lo fresco y lo ya terminal', async () => {
    storage.set('kb/facts', [
      { key: 'stale-1', payload: { subject: 'a', predicate: 'b', object: 'c' }, metadata: { ts: STALE_TS, state: 'active' } },
      { key: 'fresh-1', payload: { subject: 'x', predicate: 'y', object: 'z' }, metadata: { ts: FRESH_TS, state: 'active' } },
      { key: 'done-1', payload: { subject: 'm', predicate: 'n', object: 'o' }, metadata: { ts: STALE_TS, state: 'superseded' } },
      { key: 'no-ts', payload: { subject: 'p', predicate: 'q', object: 'r' }, metadata: { state: 'active' } },
    ]);
    const curator = new MemoryCurator(mockAdapter, { staleAfterDays: 90 });

    const stats = await curator.runOnce(NOW);

    expect(stats.staleConsolidatedCount).toBe(1);
    expect(stats.dream).toBeUndefined();
    const rows = storage.get('kb/facts')!;
    const stale = rows.find((r) => r.key === 'stale-1')!;
    expect(stale.metadata?.['state']).toBe('superseded');
    expect(stale.metadata?.['superseded_by']).toBe('curator:stale');
    expect((stale.payload as Record<string, unknown>)['is_latest']).toBe(false);
    // Fresco, terminal y sin timestamp: intactos.
    expect(rows.find((r) => r.key === 'fresh-1')!.metadata?.['state']).toBe('active');
    expect(rows.find((r) => r.key === 'done-1')!.metadata?.['superseded_by']).toBeUndefined();
    expect(rows.find((r) => r.key === 'no-ts')!.metadata?.['state']).toBe('active');
  });

  it('respeta cuarentena: omite marcados y delega quarantine/pending al DreamConsolidator', async () => {
    storage.set('kb/facts', [
      { key: 'q-marked', payload: { subject: 'a', predicate: 'b', object: 'c' }, metadata: { ts: STALE_TS, quarantined: true } },
      { key: 'q-env', payload: { subject: 'd', predicate: 'e', object: 'f' }, metadata: { ts: STALE_TS, original_namespace: 'kb/facts', state: 'quarantined' } },
    ]);
    storage.set('quarantine/pending', [
      { key: 'kb/facts:q-old', payload: 'old', metadata: { expiresAt: NOW - 1000 } },
    ]);
    const consolidator = new DreamConsolidator(mockAdapter);
    const curator = new MemoryCurator(mockAdapter, { staleAfterDays: 90 }, consolidator);

    const stats = await curator.runOnce(NOW);

    // El curator no tocó los marcados; el dream purgó el expirado.
    expect(stats.staleConsolidatedCount).toBe(0);
    expect(stats.dream?.quarantinePurgedCount).toBe(1);
    expect(mockAdapter.delete).toHaveBeenCalledWith('quarantine/pending', 'kb/facts:q-old');
    const rows = storage.get('kb/facts')!;
    expect(rows.find((r) => r.key === 'q-marked')!.metadata?.['state']).toBeUndefined();
  });

  it('start/stop programa la corrida cada intervalHours sin duplicar timers', async () => {
    vi.useFakeTimers();
    try {
      const curator = new MemoryCurator(mockAdapter, { intervalHours: 24, staleAfterDays: 90 });
      const onRun = vi.fn();
      expect(curator.running).toBe(false);
      curator.start(onRun);
      curator.start(onRun);
      expect(curator.running).toBe(true);
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(onRun).toHaveBeenCalledTimes(1);
      curator.stop();
      expect(curator.running).toBe(false);
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(onRun).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
