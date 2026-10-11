import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SnapshotManager } from "../../src/SnapshotManager.js";
import { ProjectExport } from "../../src/ProjectExport.js";
import { ProjectImport } from "../../src/ProjectImport.js";

describe("Durability Chaos (REC-09, FIND-246/248)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-durability-chaos-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("garantiza atomicidad en exportaciones interrumpidas sin corromper el snapshot previo", async () => {
    const memoryStore: Record<string, any[]> = {
      core: [{ key: "initial_state", payload: { step: 1 }, metadata: {} }],
    };

    const mockAdapter = {
      getDb: () => ({ listNamespaces: async () => ["core"] }),
      list: async (ns: string) => memoryStore[ns] || [],
      putMulti: async (items: any[]) => {
        for (const item of items) {
          memoryStore[item.namespace] = memoryStore[item.namespace] || [];
          memoryStore[item.namespace].push(item);
        }
      },
    };

    const snapshotsDir = path.join(tmpDir, "snapshots");
    const manager = new SnapshotManager({ snapshotsDir }, mockAdapter);

    // 1. Crear Snapshot Válido inicial (Golden state)
    const goldenSnapshot = await manager.createSnapshot("proj-chaos", "manual");
    expect(fs.existsSync(goldenSnapshot.filePath)).toBe(true);

    // 2. Simular exportación fallida / abortada abruptamente
    let callCount = 0;
    const failingAdapter = {
      getDb: () => ({ listNamespaces: async () => ["core", "fail_namespace"] }),
      list: async (ns: string) => {
        callCount++;
        if (ns === "fail_namespace") {
          throw new Error("I/O DISK INTERRUPTED (Chaos Injection FIND-246)");
        }
        return [{ key: "transient_data", payload: "data" }];
      },
    };

    const exporter = new ProjectExport(failingAdapter);
    const interruptedTarget = path.join(snapshotsDir, "interrupted_backup.vdbdump");

    await expect(
      exporter.exportProject({ outputPath: interruptedTarget })
    ).rejects.toThrow(/I\/O DISK INTERRUPTED/);

    // 3. El archivo destino final NO debe haber sido creado a medias
    expect(fs.existsSync(interruptedTarget)).toBe(false);
    expect(fs.existsSync(`${interruptedTarget}.tmp`)).toBe(false);

    // 4. Restauración del Golden Snapshot previo debe funcionar limpiamente
    const restoreResult = await manager.restoreSnapshot(goldenSnapshot.snapshotId);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.importedRecords).toBe(1);
    expect(memoryStore.core.some((r) => r.key === "initial_state")).toBe(true);
  });

  it("protege contra importaciones de volcados truncados (FIND-248)", async () => {
    const truncatedDumpPath = path.join(tmpDir, "truncated.vdbdump");

    // Escribir solo una cabecera rota sin datos
    fs.writeFileSync(truncatedDumpPath, "INVALID_OR_TRUNCATED_BYTES", "utf8");

    const importer = new ProjectImport({});
    await expect(
      importer.importProject({ inputPath: truncatedDumpPath })
    ).rejects.toThrow();

    // Comprobar que no queda ningún lock huérfano
    expect(fs.existsSync(path.join(tmpDir, "ego.import.lock"))).toBe(false);
  });
});
