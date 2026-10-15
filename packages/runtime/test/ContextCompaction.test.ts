import { describe, it, expect } from "vitest";
import type { ModelMessage } from "@ego/models";
import {
  ContextCompactionJob,
  DEFAULT_CONTEXT_COMPACTION_SETTINGS,
  evaluateCompactionNeed,
  resolveContextCompactionSettings,
} from "../src/ContextCompaction.js";

function makeMessages(n: number): ModelMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `mensaje ${i} — contenido de relleno para estimar la poda`,
  }));
}

describe("ContextCompaction (CFG-05)", () => {
  it("defaults CFG-05 exactos: threshold 0.50 / target 0.20 / auto_compact 200000 / autoMemory", () => {
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.compressionThreshold).toBe(0.5);
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.compressionTargetRatio).toBe(0.2);
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.autoCompactTokens).toBe(200000);
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.autoMemory).toBe(true);
  });

  it("resolve rechaza valores sin sentido", () => {
    expect(() => resolveContextCompactionSettings({ compressionThreshold: 0 })).toThrow();
    expect(() => resolveContextCompactionSettings({ compressionThreshold: 1.5 })).toThrow();
    expect(() => resolveContextCompactionSettings({ compressionTargetRatio: 0.9 })).toThrow();
    expect(() => resolveContextCompactionSettings({ autoCompactTokens: 0 })).toThrow();
  });

  it("evaluate: bajo umbral no compacta; ratio >= 0.50 sí; tokens >= 200000 sí", () => {
    const settings = resolveContextCompactionSettings();
    expect(evaluateCompactionNeed({ messages: [], usageRatio: 0.49 }, settings).shouldCompact).toBe(false);
    const byRatio = evaluateCompactionNeed({ messages: [], usageRatio: 0.5 }, settings);
    expect(byRatio).toEqual({ shouldCompact: true, reason: "ratio_threshold" });
    const byTokens = evaluateCompactionNeed({ messages: [], usageRatio: 0.1, estimatedTokens: 200000 }, settings);
    expect(byTokens).toEqual({ shouldCompact: true, reason: "token_limit" });
  });

  it("compact() sin isCompressionRebuild lanza (nunca mid-turn salvo compresión)", () => {
    const job = new ContextCompactionJob();
    expect(() =>
      job.compact(
        { messages: makeMessages(10), usageRatio: 0.9 },
        { isCompressionRebuild: false }
      )
    ).toThrow(/isCompressionRebuild/);
  });

  it("compact() verificada: con flag comprime hacia target 0.20 + snapshot volátil", () => {
    const job = new ContextCompactionJob();
    const messages = makeMessages(20);
    const result = job.compact(
      { messages, usageRatio: 0.9 },
      { isCompressionRebuild: true }
    );
    // 20 mensajes → keep floor(20*0.2)=4 + 1 resumen = 5 (ratio 0.25, techo por mínimo 1 head).
    expect(result.messages.length).toBeLessThanOrEqual(6);
    expect(result.keptRatio).toBeLessThanOrEqual(0.3);
    expect(result.summary).toContain("summarized");
    expect(result.volatileSnapshot).toContain("compression rebuild");
    // Head preservado + tail preservado + resumen intermedio marcado.
    expect(result.messages[0].content).toContain("mensaje 0");
    expect(result.messages[result.messages.length - 1].content).toContain("mensaje 19");
    expect(result.messages.some((m) => m.content.includes("[COMPRESSED CONTEXT"))).toBe(true);
  });

  it("compact() con historial vacío no lanza y reporta keptRatio 1", () => {
    const job = new ContextCompactionJob();
    const result = job.compact({ messages: [], usageRatio: 0.9 }, { isCompressionRebuild: true });
    expect(result.messages).toEqual([]);
    expect(result.keptRatio).toBe(1);
  });
});
