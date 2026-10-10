import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DreamConsolidator } from '../src/DreamConsolidator.js';

describe('DreamConsolidator (TASK-08 / KHOJ-05)', () => {
  let mockAdapter: any;
  let consolidator: DreamConsolidator;
  const storage = new Map<string, Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>>();

  beforeEach(() => {
    storage.clear();
    mockAdapter = {
      list: vi.fn(async (ns: string) => {
        return storage.get(ns) ?? [];
      }),
      delete: vi.fn(async (ns: string, key: string) => {
        const items = storage.get(ns) ?? [];
        storage.set(
          ns,
          items.filter((i) => i.key !== key)
        );
        return true;
      }),
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) => {
        const items = storage.get(item.namespace) ?? [];
        const index = items.findIndex((i) => i.key === item.key);
        if (index >= 0) {
          items[index] = { key: item.key, payload: item.payload, metadata: item.metadata };
        } else {
          items.push({ key: item.key, payload: item.payload, metadata: item.metadata });
        }
        storage.set(item.namespace, items);
      }),
    };
    consolidator = new DreamConsolidator(mockAdapter, { idleThresholdMs: 1000 });
  });

  it('detecta inactividad del sistema cuando el tiempo supera el umbral', () => {
    const now = 10000;
    expect(consolidator.isSystemIdle(now - 500, now)).toBe(false);
    expect(consolidator.isSystemIdle(now - 1500, now)).toBe(true);
  });

  it('purga entradas en cuarentena con TTL expirado', async () => {
    const now = 5000;
    storage.set('quarantine/pending', [
      { key: 'q-expired', payload: 'old', metadata: { expiresAt: 4000 } },
      { key: 'q-valid', payload: 'fresh', metadata: { expiresAt: 9000 } },
    ]);

    const stats = await consolidator.runCycle(now);

    expect(stats.quarantinePurgedCount).toBe(1);
    expect(mockAdapter.delete).toHaveBeenCalledWith('quarantine/pending', 'q-expired');
    expect(mockAdapter.delete).not.toHaveBeenCalledWith('quarantine/pending', 'q-valid');
  });

  it('deduplica y marca como superseded hechos idénticos en kb/facts', async () => {
    storage.set('kb/facts', [
      {
        key: 'fact-1',
        payload: { subject: 'Node.js', predicate: 'version', object: '22' },
        metadata: { state: 'active' },
      },
      {
        key: 'fact-2',
        payload: { subject: 'Node.js', predicate: 'version', object: '22' },
        metadata: { state: 'active' },
      },
    ]);

    const stats = await consolidator.runCycle(Date.now());

    expect(stats.deduplicatedCount).toBe(1);
    expect(stats.supersededCount).toBe(1);
    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'kb/facts',
        key: 'fact-2',
        payload: expect.objectContaining({ is_latest: false, superseded_by: 'fact-1' }),
      })
    );
  });
});
