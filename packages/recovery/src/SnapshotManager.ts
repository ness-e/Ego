import * as fs from "node:fs";
import * as path from "node:path";
import {
  SnapshotManagerOptions,
  SnapshotRecord,
  SnapshotRecordSchema,
  ProjectImportResult,
} from "./types.js";
import { ProjectExport } from "./ProjectExport.js";
import { ProjectImport } from "./ProjectImport.js";

export class SnapshotManager {
  private readonly snapshotsDir: string;
  private readonly maxSnapshots: number;
  private readonly indexPath: string;

  constructor(
    options: SnapshotManagerOptions,
    private readonly adapter: any
  ) {
    this.snapshotsDir = options.snapshotsDir;
    this.maxSnapshots = options.maxSnapshots ?? 7;
    this.indexPath = path.join(this.snapshotsDir, "snapshots.json");

    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  /**
   * Crea un nuevo snapshot local comprimido del proyecto.
   * Aplica rotación automática conservando como máximo maxSnapshots.
   */
  public async createSnapshot(
    projectId: string,
    reason: "scheduled" | "pre_risk" | "manual" | "pre_migration" = "scheduled"
  ): Promise<SnapshotRecord> {
    const timestamp = Date.now();
    const snapshotId = `snap_${timestamp}_${reason}`;
    const filePath = path.join(this.snapshotsDir, `${snapshotId}.vdbdump`);

    const exporter = new ProjectExport(this.adapter);
    const exportResult = await exporter.exportProject({
      outputPath: filePath,
      projectId,
      compress: true,
    });

    const record: SnapshotRecord = {
      snapshotId,
      projectId,
      reason,
      timestamp,
      filePath,
      sizeBytes: exportResult.bytesWritten,
      totalRecords: exportResult.totalRecords,
    };

    // Actualizar índice de snapshots
    const index = this.readIndex();
    index.push(record);
    this.writeIndex(index);

    // Rotar snapshots antiguos
    await this.pruneOldSnapshots();

    return record;
  }

  /**
   * Lista todos los snapshots locales disponibles, ordenados por fecha descendente.
   */
  public async listSnapshots(projectId?: string): Promise<SnapshotRecord[]> {
    const index = this.readIndex();
    const filtered = projectId ? index.filter((s) => s.projectId === projectId) : index;
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Restaura el estado de la base de datos a partir de un snapshot local específico.
   */
  public async restoreSnapshot(snapshotId: string): Promise<ProjectImportResult> {
    const index = this.readIndex();
    const snapshot = index.find((s) => s.snapshotId === snapshotId);

    if (!snapshot) {
      throw new Error(`[SnapshotManager] No se encontró el snapshot con ID: ${snapshotId}`);
    }

    if (!fs.existsSync(snapshot.filePath)) {
      throw new Error(`[SnapshotManager] El archivo físico del snapshot no existe: ${snapshot.filePath}`);
    }

    const importer = new ProjectImport(this.adapter);
    return await importer.importProject({
      inputPath: snapshot.filePath,
      verifyChecksums: true,
    });
  }

  /**
   * Poda y elimina snapshots antiguos excedentes que superen maxSnapshots.
   */
  public async pruneOldSnapshots(): Promise<number> {
    let index = this.readIndex();
    if (index.length <= this.maxSnapshots) {
      return 0;
    }

    // Ordenar de más reciente a más antiguo
    index.sort((a, b) => b.timestamp - a.timestamp);

    const toKeep = index.slice(0, this.maxSnapshots);
    const toDelete = index.slice(this.maxSnapshots);

    for (const snap of toDelete) {
      try {
        if (fs.existsSync(snap.filePath)) {
          fs.unlinkSync(snap.filePath);
        }
      } catch (err) {
        console.warn(`[SnapshotManager] No se pudo eliminar snapshot obsoleto ${snap.filePath}:`, err);
      }
    }

    this.writeIndex(toKeep);
    return toDelete.length;
  }

  private readIndex(): SnapshotRecord[] {
    if (!fs.existsSync(this.indexPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.indexPath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.filter((item) => {
          const parsed = SnapshotRecordSchema.safeParse(item);
          return parsed.success;
        });
      }
    } catch {
      // noop
    }

    return [];
  }

  private writeIndex(records: SnapshotRecord[]): void {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(records, null, 2), "utf8");
    } catch (err) {
      console.warn("[SnapshotManager] Error al escribir snapshots.json:", err);
    }
  }
}
