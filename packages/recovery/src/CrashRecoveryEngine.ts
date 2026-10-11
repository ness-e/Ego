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
      if (this.currentSessionId) {
        try {
          this.updateHeartbeat(Date.now());
        } catch {
          // Ignorar fallo de I/O en heartbeat temporal
        }
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
    } catch (err: any) {
      return err.code === "EPERM"; // EPERM significa que el proceso existe pero es de otro usuario
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

  private updateHeartbeat(timestamp: number): void {
    if (!fs.existsSync(this.lockFilePath)) return;

    try {
      const raw = fs.readFileSync(this.lockFilePath, "utf8");
      const record = JSON.parse(raw) as LockFileRecord;
      record.lastHeartbeat = timestamp;
      fs.writeFileSync(this.lockFilePath, JSON.stringify(record, null, 2), "utf8");
    } catch {
      // noop
    }
  }
}
