import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import { KnowledgeIndexer } from "../src/KnowledgeIndexer.js";
import type { ParsedDocument } from "../src/schemas/knowledge.js";

function buildDoc(): ParsedDocument {
  return {
    id: "doc_double_idx",
    sourcePath: "manual.md",
    title: "Manual",
    mimeType: "text/markdown",
    rawLength: 300,
    documentHash: "a".repeat(64),
    chunks: [0, 1, 2].map((i) => ({
      id: `chunk_${i}`,
      content: `Texto del fragmento ${i}`,
      tokenCount: 10 + i,
      headingPath: [`Capítulo ${i}`],
      contentHash: `${i}`.repeat(64),
      sourcePath: "manual.md",
      mimeType: "text/markdown",
      index: i,
    })),
  };
}

describe("KnowledgeIndexer — doble indexación idempotente (M13/C02)", () => {
  let dir: string;
  let adapter: EgoMemoryAdapter;
  let indexer: KnowledgeIndexer;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-double-index-"));
    adapter = new EgoMemoryAdapter(dir);
    await adapter.init();
    indexer = new KnowledgeIndexer(adapter);
  });

  afterAll(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos de Windows
    }
  });

  it("indexa un doc 2 veces: 1ª indexa todo, 2ª skips todo con 0 puts nuevos + flush", async () => {
    const flushSpy = vi.spyOn(adapter, "flush");
    const putSpy = vi.spyOn(adapter, "put");
    const putMultiSpy = vi.spyOn(adapter, "putMulti");
    const doc = buildDoc();

    const first = await indexer.indexDocument(doc);
    expect(first.totalChunks).toBe(3);
    expect(first.indexedChunks).toBe(3);
    expect(first.skippedDuplicates).toBe(0);
    expect(flushSpy).toHaveBeenCalled();

    putSpy.mockClear();
    putMultiSpy.mockClear();
    flushSpy.mockClear();

    const second = await indexer.indexDocument(doc);
    expect(second.totalChunks).toBe(3);
    expect(second.indexedChunks).toBe(0);
    expect(second.skippedDuplicates).toBe(3);
    expect(putSpy).not.toHaveBeenCalled();
    expect(putMultiSpy).not.toHaveBeenCalled();
    expect(flushSpy).toHaveBeenCalledTimes(1);

    const records = await adapter.list(`kb/docs/${doc.id}`);
    expect(records).toHaveLength(3);
    const keys = records.map((r) => r.key).sort();
    expect(keys).toEqual(["chunk_0", "chunk_1", "chunk_2"]);
  });
});
