import { describe, it, expect } from "vitest";
import {
  COMPRESSION_SETTINGS_KEY,
  COMPRESSION_SETTINGS_NAMESPACE,
  DEFAULT_COMPRESSION_SETTINGS,
  resolveCompressionSettings,
  shouldTriggerCompression,
} from "../CompressionSettings.js";

describe("CompressionSettings (STAB-05, Gate P vinculante)", () => {
  it("defaults Gate P: threshold 70% + target 40% + auto_compact + cleanup 30d", () => {
    expect(DEFAULT_COMPRESSION_SETTINGS.thresholdRatio).toBe(0.7);
    expect(DEFAULT_COMPRESSION_SETTINGS.targetRatio).toBe(0.4);
    expect(DEFAULT_COMPRESSION_SETTINGS.autoCompact).toBe(true);
    expect(DEFAULT_COMPRESSION_SETTINGS.cleanupPeriodDays).toBe(30);
    expect(DEFAULT_COMPRESSION_SETTINGS.maxSnapshots).toBe(50);
  });

  it("namespace/key canónicos gov/settings + compression", () => {
    expect(COMPRESSION_SETTINGS_NAMESPACE).toBe("gov/settings");
    expect(COMPRESSION_SETTINGS_KEY).toBe("compression");
  });

  it("resolve rechaza threshold fuera de (0,1) y target > threshold", () => {
    expect(() => resolveCompressionSettings({ thresholdRatio: 0 })).toThrow();
    expect(() => resolveCompressionSettings({ thresholdRatio: 1 })).toThrow();
    expect(() =>
      resolveCompressionSettings({ thresholdRatio: 0.3, targetRatio: 0.4 })
    ).toThrow();
    expect(() => resolveCompressionSettings({ cleanupPeriodDays: 0 })).toThrow();
    expect(() => resolveCompressionSettings({ maxSnapshots: 0 })).toThrow();
  });

  it("shouldTriggerCompression: ratio >= 70% dispara por ratio", () => {
    const s = resolveCompressionSettings({});
    expect(shouldTriggerCompression(7000, 10000, s)).toEqual({
      shouldCompact: true,
      reason: "ratio_threshold",
    });
    expect(shouldTriggerCompression(6999, 10000, s)).toEqual({
      shouldCompact: false,
      reason: "under_threshold",
    });
  });

  it("shouldTriggerCompression: techo absoluto aunque el ratio no llegue", () => {
    const s = resolveCompressionSettings({ maxWindowTokens: 1000 });
    expect(shouldTriggerCompression(1000, 100000, s)).toEqual({
      shouldCompact: true,
      reason: "token_limit",
    });
  });

  it("shouldTriggerCompression: autoCompact=false nunca dispara", () => {
    const s = resolveCompressionSettings({ autoCompact: false });
    expect(shouldTriggerCompression(999999, 1000, s).shouldCompact).toBe(false);
  });

  it("shouldTriggerCompression: ventana desconocida (0) no dispara por ratio", () => {
    const s = resolveCompressionSettings({});
    expect(shouldTriggerCompression(5000, 0, s).shouldCompact).toBe(false);
  });
});
