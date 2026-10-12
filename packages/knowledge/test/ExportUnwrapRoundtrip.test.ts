import { describe, it, expect, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import {
  KnowledgeExport,
  canonicalExportChecksum,
  type ExportPackage,
} from "../src/KnowledgeExport.js";

/**
 * C03-list Task 5 — round-trip de KnowledgeExport con shape desenvuelto.
 *
 * `KnowledgeExport.exportPackage` lista vía cursor con metadata desenvuelta
 * (primitivas, no objetos tagged {String}/{Float}/{Bool}). Este test prueba
 * con adaptadores reales que export→import conserva el checksum y los
 * registros íntegros, y que los dumps legacy (tagged) siguen siendo
 * importables y se normalizan en el borde de importación (F2T5/M14).
 *
 * Fixtures con patrón VDB-BUG-04: metadata plana (números/strings/bools) +
 * anidado serializado como string JSON (`*_json`).
 */
describe("C03-list Task 5 — round-trip KnowledgeExport con shape desenvuelto (integración real)", () => {
  const opened: Array<{ dir: string; adapter: EgoMemoryAdapter }> = [];

  async function newAdapter(): Promise<{ dir: string; adapter: EgoMemoryAdapter }> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-c03-export-rt-"));
    const adapter = new EgoMemoryAdapter(dir);
    await adapter.init();
    opened.push({ dir, adapter });
    return { dir, adapter };
  }

  afterEach(async () => {
    while (opened.length > 0) {
      const entry = opened.pop();
      if (entry === undefined) break;
      if (entry.adapter.ready) {
        await entry.adapter.close();
      }
      try {
        await fs.rm(entry.dir, { recursive: true, force: true });
      } catch {
        // Ignorar bloqueos de Windows
      }
    }
  });

  function sha256(records: ExportPackage["records"]): string {
    // F2T5/M14: checksum canónico (registros ordenados + claves ordenadas).
    return canonicalExportChecksum(records);
  }

  function sortedByKey(records: ExportPackage["records"]): ExportPackage["records"] {
    return [...records].sort((a, b) =>
      `${a.namespace}:${a.key}`.localeCompare(`${b.namespace}:${b.key}`)
    );
  }

  async function seedFixtures(adapter: EgoMemoryAdapter): Promise<void> {
    await adapter.put({
      namespace: "kb/facts",
      key: "rt_fact_1",
      payload: "Arquitectura usa VantaDB",
      metadata: {
        fact_id: "rt_fact_1",
        subject: "Arquitectura",
        predicate: "usa",
        object: "VantaDB",
        confidence: 0.92,
        verified: true,
        valid_at: 1000,
        invalid_at: -1,
        tags_json: JSON.stringify(["persistente", "infraestructura"]),
      },
    });
    await adapter.put({
      namespace: "kb/docs",
      key: "rt_doc_1",
      payload: "Guia de despliegue del nodo local",
      metadata: {
        doc_id: "rt_doc_1",
        title: "Guia de despliegue",
        chunk_index: 3,
        archived: false,
        heading_path_json: JSON.stringify(["Capitulo 1", "Seccion A"]),
      },
    });
  }

  it("round-trip export→import conserva checksum SHA-256 y registros íntegros", async () => {
    const { adapter: src } = await newAdapter();
    const { dir: dstDir, adapter: dst } = await newAdapter();
    await seedFixtures(src);

    // Exporta a archivo (vía adapter.list desenvuelto) e importa en otro adapter.
    const exporterSrc = new KnowledgeExport(src);
    const filePath = path.join(dstDir, "kb-export.json");
    const pkg = await exporterSrc.exportPackage("proj-export-rt", filePath);

    expect(pkg.totalRecords).toBe(2);
    expect(pkg.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(pkg.checksum).toBe(sha256(pkg.records));

    // Shape desenvuelto en el paquete: primitivas, no objetos tagged.
    const factRec = pkg.records.find((r) => r.key === "rt_fact_1");
    expect(factRec).toBeDefined();
    expect(typeof factRec?.metadata?.["confidence"]).toBe("number");
    expect(factRec?.metadata?.["confidence"]).toBe(0.92);
    expect(typeof factRec?.metadata?.["verified"]).toBe("boolean");
    expect(factRec?.metadata?.["verified"]).toBe(true);
    expect(typeof factRec?.metadata?.["valid_at"]).toBe("number");
    expect(typeof factRec?.metadata?.["subject"]).toBe("string");
    expect(JSON.parse(String(factRec?.metadata?.["tags_json"]))).toEqual([
      "persistente",
      "infraestructura",
    ]);
    const docRec = pkg.records.find((r) => r.key === "rt_doc_1");
    expect(typeof docRec?.metadata?.["chunk_index"]).toBe("number");
    expect(typeof docRec?.metadata?.["archived"]).toBe("boolean");
    expect(JSON.parse(String(docRec?.metadata?.["heading_path_json"]))).toEqual([
      "Capitulo 1",
      "Seccion A",
    ]);

    // Import desde archivo: checksum OK (no lanza) e imported == totalRecords.
    const exporterDst = new KnowledgeExport(dst);
    const importRes = await exporterDst.importPackage(filePath);
    expect(importRes.imported).toBe(2);

    // Lectura en destino: valores reales, no fallbacks ni tagged.
    const dstFacts = await dst.list("kb/facts", 10);
    const dstFact = dstFacts.find((r) => r.key === "rt_fact_1");
    expect(dstFact?.metadata?.["confidence"]).toBe(0.92);
    expect(dstFact?.metadata?.["verified"]).toBe(true);
    expect(dstFact?.metadata?.["subject"]).toBe("Arquitectura");
    expect(dstFact?.payload).toBe("Arquitectura usa VantaDB");

    // Re-export del destino: checksum idéntico y registros deep-equal.
    const rePkg = await exporterDst.exportPackage("proj-export-rt");
    expect(rePkg.totalRecords).toBe(2);
    expect(rePkg.checksum).toBe(pkg.checksum);
    expect(sortedByKey(rePkg.records)).toEqual(sortedByKey(pkg.records));
  });

  it("dump legacy con metadata tagged: importable, se normaliza al re-exportar (migración)", async () => {
    // Paquete tal como lo generaba el export pre-C03-list (metadata tagged),
    // con checksum autoconsistente sobre ese shape.
    const legacyRecords: ExportPackage["records"] = [
      {
        namespace: "kb/facts",
        key: "legacy_1",
        payload: "Dato legacy",
        metadata: {
          subject: { String: "Arquitectura" },
          confidence: { Float: 0.9 },
          verified: { Bool: true },
          valid_at: { Float: 1000 },
        },
      },
    ];
    const legacyPkg: ExportPackage = {
      version: "1.0.0",
      projectId: "legacy",
      exportedAt: 1000,
      checksum: sha256(legacyRecords),
      totalRecords: legacyRecords.length,
      records: legacyRecords,
    };

    const { adapter: dst } = await newAdapter();
    const exporterDst = new KnowledgeExport(dst);

    // El dump legacy sigue siendo importable: su checksum es autoconsistente.
    const importRes = await exporterDst.importPackage(legacyPkg);
    expect(importRes.imported).toBe(1);

    // La lectura parcial se autocorrige vía unwrap para claves no auditadas…
    const listed = await dst.list("kb/facts", 10);
    const rec = listed.find((r) => r.key === "legacy_1");
    expect(rec?.metadata?.["subject"]).toBe("Arquitectura");
    expect(rec?.metadata?.["verified"]).toBe(true);
    expect(rec?.metadata?.["valid_at"]).toBe(1000);
    expect(typeof rec?.metadata?.["valid_at"]).toBe("number");

    // F2T5/M14: el borde de importación normaliza (unwrap) la metadata tagged
    // ANTES del `put`, donde la normalización de auditoría de `putMulti` ya
    // solo acepta primitivas. Las claves auditadas conservan sus valores
    // reales (`confidence` 0.9, no el default 1.0 de la corrupción previa).
    expect(rec?.metadata?.["confidence"]).toBe(0.9);
    expect(typeof rec?.metadata?.["confidence"]).toBe("number");

    // Migración: al re-exportar, el shape ya está normalizado (primitivas).
    // El checksum del re-export difiere del legacy solo por la canonicalización
    // (claves ordenadas): los checksums pre/post F2T5 no son comparables
    // byte a byte, pero el contenido semántico se preserva íntegro.
    const rePkg = await exporterDst.exportPackage("legacy");
    expect(rePkg.totalRecords).toBe(1);
    expect(typeof rePkg.records[0].metadata?.["confidence"]).toBe("number");
    expect(rePkg.records[0].metadata?.["confidence"]).toBe(0.9);
    expect(rePkg.checksum).not.toBe(legacyPkg.checksum);
  });
});
