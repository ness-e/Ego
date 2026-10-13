import * as fs from "node:fs";
import * as path from "node:path";
import { SchemaMigrationStep, RecoveryMemoryAdapter } from "./types.js";
import { SnapshotManager } from "./SnapshotManager.js";

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
  public getCurrentVersion(): number {
    if (!fs.existsSync(this.configPath)) {
      return 1;
    }

    try {
      const raw = fs.readFileSync(this.configPath, "utf8");
      const config = JSON.parse(raw) as Partial<NamespacesConfig>;
      return config.schema_version ?? 1;
    } catch {
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
    const currentVersion = this.getCurrentVersion();
    const config = this.loadOrCreateConfig();

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
      } catch (snapErr) {
        console.warn("[SchemaMigrator] Advertencia: No se pudo generar snapshot pre-migración:", snapErr);
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
      this.saveConfig(config);

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
        } catch (rollbackErr) {
          console.error("[SchemaMigrator] Error crítico al ejecutar rollback de snapshot:", rollbackErr);
        }
      }

      throw new Error(
        `[SchemaMigrator] Falló la migración de esquemas en paso hacia v${current + 1}: ${
          migrationErr instanceof Error ? migrationErr.message : String(migrationErr)
        }`
      );
    }
  }

  private loadOrCreateConfig(): NamespacesConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, "utf8");
        return JSON.parse(raw);
      } catch {
        // fallback
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

  private saveConfig(config: NamespacesConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${this.configPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), "utf8");
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
    fs.renameSync(tempPath, this.configPath);
  }
}
