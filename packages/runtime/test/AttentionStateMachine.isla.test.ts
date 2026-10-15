import { describe, it, expect } from "vitest";
import {
  AttentionStateMachine,
  ISLA_TIMING,
} from "../src/AttentionStateMachine.js";

describe("isla parity (Task1: home->compact 15s, compact->hidden 60s, pinned)", () => {
  it("home->compact 15s, compact->hidden 60s, pinned bloquea", async () => {
    const m = new AttentionStateMachine({ homeMs: 15_000, compactMs: 60_000 });
    m.requestAttention({ id: "a", priority: 50, state: "expanded", title: "t" });
    expect(m.getState()).toBe("expanded");
    m.setPinned(true);
    m.tick(16_000);
    expect(m.getState()).toBe("expanded"); // pinned bloquea colapso
  });

  it("expanded colapsa a compact tras homeMs sin pin", () => {
    const m = new AttentionStateMachine({ homeMs: 15_000, compactMs: 60_000 });
    m.requestAttention({ id: "a", priority: 50, state: "expanded", title: "t" });
    expect(m.getState()).toBe("expanded");
    m.tick(14_999);
    expect(m.getState()).toBe("expanded");
    m.tick(1);
    expect(m.getState()).toBe("compact");
  });

  it("compact colapsa a hidden tras compactMs sin pin", () => {
    const m = new AttentionStateMachine({ homeMs: 15_000, compactMs: 60_000 });
    m.requestAttention({ id: "c", priority: 50, state: "compact", title: "t" });
    expect(m.getState()).toBe("compact");
    m.tick(59_999);
    expect(m.getState()).toBe("compact");
    m.tick(1);
    expect(m.getState()).toBe("hidden");
  });

  it("unpin reanuda evaluacion de colapso", () => {
    const m = new AttentionStateMachine({ homeMs: 15_000, compactMs: 60_000 });
    m.requestAttention({ id: "a", priority: 50, state: "expanded", title: "t" });
    m.setPinned(true);
    m.tick(16_000);
    expect(m.getState()).toBe("expanded");
    m.setPinned(false);
    m.tick(15_000);
    expect(m.getState()).toBe("compact");
  });

  it("expone constantes de temporizacion isla", () => {
    expect(ISLA_TIMING.homeToCompact).toBe(15_000);
    expect(ISLA_TIMING.compactToHidden).toBe(60_000);
    expect(ISLA_TIMING.greetAuto).toBe(600);
    expect(ISLA_TIMING.finishedPin).toBe(5_200);
  });
});
