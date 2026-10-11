export type SupervisorMode =
  | "electron"
  | "windows-scheduled-task"
  | "systemd"
  | "pm2"
  | "unmanaged";

export interface ProcessSupervisorConfig {
  autoCatchFatal?: boolean;
  onCrashSnapshot?: (error: unknown) => Promise<void>;
}

/**
 * Supervisor de proceso y tolerancia a fallos ante caídas del runtime (OCLW-13).
 * Extraído y adaptado de OpenClaw src/infra/process-respawn.ts y entry.respawn.ts.
 *
 * Evita bloqueos de descriptores de archivos de VantaDB (FjallError: Locked)
 * ante excepciones no controladas y coordina el reinicio limpio del proceso Main.
 */
export class ProcessSupervisor {
  private readonly cleanups = new Set<() => Promise<void>>();
  private isShuttingDown = false;

  constructor(private readonly config: ProcessSupervisorConfig = {}) {
    if (config.autoCatchFatal) {
      this.attachGlobalHandlers();
    }
  }

  /**
   * Detecta el entorno de supervisión bajo el cual está corriendo el proceso.
   */
  public static detectSupervisorMode(): SupervisorMode {
    if (process.versions?.electron) {
      return "electron";
    }
    if (process.env.PM2_HOME || process.env.pm_id !== undefined) {
      return "pm2";
    }
    if (process.env.INVOCATION_ID || process.env.JOURNAL_STREAM) {
      return "systemd";
    }
    if (process.env.EGO_WIN_TASK_SUPERVISED) {
      return "windows-scheduled-task";
    }
    return "unmanaged";
  }

  /**
   * Registra una función de limpieza obligatoria antes de que el proceso muera (ej. vdb.close()).
   */
  public registerCleanup(handler: () => Promise<void>): () => void {
    this.cleanups.add(handler);
    return () => this.cleanups.delete(handler);
  }

  /**
   * Ejecuta el protocolo de cierre de emergencia ante una excepción fatal.
   */
  public async handleFatalError(error: unknown): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // 1. Guardar snapshot de crash si hay hook registrado
    if (this.config.onCrashSnapshot) {
      try {
        await this.config.onCrashSnapshot(error);
      } catch {
        // Ignorar fallo en snapshot secundario
      }
    }

    // 2. Ejecutar cleanups registrados (cierre seguro de VantaDB / locks)
    for (const cleanup of this.cleanups) {
      try {
        await cleanup();
      } catch {
        // Ignorar fallo en cleanup individual
      }
    }
  }

  /**
   * Adjunta escuchadores globales para capturar excepciones no manejadas.
   */
  private attachGlobalHandlers(): void {
    process.on("uncaughtException", async (err) => {
      await this.handleFatalError(err);
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason) => {
      await this.handleFatalError(reason);
      process.exit(1);
    });
  }
}
