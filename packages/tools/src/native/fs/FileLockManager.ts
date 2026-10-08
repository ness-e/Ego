import fs from "node:fs";
import path from "node:path";

export interface FileLockOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
  staleTimeoutMs?: number;
}

/**
 * Gestor de exclusión mutua basada en lockfiles para evitar carreras concurrentes en filesystem.
 * Patrón Career-Ops CARP-02 (pipeline-lock.mjs).
 */
export class FileLockManager {
  private static readonly DEFAULT_TIMEOUT_MS = 5000;
  private static readonly DEFAULT_RETRY_INTERVAL_MS = 50;
  private static readonly DEFAULT_STALE_TIMEOUT_MS = 30000;

  /**
   * Ejecuta una acción dentro de un bloqueo exclusivo de archivo.
   * Libera el bloqueo de forma garantizada al finalizar (incluso ante errores).
   */
  public static async withLock<T>(
    targetFilePath: string,
    action: () => Promise<T>,
    options: FileLockOptions = {}
  ): Promise<T> {
    const lockPath = `${targetFilePath}.ego.lock`;
    await this.acquireLock(lockPath, options);

    try {
      return await action();
    } finally {
      await this.releaseLock(lockPath);
    }
  }

  /**
   * Intenta adquirir el lock con reintentos y backoff hasta timeout.
   */
  public static async acquireLock(lockPath: string, options: FileLockOptions = {}): Promise<void> {
    const timeout = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const retryInterval = options.retryIntervalMs ?? this.DEFAULT_RETRY_INTERVAL_MS;
    const staleTimeout = options.staleTimeoutMs ?? this.DEFAULT_STALE_TIMEOUT_MS;

    const startTime = Date.now();
    let currentInterval = retryInterval;

    while (Date.now() - startTime < timeout) {
      try {
        // Asegurar que el directorio padre existe
        const dir = path.dirname(lockPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Bandera 'wx': falla inmediatamente si el archivo ya existe (atómico)
        const content = JSON.stringify({
          pid: process.pid,
          timestamp: Date.now(),
        });

        fs.writeFileSync(lockPath, content, { flag: "wx" });
        return; // Lock adquirido exitosamente
      } catch (err: any) {
        if (err.code === "EEXIST") {
          // El lock ya existe. Verificar si es stale (huérfano/zombie)
          if (this.isLockStale(lockPath, staleTimeout)) {
            try {
              fs.unlinkSync(lockPath);
              continue; // Reintentar inmediatamente tras limpiar stale lock
            } catch {
              // Otra instancia pudo haberlo eliminado
            }
          }

          // Esperar con backoff ligero antes de reintentar
          await new Promise((r) => setTimeout(r, currentInterval));
          currentInterval = Math.min(currentInterval * 1.5, 500);
        } else {
          throw err;
        }
      }
    }

    throw new Error(
      `Timeout (${timeout}ms) esperando liberación de lock en: '${lockPath}' (concurrencia bloqueada)`
    );
  }

  /**
   * Libera el archivo lock.
   */
  public static async releaseLock(lockPath: string): Promise<void> {
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // Ignorar si ya fue removido
    }
  }

  /**
   * Determina si existe un archivo de bloqueo activo para la ruta especificada.
   */
  public static isLocked(targetFilePath: string): boolean {
    const lockPath = `${targetFilePath}.ego.lock`;
    return fs.existsSync(lockPath);
  }

  /**
   * Determina si un lockfile pertenece a un proceso caído o expiró su tiempo de vida máximo.
   */
  private static isLockStale(lockPath: string, staleTimeoutMs: number): boolean {
    try {
      const stats = fs.statSync(lockPath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs > staleTimeoutMs) {
        return true;
      }

      // Intentar leer PID para verificar si sigue vivo
      const data = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
      if (data.pid && typeof data.pid === "number") {
        try {
          process.kill(data.pid, 0); // Señal 0 verifica existencia del proceso sin matarlo
          return false; // El proceso sigue vivo
        } catch {
          return true; // Proceso no existe -> lock stale
        }
      }
    } catch {
      return true;
    }
    return false;
  }
}
