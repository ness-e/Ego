import { describe, it, expect } from "vitest";
import { forkSession } from "../SessionFork.js";

interface Stored {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

function fakeAdapter(seed: Stored[] = []) {
  const puts: Stored[] = [];
  return {
    puts,
    adapter: {
      list: async () => [...seed],
      put: async (item: Stored) => {
        puts.push(item);
      },
    } as never,
  };
}

describe("@ego/memory — forkSession (STAB-12)", () => {
  it("1. copia session/turns al nuevo id + checkpoint + handoff", async () => {
    const seed: Stored[] = [
      { key: "s1:turn:1", payload: { a: 1 }, metadata: { sessionId: "s1" } },
      { key: "s1:turn:2", payload: { a: 2 } },
      { key: "other:turn:1", payload: { a: 9 } },
    ];
    const { puts, adapter } = fakeAdapter(seed);
    const handoff = await forkSession(
      { fromSessionId: "s1", toSessionId: "s2", summary: "Continuación", findings: ["f1"], files: [], issues: ["i1"] },
      { adapter, createCheckpoint: async () => "chk_1", nowMs: () => 1000 }
    );
    expect(handoff).toMatchObject({
      from: "s1",
      to: "s2",
      summary: "Continuación",
      findings: ["f1"],
      issues: ["i1"],
      checkpointId: "chk_1",
      copiedTurns: 2,
      createdAtMs: 1000,
    });
    expect(puts.map((p) => p.key).sort()).toEqual(["s2:turn:1", "s2:turn:2"]);
    expect(puts[0].metadata).toMatchObject({ forkedFrom: "s1", forkedAtMs: 1000 });
    // El origen no se toca (solo puts al nuevo id)
    expect(puts.every((p) => !p.key.startsWith("s1:"))).toBe(true);
  });

  it("2. fail-closed: ids inválidos o iguales lanzan sin tocar memoria", async () => {
    const { puts, adapter } = fakeAdapter();
    let calls = 0;
    const deps = { adapter, createCheckpoint: async () => { calls++; return "x"; } };
    await expect(forkSession({ fromSessionId: "", toSessionId: "s2", summary: "s" }, deps)).rejects.toThrow(/fail-closed/);
    await expect(forkSession({ fromSessionId: "s", toSessionId: "s", summary: "s" }, deps)).rejects.toThrow(/diferir/);
    await expect(forkSession({ fromSessionId: "s1", toSessionId: "s2", summary: "  " }, deps)).rejects.toThrow(/summary/);
    expect(puts.length).toBe(0);
    expect(calls).toBe(0);
  });

  it("3. sin turnos (list vacío) produce handoff válido con copiedTurns 0 + checkpoint", async () => {
    const { adapter } = fakeAdapter([]);
    const handoff = await forkSession(
      { fromSessionId: "ghost", toSessionId: "s9", summary: "vacío" },
      { adapter, createCheckpoint: async () => "chk_9", nowMs: () => 7 }
    );
    expect(handoff.copiedTurns).toBe(0);
    expect(handoff.checkpointId).toBe("chk_9");
  });
});
