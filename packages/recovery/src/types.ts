import { z } from "zod";

/**
 * Esquema de datos para el lockfile de exclusión mutua y heartbeat de Ego (ego.lock).
 */
export const LockFileRecordSchema = z.object({
  pid: z.number(),
  sessionId: z.string(),
  startedAt: z.number(),
  lastHeartbeat: z.number(),
  version: z.string().default("0.1.0"),
  hostname: z.string().optional(),
});

export type LockFileRecord = z.infer<typeof LockFileRecordSchema>;

/**
 * Reporte de diagnóstico del motor de recuperación ante caídas.
 */
export const DirtyShutdownReportSchema = z.object({
  wasDirty: z.boolean(),
  previousPid: z.number().optional(),
  previousSessionId: z.string().optional(),
  lastHeartbeat: z.number().optional(),
  recoveryAction: z.enum([
    "clean_start",
    "lock_released_orphan",
    "wal_snapshot_created",
    "stale_lock_purged",
    "concurrent_instance_detected",
    // Ola 1b T4: el lock existe pero es ilegible/truncado ⇒ hubo una
    // instancia previa que murió a mitad de escritura (hard kill).
    "corrupt_lock_purged",
  ]),
  timestamp: z.number(),
  details: z.string().optional(),
});

export type DirtyShutdownReport = z.infer<typeof DirtyShutdownReportSchema>;

/**
 * Opciones para la barrera de durabilidad OpGate.
 */
export interface OpGateOptions {
  drainTimeoutMs?: number;
}

/**
 * Estado actual de la barrera de durabilidad OpGate.
 */
export interface OpGateStatus {
  isDraining: boolean;
  inFlightCount: number;
}

/**
 * Esquema canónico para el manifiesto de cabecera de exportación soberana .vdbdump.
 */
export const VdbdumpManifestSchema = z.object({
  format: z.literal("VDBJSON-V1"),
  projectId: z.string(),
  projectName: z.string().default("default-project"),
  createdAt: z.number(),
  version: z.string().default("0.1.0"),
  namespaces: z.array(z.string()),
  recordCounts: z.record(z.string(), z.number()),
  checksums: z.record(z.string(), z.string()),
  totalChecksum: z.string(),
  totalRecords: z.number(),
});

export type VdbdumpManifest = z.infer<typeof VdbdumpManifestSchema>;

/**
 * Registro unitario volcado en NDJSON para cada ítem de memoria.
 */
export const DumpRecordSchema = z.object({
  namespace: z.string(),
  key: z.string(),
  payload: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DumpRecord = z.infer<typeof DumpRecordSchema>;

/**
 * Opciones de configuración para la exportación de proyectos a .vdbdump.
 */
export interface ProjectExportOptions {
  outputPath: string;
  projectId?: string;
  projectName?: string;
  namespaces?: string[];
  compress?: boolean;
}

/**
 * Resultado formal de una exportación de proyecto.
 */
export interface ProjectExportResult {
  outputPath: string;
  manifest: VdbdumpManifest;
  bytesWritten: number;
  totalRecords: number;
  durationMs: number;
}

/**
 * Opciones de importación y restauración desde un archivo .vdbdump.
 */
export interface ProjectImportOptions {
  inputPath: string;
  targetProjectId?: string;
  overwrite?: boolean;
  verifyChecksums?: boolean;
  batchSize?: number;
}

/**
 * Resultado de una importación de proyecto.
 */
export interface ProjectImportResult {
  success: boolean;
  manifest: VdbdumpManifest;
  importedRecords: number;
  namespacesRestored: string[];
  durationMs: number;
  /**
   * DSEK-04: resultado de la migración de esquema de la configuración de
   * namespaces tras la restauración. `null` si no se inyectó un migrador.
   */
  schemaMigration?: {
    previousVersion: number;
    newVersion: number;
    appliedSteps: number;
  } | null;
}

/**
 * Esquema para metadatos de un snapshot local.
 */
export const SnapshotRecordSchema = z.object({
  snapshotId: z.string(),
  projectId: z.string(),
  reason: z.enum(["scheduled", "pre_risk", "manual", "pre_migration"]),
  timestamp: z.number(),
  filePath: z.string(),
  sizeBytes: z.number(),
  totalRecords: z.number(),
});

export type SnapshotRecord = z.infer<typeof SnapshotRecordSchema>;

/**
 * Opciones para el gestor de snapshots locales.
 */
export interface SnapshotManagerOptions {
  snapshotsDir: string;
  maxSnapshots?: number;
}

/**
 * Registro de memoria tal como lo expone el gateway (`EgoMemoryAdapter`).
 */
export interface RecoveryMemoryRecord {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Página de listado con cursor opaco (compatible con `listPaged()`).
 */
export interface RecoveryListPage {
  records: RecoveryMemoryRecord[];
  nextCursor?: number | string;
}

/**
 * Superficie mínima del adapter de memoria que necesita `recovery` (H20).
 * Prohíbe `any`: lecturas vía `list` (+ `listPaged` cuando existe para
 * barridos acotados), escrituras vía `put`/`putMulti`, namespaces vía
 * `getDb()`. `getDb()` es solo-lectura (F2T6/H04): jamás escribir por esa vía.
 */
export interface RecoveryMemoryAdapter {
  list(namespace: string, limit?: number): Promise<RecoveryMemoryRecord[]>;
  listPaged?(
    namespace: string,
    limit?: number,
    cursor?: number | string
  ): Promise<RecoveryListPage>;
  put(item: {
    namespace: string;
    key: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  putMulti?(
    items: Array<{
      namespace: string;
      key: string;
      payload: unknown;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void>;
  getDb?(): { listNamespaces?: () => Promise<string[]> } | null;
}

/**
 * Paso de migración de esquema declarativo.
 */
export interface SchemaMigrationStep {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (adapter: RecoveryMemoryAdapter | undefined) => Promise<void>;
}

/**
 * Registro de entrada de log diagnóstico.
 */
export interface DiagnosticsLogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error" | "critical";
  category: string;
  message: string;
  details?: unknown;
}

/**
 * Paquete consolidado de diagnóstico local.
 */
export interface DiagnosticsBundle {
  exportedAt: number;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    egoVersion: string;
  };
  recentLogs: DiagnosticsLogEntry[];
  lockStatus: LockFileRecord | null;
  dirtyShutdownHistory: DirtyShutdownReport[];
}
