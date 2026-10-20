import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  DiagnosticsLogEntry,
  DiagnosticsBundle,
  LockFileRecord,
  DirtyShutdownReport,
} from "./types.js";
import { ensureDir, pathExists, readTextFile, removeIfExists } from "./fsAsync.js";

export interface DiagnosticsLoggerOptions {
  logsDir: string;
  maxFileSizeBytes?: number; // default: 5MB
  maxFiles?: number; // default: 3
}

/**
 * DiagnosticsLogger — log estructurado con saneamiento de secretos.
 *
 * EGO-FIND-66 (T11): el I/O pasó de síncrono a asíncrono. `log()` conserva su
 * firma síncrona (devuelve la entrada saneada) pero encola la escritura en
 * una cadena de promesas: el path caliente de logging NO bloquea el event loop
 * del main. `readRecentLogs` y `exportDiagnosticsBundle` son async.
 */
export class DiagnosticsLogger {
  private readonly logsDir: string;
  private readonly currentLogPath: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private readonly dirtyShutdownHistory: DirtyShutdownReport[] = [];
  /**
   * Cola de escrituras: serializa los appends para no perder líneas y
   * garantiza el orden.
   */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: DiagnosticsLoggerOptions) {
    this.logsDir = options.logsDir;
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 5 * 1024 * 1024; // 5MB
    this.maxFiles = options.maxFiles ?? 3;
    this.currentLogPath = path.join(this.logsDir, "ego.diagnostics.log");
  }

  /**
   * Registra una entrada de log estructurado aplicando saneamiento estricto de secretos.
   *
   * La escritura al disco es asíncrona y encolada: el llamante no bloquea.
   * Usa `flush()` si necesita garantizar que la entrada llegó al disco.
   */
  public log(
    level: "debug" | "info" | "warn" | "error" | "critical",
    category: string,
    message: string,
    details?: unknown
  ): DiagnosticsLogEntry {
    const rawEntry: DiagnosticsLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
    };

    const sanitizedEntry = this.sanitizeEntry(rawEntry);
    this.enqueueWrite(() => this.appendToFile(sanitizedEntry));
    return sanitizedEntry;
  }

  public debug(category: string, message: string, details?: unknown): DiagnosticsLogEntry {
    return this.log("debug", category, message, details);
  }

  public info(category: string, message: string, details?: unknown): DiagnosticsLogEntry {
    return this.log("info", category, message, details);
  }

  public warn(category: string, message: string, details?: unknown): DiagnosticsLogEntry {
    return this.log("warn", category, message, details);
  }

  public error(category: string, message: string, details?: unknown): DiagnosticsLogEntry {
    return this.log("error", category, message, details);
  }

  public recordDirtyShutdown(report: DirtyShutdownReport): void {
    this.dirtyShutdownHistory.push(report);
    this.warn("recovery.dirty_shutdown", `Dirty shutdown detectado: ${report.recoveryAction}`, report);
  }

  /**
   * Exporta un paquete consolidado de diagnóstico anónimo para depuración y soporte.
   */
  public async exportDiagnosticsBundle(
    lockRecord?: LockFileRecord | null
  ): Promise<DiagnosticsBundle> {
    await this.flush();
    const recentLogs = await this.readRecentLogs(200);

    return {
      exportedAt: Date.now(),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        egoVersion: "0.1.0",
      },
      recentLogs,
      lockStatus: lockRecord ?? null,
      dirtyShutdownHistory: [...this.dirtyShutdownHistory],
    };
  }

  /**
   * Espera a que se vacíe la cola de escrituras (para tests y para el
   * apagado ordenado de la app).
   */
  public async flush(): Promise<void> {
    await this.writeQueue;
  }

  /**
   * Lee las últimas N entradas de log.
   */
  public async readRecentLogs(limit: number = 100): Promise<DiagnosticsLogEntry[]> {
    if (!(await pathExists(this.currentLogPath))) {
      return [];
    }

    try {
      const content = await readTextFile(this.currentLogPath);
      if (content === null) return [];
      const lines = content.trim().split("\n").filter(Boolean);
      const entries: DiagnosticsLogEntry[] = [];

      for (const line of lines.slice(-limit)) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // ignore
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Sanea recursivamente cualquier secreto sensible (API keys, Bearer tokens, contraseñas).
   */
  public sanitizeString(text: string): string {
    return text
      // API Keys (OpenAI, Anthropic, Groq, etc.)
      .replace(/(?:sk-[a-zA-Z0-9_\-]{20,}|gsk_[a-zA-Z0-9_\-]{20,})/gi, "[REDACTED_API_KEY]")
      // Bearer tokens
      .replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED_TOKEN]")
      // Campos JSON comunes de contraseña o secreto
      .replace(/(["']?(?:password|token|secret|apiKey|api_key)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, "$1[REDACTED]$3");
  }

  private sanitizeEntry(entry: DiagnosticsLogEntry): DiagnosticsLogEntry {
    const sanitizedMsg = this.sanitizeString(entry.message);
    let sanitizedDetails = entry.details;

    if (entry.details !== undefined) {
      try {
        const detailsStr = JSON.stringify(entry.details);
        const sanitizedDetailsStr = this.sanitizeString(detailsStr);
        sanitizedDetails = JSON.parse(sanitizedDetailsStr);
      } catch {
        sanitizedDetails = "[Unserializable Details]";
      }
    }

    return {
      ...entry,
      message: sanitizedMsg,
      details: sanitizedDetails,
    };
  }

  /**
   * Encola una escritura sin bloquear al llamante.
   */
  private enqueueWrite(task: () => Promise<void>): void {
    this.writeQueue = this.writeQueue
      .then(task)
      .catch((err: unknown) => {
        console.warn(
          `[DiagnosticsLogger] Error escribiendo en log: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
  }

  private async appendToFile(entry: DiagnosticsLogEntry): Promise<void> {
    try {
      await ensureDir(this.logsDir);
      await this.checkAndRotate();
      const line = JSON.stringify(entry) + "\n";
      await fs.promises.appendFile(this.currentLogPath, line, "utf8");
    } catch (err: unknown) {
      console.warn(
        `[DiagnosticsLogger] Error escribiendo en log: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  private async checkAndRotate(): Promise<void> {
    if (!(await pathExists(this.currentLogPath))) {
      return;
    }

    const stat = await fs.promises.stat(this.currentLogPath);
    if (stat.size < this.maxFileSizeBytes) {
      return;
    }

    // Rotar archivos existentes: log.2 -> log.3, log.1 -> log.2, etc.
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = path.join(this.logsDir, `ego.diagnostics.${i}.log`);
      const nextPath = path.join(this.logsDir, `ego.diagnostics.${i + 1}.log`);
      if (await pathExists(oldPath)) {
        if (i === this.maxFiles - 1 && (await pathExists(nextPath))) {
          await removeIfExists(nextPath);
        }
        await fs.promises.rename(oldPath, nextPath);
      }
    }

    const firstRotated = path.join(this.logsDir, "ego.diagnostics.1.log");
    if (await pathExists(firstRotated)) {
      await removeIfExists(firstRotated);
    }
    await fs.promises.rename(this.currentLogPath, firstRotated);
  }
}
