import { describe, it, expect, vi, beforeEach } from "vitest";
import { DecisionsFeed } from "../src/DecisionsFeed.js";

describe("DecisionsFeed (DS-03 / COUC-09)", () => {
  let mockAdapter: any;
  const storeMap = new Map<string, unknown>();

  beforeEach(() => {
    storeMap.clear();
    mockAdapter = {
      list: vi.fn(async (namespace: string, limit?: number) => {
        const results: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }> = [];
        for (const [k, v] of storeMap.entries()) {
          if (k.startsWith(`${namespace}:`)) {
            const itemKey = k.split(":")[1];
            results.push({ key: itemKey, payload: v });
          }
        }
        return results;
      }),
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        storeMap.set(`${item.namespace}:${item.key}`, item.payload);
      }),
    };
  });

  it("registra una decisión inmutable en gov/audit", async () => {
    const feed = new DecisionsFeed(mockAdapter);
    const recorded = await feed.recordDecision({
      title: "Adoptar NativeVantaDB",
      subEgoId: "ego.architect",
      impact: "Persistencia duradera con Fjall LSM",
    });

    expect(recorded.id).toMatch(/^dec-/);
    expect(recorded.title).toBe("Adoptar NativeVantaDB");
    expect(recorded.subEgoId).toBe("ego.architect");

    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "gov/audit",
        key: recorded.id,
      })
    );
  });

  it("recupera decisiones ordenadas cronológicamente y filtra por subEgoId", async () => {
    const feed = new DecisionsFeed(mockAdapter);
    await feed.recordDecision({ title: "Decisión A", subEgoId: "subego.alpha" });
    await feed.recordDecision({ title: "Decisión B", subEgoId: "subego.beta" });
    await feed.recordDecision({ title: "Decisión C", subEgoId: "subego.alpha" });

    const all = await feed.getDecisions();
    expect(all).toHaveLength(3);

    const filtered = await feed.getDecisions({ subEgoId: "subego.alpha" });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((d) => d.subEgoId === "subego.alpha")).toBe(true);
  });

  it("exporta formato Markdown para Journal o auditoría ejecutiva", async () => {
    const feed = new DecisionsFeed(mockAdapter);
    await feed.recordDecision({
      title: "Desacoplar Dynamic Workspace",
      subEgoId: "ego.nucleus",
      impact: "Alto",
    });

    const markdown = await feed.exportDecisionsMarkdown();
    expect(markdown).toContain("| Hora | Sub-Ego | Decisión | Impacto |");
    expect(markdown).toContain("`ego.nucleus`");
    expect(markdown).toContain("Desacoplar Dynamic Workspace");
  });

  it("usa metadata.ts/agent_id reales vía list() (anti-fallback C03-list)", async () => {
    const TS = 1728570000000;
    mockAdapter.list.mockResolvedValueOnce([
      {
        key: "dec-meta-1",
        payload: { id: "dec-meta-1", title: "Decisión vía metadata" },
        metadata: { ts: TS, agent_id: "subego.meta" },
      },
    ]);

    const feed = new DecisionsFeed(mockAdapter);
    const decisions = await feed.getDecisions();

    expect(decisions).toHaveLength(1);
    // Anti-fallback: con metadata tagged sin desenvolver, timestamp caería a
    // Date.now() y subEgoId a "ego.nucleus".
    expect(decisions[0].timestamp).toBe(TS);
    expect(decisions[0].subEgoId).toBe("subego.meta");
    expect(decisions[0].subEgoId).not.toBe("ego.nucleus");
  });

  it("emite evento propio daily.decision.recorded (H21, sin colisión de hechos)", async () => {
    const mockEventBus = { emit: vi.fn() };
    const feed = new DecisionsFeed(mockAdapter, { eventBus: mockEventBus as never });
    const recorded = await feed.recordDecision({
      title: "Adoptar NativeVantaDB",
      subEgoId: "ego.architect",
    });

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      "daily.decision.recorded",
      expect.objectContaining({ id: recorded.id }),
      expect.objectContaining({ source: "DecisionsFeed" })
    );

    // Sin colisión: JAMÁS reutiliza el evento de síntesis del motor
    const synthesizedCalls = mockEventBus.emit.mock.calls.filter(
      (c: unknown[]) => c[0] === "daily.state.synthesized"
    );
    expect(synthesizedCalls).toHaveLength(0);
  });
});
