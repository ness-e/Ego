import { describe, it, expect, vi } from "vitest";
import {
  KnowledgeExport,
  canonicalExportChecksum,
  type ExportPackage,
} from "../src/KnowledgeExport.js";
import type { EgoMemoryAdapter } from "@ego/memory";

/**
 * F2T5 Slice 3 (M14) — KnowledgeExport: checksum canónico + streaming por lotes.
 *
 * - El checksum debe ser insensible al orden (claves ordenadas + registros
 *   ordenados por namespace:key): dos exports del mismo contenido en distinto
 *   orden producen el mismo digest, y reordenar `pkg.records` no rompe import.
 * - `importPackage` debe escribir por lotes (`putMulti` acotados + `flush`)
 *   en vez de N puts secuenciales en RAM.
 * - El borde de importación normaliza (unwrap) metadata tagged legacy para
 *   no corromper las claves auditadas que `putMulti` normaliza.
 */

function makeRecords(n: number, reverse = false): ExportPackage["records"] {
  const recs: ExportPackage["records"] = [];
  for (let i = 0; i < n; i++) {
    recs.push({
      namespace: i % 2 === 0 ? "kb/facts" : "kb/docs",
      key: `rec_${String(i).padStart(4, "0")}`,
      payload: `contenido ${i}`,
      metadata: { idx: i, flag: i % 2 === 0 },
    });
  }
  return reverse ? [...recs].reverse() : recs;
}

function mockExportAdapter(records: ExportPackage["records"]) {
  return {
    list: vi.fn(async (_namespace: string, limit: number) => {
      const all = records.filter((r) => r.namespace === _namespace);
      return all.slice(0, limit).map((r) => ({
        key: r.key,
        payload: r.payload,
        metadata: r.metadata,
      }));
    }),
  } as unknown as EgoMemoryAdapter;
}

function mockImportAdapter() {
  const adapter = {
    put: vi.fn(async () => undefined),
    putMulti: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
  } as unknown as EgoMemoryAdapter;
  return adapter;
}

describe("F2T5 Slice 3 (M14) — KnowledgeExport canónico + lotes", () => {
  it("dos exports del mismo contenido en distinto orden producen el mismo checksum", async () => {
    const exporterA = new KnowledgeExport(mockExportAdapter(makeRecords(6)));
    const exporterB = new KnowledgeExport(mockExportAdapter(makeRecords(6, true)));

    const pkgA = await exporterA.exportPackage("proj");
    const pkgB = await exporterB.exportPackage("proj");

    expect(pkgA.totalRecords).toBe(6);
    expect(pkgB.totalRecords).toBe(6);
    expect(pkgA.checksum).toBe(pkgB.checksum);
    expect(pkgA.checksum).toMatch(/^[0-9a-f]{64}$/);

    // Registros ordenados por namespace:key (determinismo).
    const order = pkgA.records.map((r) => `${r.namespace}:${r.key}`);
    expect(order).toEqual([...order].sort());
  });

  it("import tolera records reordenados (verificación canónica)", async () => {
    const exporter = new KnowledgeExport(mockExportAdapter(makeRecords(4)));
    const pkg = await exporter.exportPackage("proj");

    const shuffled: ExportPackage = {
      ...pkg,
      records: [...pkg.records].reverse(),
    };

    const importer = new KnowledgeExport(mockImportAdapter());
    const res = await importer.importPackage(shuffled);
    expect(res.imported).toBe(4);
  });

  it("import escribe por lotes acotados con putMulti + flush", async () => {
    const adapter = mockImportAdapter();
    // Sin put: si la implementación usara puts secuenciales, lanzaría.
    delete (adapter as unknown as Record<string, unknown>)["put"];

    const exporter = new KnowledgeExport(mockExportAdapter(makeRecords(250)));
    const pkg = await exporter.exportPackage("proj");
    expect(pkg.totalRecords).toBe(250);

    const importer = new KnowledgeExport(adapter);
    const res = await importer.importPackage(pkg);
    expect(res.imported).toBe(250);

    const putMulti = vi.mocked(
      (adapter as unknown as { putMulti: (...args: unknown[]) => Promise<void> }).putMulti
    );
    // Lotes de 200: 200 + 50.
    expect(putMulti).toHaveBeenCalledTimes(2);
    expect((putMulti.mock.calls[0][0] as unknown[])).toHaveLength(200);
    expect((putMulti.mock.calls[1][0] as unknown[])).toHaveLength(50);

    const flush = vi.mocked(
      (adapter as unknown as { flush: () => Promise<void> }).flush
    );
    expect(flush).toHaveBeenCalled();
  });

  it("import normaliza metadata tagged legacy a primitivas", async () => {
    const adapter = mockImportAdapter();
    const taggedRecords: ExportPackage["records"] = [
      {
        namespace: "kb/facts",
        key: "legacy_norm_1",
        payload: "Dato legacy",
        metadata: {
          subject: { String: "Arquitectura" },
          confidence: { Float: 0.9 },
          verified: { Bool: true },
        },
      },
    ];
    // Checksum canónico sobre el shape tal cual (el import lo verifica igual).
    const legacyPkg: ExportPackage = {
      version: "1.0.0",
      projectId: "legacy",
      exportedAt: 1000,
      checksum: canonicalExportChecksum(taggedRecords),
      totalRecords: 1,
      records: taggedRecords,
    };

    const importer = new KnowledgeExport(adapter);
    const res = await importer.importPackage(legacyPkg);
    expect(res.imported).toBe(1);

    const putMulti = vi.mocked(
      (adapter as unknown as { putMulti: (...args: unknown[]) => Promise<void> }).putMulti
    );
    expect(putMulti).toHaveBeenCalledTimes(1);
    const written = putMulti.mock.calls[0][0] as Array<{
      metadata?: Record<string, unknown>;
    }>;
    expect(written[0].metadata?.["subject"]).toBe("Arquitectura");
    expect(written[0].metadata?.["confidence"]).toBe(0.9);
    expect(written[0].metadata?.["verified"]).toBe(true);
  });
});
