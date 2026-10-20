import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../../types.js";
import { PathValidator } from "./PathValidator.js";
import { FileLockManager } from "./FileLockManager.js";

/**
 * Tool `fs_edit_patch` — parche de fichero por reemplazos exactos, con
 * `dryRun` (T5.2, Ola 1b).
 *
 * POR QUÉ UN FORMATO PROPIO Y NO UN DIFF UNIFICADO
 * -----------------------------------------------
 * Un diff unificado exige parsear cabeceras `@@`, calcular números de línea
 * y decidir qué hacer con los hunks que no aplican: un parche mal aplicado
 * puede pisar código equivocado sin que nadie lo note. Aquí el parche es
 * una lista de reemplazos **exactos**, y el motor **falla cerrado** si un
 * `find` no aparece o aparece más de una vez.
 *
 * Es un formato determinista, auditable y trivialmente verificable por un
 * modelo. Un formato de parche más rico (con contexto y hunks parciales) es
 * una decisión de producto, no de infraestructura.
 *
 * La escritura es **atómica** (tmp + fsync + rename), igual que
 * `fs_write_file`, y con backup opcional.
 */

const EditHunkSchema = z.object({
  /** Texto exacto a buscar. Debe aparecer EXACTAMENTE UNA vez. */
  find: z.string().min(1).describe("Texto exacto a buscar (debe aparecer una única vez)."),
  /** Texto de reemplazo (literal). */
  replace: z.string().describe("Texto de reemplazo (literal)."),
});

const FsEditPatchInputSchema = z.object({
  path: z.string().describe("Ruta del fichero a parchear, dentro del workspace."),
  hunks: z.array(EditHunkSchema).min(1).describe("Reemplazos exactos a aplicar, en orden."),
  /**
   * Calcula el resultado y devuelve el diff **sin escribir en disco**.
   * Por defecto `false` (aplica); ponlo a `true` para previsualizar.
   */
  dryRun: z.boolean().default(false).describe("Previsualizar sin escribir."),
  /** Crea una copia del fichero original antes de escribir. */
  createBackup: z.boolean().default(true).describe("Copia de seguridad antes de escribir."),
});

export type FsEditPatchInput = z.infer<typeof FsEditPatchInputSchema>;

/** Resultado de la tool. */
export interface FsEditPatchResult {
  /** `true` si el parche se aplicó (es decir, se escribió). */
  readonly applied: boolean;
  /** `true` si sólo fue una previsualización. */
  readonly dryRun: boolean;
  /** Ruta relativa dentro del workspace. */
  readonly path: string;
  /** Número de hunks aplicados. */
  readonly hunksApplied: number;
  /** Diff legible entre el original y el resultado (previsualización). */
  readonly preview: string;
  /** Ruta del backup (relativa), si se creó. */
  readonly backupPath?: string;
  /** Bytes escritos. */
  readonly bytesWritten?: number;
}

/**
 * Cuenta las apariciones de un substring (no solapadas).
 */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Construye un diff legible (unified-lite) entre dos textos.
 */
function buildPreview(original: string, next: string): string {
  const originalLines = original.split("\n");
  const nextLines = next.split("\n");
  const out: string[] = [];
  const max = Math.max(originalLines.length, nextLines.length);

  for (let i = 0; i < max; i++) {
    const before = originalLines[i];
    const after = nextLines[i];
    if (before === after) continue;
    if (before !== undefined) out.push(`- ${before}`);
    if (after !== undefined) out.push(`+ ${after}`);
  }

  if (out.length === 0) out.push("(sin cambios)");
  return out.join("\n");
}

/**
 * Crea la tool `fs_edit_patch`.
 */
export function createFsEditPatchTool(
  options: { defaultWorkspacePath?: string } = {}
): ToolDefinition {
  return {
    name: "fs_edit_patch",
    description:
      "Aplica un parche de reemplazos exactos a un fichero del workspace. Cada 'find' debe aparecer exactamente una vez (si no, se rechaza). Soporta dryRun para previsualizar sin escribir.",
    category: "filesystem",
    riskLevel: "sensitive",
    origin: "native",
    requiresApproval: true,
    tags: ["fs", "edit", "patch", "atomic", "governed"],
    inputSchema: FsEditPatchInputSchema,
    execute: async (
      input: FsEditPatchInput,
      context: ToolExecutionContext
    ): Promise<FsEditPatchResult> => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación de patch");
      }

      const resolved = await PathValidator.validatePathAsync(input.path, workspace);
      const relative = path.relative(workspace, resolved);

      let original: string;
      try {
        original = await fs.promises.readFile(resolved, "utf8");
      } catch (err: unknown) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "ENOENT") {
          throw new Error(`El fichero '${input.path}' no existe: no se puede parchear.`);
        }
        throw err;
      }

      // Aplicar los hunks en memoria (fail-closed ante ambigüedad).
      let next = original;
      for (const hunk of input.hunks) {
        const occurrences = countOccurrences(next, hunk.find);
        if (occurrences === 0) {
          throw new Error(
            `fs_edit_patch: no se encontró el texto a reemplazar en '${input.path}' ` +
              `(0 coincidencias). Parche abortado, fichero intacto.`
          );
        }
        if (occurrences > 1) {
          throw new Error(
            `fs_edit_patch: el texto a reemplazar es ambiguo en '${input.path}' ` +
              `(${occurrences} coincidencias). Un parche ambiguo podría pisar el código ` +
              `equivocado; añade más contexto a 'find'. Parche abortado, fichero intacto.`
          );
        }
        next = next.replace(hunk.find, hunk.replace);
      }

      const preview = buildPreview(original, next);

      if (input.dryRun) {
        return {
          applied: false,
          dryRun: true,
          path: relative,
          hunksApplied: input.hunks.length,
          preview,
        };
      }

      let backupPath: string | undefined;
      return await FileLockManager.withLock(resolved, async () => {
        if (input.createBackup) {
          const backup = `${resolved}.ego_bak.${Date.now()}`;
          await fs.promises.copyFile(resolved, backup);
          backupPath = path.relative(workspace, backup);
        }

        // Escritura atómica: tmp + fsync + rename (mismo patrón que
        // `fs_write_file`).
        const tmpPath = path.join(path.dirname(resolved), `.ego_tmp_${randomUUID()}`);
        try {
          const handle = await fs.promises.open(tmpPath, "w+");
          try {
            await handle.writeFile(next, "utf8");
            await handle.sync();
          } finally {
            await handle.close();
          }
          await fs.promises.rename(tmpPath, resolved);
        } catch (err: unknown) {
          try {
            await fs.promises.unlink(tmpPath);
          } catch {
            // noop: mejor un temporal huérfano que un fichero a medias
          }
          throw err;
        }

        return {
          applied: true,
          dryRun: false,
          path: relative,
          hunksApplied: input.hunks.length,
          preview,
          backupPath,
          bytesWritten: Buffer.byteLength(next, "utf8"),
        };
      });
    },
  };
}
