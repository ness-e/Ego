import { describe, it, expect } from "vitest";
import {
  getCachedCompressionSettings,
  setCachedCompressionSettingsForTests,
  estimateTurnTokens,
  getLoopStableHash,
  updateLoopStableHash,
  clearLoopStableHash,
  stopMemoryCleanupForTests,
} from "../src/main.js";

describe("@ego/desktop — STAB-05 compresión (settings + trigger helpers)", () => {
  it("defaults Gate P sin VantaDB: 70% / 40% / auto / 30d / 50 snapshots", () => {
    setCachedCompressionSettingsForTests(null);
    const s = getCachedCompressionSettings();
    expect(s.thresholdRatio).toBe(0.7);
    expect(s.targetRatio).toBe(0.4);
    expect(s.autoCompact).toBe(true);
    expect(s.cleanupPeriodDays).toBe(30);
    expect(s.maxSnapshots).toBe(50);
  });

  it("setCached roundtrip para tests", () => {
    setCachedCompressionSettingsForTests({
      thresholdRatio: 0.9,
      targetRatio: 0.5,
      autoCompact: false,
      maxWindowTokens: 1000,
      cleanupPeriodDays: 7,
      maxSnapshots: 3,
    });
    expect(getCachedCompressionSettings().thresholdRatio).toBe(0.9);
    expect(getCachedCompressionSettings().autoCompact).toBe(false);
    setCachedCompressionSettingsForTests(null);
  });

  it("estimateTurnTokens: chars/4 con techo (hot path O(n) sin serializar)", () => {
    expect(estimateTurnTokens([])).toBe(0);
    expect(estimateTurnTokens([{ content: "abcd" }])).toBe(1);
    expect(estimateTurnTokens([{ content: "abcde" }])).toBe(2);
    expect(
      estimateTurnTokens([{ content: "abcdefgh" }, { content: "abcdefgh" }])
    ).toBe(4);
  });

  it("loop stable hash: primer turno sin baseline, luego fija y libera", () => {
    const session = "sess-stab05-test";
    clearLoopStableHash(session);
    expect(getLoopStableHash(session)).toBeUndefined();
    const hash = updateLoopStableHash(session, "system-estable");
    expect(getLoopStableHash(session)).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // El overlay efímero no entra: mismo estable → mismo hash.
    expect(updateLoopStableHash(session, "system-estable")).toBe(hash);
    expect(updateLoopStableHash(session, "system-otro")).not.toBe(hash);
    clearLoopStableHash(session);
    expect(getLoopStableHash(session)).toBeUndefined();
    stopMemoryCleanupForTests();
  });
});
