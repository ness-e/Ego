import { describe, expect, it } from "vitest";
import { InteractionTransport } from "../src/InteractionTransport.js";

describe("STAB-14: InteractionTransport + admit (fallback sin bloqueo)", () => {
  it("submit + resolve aprueba admit", async () => {
    const t = new InteractionTransport();
    t.submit("i1");
    const p = t.admit("i1", { timeoutMs: 500 });
    expect(t.resolve("i1", "approved")).toBe(true);
    await expect(p).resolves.toBe(true);
  });

  it("admit con timeout corto sin resolve → false (no cuelga)", async () => {
    const t = new InteractionTransport();
    t.submit("i2");
    await expect(t.admit("i2", { timeoutMs: 20 })).resolves.toBe(false);
    expect(t.pendingCount()).toBe(1);
  });

  it("cancel → admit false", async () => {
    const t = new InteractionTransport();
    t.submit("i3");
    const p = t.admit("i3", { timeoutMs: 500 });
    expect(t.cancel("i3", "user-dismissed")).toBe(true);
    await expect(p).resolves.toBe(false);
  });

  it("admit id desconocido → false sin rechazar", async () => {
    const t = new InteractionTransport();
    await expect(t.admit("missing", { timeoutMs: 10 })).resolves.toBe(false);
  });

  it("denegación → admit false; resolve duplicado → false", async () => {
    const t = new InteractionTransport();
    t.submit("i4");
    const p = t.admit("i4", { timeoutMs: 500 });
    expect(t.resolve("i4", "denied")).toBe(true);
    await expect(p).resolves.toBe(false);
    expect(t.resolve("i4", "approved")).toBe(false);
  });
});
