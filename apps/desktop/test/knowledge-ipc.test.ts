import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  KnowledgeIngestSchema,
  KnowledgeHybridSearchSchema,
  KnowledgeGraphRagSchema,
  KnowledgeQuarantineActionSchema,
  KnowledgeAsOfSchema,
  KnowledgeExplainArtifactSchema,
} from "../src/ipc/schema.js";
import {
  KnowledgeIndexer,
  HybridSearch,
  GraphRagEngine,
  QuarantineManager,
  FactLifecycle,
  BitemporalQueries,
  DocumentParser,
} from "@ego/knowledge";
import type { EgoMemoryAdapter, MemoryRecord, SearchHit } from "@ego/memory";

describe("Knowledge & Data Desktop Main Integration (Fase 06 / KB-01..11)", () => {
  let mockAdapter: EgoMemoryAdapter;
  const inMemoryStorage = new Map<string, { payload: unknown; metadata?: Record<string, unknown> }>();

  beforeEach(() => {
    inMemoryStorage.clear();

    mockAdapter = {
      ready: true,
      put: vi.fn().mockImplementation(async ({ namespace, key, payload, metadata }) => {
        inMemoryStorage.set(`${namespace}:${key}`, { payload, metadata });
      }),
      get: vi.fn().mockImplementation(async (namespace, key) => {
        const entry = inMemoryStorage.get(`${namespace}:${key}`);
        return entry ? { key, payload: entry.payload, metadata: entry.metadata ?? {} } : null;
      }),
      delete: vi.fn().mockImplementation(async (namespace, key) => {
        return inMemoryStorage.delete(`${namespace}:${key}`);
      }),
      list: vi.fn().mockImplementation(async (namespace, limit = 100) => {
        const results: MemoryRecord[] = [];
        for (const [k, v] of inMemoryStorage.entries()) {
          if (k.startsWith(`${namespace}:`)) {
            const shortKey = k.replace(`${namespace}:`, "");
            results.push({
              namespace,
              key: shortKey,
              payload: typeof v.payload === "string" ? v.payload : JSON.stringify(v.payload),
              metadata: v.metadata,
            });
          }
        }
        return results.slice(0, limit);
      }),
      searchMulti: vi.fn().mockImplementation(async (namespaces: string[], query: string, opts = {}) => {
        const hits: SearchHit[] = [];
        for (const [k, v] of inMemoryStorage.entries()) {
          const colonIdx = k.indexOf(":");
          const ns = colonIdx > -1 ? k.slice(0, colonIdx) : k;
          const key = colonIdx > -1 ? k.slice(colonIdx + 1) : "";

          const matchesNs = namespaces.some(
            (target) => ns === target || ns.startsWith(target + "/") || target.startsWith(ns + "/")
          );

          if (matchesNs) {
            const text = String(v.payload);
            const score = query ? (text.toLowerCase().includes(query.toLowerCase()) ? 0.9 : 0.4) : 0.8;
            hits.push({
              score,
              record: {
                namespace: ns,
                key,
                payload: text,
                metadata: v.metadata,
              },
            });
          }
        }
        return hits.sort((a, b) => b.score - a.score).slice(0, opts.topK || 10);
      }),
    } as unknown as EgoMemoryAdapter;
  });

  it("Valida esquemas IPC de Knowledge con Zod", () => {
    const validIngest = KnowledgeIngestSchema.safeParse({
      title: "Manual Ego",
      content: "# Título\nContenido de prueba",
      mimeType: "text/markdown",
    });
    expect(validIngest.success).toBe(true);

    const validHybrid = KnowledgeHybridSearchSchema.safeParse({
      query: "arquitectura",
      topK: 5,
      minConfidence: 0.75,
    });
    expect(validHybrid.success).toBe(true);

    const validGraph = KnowledgeGraphRagSchema.safeParse({
      query: "decisión vanta",
      maxDepth: 2,
    });
    expect(validGraph.success).toBe(true);

    const validQuarantine = KnowledgeQuarantineActionSchema.safeParse({
      action: "promote",
      factId: "fact_123",
      promotedBy: "subego.lead",
    });
    expect(validQuarantine.success).toBe(true);

    const validAsOf = KnowledgeAsOfSchema.safeParse({
      targetTime: 1728518400000,
      namespace: "kb/facts",
    });
    expect(validAsOf.success).toBe(true);

    const validExplain = KnowledgeExplainArtifactSchema.safeParse({
      filePath: "src/main.ts",
    });
    expect(validExplain.success).toBe(true);
  });

  it("Ejecuta pipeline completo de Ingesta, Búsqueda Híbrida y GraphRAG", async () => {
    const parser = new DocumentParser();
    const indexer = new KnowledgeIndexer(mockAdapter);
    const hybrid = new HybridSearch(mockAdapter);
    const graphRag = new GraphRagEngine(mockAdapter);

    // 1. Ingesta de documento en memoria
    const markdownContent = `# Arquitectura Ego\n\nEgo utiliza VantaDB para persistencia local de memoria mnemónica.\n\n## Memoria de Proyecto\n\nEl Project Memory Graph conecta decisiones con código.`;
    const parsed = parser.parseContent(markdownContent, "manual.md", "text/markdown");
    const result = await indexer.indexDocument(parsed, { projectId: "proj_ego" });

    expect(result.indexedChunks).toBeGreaterThan(0);
    expect(inMemoryStorage.size).toBeGreaterThan(0);

    // 2. Búsqueda híbrida RRF
    const hits = await hybrid.search("VantaDB", { topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThan(0);

    // 3. Razonamiento GraphRAG
    const graphContext = await graphRag.search("VantaDB memoria");
    expect(graphContext.seedNodes.length).toBeGreaterThan(0);
    expect(graphContext.contextSummary).toContain("Contexto de Conocimiento de Proyecto");
  });

  it("Gobierna el ciclo de vida de hechos en cuarentena y promoción atómica", async () => {
    const quarantine = new QuarantineManager(mockAdapter);
    const lifecycle = new FactLifecycle(mockAdapter);

    // 1. Depositar hecho en cuarentena
    const unverifiedFact = {
      id: "fact_test_01",
      subject: "Ego",
      predicate: "targets",
      object: "Desktop Electron",
      confidence: 0.55,
      temporalScope: "persistent" as const,
      source: "untrusted_web",
      validAt: Date.now(),
      invalidAt: null,
      supersededBy: null,
      state: "quarantined" as const,
    };

    await quarantine.quarantine(unverifiedFact, "unverified_external");
    const pending = await quarantine.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe("fact_test_01");

    // 2. Promover hecho a kb/facts
    const promoted = await lifecycle.promoteFromQuarantine("fact_test_01", {
      promotedBy: "reviewer",
    });
    expect(promoted.state).toBe("active");

    // Verificar que fue removido de cuarentena
    const remaining = await quarantine.listPending();
    expect(remaining.length).toBe(0);

    // Verificar que existe en kb/facts
    const inKb = await mockAdapter.get("kb/facts", "fact_test_01");
    expect(inKb).not.toBeNull();
  });

  it("Reconstruye el conocimiento histórico con BitemporalQueries AS OF", async () => {
    const bitemporal = new BitemporalQueries(mockAdapter);

    const now = 100000;
    // Hecho antiguo activo en t=50000 pero invalidado en t=75000
    await mockAdapter.put({
      namespace: "kb/facts",
      key: "fact_old",
      payload: "El framework era React 18",
      metadata: {
        fact_id: "fact_old",
        subject: "Framework",
        predicate: "version",
        object: "React 18",
        valid_at: 10000,
        invalid_at: 75000,
        temporal_scope: "persistent",
        source: "init",
        confidence: 0.9,
      },
    });

    // Hecho nuevo activo desde t=75000 en adelante
    await mockAdapter.put({
      namespace: "kb/facts",
      key: "fact_new",
      payload: "El framework es React 19",
      metadata: {
        fact_id: "fact_new",
        subject: "Framework",
        predicate: "version",
        object: "React 19",
        valid_at: 75000,
        invalid_at: -1,
        temporal_scope: "persistent",
        source: "upgrade",
        confidence: 0.95,
      },
    });

    // Consulta AS OF t=50000 -> Debe retornar React 18
    const pastFacts = await bitemporal.asOf(50000, { subject: "Framework" });
    expect(pastFacts.length).toBe(1);
    expect(pastFacts[0].object).toBe("React 18");

    // Consulta AS OF t=90000 -> Debe retornar React 19
    const presentFacts = await bitemporal.asOf(90000, { subject: "Framework" });
    expect(presentFacts.length).toBe(1);
    expect(presentFacts[0].object).toBe("React 19");
  });
});
