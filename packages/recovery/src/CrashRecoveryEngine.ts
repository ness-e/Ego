import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventBus } from "@ego/events";
import { StorageHealthLatch } from "./StorageHealthLatch.js";
import {
  LockFileRecord,
  LockFileRecordSchema,
  DirtyShutdownReport,
} from "./types.js";

export interface CrashRecoveryEngineOptions {
  storageDir: string;
  heartbeatIntervalMs?: number;
  staleThresholdMs?: number;
  eventBus?: EventBus;
}

export class CrashRecoveryEngine {
  private readonly storageDir: string;
  private readonly lockFilePath: string;
  private readonly heartbeatIntervalMs: number;
  private readonly staleThresholdMs: number;
  private readonly eventBus?: EventBus;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentSessionId: string | null = null;
  private isHeartbeatRunning = false;
  private activeHeartbeatPromise: Promise<void> | null = null;

  constructor(options: CrashRecoveryEngineOptions) {
    this.storageDir = options.storageDir;
    this.lockFilePath = path.join(this.storageDir, "ego.lock");
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 2000;
    this.staleThresholdMs = options.staleThresholdMs ?? 10000;
    this.eventBus = options.eventBus;
  }

  /**
   * Publica un contenido de forma ATÓMICA: escribe en un temporal con el PID
   * en el nombre, hace `fsync` y publica con `rename` (atómico en POSIX y
   * NTFS). Si algo falla, limpia el temporal y deja el destino intacto.
   *
   * EGO-FIND-66 (T11): el heartbeat ya usaba esta secuencia, pero la escritura
   * INICIAL del lock seguía con `writeFileSync` (no atómico) → un kill en ese
   * instante dejaba `ego.lock` truncado y provocaba el flake "Unexpected end
   * of JSON input" del test de caos.
   */
  private async writeAtomic(targetPath: string, content: string): Promise<void> {
    const tmpPath = `${targetPath}.${process.pid}.tmp`;
    try {
      // "w+": en Windows, fsync sobre un fd de solo-lectura falla con EPERM.
      const handle = await fs.promises.open(tmpPath, "w+");
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.promises.rename(tmpPath, targetPath);
    } catch (err: unknown) {
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
        // noop: mejor un temporal huérfano que un lock truncado
      }
      throw err;
    }
  }

  /**
   * Audita el directorio de almacenamiento y degrada con **aviso visible**
   * en vez de fallar en silencio (HERM-15, A5-S8).
   *
   * `StorageHealthLatch` implementaba el diagnóstico de salud del
   * almacenamiento (bloqueo de descriptores de Fjall, corrupción estructural)
   * pero no tenía caller: era código asimilado sin cablear. Aquí se conecta
   * al punto de arranque del motor de recuperación, que es donde un
   * almacenamiento inservible debe hacerse visible ANTES de que los Sub-Egos
   * intenten escribir a ciegas.
   */
  public async auditStorage(): Promise<{ ok: boolean; reason?: string }> {
    const verdict = await StorageHealthLatch.auditStorageDirectory(this.storageDir);
    if (verdict.ok) {
      return verdict;
    }

    StorageHealthLatch.markStorageState(
      this.storageDir,
      "corrupt",
      verdict.reason ?? "Almacenamiento inservible"
    );

    this.eventBus?.emit(
      "system.alert",
      {
        code: "RECOVERY_STORAGE_UNHEALTHY",
        message:
          `El almacenamiento '${this.storageDir}' no está en condiciones: ${
            verdict.reason ?? "motivo desconocido"
          }. Ego degradará a modo de solo lectura hasta que se resuelva.`,
        details: {
          storageDir: this.storageDir,
          reason: verdict.reason,
        },
      },
      {
        source: "CrashRecoveryEngine",
        severity: "error",
      }
    );

    return verdict;
  }

  /**
   * Verifica la existencia de bloqueos previos, detecta Dirty Shutdown y adquiere el lockfile ego.lock.
   */
  public async checkAndAcquireLock(sessionId: string): Promise<DirtyShutdownReport> {
    this.currentSessionId = sessionId;
    const now = Date.now();

    // Auditoría de salud del almacenamiento (HERM-15): visible desde el arranque.
    await this.auditStorage();

    if (await this.lockFileExists()) {
      let previousRecord: LockFileRecord | null = null;
      let corruptReason: string | undefined;

      try {
        const rawContent = await fs.promises.readFile(this.lockFilePath, "utf8");
        previousRecord = LockFileRecordSchema.parse(JSON.parse(rawContent));
      } catch (err: unknown) {
        // El lock existe pero NO es parseable (JSON truncado o esquema
        // inválido).
        //
        // EGO-FIND-66 / Ola 1b T4: esto es EL indicio de un hard kill (una
        // escritura no atómica interrumpida deja el lock a medias). Antes se
        // caía al "arranque limpio": el dirty shutdown se perdía en silencio
        // y el lock huérfano se quedaba en disco.
        //
        // Fail-closed: si hay lock en disco, hubo una instancia previa. Se
        // informa como dirty shutdown y se purga.
        corruptReason =
          err instanceof Error ? err.message : "contenido ilegible o esquema inválido";
      }

      if (previousRecord) {
        const isProcessAlive = this.isProcessRunning(previousRecord.pid);
        const timeSinceHeartbeat = now - previousRecord.lastHeartbeat;

        if (isProcessAlive && timeSinceHeartbeat < this.staleThresholdMs && previousRecord.pid !== process.pid) {
          throw new Error(`[CrashRecoveryEngine] CONCURRENT_INSTANCE_DETECTED: Instancia activa detectada con PID ${previousRecord.pid}.`);
        }

        // Si el proceso murió abruptamente o el heartbeat expiró, es un Dirty Shutdown
        const report: DirtyShutdownReport = {
          wasDirty: true,
          previousPid: previousRecord.pid,
          previousSessionId: previousRecord.sessionId,
          lastHeartbeat: previousRecord.lastHeartbeat,
          recoveryAction: "stale_lock_purged",
          timestamp: now,
          details: `Dirty shutdown detectado. PID previo ${previousRecord.pid} inerte o heartbeat expirado hace ${timeSinceHeartbeat}ms.`,
        };

        // Purgar lockfiles huérfanos
        await this.writeLockFile(sessionId, now);
        this.startHeartbeat();

        this.eventBus?.emit("system.alert", {
          code: "RECOVERY_DIRTY_SHUTDOWN",
          message: `Dirty shutdown detectado. PID previo ${previousRecord.pid} inerte o heartbeat expirado.`,
          details: {
            previousPid: previousRecord.pid,
            timeSinceHeartbeat,
          },
        }, {
          source: "CrashRecoveryEngine",
          severity: "warn",
          sessionId,
        });

        return report;
      }

      // Lock corrupto/tornado: hubo una instancia previa que murió a mitad de
      // escritura. Es un dirty shutdown (no un arranque limpio).
      const corruptReport: DirtyShutdownReport = {
        wasDirty: true,
        recoveryAction: "corrupt_lock_purged",
        timestamp: now,
        details:
          `Lockfile corrupto o truncado (indicio de cierre abrupto): ${corruptReason}. ` +
          `Se purga y se continúa con un lock nuevo.`,
      };

      await this.writeLockFile(sessionId, now);
      this.startHeartbeat();

      this.eventBus?.emit("system.alert", {
        code: "RECOVERY_CORRUPT_LOCK",
        message: `Lockfile corrupto detectado (posible cierre abrupto previo): ${corruptReason}`,
        details: {
          lockFilePath: this.lockFilePath,
          reason: corruptReason,
        },
      }, {
        source: "CrashRecoveryEngine",
        severity: "warn",
        sessionId,
      });

      return corruptReport;
    }

    // Arranque limpio estándar
    await this.writeLockFile(sessionId, now);
    this.startHeartbeat();

    const cleanReport: DirtyShutdownReport = {
      wasDirty: false,
      recoveryAction: "clean_start",
      timestamp: now,
      details: "Arranque limpio sin cierres pendientes.",
    };

    this.eventBus?.emit("system.alert", {
      code: "RECOVERY_LOCK_ACQUIRED",
      message: `Bloqueo adquirido limpiamente por PID ${process.pid}`,
      details: {
        pid: process.pid,
        sessionId,
      },
    }, {
      source: "CrashRecoveryEngine",
      severity: "info",
      sessionId,
    });

    return cleanReport;
  }

  /**
   * Inicia el latido periódico (Heartbeat) escribiendo timestamp activo en ego.lock.
   */
  public startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.currentSessionId && !this.isHeartbeatRunning) {
        this.isHeartbeatRunning = true;
        this.activeHeartbeatPromise = this.updateHeartbeat(Date.now())
          .catch(() => {
            // Ignorar fallo de I/O en heartbeat temporal
          })
          .finally(() => {
            this.isHeartbeatRunning = false;
            this.activeHeartbeatPromise = null;
          });
      }
    }, this.heartbeatIntervalMs);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Detiene el timer de heartbeat.
   */
  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Espera a que termine cualquier latido I/O en vuelo y detiene el heartbeat.
   */
  public async stopHeartbeatAsync(): Promise<void> {
    this.stopHeartbeat();
    if (this.activeHeartbeatPromise) {
      try {
        await this.activeHeartbeatPromise;
      } catch {
        // noop
      }
    }
  }

  /**
   * Libera limpiamente el lockfile de Ego al cerrar la aplicación de forma ordenada.
   *
   * Variante síncrona conservada por compatibilidad (se invoca UNA vez al
   * cerrar la app; no es un path caliente de IPC). La variante async
   * `releaseLockAsync()` es la recomendada en el proceso main.
   */
  public releaseLock(): void {
    this.stopHeartbeat();
    try {
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch (err: unknown) {
      console.warn(
        `[CrashRecoveryEngine] No se pudo liberar el lockfile: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Variante asíncrona de `releaseLock` (sin I/O síncrono).
   */
  public async releaseLockAsync(): Promise<void> {
    this.stopHeartbeat();
    try {
      if (await this.lockFileExists()) {
        await fs.promises.unlink(this.lockFilePath);
      }
    } catch (err: unknown) {
      console.warn(
        `[CrashRecoveryEngine] No se pudo liberar el lockfile: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * `true` si el lockfile existe (async, sin I/O síncrono).
   */
  private async lockFileExists(): Promise<boolean> {
    try {
      await fs.promises.access(this.lockFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Comprueba si un PID de proceso sigue vivo en el sistema operativo.
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // process.kill(pid, 0) no mata el proceso, verifica si existe y si tenemos permiso
      process.kill(pid, 0);
      return true;
    } catch (err: unknown) {
      // EPERM significa que el proceso existe pero es de otro usuario
      return (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: unknown }).code === "EPERM"
      );
    }
  }

  private async writeLockFile(sessionId: string, timestamp: number): Promise<void> {
    const record: LockFileRecord = {
      pid: process.pid,
      sessionId,
      startedAt: timestamp,
      lastHeartbeat: timestamp,
      version: "0.1.0",
      hostname: os.hostname(),
    };

    // EGO-FIND-66 (T11): escritura ATÓMICA (tmp + fsync + rename), la misma
    // secuencia que usa el heartbeat. Antes era `writeFileSync` (no atómico).
    await fs.promises.mkdir(this.storageDir, { recursive: true });
    await this.writeAtomic(this.lockFilePath, JSON.stringify(record, null, 2));
  }

  /**
   * L12: latido atómico. El read-modify-write directo sobre `ego.lock` podía
   * dejar escrituras truncadas ante dos instancias o un kill en el instante
   * preciso. Ahora: valida schema (no pisa corrupción ajena), escribe a un
   * temporal con el PID en el nombre, hace `fsync` y publica con `rename`
   * (atómico en POSIX y NTFS), limpiando el temporal ante cualquier fallo.
   */
  private async updateHeartbeat(timestamp: number): Promise<void> {
    let raw: string;
    try {
      raw = await fs.promises.readFile(this.lockFilePath, "utf8");
    } catch {
      return; // Lock liberado entre tanto; nada que latir
    }

    let record: LockFileRecord;
    try {
      record = LockFileRecordSchema.parse(JSON.parse(raw));
    } catch {
      return; // Contenido ajeno o corrupto: no pisarlo desde el heartbeat
    }
    record.lastHeartbeat = timestamp;

    // Misma secuencia atómica que `writeLockFile` (EGO-FIND-66, T11).
    await this.writeAtomic(this.lockFilePath, JSON.stringify(record, null, 2));
  }
}
