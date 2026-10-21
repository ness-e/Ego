import { createTempWorkspace } from "@ego/tools";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SchemaMigrator } from "../src/SchemaMigrator.js";
import { SnapshotManager } from "../src/SnapshotManager.js";

describe("SchemaMigrator", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = createTempWorkspace({ prefix: "ego-schema-test-" }).path;
    configPath = path.join(tmpDir, "ego.namespaces.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("aplica migraciones incrementales secuencialmente y actualiza schema_version", async () => {
    const executedSteps: string[] = [];
    const migrator = new SchemaMigrator(configPath);

    migrator.registerStep({
      fromVersion: 1,
      toVersion: 2,
      description: "Añadir namespace analytics",
      migrate: async () => {
        executedSteps.push("v1_to_v2");
      },
    });

    migrator.registerStep({
      fromVersion: 2,
      toVersion: 3,
      description: "Migrar formato de tags",
      migrate: async () => {
        executedSteps.push("v2_to_v3");
      },
    });

    const result = await migrator.migrate(3);
    expect(result.previousVersion).toBe(1);
    expect(result.newVersion).toBe(3);
    expect(result.appliedSteps).toBe(2);
    expect(executedSteps).toEqual(["v1_to_v2", "v2_to_v3"]);

    expect(await migrator.getCurrentVersion()).toBe(3);
    const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(savedConfig.schema_version).toBe(3);
    expect(savedConfig.migration_history.length).toBe(2);
  });

  it("no aplica pasos si ya se encuentra en la versión objetivo", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ schema_version: 2, namespaces: {} }), "utf8");
    const migrator = new SchemaMigrator(configPath);

    const result = await migrator.migrate(2);
    expect(result.appliedSteps).toBe(0);
    expect(result.newVersion).toBe(2);
  });

  it("ejecuta rollback a snapshot previo si un paso de migración falla", async () => {
    let rollbackExecuted = false;
    const mockSnapshotManager = {
      createSnapshot: async () => ({ snapshotId: "snap-pre-mig", filePath: "dummy" }),
      restoreSnapshot: async (id: string) => {
        if (id === "snap-pre-mig") rollbackExecuted = true;
      },
    } as unknown as SnapshotManager;

    const migrator = new SchemaMigrator(configPath, mockSnapshotManager);

    migrator.registerStep({
      fromVersion: 1,
      toVersion: 2,
      description: "Paso defectuoso",
      migrate: async () => {
        throw new Error("Simulated migration failure");
      },
    });

    await expect(migrator.migrate(2)).rejects.toThrow(/Simulated migration failure/);
    expect(rollbackExecuted).toBe(true);
    expect(await migrator.getCurrentVersion()).toBe(1);
  });
});