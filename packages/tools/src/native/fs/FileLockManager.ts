import fs from "node:fs";
import path from "node:path";
import { getErrorParts } from "../../error-parts.js";

export interface FileLockOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
  staleTimeoutMs?: number;
}

/**
 * Gestor de exclusión mutua basada en lockfiles para evitar carreras concurrentes en filesystem.
 * **Implementación propia de Ego** (patrón asimilado de Career-Ops · CARP-02
 * / `pipeline-lock.mjs`): el gestor de lockfiles con detección de locks
 * caducos es propio. Sin atribución de código derivado.
 *
 * EGO-FIND-66 (Ola 1 / A3 / T11): todo el I/O pasó a `fs/promises`. Este
 * lockfile está en el path de escritura (`fs_write_file`), es decir, en un
 * path de IPC: el I/O síncrono bloqueaba el event loop del proceso main.
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
        await fs.promises.mkdir(dir, { recursive: true });

        // Bandera 'wx': falla inmediatamente si el archivo ya existe (atómico)
        const content = JSON.stringify({
          pid: process.pid,
          timestamp: Date.now(),
        });

        await fs.promises.writeFile(lockPath, content, { flag: "wx" });
        return; // Lock adquirido exitosamente
      } catch (err: unknown) {
        if (getErrorParts(err).code === "EEXIST") {
          // El lock ya existe. Verificar si es stale (huérfano/zombie)
          if (await this.isLockStale(lockPath, staleTimeout)) {
            try {
              await fs.promises.unlink(lockPath);
              continue; // Reintentar inmediatamente tras limpiar stale lock
            } catch (cleanupErr: unknown) {
              console.warn(
                `[FileLockManager] No se pudo limpiar el lock stale '${lockPath}': ${
                  cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
                }`
              );
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
      await fs.promises.unlink(lockPath);
    } catch (err: unknown) {
      const code = getErrorParts(err).code;
      if (code !== "ENOENT") {
        console.warn(
          `[FileLockManager] No se pudo liberar el lock '${lockPath}': ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  /**
   * Determina si existe un lockfile activo para la ruta especificada.
   */
  public static async isLocked(targetFilePath: string): Promise<boolean> {
    const lockPath = `${targetFilePath}.ego.lock`;
    try {
      await fs.promises.access(lockPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determina si un lockfile pertenece a un proceso caído o expiró su tiempo de vida máximo.
   */
  private static async isLockStale(lockPath: string, staleTimeoutMs: number): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(lockPath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs > staleTimeoutMs) {
        return true;
      }

      // Leer PID para verificar si sigue vivo
      const raw = await fs.promises.readFile(lockPath, "utf-8");
      const data = JSON.parse(raw) as { pid?: unknown };
      if (data.pid && typeof data.pid === "number") {
        try {
          process.kill(data.pid, 0); // Señal 0 verifica existencia del proceso sin matarlo
          return false; // El proceso sigue vivo
        } catch {
          return true; // Proceso no existe -> lock stale
        }
      }
    } catch (err: unknown) {
      console.warn(
        `[FileLockManager] No se pudo evaluar el lock '${lockPath}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return true;
    }
    return false;
  }
}
