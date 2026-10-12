import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import { KnowledgeDomain } from "../src/knowledge/KnowledgeDomain.js";

describe("KnowledgeDomain (DOM-03)", () => {
  let domain: KnowledgeDomain;

  beforeEach(() => {
    domain = new KnowledgeDomain();
  });

  it("debe registrar y recuperar hechos con nivel de confianza y verificación", async () => {
    const fact = await domain.addFact({
      claim: "VantaDB 0.8.0 utiliza motor LSM Fjall embebido in-process",
      source: "AGENTS.md:14",
      confidence: 0.95,
      tags: ["vantadb", "storage", "lsm"],
    });

    expect(fact.id).toBeDefined();
    expect(fact.claim).toContain("VantaDB 0.8.0");
    expect(fact.verified).toBe(true);

    const retrieved = await domain.getFact(fact.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.source).toBe("AGENTS.md:14");
  });

  it("debe buscar hechos por palabra clave y filtrar por confianza mínima", async () => {
    await domain.addFact({
      claim: "Electron Context Isolation debe ser estricto",
      source: "security.md",
      confidence: 0.9,
      tags: ["security"],
    });

    await domain.addFact({
      claim: "Hipótesis no validada de rendimiento",
      source: "scratch.md",
      confidence: 0.4,
      tags: ["draft"],
    });

    const highConfidenceMatches = await domain.searchKnowledge("electron", {
      minConfidence: 0.8,
    });
    expect(highConfidenceMatches.length).toBe(1);
    expect(highConfidenceMatches[0].claim).toContain("Context Isolation");

    const draftMatches = await domain.searchKnowledge("rendimiento", {
      minConfidence: 0.3,
    });
    expect(draftMatches.length).toBe(1);
  });

  it("debe sintetizar una bibliografía estructurada con métricas de confianza", async () => {
    const f1 = await domain.addFact({
      claim: "Fast path opera en modo BM25 léxico",
      source: "doc-1.md",
      confidence: 0.9,
    });
    const f2 = await domain.addFact({
      claim: "vantadb-mcp maneja ONNX densamente en subprocess",
      source: "doc-2.md",
      confidence: 0.8,
    });

    const synthesis = await domain.synthesizeBibliography("Arquitectura de Búsqueda", [
      f1.id,
      f2.id,
    ]);

    expect(synthesis.topic).toBe("Arquitectura de Búsqueda");
    expect(synthesis.citedFacts.length).toBe(2);
    expect(synthesis.sourcesCount).toBe(2);
    expect(synthesis.averageConfidence).toBe(0.85);
    expect(synthesis.summary).toContain("2 hechos verificados");
  });

  it("debe generar un vecindario de grafo conceptual para la vista GraphRAG", async () => {
    const view = await domain.getGraphNeighborhood("ent_vantadb");
    expect(view.centerEntityId).toBe("ent_vantadb");
    expect(view.nodes.length).toBeGreaterThan(0);
    expect(view.edges.length).toBeGreaterThan(0);
  });

  describe("F2T4 cold-reboot (H06/H07)", () => {
    let dir: string;
    let adapter: EgoMemoryAdapter | undefined;

    afterEach(async () => {
      if (adapter?.ready) await adapter.close();
      adapter = undefined;
      if (dir) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignorar bloqueos de Windows
        }
      }
    });

    async function freshAdapter(storagePath: string): Promise<EgoMemoryAdapter> {
      const a = new EgoMemoryAdapter(storagePath);
      await a.init();
      return a;
    }

    it("rehidrata hechos tras reinicio con el mismo storage (Fact canónico)", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-kb-"));
      adapter = await freshAdapter(dir);
      const d1 = new KnowledgeDomain({ memory: adapter });
      const f1 = await d1.addFact({ claim: "Cold reboot preserva hechos", source: "f2t4.md", tags: ["persist"] });
      await adapter.flush();
      await adapter.close();

      adapter = await freshAdapter(dir);
      const d2 = new KnowledgeDomain({ memory: adapter });
      // get por clave lee VantaDB aunque el snapshot esté vacío (H07 fallback)
      expect((await d2.getFact(f1.id))?.claim).toBe("Cold reboot preserva hechos");
      const report = await d2.hydrate();
      expect(report.loaded).toBe(1);
      expect(report.migratedLegacy).toBe(0);

      const view = await d2.getFact(f1.id);
      expect(view?.claim).toBe("Cold reboot preserva hechos");
      expect(view?.tags).toEqual(["persist"]);
      const hits = await d2.searchKnowledge("reboot");
      expect(hits.length).toBe(1);
    });

    it("persiste metadata tipada compatible con KnowledgeIndexer (H06)", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-kbmeta-"));
      adapter = await freshAdapter(dir);
      const d1 = new KnowledgeDomain({ memory: adapter });
      const f = await d1.addFact({ claim: "Metadata facts", source: "s.md", confidence: 0.9 });

      const rec = await adapter.get("kb/facts", f.id);
      expect(rec).not.toBeNull();
      const meta = rec?.metadata as Record<string, unknown>;
      expect(meta["subject"]).toBe("knowledge");
      expect(meta["predicate"]).toBe("states");
      expect(meta["object"]).toBe("Metadata facts");
      expect(meta["confidence"]).toBe(0.9);
      expect(meta["state"]).toBe("active");
      expect(meta["temporal_scope"]).toBe("persistent");
    });

    it("tolera y migra hechos legacy con shape propio (INV-PROBLEMA)", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-kblegacy-"));
      adapter = await freshAdapter(dir);
      const now = new Date().toISOString();
      await adapter.put({
        namespace: "kb/facts",
        key: "fact_legacy_1",
        payload: {
          id: "fact_legacy_1",
          claim: "Hecho viejo pre-F2T4",
          source: "legacy.md",
          confidence: 0.7,
          tags: ["viejo"],
          verified: false,
          createdAt: now,
          updatedAt: now,
        },
      });

      const d2 = new KnowledgeDomain({ memory: adapter });
      const report = await d2.hydrate();
      expect(report.loaded).toBe(1);
      expect(report.migratedLegacy).toBe(1);

      const view = await d2.getFact("fact_legacy_1");
      expect(view?.claim).toBe("Hecho viejo pre-F2T4");
      expect(view?.tags).toEqual(["viejo"]);
    });

    it("rehidrata resúmenes estilo KnowledgeIndexer (payload string + metadata)", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-kbidx-"));
      adapter = await freshAdapter(dir);
      await adapter.put({
        namespace: "kb/facts",
        key: "fact_idx_1",
        payload: "Ego uses_editor VSCode",
        metadata: {
          fact_id: "fact_idx_1",
          subject: "Ego",
          predicate: "uses_editor",
          object: "VSCode",
          confidence: 0.95,
          temporal_scope: "persistent",
          source: "doc.md",
          valid_at: Date.now(),
          state: "active",
        },
      });

      const d2 = new KnowledgeDomain({ memory: adapter });
      await d2.hydrate();
      const view = await d2.getFact("fact_idx_1");
      expect(view?.claim).toBe("Ego uses_editor VSCode");
      expect(view?.confidence).toBe(0.95);
    });
  });
});
