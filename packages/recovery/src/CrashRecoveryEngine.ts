import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventBus } from "@ego/events";
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

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Verifica la existencia de bloqueos previos, detecta Dirty Shutdown y adquiere el lockfile ego.lock.
   */
  public async checkAndAcquireLock(sessionId: string): Promise<DirtyShutdownReport> {
    this.currentSessionId = sessionId;
    const now = Date.now();

    if (fs.existsSync(this.lockFilePath)) {
      let previousRecord: LockFileRecord | null = null;
      try {
        const rawContent = fs.readFileSync(this.lockFilePath, "utf8");
        previousRecord = LockFileRecordSchema.parse(JSON.parse(rawContent));
      } catch {
        // Archivo corrupto o ilegible
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
        this.writeLockFile(sessionId, now);
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
    }

    // Arranque limpio estándar
    this.writeLockFile(sessionId, now);
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
   */
  public releaseLock(): void {
    this.stopHeartbeat();
    try {
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch {
      // Ignorar error de eliminación
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

  private writeLockFile(sessionId: string, timestamp: number): void {
    const record: LockFileRecord = {
      pid: process.pid,
      sessionId,
      startedAt: timestamp,
      lastHeartbeat: timestamp,
      version: "0.1.0",
      hostname: os.hostname(),
    };

    fs.writeFileSync(this.lockFilePath, JSON.stringify(record, null, 2), "utf8");
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

    const tmpPath = `${this.lockFilePath}.${process.pid}.tmp`;
    try {
      // "w+": en Windows, fsync sobre un fd de solo-lectura falla con EPERM.
      const handle = await fs.promises.open(tmpPath, "w+");
      try {
        await handle.writeFile(JSON.stringify(record, null, 2), "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.promises.rename(tmpPath, this.lockFilePath);
    } catch {
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
        // noop: mejor un temporal huérfano que un lock truncado
      }
    }
  }
}
