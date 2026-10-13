import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as zlib from "node:zlib";
import { ProjectExport } from "../src/ProjectExport.js";

describe("ProjectExport", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-export-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("exporta un proyecto en .vdbdump comprimido con cabecera VDBJSON-V1 y SHA-256", async () => {
    const mockData: Record<string, any[]> = {
      core: [
        { key: "session_1", payload: { title: "Sesion 1" }, metadata: { agent: "nucleus" } },
        { key: "session_2", payload: { title: "Sesion 2" }, metadata: { agent: "nucleus" } },
      ],
      knowledge: [
        { key: "doc_1", payload: "Texto de documento", metadata: { source: "manual" } },
      ],
    };

    const mockAdapter = {
      getDb: () => ({
        listNamespaces: async () => ["core", "knowledge"],
      }),
      list: async (ns: string) => mockData[ns] || [],
    };

    const exporter = new ProjectExport(mockAdapter);
    const dumpPath = path.join(tmpDir, "backup.vdbdump");

    const result = await exporter.exportProject({
      outputPath: dumpPath,
      projectId: "proj-123",
      projectName: "Mi Proyecto",
      compress: true,
    });

    expect(fs.existsSync(dumpPath)).toBe(true);
    expect(result.totalRecords).toBe(3);
    expect(result.manifest.format).toBe("VDBJSON-V1");
    expect(result.manifest.projectId).toBe("proj-123");
    expect(result.manifest.namespaces).toEqual(["core", "knowledge"]);
    expect(result.manifest.recordCounts.core).toBe(2);
    expect(result.manifest.recordCounts.knowledge).toBe(1);
    expect(typeof result.manifest.totalChecksum).toBe("string");
    expect(result.manifest.totalChecksum.length).toBe(64);

    // Verificar que se puede descomprimir y que la cabecera es válida
    const compressedBuffer = fs.readFileSync(dumpPath);
    const decompressed = zlib.gunzipSync(compressedBuffer).toString("utf8");
    const lines = decompressed.trim().split("\n");

    expect(lines.length).toBe(4); // 1 manifiesto + 3 registros
    const parsedManifest = JSON.parse(lines[0]);
    expect(parsedManifest.format).toBe("VDBJSON-V1");

    const rec1 = JSON.parse(lines[1]);
    expect(rec1.namespace).toBe("core");
    expect(rec1.key).toBe("session_1");
  });

  it("exporta en texto plano sin compresión si compress: false", async () => {    const mockAdapter = {
      getDb: () => ({
        listNamespaces: async () => ["tasks"],
      }),
      list: async () => [
        { key: "task_a", payload: { goal: "Meta A" }, metadata: {} },
      ],
    };

    const exporter = new ProjectExport(mockAdapter);
    const dumpPath = path.join(tmpDir, "backup.ndjson");

    const result = await exporter.exportProject({
      outputPath: dumpPath,
      compress: false,
    });

    expect(result.totalRecords).toBe(1);
    const rawContent = fs.readFileSync(dumpPath, "utf8");
    const lines = rawContent.trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).format).toBe("VDBJSON-V1");
  });

  it("pagina con listPaged por cursor en vez de cargar 50k de golpe (H20)", async () => {
    const TOTAL = 1200;
    const all = Array.from({ length: TOTAL }, (_, i) => ({
      key: `k_${i}`,
      payload: { n: i },
      metadata: {},
    }));
    const listPagedCalls: Array<{ ns: string; limit: number; cursor?: number | string }> = [];
    const mockAdapter = {
      getDb: () => ({ listNamespaces: async () => ["bulk"] }),
      listPaged: async (ns: string, limit: number, cursor?: number | string) => {
        listPagedCalls.push({ ns, limit, cursor });
        const start = typeof cursor === "number" ? cursor : 0;
        const slice = all.slice(start, start + limit);
        return {
          records: slice,
          nextCursor: start + limit < all.length ? start + limit : undefined,
        };
      },
    };

    const exporter = new ProjectExport(mockAdapter);
    const dumpPath = path.join(tmpDir, "bulk.vdbdump");
    const result = await exporter.exportProject({ outputPath: dumpPath, compress: false });

    // Paginó en varias páginas acotadas (nunca un list(ns, 50000))
    expect(listPagedCalls.length).toBeGreaterThan(1);
    expect(listPagedCalls.every((c) => c.limit <= 500)).toBe(true);
    expect(result.totalRecords).toBe(TOTAL);

    const rawContent = fs.readFileSync(dumpPath, "utf8");
    expect(rawContent.trim().split("\n")).toHaveLength(TOTAL + 1);
  });

  it("round-trip: lo exportado con paginación se reimporta íntegro", async () => {
    const TOTAL = 350;
    const all = Array.from({ length: TOTAL }, (_, i) => ({
      key: `k_${i}`,
      payload: { n: i },
      metadata: {},
    }));
    const mockAdapter = {
      getDb: () => ({ listNamespaces: async () => ["bulk"] }),
      listPaged: async (_ns: string, limit: number, cursor?: number | string) => {
        const start = typeof cursor === "number" ? cursor : 0;
        const slice = all.slice(start, start + limit);
        return {
          records: slice,
          nextCursor: start + limit < all.length ? start + limit : undefined,
        };
      },
      putMulti: async () => {},
    };

    const exporter = new ProjectExport(mockAdapter);
    const dumpPath = path.join(tmpDir, "rt.vdbdump");
    await exporter.exportProject({ outputPath: dumpPath, compress: true });

    const { ProjectImport } = await import("../src/ProjectImport.js");
    const importer = new ProjectImport(mockAdapter);
    const res = await importer.importProject({ inputPath: dumpPath, verifyChecksums: true });
    expect(res.success).toBe(true);
    expect(res.importedRecords).toBe(TOTAL);
  });
});
