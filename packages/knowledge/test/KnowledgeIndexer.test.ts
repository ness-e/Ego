import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgeIndexer } from "../src/KnowledgeIndexer.js";
import { ParsedDocument } from "../src/schemas/knowledge.js";

describe("KnowledgeIndexer (KB-03)", () => {
  let mockAdapter: any;
  let indexer: KnowledgeIndexer;

  beforeEach(() => {
    mockAdapter = {
      put: vi.fn().mockResolvedValue(undefined),
      putMulti: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    };
    indexer = new KnowledgeIndexer(mockAdapter);
  });

  it("indexa chunks en kb/docs con serialización segura de metadatos (VDB-BUG-04)", async () => {
    const doc: ParsedDocument = {
      id: "doc_test_1",
      sourcePath: "manual.md",
      title: "Manual",
      mimeType: "text/markdown",
      rawLength: 100,
      documentHash: "a".repeat(64),
      chunks: [
        {
          id: "chunk_0",
          content: "Texto del fragmento 1",
          tokenCount: 15,
          headingPath: ["Capítulo 1", "Sección A"],
          contentHash: "b".repeat(64),
          sourcePath: "manual.md",
          mimeType: "text/markdown",
          index: 0,
        },
      ],
    };

    const res = await indexer.indexDocument(doc, { projectId: "proj_1" });

    expect(res.indexedChunks).toBe(1);
    expect(res.skippedDuplicates).toBe(0);
    expect(mockAdapter.putMulti).toHaveBeenCalledTimes(1);
    expect(mockAdapter.flush).toHaveBeenCalledTimes(1);

    const batch = mockAdapter.putMulti.mock.calls[0][0];
    expect(batch).toHaveLength(1);
    const putCall = batch[0];
    expect(putCall.namespace).toBe("kb/docs/doc_test_1");
    expect(putCall.key).toBe("chunk_0");
    expect(putCall.metadata.heading_path_json).toBe(JSON.stringify(["Capítulo 1", "Sección A"]));
  });

  it("omite chunks duplicados si el contentHash ya existe en base de datos", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      content: "Existente",
      metadata: { content_hash: "b".repeat(64) },
    });

    const doc: ParsedDocument = {
      id: "doc_test_1",
      sourcePath: "manual.md",
      title: "Manual",
      mimeType: "text/markdown",
      rawLength: 100,
      documentHash: "a".repeat(64),
      chunks: [
        {
          id: "chunk_0",
          content: "Texto duplicado",
          tokenCount: 10,
          headingPath: [],
          contentHash: "b".repeat(64),
          sourcePath: "manual.md",
          mimeType: "text/markdown",
          index: 0,
        },
      ],
    };

    const res = await indexer.indexDocument(doc);
    expect(res.indexedChunks).toBe(0);
    expect(res.skippedDuplicates).toBe(1);
  });

  it("indexa hechos atómicos en kb/facts con metadata tipada", async () => {
    const fact = {
      id: "fact_123",
      subject: "Ego",
      predicate: "uses_runtime",
      object: "Node 22",
      confidence: 0.95,
      temporalScope: "persistent" as const,
      source: "doc.md",
      validAt: Date.now(),
      invalidAt: null,
      supersededBy: null,
      state: "active" as const,
    };

    await indexer.indexFact(fact);

    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "kb/facts",
        key: "fact_123",
        payload: "Ego uses_runtime Node 22",
        metadata: expect.objectContaining({
          confidence: 0.95,
          is_latest: true,
        }),
      })
    );
  });
});
