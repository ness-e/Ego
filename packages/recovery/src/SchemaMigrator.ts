import * as path from "node:path";
import { SchemaMigrationStep, RecoveryMemoryAdapter } from "./types.js";
import { SnapshotManager } from "./SnapshotManager.js";
import { ensureDir, pathExists, readTextFile, writeTextFileAtomic } from "./fsAsync.js";

export interface NamespacesConfig {
  schema_version: number;
  namespaces: Record<string, { description?: string; ttl_days?: number }>;
  migration_history?: Array<{
    fromVersion: number;
    toVersion: number;
    description: string;
    appliedAt: number;
  }>;
}

/**
 * SchemaMigrator — migraciones de esquema versionadas y aditivas.
 *
 * EGO-FIND-66 (T11): todo el I/O pasó a `fs/promises`. La versión del
 * esquema se publica de forma **atómica** (tmp + fsync + rename): antes, un
 * kill entre `writeFileSync` y `renameSync` dejaba el config a medias.
 */
export class SchemaMigrator {
  private readonly steps: SchemaMigrationStep[] = [];

  constructor(
    private readonly configPath: string,
    private readonly snapshotManager?: SnapshotManager,
    private readonly adapter?: RecoveryMemoryAdapter
  ) {}

  /**
   * Registra un paso de migración aditiva.
   */
  public registerStep(step: SchemaMigrationStep): void {
    this.steps.push(step);
    // Ordenar pasos por versión inicial
    this.steps.sort((a, b) => a.fromVersion - b.fromVersion);
  }

  /**
   * Obtiene la versión actual de esquema registrada en ego.namespaces.json.
   */
  public async getCurrentVersion(): Promise<number> {
    if (!(await pathExists(this.configPath))) {
      return 1;
    }

    try {
      const raw = await readTextFile(this.configPath);
      if (raw === null) return 1;
      const config = JSON.parse(raw) as Partial<NamespacesConfig>;
      return config.schema_version ?? 1;
    } catch (err: unknown) {
      console.warn(
        `[SchemaMigrator] No se pudo leer la versión del esquema: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return 1;
    }
  }

  /**
   * Ejecuta el pipeline de migraciones incrementales paso a paso de forma atómica y aditiva.
   * Crea un snapshot pre-migración para permitir rollback automático ante cualquier fallo.
   */
  public async migrate(targetVersion?: number): Promise<{
    previousVersion: number;
    newVersion: number;
    appliedSteps: number;
  }> {
    const currentVersion = await this.getCurrentVersion();
    const config = await this.loadOrCreateConfig();

    const maxRegisteredVersion = this.steps.reduce(
      (max, step) => Math.max(max, step.toVersion),
      currentVersion
    );
    const target = targetVersion ?? maxRegisteredVersion;

    if (currentVersion >= target) {
      return {
        previousVersion: currentVersion,
        newVersion: currentVersion,
        appliedSteps: 0,
      };
    }

    // Filtrar pasos aplicables en orden
    const pendingSteps = this.steps.filter(
      (s) => s.fromVersion >= currentVersion && s.toVersion <= target
    );

    if (pendingSteps.length === 0) {
      return {
        previousVersion: currentVersion,
        newVersion: currentVersion,
        appliedSteps: 0,
      };
    }

    // Crear snapshot pre-migración preventivo si existe snapshotManager
    let preMigrationSnapshotId: string | null = null;
    if (this.snapshotManager) {
      try {
        const snap = await this.snapshotManager.createSnapshot(
          "system-schema",
          "pre_migration"
        );
        preMigrationSnapshotId = snap.snapshotId;
      } catch (snapErr: unknown) {
        console.warn(
          "[SchemaMigrator] Advertencia: No se pudo generar snapshot pre-migración:",
          snapErr
        );
      }
    }

    let current = currentVersion;
    let appliedCount = 0;

    try {
      for (const step of pendingSteps) {
        if (step.fromVersion !== current) {
          throw new Error(
            `[SchemaMigrator] Discontinuidad en cadena de migración: esperado v${current}, recibido v${step.fromVersion}`
          );
        }

        // Ejecutar migración de datos si hay función
        if (typeof step.migrate === "function") {
          await step.migrate(this.adapter);
        }

        current = step.toVersion;
        appliedCount++;

        // Registrar en histórico
        if (!config.migration_history) {
          config.migration_history = [];
        }
        config.migration_history.push({
          fromVersion: step.fromVersion,
          toVersion: step.toVersion,
          description: step.description,
          appliedAt: Date.now(),
        });
      }

      // Persistir versión actualizada
      config.schema_version = current;
      await this.saveConfig(config);

      return {
        previousVersion: currentVersion,
        newVersion: current,
        appliedSteps: appliedCount,
      };
    } catch (migrationErr: unknown) {
      // Rollback automático usando snapshot si está disponible
      if (preMigrationSnapshotId && this.snapshotManager) {
        try {
          await this.snapshotManager.restoreSnapshot(preMigrationSnapshotId);
        } catch (rollbackErr: unknown) {
          console.error(
            "[SchemaMigrator] Error crítico al ejecutar rollback de snapshot:",
            rollbackErr
          );
        }
      }

      throw new Error(
        `[SchemaMigrator] Falló la migración de esquemas en paso hacia v${current + 1}: ${
          migrationErr instanceof Error ? migrationErr.message : String(migrationErr)
        }`
      );
    }
  }

  private async loadOrCreateConfig(): Promise<NamespacesConfig> {
    if (await pathExists(this.configPath)) {
      try {
        const raw = await readTextFile(this.configPath);
        if (raw !== null) {
          return JSON.parse(raw) as NamespacesConfig;
        }
      } catch (err: unknown) {
        console.warn(
          `[SchemaMigrator] Config de esquemas ilegible; se usa la config por defecto: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    return {
      schema_version: 1,
      namespaces: {
        core: { description: "Núcleo y sesiones activas" },
        knowledge: { description: "Documentos e índices" },
        tasks: { description: "Tareas en segundo plano" },
        gov: { description: "Gobernanza y aprobaciones" },
        domains: { description: "Dominios cognitivos" },
      },
      migration_history: [],
    };
  }

  private async saveConfig(config: NamespacesConfig): Promise<void> {
    const dir = path.dirname(this.configPath);
    await ensureDir(dir);

    // Publicación atómica (tmp + fsync + rename): la versión anterior del
    // esquema queda intacta si el proceso muere a mitad de la escritura.
    await writeTextFileAtomic(this.configPath, JSON.stringify(config, null, 2));
  }
}
