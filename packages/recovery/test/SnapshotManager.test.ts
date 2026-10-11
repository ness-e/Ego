import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SnapshotManager } from "../src/SnapshotManager.js";

describe("SnapshotManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-snapshot-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("crea snapshot local y lo registra en el catálogo", async () => {
    const mockAdapter = {
      getDb: () => ({ listNamespaces: async () => ["core"] }),
      list: async () => [{ key: "k1", payload: "data", metadata: {} }],
      putMulti: async () => {},
    };

    const manager = new SnapshotManager({ snapshotsDir: tmpDir, maxSnapshots: 3 }, mockAdapter);
    const snap = await manager.createSnapshot("proj-1", "pre_risk");

    expect(snap.snapshotId).toContain("pre_risk");
    expect(snap.projectId).toBe("proj-1");
    expect(fs.existsSync(snap.filePath)).toBe(true);

    const list = await manager.listSnapshots("proj-1");
    expect(list.length).toBe(1);
    expect(list[0].snapshotId).toBe(snap.snapshotId);
  });

  it("rota y elimina snapshots obsoletos cuando superan maxSnapshots", async () => {
    const mockAdapter = {
      getDb: () => ({ listNamespaces: async () => ["core"] }),
      list: async () => [],
      putMulti: async () => {},
    };

    const manager = new SnapshotManager({ snapshotsDir: tmpDir, maxSnapshots: 2 }, mockAdapter);

    const s1 = await manager.createSnapshot("proj-1", "manual");
    // Pequeño delay para diferenciar timestamps
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await manager.createSnapshot("proj-1", "manual");
    await new Promise((r) => setTimeout(r, 10));
    const s3 = await manager.createSnapshot("proj-1", "manual");

    const list = await manager.listSnapshots("proj-1");
    expect(list.length).toBe(2);
    // s1 debe haber sido eliminado del disco
    expect(fs.existsSync(s1.filePath)).toBe(false);
    expect(fs.existsSync(s2.filePath)).toBe(true);
    expect(fs.existsSync(s3.filePath)).toBe(true);
  });

  it("restaura un snapshot específico invocando el importador", async () => {
    const originalRecords = [{ key: "doc", payload: "restored content", metadata: {} }];
    const inserted: any[] = [];

    const mockAdapter = {
      getDb: () => ({ listNamespaces: async () => ["knowledge"] }),
      list: async () => originalRecords,
      putMulti: async (items: any[]) => {
        inserted.push(...items);
      },
    };

    const manager = new SnapshotManager({ snapshotsDir: tmpDir }, mockAdapter);
    const snap = await manager.createSnapshot("proj-restore", "pre_migration");

    const res = await manager.restoreSnapshot(snap.snapshotId);
    expect(res.success).toBe(true);
    expect(res.importedRecords).toBe(1);
    expect(inserted.length).toBe(1);
    expect(inserted[0].key).toBe("doc");
  });
});
