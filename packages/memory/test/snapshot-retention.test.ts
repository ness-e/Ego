import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pruneSnapshotDumps } from "../SnapshotRetention.js";

async function touch(file: string, mtimeMs: number): Promise<void> {
  await fs.writeFile(file, "VDBJSON\n");
  await fs.utimes(file, new Date(mtimeMs), new Date(mtimeMs));
}

describe("pruneSnapshotDumps (CFG-08)", () => {
  const NOW = Date.now();
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "snap-ret-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("rechaza maxSnapshots inválido", async () => {
    await expect(pruneSnapshotDumps(dir, { maxSnapshots: 0 })).rejects.toThrow();
  });

  it("directorio inexistente → reporte vacío sin lanzar", async () => {
    const report = await pruneSnapshotDumps(path.join(dir, "no-existe"));
    expect(report.kept).toEqual([]);
    expect(report.pruned).toEqual([]);
  });

  it("poda a max_snapshots conservando los más recientes", async () => {
    for (let i = 0; i < 55; i++) {
      await touch(path.join(dir, `ego_backup_${i}.vdbdump`), NOW - (55 - i) * 1000);
    }
    // Archivo no-dump: nunca se toca.
    await fs.writeFile(path.join(dir, "nota.txt"), "hola");

    const report = await pruneSnapshotDumps(dir, { maxSnapshots: 50 });

    expect(report.kept).toHaveLength(50);
    expect(report.pruned).toHaveLength(5);
    expect(report.activePreserved).toBe(true);
    const remaining = await fs.readdir(dir);
    expect(remaining).toHaveLength(51); // 50 dumps + nota.txt
    expect(remaining).toContain("nota.txt");
    // Los 5 más antiguos fueron podados.
    for (let i = 0; i < 5; i++) {
      expect(remaining).not.toContain(`ego_backup_${i}.vdbdump`);
    }
    expect(remaining).toContain("ego_backup_54.vdbdump");
  });

  it("nunca pierde el snapshot activo aunque sea el más antiguo", async () => {
    for (let i = 0; i < 55; i++) {
      await touch(path.join(dir, `ego_backup_${i}.vdbdump`), NOW - (55 - i) * 1000);
    }
    const active = path.join(dir, "ego_backup_0.vdbdump"); // el más antiguo

    const report = await pruneSnapshotDumps(dir, { maxSnapshots: 50, activePath: active });

    expect(report.activePreserved).toBe(true);
    expect(report.kept).toContain(active);
    expect(report.pruned).not.toContain(active);
    await expect(fs.stat(active)).resolves.toBeDefined();
    const remaining = (await fs.readdir(dir)).filter((f) => f.endsWith(".vdbdump"));
    expect(remaining).toHaveLength(50);
    expect(remaining).toContain("ego_backup_0.vdbdump");
  });

  it("con menos dumps que el tope no poda nada", async () => {
    await touch(path.join(dir, "a.vdbdump"), NOW);
    const report = await pruneSnapshotDumps(dir, { maxSnapshots: 50 });
    expect(report.kept).toHaveLength(1);
    expect(report.pruned).toEqual([]);
  });
});
