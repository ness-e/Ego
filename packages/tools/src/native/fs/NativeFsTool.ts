import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../../types.js";
import { PathValidator } from "./PathValidator.js";
import { FileLockManager } from "./FileLockManager.js";

const ReadFileInputSchema = z.object({
  path: z.string().describe("Ruta relativa o absoluta del archivo a leer dentro del workspace"),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8").describe("Codificación de lectura"),
});

const WriteFileInputSchema = z.object({
  path: z.string().describe("Ruta relativa o absoluta del archivo a escribir dentro del workspace"),
  content: z.string().describe("Contenido que se escribirá en el archivo"),
  createBackup: z.boolean().default(true).describe("Generar copia pre-mutación para permitir reversión (COUC-11)"),
});

export interface NativeFsOptions {
  defaultWorkspacePath?: string;
}

/**
 * Crea la herramienta nativa de lectura segura de archivos (`fs_read_file`).
 */
export function createFsReadFileTool(options: NativeFsOptions = {}): ToolDefinition {
  return {
    name: "fs_read_file",
    description: "Lee de forma segura el contenido de un archivo local dentro del workspace del usuario.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["fs", "read", "local"],
    inputSchema: ReadFileInputSchema,
    execute: async (input: z.infer<typeof ReadFileInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación de lectura");
      }

      const resolved = PathValidator.validatePath(input.path, workspace);

      let stats: fs.Stats;
      try {
        stats = await fs.promises.stat(resolved);
      } catch (err: any) {
        if (err?.code === "ENOENT") {
          throw new Error(`Archivo no encontrado: '${input.path}'`);
        }
        throw err;
      }

      if (stats.isDirectory()) {
        throw new Error(`La ruta '${input.path}' es un directorio, no un archivo regular`);
      }

      const content = await fs.promises.readFile(resolved, { encoding: input.encoding as BufferEncoding });

      return {
        path: path.relative(workspace, resolved),
        sizeBytes: stats.size,
        mtimeMs: stats.mtimeMs,
        content,
      };
    },
  };
}

/**
 * Crea la herramienta nativa de escritura atómica y gobernada de archivos (`fs_write_file`).
 * Implementa escrituras atómicas (tmp + rename), exclusión mutua por lockfiles y snapshot de rollback.
 */
export function createFsWriteFileTool(options: NativeFsOptions = {}): ToolDefinition {
  return {
    name: "fs_write_file",
    description: "Escribe de forma atómica y segura un archivo en el filesystem del usuario con soporte de backup.",
    category: "filesystem",
    riskLevel: "sensitive",
    origin: "native",
    requiresApproval: true,
    tags: ["fs", "write", "atomic", "governed"],
    inputSchema: WriteFileInputSchema,
    execute: async (input: z.infer<typeof WriteFileInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación de escritura");
      }

      const resolved = PathValidator.validatePath(input.path, workspace);
      const targetDir = path.dirname(resolved);

      await fs.promises.mkdir(targetDir, { recursive: true });

      return await FileLockManager.withLock(resolved, async () => {
        let backupPath: string | undefined;

        // 1. Snapshot previo de reversión (COUC-11)
        if (input.createBackup) {
          try {
            await fs.promises.access(resolved);
            const timestamp = Date.now();
            backupPath = `${resolved}.ego_bak.${timestamp}`;
            await fs.promises.copyFile(resolved, backupPath);
          } catch (err: any) {
            if (err?.code !== "ENOENT") {
              throw err;
            }
          }
        }

        // 2. Escritura atómica a archivo temporal en el mismo volumen
        const tmpPath = path.join(targetDir, `.ego_tmp_${randomUUID()}`);
        const buffer = Buffer.from(input.content, "utf-8");

        try {
          await fs.promises.writeFile(tmpPath, buffer);
          // 3. Rename atómico sobre el archivo definitivo
          await fs.promises.rename(tmpPath, resolved);
        } catch (err) {
          // Limpiar archivo temporal si falló
          try {
            await fs.promises.unlink(tmpPath);
          } catch {}
          throw err;
        }

        return {
          success: true,
          path: path.relative(workspace, resolved),
          bytesWritten: buffer.length,
          backupPath: backupPath ? path.relative(workspace, backupPath) : undefined,
        };
      });
    },
  };
}
