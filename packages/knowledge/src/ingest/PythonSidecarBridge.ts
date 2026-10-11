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
      const candidates = [
        path.resolve(process.cwd(), "scripts/ingest/bulk_import.py"),
        path.resolve(process.cwd(), "../../scripts/ingest/bulk_import.py"),
        path.resolve(__dirname, "../../../../scripts/ingest/bulk_import.py"),
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
   */
  public async runBulkImport(
    targetPath: string,
    onProgress?: (progress: SidecarProgress) => void
  ): Promise<SidecarResult> {
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

      const rl = readline.createInterface({
        input: proc.stdout,
        terminal: false,
      });

      rl.on("line", (line) => {
        if (!line.trim()) return;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "chunk" && msg.chunk) {
            const parsedChunk = DocumentChunkSchema.parse(msg.chunk);
            chunks.push(parsedChunk);
          } else if (msg.type === "progress") {
            if (onProgress) {
              onProgress({
                current: msg.current,
                total: msg.total,
                file: msg.file,
                chunksSoFar: msg.chunksSoFar,
              });
            }
          } else if (msg.type === "done") {
            totalFiles = msg.totalFiles;
            totalChunks = msg.totalChunks;
          }
        } catch (err) {
          console.warn("[PythonSidecarBridge] Línea no parseable:", line, err);
        }
      });

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        console.warn(`[PythonSidecarBridge:stderr] ${text}`);
      });

      proc.on("error", (err) => {
        reject(new Error(`Fallo al iniciar el subproceso Python: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`El subproceso Python finalizó con código de error ${code}`));
        } else {
          resolve({
            chunks,
            totalFiles: totalFiles || (chunks.length > 0 ? 1 : 0),
            totalChunks: totalChunks || chunks.length,
          });
        }
      });
    });
  }
}
