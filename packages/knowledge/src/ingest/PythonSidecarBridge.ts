import { spawn } from "node:child_process";
import * as path from "node:path";
import * as readline from "node:readline";
import { DocumentChunk, DocumentChunkSchema } from "../schemas/knowledge.js";

import * as fs from "node:fs";

export interface SidecarProgress {
  current: number;
  total: number;
  file?: string;
  chunksSoFar?: number;
}

export interface SidecarResult {
  chunks: DocumentChunk[];
  totalFiles: number;
  totalChunks: number;
}

export interface SidecarRunOptions {
  /** Timeout total en ms; superado aborta con kill (default 120s). */
  timeoutMs?: number;
  /** Tope de chunks acumulados; superado aborta con kill (default 50000). */
  maxChunks?: number;
}

/** Timeout por defecto del sidecar (2 min: ingesta masiva sin cuelgue eterno). */
const DEFAULT_TIMEOUT_MS = 120_000;
/** Tope por defecto de chunks en memoria (acota OOM ante sidecar desbocado). */
const DEFAULT_MAX_CHUNKS = 50_000;
/** Tope de stderr reenviado a logs (evita spam infinito del hijo). */
const STDERR_LOG_CAP_BYTES = 64 * 1024;
/** Gracia entre SIGTERM y SIGKILL al abortar. */
const KILL_GRACE_MS = 2000;

/**
 * Puente para el sidecar opcional en Python (bulk_import.py) para ingesta masiva (KB-02).
 * Adhiere al Guardrail §4 y VDB-INC-02:
 * El sidecar opera exclusivamente en stdio JSONL, nunca abre VantaDB directamente para
 * evitar bloqueos de descriptores de archivos FjallError: Locked.
 */
export class PythonSidecarBridge {
  private readonly scriptPath: string;
  private pythonCommand: string | null = null;

  constructor(scriptPath?: string) {
    if (scriptPath) {
      this.scriptPath = scriptPath;
    } else {
      // L08: `__dirname` no existe en ESM (ReferenceError al evaluar); el
      // guard `typeof` es seguro en ambos sistemas de módulos. Divergencia
      // documentada vs reporte: `import.meta.url` no compila aquí porque el
      // paquete emite CJS (NodeNext sin `"type": "module"`); el guard
      // `typeof __dirname` logra la misma robustez sin romper typecheck.
      const moduleDir: string | undefined =
        typeof __dirname === "string" ? (__dirname as string) : undefined;
      const candidates = [
        path.resolve(process.cwd(), "scripts/ingest/bulk_import.py"),
        path.resolve(process.cwd(), "../../scripts/ingest/bulk_import.py"),
        ...(moduleDir
          ? [path.resolve(moduleDir, "../../../../scripts/ingest/bulk_import.py")]
          : []),
      ];
      this.scriptPath = candidates.find((c) => fs.existsSync(c)) || candidates[0];
    }
  }

  /**
   * Comprueba si Python (python o python3) está disponible en el entorno del host.
   */
  public async isAvailable(): Promise<boolean> {
    if (this.pythonCommand) return true;

    for (const cmd of ["python", "python3"]) {
      try {
        const available = await new Promise<boolean>((resolve) => {
          const proc = spawn(cmd, ["--version"]);
          proc.on("error", () => resolve(false));
          proc.on("close", (code) => resolve(code === 0));
        });
        if (available) {
          this.pythonCommand = cmd;
          return true;
        }
      } catch {
        // Continuar buscando
      }
    }
    return false;
  }

