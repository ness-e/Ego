import { describe, it, expect, vi } from "vitest";
import type { EgoMemoryAdapter, EgoPut } from "@ego/memory";
import { DailyStateEngine } from "../src/DailyStateEngine.js";
import { DailyStateSummarySchema } from "../src/types.js";

/**
 * EGO-FIND-52 (Ola 1 / A3 / T9) — DailyState honesto.
 *
 * `decisionsCount` era la longitud de una página de 50 (no del namespace);
 * `recentDecisions` era el top-10 DESPUÉS de ordenar solo el primer lote
 * (no eran las 10 más recientes reales); y 5 `catch {}` silenciosos
 * convertían un fallo de lectura en "0 aprobaciones".
 */

function makeAdapter(
  namespaces: Record<string, Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>>,
  failing: string[] = []
): { adapter: EgoMemoryAdapter; puts: EgoPut[] } {
  const puts: EgoPut[] = [];
  const adapter = {
    ready: true,
    init: vi.fn(async () => {}),
    put: vi.fn(async (item: EgoPut) => {
      puts.push(item);
    }),
    get: vi.fn(async () => null),
    delete: vi.fn(async () => true),
    list: vi.fn(async (namespace: string, limit = 100) => {
      if (failing.includes(namespace)) throw new Error(`boom en ${namespace}`);
      return (namespaces[namespace] ?? []).slice(0, limit);
    }),
    listPaged: vi.fn(async (namespace: string, limit = 100, cursor?: number | string) => {
      if (failing.includes(namespace)) throw new Error(`boom en ${namespace}`);
      const all = namespaces[namespace] ?? [];
      const start = typeof cursor === "number" ? cursor : 0;
      const slice = all.slice(start, start + limit);
      const next = start + limit < all.length ? start + limit : undefined;
      return { records: slice, nextCursor: next };
    }),
    recordAudit: vi.fn(async () => {}),
  } as unknown as EgoMemoryAdapter;
  return { adapter, puts };
}

describe("T9 — DailyState honesto (EGO-FIND-52)", () => {
  it("`decisionsCount` cuenta TODAS las decisiones del namespace, no una página", async () => {
    const decisions = Array.from({ length: 130 }, (_, i) => ({
      key: `d${i}`,
      payload: { id: `d${i}`, title: `Decisión ${i}`, timestamp: 1000 + i },
    }));

    const { adapter } = makeAdapter({ "gov/audit": decisions });
    const engine = new DailyStateEngine(adapter);

    const summary = await engine.synthesize();

    expect(summary.decisionsCount).toBe(130);
  });

  it("`recentDecisions` son las N más recientes REALES (más allá de la primera página)", async () => {
    const decisions = Array.from({ length: 130 }, (_, i) => ({
      key: `d${i}`,
      payload: { id: `d${i}`, title: `Decisión ${i}`, timestamp: 1000 + i },
    }));

    const { adapter } = makeAdapter({ "gov/audit": decisions });
    const engine = new DailyStateEngine(adapter);

    const summary = await engine.synthesize({ maxRecentDecisions: 3 });

    expect(summary.recentDecisions.length).toBe(3);
    // Las 3 de mayor timestamp (129, 128, 127), NO las de la primera página.
    expect(summary.recentDecisions[0]?.id).toBe("d129");
    expect(summary.recentDecisions[1]?.id).toBe("d128");
    expect(summary.recentDecisions[2]?.id).toBe("d127");
  });

  it("un fallo de lectura NO se presenta como 0 aprobaciones", async () => {
    const { adapter } = makeAdapter({ "gov/audit": [] }, ["gov/approvals"]);
    const engine = new DailyStateEngine(adapter);

    const summary = await engine.synthesize();

    // El contador NO debe mentir diciendo 0.
    expect(summary.sourcesUnavailable).toContain("gov/approvals");
    expect(summary.partial).toBe(true);
    // Y el valor debe ser honesto (no un 0 que parece "no hay aprobaciones").
    expect(summary.pendingApprovalsCount).not.toBe(0);
  });

  it("sin fallos, `partial` es false y `sourcesUnavailable` está vacío", async () => {
    const { adapter } = makeAdapter({ "gov/audit": [] });
    const engine = new DailyStateEngine(adapter);

    const summary = await engine.synthesize();

    expect(summary.partial).toBe(false);
    expect(summary.sourcesUnavailable).toEqual([]);
  });

  it("el summary sigue validando contra el esquema Zod", async () => {
    const { adapter } = makeAdapter({ "gov/audit": [] });
    const engine = new DailyStateEngine(adapter);

    const summary = await engine.synthesize();

    expect(() => DailyStateSummarySchema.parse(summary)).not.toThrow();
  });
});
