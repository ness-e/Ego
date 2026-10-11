import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  DiagnosticsLogEntry,
  DiagnosticsBundle,
  LockFileRecord,
  DirtyShutdownReport,
} from "./types.js";

export interface DiagnosticsLoggerOptions {
  logsDir: string;
  maxFileSizeBytes?: number; // default: 5MB
  maxFiles?: number; // default: 3
}

export class DiagnosticsLogger {
  private readonly logsDir: string;
  private readonly currentLogPath: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private readonly dirtyShutdownHistory: DirtyShutdownReport[] = [];

  constructor(options: DiagnosticsLoggerOptions) {
    this.logsDir = options.logsDir;
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 5 * 1024 * 1024; // 5MB
    this.maxFiles = options.maxFiles ?? 3;
    this.currentLogPath = path.join(this.logsDir, "ego.diagnostics.log");

    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Registra una entrada de log estructurado aplicando saneamiento estricto de secretos.
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
    this.appendToFile(sanitizedEntry);
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
  public exportDiagnosticsBundle(lockRecord?: LockFileRecord | null): DiagnosticsBundle {
    const recentLogs = this.readRecentLogs(200);

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
   * Lee las últimas N entradas de log.
   */
  public readRecentLogs(limit: number = 100): DiagnosticsLogEntry[] {
    if (!fs.existsSync(this.currentLogPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.currentLogPath, "utf8");
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

  private appendToFile(entry: DiagnosticsLogEntry): void {
    try {
      this.checkAndRotate();
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.currentLogPath, line, "utf8");
    } catch (err) {
      console.warn("[DiagnosticsLogger] Error escribiendo en log:", err);
    }
  }

  private checkAndRotate(): void {
    if (!fs.existsSync(this.currentLogPath)) {
      return;
    }

    const stat = fs.statSync(this.currentLogPath);
    if (stat.size < this.maxFileSizeBytes) {
      return;
    }

    // Rotar archivos existentes: log.2 -> log.3, log.1 -> log.2, etc.
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = path.join(this.logsDir, `ego.diagnostics.${i}.log`);
      const nextPath = path.join(this.logsDir, `ego.diagnostics.${i + 1}.log`);
      if (fs.existsSync(oldPath)) {
        if (i === this.maxFiles - 1 && fs.existsSync(nextPath)) {
          fs.unlinkSync(nextPath);
        }
        fs.renameSync(oldPath, nextPath);
      }
    }

    const firstRotated = path.join(this.logsDir, "ego.diagnostics.1.log");
    if (fs.existsSync(firstRotated)) {
      fs.unlinkSync(firstRotated);
    }
    fs.renameSync(this.currentLogPath, firstRotated);
  }
}