  /**
   * Ejecuta el proceso secundario de Python para procesar un lote de archivos masivo.
   *
   * L08: timeout con kill (nunca cuelga indefinidamente) + tope de chunks
   * (nunca acumula sin fin en RAM) + stderr acotado en logs.
   */
  public async runBulkImport(
    targetPath: string,
    onProgress?: (progress: SidecarProgress) => void,
    options: SidecarRunOptions = {}
  ): Promise<SidecarResult> {
    if (typeof targetPath !== "string" || targetPath.length === 0) {
      throw new Error("[PythonSidecarBridge] targetPath inválido (vacío).");
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error(`[PythonSidecarBridge] timeoutMs inválido: ${String(timeoutMs)}.`);
    }
    const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;
    if (!Number.isInteger(maxChunks) || maxChunks <= 0) {
      throw new Error(`[PythonSidecarBridge] maxChunks inválido: ${String(maxChunks)}.`);
    }

    const available = await this.isAvailable();
    if (!available || !this.pythonCommand) {
      throw new Error(
        "Python runtime no disponible en el host. Se requiere fallback a DocumentParser de TypeScript."
      );
    }

    return new Promise<SidecarResult>((resolve, reject) => {
      const proc = spawn(this.pythonCommand!, [this.scriptPath, targetPath]);
      const chunks: DocumentChunk[] = [];
      let totalFiles = 0;
      let totalChunks = 0;
      let settled = false;
      let timedOut = false;
      let stderrBytes = 0;
      let stderrCapped = false;

      const clearTimers = (): void => {
        clearTimeout(timeoutTimer);
        if (killTimer !== undefined) {
          clearTimeout(killTimer);
        }
      };
      const settleResolve = (result: SidecarResult): void => {
        if (settled) return;
        settled = true;
        clearTimers();
        rl.close();
        resolve(result);
      };
      const settleReject = (err: Error): void => {
        if (settled) return;
        settled = true;
        clearTimers();
        rl.close();
        reject(err);
      };
      const killChild = (): void => {
        try {
          proc.kill("SIGTERM");
        } catch {
          // El proceso ya pudo haber terminado; el grace-timer remata.
        }
      };

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        killChild();
        // Gracia para SIGTERM; si el hijo sigue vivo, remate con SIGKILL.
        killTimer = setTimeout(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
            // Proceso ya terminado; nada que rematar.
          }
        }, KILL_GRACE_MS);
        settleReject(
          new Error(
            `[PythonSidecarBridge] Timeout tras ${timeoutMs}ms esperando al sidecar (proceso terminado).`
          )
        );
      }, timeoutMs);
      let killTimer: NodeJS.Timeout | undefined = undefined;

      const rl = readline.createInterface({
        input: proc.stdout,
        terminal: false,
      });

      rl.on("line", (line) => {
        if (settled) return;
        if (!line.trim()) return;
        try {
          const msg = JSON.parse(line) as {
            type?: unknown;
            chunk?: unknown;
            current?: number;
            total?: number;
            file?: string;
            chunksSoFar?: number;
            totalFiles?: number;
            totalChunks?: number;
          };
          if (msg.type === "chunk" && msg.chunk) {
            if (chunks.length >= maxChunks) {
              killChild();
              settleReject(
                new Error(
                  `[PythonSidecarBridge] Límite de chunks excedido (maxChunks=${maxChunks}); proceso terminado para evitar OOM.`
                )
              );
              return;
            }
            const parsedChunk = DocumentChunkSchema.parse(msg.chunk);
            chunks.push(parsedChunk);
          } else if (msg.type === "progress") {
            if (onProgress) {
              onProgress({
                current: msg.current ?? 0,
                total: msg.total ?? 0,
                file: msg.file,
                chunksSoFar: msg.chunksSoFar,
              });
            }
          } else if (msg.type === "done") {
            totalFiles = msg.totalFiles ?? 0;
            totalChunks = msg.totalChunks ?? 0;
          }
        } catch (err) {
          console.warn("[PythonSidecarBridge] Línea no parseable:", line, err);
        }
      });

      proc.stderr.on("data", (data) => {
        if (settled) return;
        const text = data.toString() as string;
        if (stderrCapped) return;
        stderrBytes += Buffer.byteLength(text);
        if (stderrBytes > STDERR_LOG_CAP_BYTES) {
          stderrCapped = true;
          console.warn(
            `[PythonSidecarBridge:stderr] Límite de ${STDERR_LOG_CAP_BYTES} bytes superado; se silencia el resto.`
          );
          return;
        }
        console.warn(`[PythonSidecarBridge:stderr] ${text}`);
      });

      proc.on("error", (err) => {
        settleReject(new Error(`Fallo al iniciar el subproceso Python: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (settled) return;
        if (timedOut) {
          settleReject(
            new Error(
              `[PythonSidecarBridge] Timeout tras ${timeoutMs}ms esperando al sidecar (proceso terminado).`
            )
          );
        } else if (code !== 0) {
          settleReject(new Error(`El subproceso Python finalizó con código de error ${code}`));
        } else {
          settleResolve({
            chunks,
            totalFiles: totalFiles || (chunks.length > 0 ? 1 : 0),
            totalChunks: totalChunks || chunks.length,
          });
        }
      });
    });
  }
}
