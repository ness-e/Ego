import { describe, it, expect, vi } from "vitest";
import { EgoMemoryLifecycle, type TurnRecord } from "../EgoMemoryLifecycle.js";
import { resolveCompressionSettings } from "../CompressionSettings.js";

function makeTurn(id: string, ts: number): TurnRecord {
  return {
    sessionId: "sess-05",
    turnId: id,
    timestamp: ts,
    userPrompt: `hola ${id}`,
    assistantReply: `respuesta ${id}`,
    recalledKeys: [],
  };
}

function makeAdapter() {
  const puts: Array<{ namespace: string; key: string; payload: unknown }> = [];
  return {
    ready: true,
    init: vi.fn(),
    put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
      puts.push(item);
      return { routedTo: "live" };
    }),
    searchMulti: vi.fn(async () => []),
    recordAudit: vi.fn(async () => "audit:key"),
    puts,
  };
}

describe("EgoMemoryLifecycle.maybePreCompact (STAB-05)", () => {
  it("archiva en kb/history_archive cuando el ratio supera el 70%", async () => {
    const adapter = makeAdapter();
    const lifecycle = new EgoMemoryLifecycle(adapter as never);
    const turns = [makeTurn("t1", 1000), makeTurn("t2", 2000)];
    const settings = resolveCompressionSettings({});

    const result = await lifecycle.maybePreCompact("sess-05", turns, 7500, 10000, settings);

    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("ratio_threshold");
    expect(result.archiveKey).toMatch(/^archive_sess-05_/);
    const archived = adapter.puts.find((p) => p.namespace === "kb/history_archive");
    expect(archived).toBeDefined();
    expect((archived!.payload as { turnCount: number }).turnCount).toBe(2);
  });

  it("no archiva bajo el umbral y retorna triggered:false", async () => {
    const adapter = makeAdapter();
    const lifecycle = new EgoMemoryLifecycle(adapter as never);
    const settings = resolveCompressionSettings({});

    const result = await lifecycle.maybePreCompact("sess-05", [makeTurn("t1", 1000)], 100, 10000, settings);

    expect(result.triggered).toBe(false);
    expect(result.archiveKey).toBeNull();
    expect(adapter.puts.length).toBe(0);
  });

  it("close/reopen: el archive queda legible con turnCount e historial", async () => {
    const adapter = makeAdapter();
    const lifecycle = new EgoMemoryLifecycle(adapter as never);
    const turns = [makeTurn("t1", 1000)];
    const settings = resolveCompressionSettings({ maxWindowTokens: 10 });

    const result = await lifecycle.maybePreCompact("sess-05", turns, 999, 100000, settings);

    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("token_limit");
    const payload = adapter.puts[0].payload as {
      sessionId: string;
      turnCount: number;
      history: TurnRecord[];
    };
    expect(payload.sessionId).toBe("sess-05");
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].turnId).toBe("t1");
  });

  it("respeta autoCompact=false aunque el ratio lo supere", async () => {
    const adapter = makeAdapter();
    const lifecycle = new EgoMemoryLifecycle(adapter as never);
    const settings = resolveCompressionSettings({ autoCompact: false });

    const result = await lifecycle.maybePreCompact("sess-05", [makeTurn("t1", 1)], 9999, 10000, settings);

    expect(result.triggered).toBe(false);
    expect(adapter.puts.length).toBe(0);
  });
});
