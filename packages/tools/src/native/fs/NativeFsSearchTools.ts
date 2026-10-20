import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../../types.js";
import { PathValidator } from "./PathValidator.js";
import { matchesGlobPath } from "./glob.js";

/**
 * Tools de búsqueda en el filesystem (T7, Ola 1 / A3).
 *
 * EGO-FIND-32/A3-12: el catálogo de tools solo tenía `fs_read_file` y
 * `fs_write_file`. El agente no podía **encontrar** ficheros por patrón
 * (`fs_glob`) ni **buscar** contenido (`fs_grep`), y `fs_read_file` leía el
 * fichero **entero** sin tope (el truncado a 5 MB ocurría DESPUÉS, en el
 * `ExecutionManager`, con el contenido ya en memoria).
 *
 * Estas tools son de solo lectura (`riskLevel: safe`, sin aprobación) pero
 * respetan el perímetro del workspace (`PathValidator`).
 */

/** Tope por defecto de bytes devueltos por `fs_read_file`. */
export const DEFAULT_MAX_READ_BYTES = 1024 * 1024; // 1 MiB

/** Tope absoluto de bytes por lectura (protección de memoria). */
export const HARD_MAX_READ_BYTES = 10 * 1024 * 1024; // 10 MiB

/** Número máximo de resultados por defecto de `fs_glob` / `fs_grep`. */
export const DEFAULT_MAX_RESULTS = 200;

/** Directorios que nunca se recorren (ruido + riesgo). */
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  "coverage",
  ".cache",
  ".turbo",
]);

const FsGlobInputSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe("Patrón glob (ej. '**/*.ts', 'src/**/*.{ts,tsx}')."),
  cwd: z.string().optional().describe("Directorio de búsqueda (relativo al workspace)."),
  limit: z.number().int().min(1).max(2000).default(DEFAULT_MAX_RESULTS).describe("Máximo de resultados."),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(8)
    .describe("Profundidad máxima de recursión (directorios)."),
  includeDirectories: z.boolean().default(false).describe("Incluir directorios en los resultados."),
});

const FsGrepInputSchema = z.object({
  pattern: z.string().min(1).describe("Expresión regular a buscar en el contenido."),
  path: z.string().optional().describe("Fichero o directorio donde buscar (relativo al workspace)."),
  glob: z.string().optional().describe("Filtro glob de los ficheros a inspeccionar."),
  ignoreCase: z.boolean().default(false).describe("Búsqueda case-insensitive."),
  limit: z.number().int().min(1).max(2000).default(DEFAULT_MAX_RESULTS).describe("Máximo de coincidencias."),
  maxFileBytes: z
    .number()
    .int()
    .min(1024)
    .max(HARD_MAX_READ_BYTES)
    .default(DEFAULT_MAX_READ_BYTES)
    .describe("No inspeccionar ficheros mayores que esto."),
});

/** Coincidencia de `fs_grep`. */
export interface FsGrepMatch {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

/**
 * Crea la tool `fs_glob` — encuentra ficheros por patrón glob.
 */
export function createFsGlobTool(options: { defaultWorkspacePath?: string } = {}): ToolDefinition {
  return {
    name: "fs_glob",
    description:
      "Encuentra ficheros del workspace que casan con un patrón glob (ej. '**/*.ts'). Solo lectura.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["fs", "glob", "search", "local"],
    inputSchema: FsGlobInputSchema,
    execute: async (input: z.infer<typeof FsGlobInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación de glob");
      }

      const root = input.cwd
        ? await PathValidator.validatePathAsync(input.cwd, workspace)
        : workspace;

      const results: string[] = [];
      let truncated = false;

      const walk = async (dir: string, depth: number): Promise<void> => {
        if (truncated || depth > input.maxDepth) return;

        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (err: unknown) {
          console.warn(
            `[fs_glob] No se pudo leer '${dir}': ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return;
        }

        for (const entry of entries) {
          if (truncated) return;
          if (IGNORED_DIRECTORIES.has(entry.name)) continue;

          const full = path.join(dir, entry.name);
          const relative = path.relative(workspace, full).replace(/\\/g, "/");

          if (entry.isDirectory()) {
            if (input.includeDirectories && matchesGlobPath(relative, full, input.pattern)) {
              results.push(relative);
            }
            await walk(full, depth + 1);
            continue;
          }

          if (!entry.isFile()) continue;
          if (matchesGlobPath(relative, full, input.pattern)) {
            results.push(relative);
            if (results.length >= input.limit) {
              truncated = true;
              return;
            }
          }
        }
      };

      await walk(root, 0);

      return {
        pattern: input.pattern,
        root: path.relative(workspace, root) || ".",
        count: results.length,
        truncated,
        files: results.sort(),
      };
    },
  };
}

/**
 * Crea la tool `fs_grep` — busca un patrón en el contenido de los ficheros.
 */
export function createFsGrepTool(options: { defaultWorkspacePath?: string } = {}): ToolDefinition {
  return {
    name: "fs_grep",
    description:
      "Busca una expresión regular en el contenido de los ficheros del workspace y devuelve las coincidencias. Solo lectura.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["fs", "grep", "search", "local"],
    inputSchema: FsGrepInputSchema,
    execute: async (input: z.infer<typeof FsGrepInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación de grep");
      }

      const root = input.path
        ? await PathValidator.validatePathAsync(input.path, workspace)
        : workspace;

      let regex: RegExp;
      try {
        regex = new RegExp(input.pattern, input.ignoreCase ? "i" : "");
      } catch (err: unknown) {
        throw new Error(
          `Expresión regular inválida para fs_grep: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

      const matches: FsGrepMatch[] = [];
      let truncated = false;
      let filesScanned = 0;

      const scanFile = async (file: string, relative: string): Promise<void> => {
        if (truncated) return;
        if (input.glob && !matchesGlobPath(relative, file, input.glob)) return;

        let stat: fs.Stats;
        try {
          stat = await fs.promises.stat(file);
        } catch {
          return;
        }
        if (!stat.isFile()) return;
        if (stat.size > input.maxFileBytes) return;

        let content: string;
        try {
          content = await fs.promises.readFile(file, "utf8");
        } catch {
          return;
        }
        filesScanned++;

        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (!regex.test(line)) continue;
          matches.push({ path: relative, line: i + 1, text: line.slice(0, 500) });
          if (matches.length >= input.limit) {
            truncated = true;
            return;
          }
        }
      };

      const walk = async (dir: string, depth: number): Promise<void> => {
        if (truncated || depth > 8) return;
        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (truncated) return;
          if (IGNORED_DIRECTORIES.has(entry.name)) continue;
          const full = path.join(dir, entry.name);
          const relative = path.relative(workspace, full).replace(/\\/g, "/");
          if (entry.isDirectory()) {
            await walk(full, depth + 1);
          } else if (entry.isFile()) {
            await scanFile(full, relative);
          }
        }
      };

      const rootStat = await fs.promises.stat(root).catch(() => null);
      if (rootStat?.isFile()) {
        await scanFile(root, path.relative(workspace, root).replace(/\\/g, "/"));
      } else {
        await walk(root, 0);
      }

      return {
        pattern: input.pattern,
        filesScanned,
        count: matches.length,
        truncated,
        matches,
      };
    },
  };
}
