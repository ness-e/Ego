import { createTempWorkspace } from "@ego/tools";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ProjectExport } from "../src/ProjectExport.js";
import { ProjectImport } from "../src/ProjectImport.js";

describe("ProjectImport", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempWorkspace({ prefix: "ego-import-test-" }).path;
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("importa y restaura registros desde un .vdbdump comprimido", async () => {
    const originalData = [
      { key: "item_1", payload: { name: "Valor 1" }, metadata: {} },
      { key: "item_2", payload: { name: "Valor 2" }, metadata: {} },
    ];

    const sourceAdapter = {
      getDb: () => ({
        listNamespaces: async () => ["core"],
      }),
      list: async () => originalData,
    };

    const dumpPath = path.join(tmpDir, "export.vdbdump");
    const exporter = new ProjectExport(sourceAdapter);
    await exporter.exportProject({ outputPath: dumpPath });

    const inserted: any[] = [];
    const targetAdapter = {
      putMulti: async (items: any[]) => {
        inserted.push(...items);
      },
    };

    const importer = new ProjectImport(targetAdapter);
    const result = await importer.importProject({ inputPath: dumpPath });

    expect(result.success).toBe(true);
    expect(result.importedRecords).toBe(2);
    expect(result.namespacesRestored).toEqual(["core"]);
    expect(inserted.length).toBe(2);
    expect(inserted[0].key).toBe("item_1");
    expect(inserted[1].key).toBe("item_2");

    // Verificar que el lockfile de importación fue liberado
    expect(fs.existsSync(path.join(tmpDir, "ego.import.lock"))).toBe(false);
  });

  it("aborta la importación si se detecta corrupción de checksum SHA-256", async () => {
    const dumpPath = path.join(tmpDir, "corrupted.ndjson");
    // Crear export sin compresión para manipular fácilmente el contenido
    const exporter = new ProjectExport({
      getDb: () => ({ listNamespaces: async () => ["core"] }),
      list: async () => [{ key: "original", payload: "ok", metadata: {} }],
    });
    await exporter.exportProject({ outputPath: dumpPath, compress: false });

    // Modificar un byte del archivo para simular corrupción
    const content = fs.readFileSync(dumpPath, "utf8");
    const lines = content.trim().split("\n");
    // Modificar el registro alterando el payload
    const tampered = JSON.parse(lines[1]);
    tampered.payload = "TAMPERED_CONTENT";
    lines[1] = JSON.stringify(tampered);
    fs.writeFileSync(dumpPath, lines.join("\n"), "utf8");

    const targetAdapter = {
      putMulti: async () => {},
    };

    const importer = new ProjectImport(targetAdapter);
    await expect(importer.importProject({ inputPath: dumpPath, verifyChecksums: true })).rejects.toThrow(
      /Corrupción detectada/
    );

    // Lockfile liberado incluso tras error
    expect(fs.existsSync(path.join(tmpDir, "ego.import.lock"))).toBe(false);
  });

  it("bloquea la importación si otro proceso tiene un lock activo", async () => {
    const dumpPath = path.join(tmpDir, "dummy.vdbdump");
    fs.writeFileSync(dumpPath, "fake", "utf8");

    const lockPath = path.join(tmpDir, "ego.import.lock");
    fs.writeFileSync(lockPath, "locked", "utf8");

    const importer = new ProjectImport({});
    await expect(importer.importProject({ inputPath: dumpPath })).rejects.toThrow(/ego.import.lock activo/);
  });
});