import { describe, it, expect, vi } from "vitest";
import type { ModelMessage } from "@ego/models";
import {
  ContextCompactionJob,
  type CompactionArchiveTarget,
  type CompactionArchiveRecord,
} from "../src/ContextCompaction.js";

function makeMessages(n: number): ModelMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `mensaje ${i} — contenido de relleno para estimar la poda`,
  }));
}

describe("ContextCompaction — motor único (T1 / EGO-FIND-21)", () => {
  it("(1) compactSync honra un summarizer SÍNCRONO inyectado (antes lo ignoraba)", () => {
    const job = new ContextCompactionJob();
    const result = job.compactSync(
      { messages: makeMessages(20), usageRatio: 0.9 },
      {
        isCompressionRebuild: true,
        summarizer: () => "RESUMEN SINCRONO INYECTADO",
      }
    );

    expect(result.summary).toBe("RESUMEN SINCRONO INYECTADO");
    expect(result.messages.some((m) => m.content.includes("RESUMEN SINCRONO INYECTADO"))).toBe(true);
    expect(result.summary).not.toContain("Context compacted:");
  });

  it("(1b) compactSync con summarizer que devuelve una promesa cae al fallback sin dejar promesa colgante", async () => {
    const job = new ContextCompactionJob();
    const result = job.compactSync(
      { messages: makeMessages(20), usageRatio: 0.9 },
      {
        isCompressionRebuild: true,
        summarizer: async () => "NO DEBE APARECER",
      }
    );

    expect(result.summary).toContain("Context compacted:");
    expect(result.summary).not.toContain("NO DEBE APARECER");
  });

  it("(2) autoMemory archiva el resumen en kb/history_archive vía target inyectado", async () => {
    const archived: CompactionArchiveRecord[] = [];
    const target: CompactionArchiveTarget = {
      put: async (record) => {
        archived.push(record);
        return { ok: true };
      },
    };

    const job = new ContextCompactionJob({ autoMemory: true }, { archiveTarget: target });
    const result = await job.compact(
      { messages: makeMessages(20), usageRatio: 0.9 },
      { isCompressionRebuild: true, sessionId: "sess_abc" }
    );

    expect(archived.length).toBe(1);
    expect(archived[0]?.namespace).toBe("kb/history_archive");
    expect(archived[0]?.key).toContain("sess_abc");
    expect(archived[0]?.payload.summary).toBe(result.summary);
    expect(result.archiveKey).toBe(archived[0]?.key);
  });

  it("(2b) autoMemory=false NO archiva", async () => {
    const put = vi.fn(async () => ({ ok: true }));
    const job = new ContextCompactionJob(
      { autoMemory: false },
      { archiveTarget: { put: put as unknown as CompactionArchiveTarget["put"] } }
    );

    const result = await job.compact(
      { messages: makeMessages(20), usageRatio: 0.9 },
      { isCompressionRebuild: true, sessionId: "sess_xyz" }
    );

    expect(put).not.toHaveBeenCalled();
    expect(result.archiveKey).toBeNull();
  });

  it("(2c) un fallo de archivado NO invalida la compactación (fail-soft)", async () => {
    const job = new ContextCompactionJob(
      { autoMemory: true },
      {
        archiveTarget: {
          put: async () => {
            throw new Error("VantaDB no disponible");
          },
        },
      }
    );

    const result = await job.compact(
      { messages: makeMessages(20), usageRatio: 0.9 },
      { isCompressionRebuild: true, sessionId: "sess_err" }
    );

    expect(result.archiveKey).toBeNull();
    expect(result.messages.length).toBeLessThanOrEqual(6);
  });

  it("(3) el motor único comparte la misma segmentación head/dropped/tail entre compact y compactSync", async () => {
    const job = new ContextCompactionJob();
    const messages = makeMessages(25);

    const asyncResult = await job.compact(
      { messages, usageRatio: 0.9 },
      { isCompressionRebuild: true }
    );
    const syncResult = job.compactSync(
      { messages, usageRatio: 0.9 },
      { isCompressionRebuild: true }
    );

    expect(asyncResult.messages.length).toBe(syncResult.messages.length);
    expect(asyncResult.messages.map((m) => m.role)).toEqual(syncResult.messages.map((m) => m.role));
    expect(asyncResult.keptRatio).toBe(syncResult.keptRatio);
  });
});
