import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../../types.js";
import { GitParser } from "./GitParser.js";
import { PathValidator } from "../fs/PathValidator.js";

const pExecFile = promisify(execFile);

const GitStatusInputSchema = z.object({
  path: z.string().optional().describe("Subdirectorio relativo opcional dentro del repositorio"),
});

const GitDiffInputSchema = z.object({
  path: z.string().optional().describe("Archivo o ruta específica a comparar"),
  staged: z.boolean().default(false).describe("Si es true, compara contra el índice (staged)"),
});

export interface NativeGitOptions {
  defaultWorkspacePath?: string;
}

/**
 * Crea la herramienta nativa de inspección de estado Git (`git_status`).
 */
export function createGitStatusTool(options: NativeGitOptions = {}): ToolDefinition {
  return {
    name: "git_status",
    description: "Inspecciona el estado de ramas, archivos modificados y archivos sin seguimiento en el repositorio local.",
    category: "git",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["git", "status", "vcs"],
    inputSchema: GitStatusInputSchema,
    execute: async (input: z.infer<typeof GitStatusInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación Git");
      }

      const cwd = input.path ? PathValidator.validatePath(input.path, workspace) : workspace;

      try {
        const { stdout } = await pExecFile("git", ["status", "--porcelain=v1", "-b"], {
          cwd,
          timeout: 10000,
        });

        return GitParser.parseStatus(stdout);
      } catch (err: any) {
        throw new Error(`Fallo ejecutando git status en '${cwd}': ${err.message || String(err)}`);
      }
    },
  };
}

/**
 * Crea la herramienta nativa de inspección de cambios Git (`git_diff`).
 */
export function createGitDiffTool(options: NativeGitOptions = {}): ToolDefinition {
  return {
    name: "git_diff",
    description: "Obtiene el diff unificado de los cambios en el código (staged o en working tree).",
    category: "git",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["git", "diff", "vcs"],
    inputSchema: GitDiffInputSchema,
    execute: async (input: z.infer<typeof GitDiffInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación Git");
      }

      const args = ["diff"];
      if (input.staged) {
        args.push("--staged");
      }

      if (input.path) {
        const validatedPath = PathValidator.validatePath(input.path, workspace);
        args.push("--", validatedPath);
      }

      try {
        const { stdout } = await pExecFile("git", args, {
          cwd: workspace,
          timeout: 15000,
          maxBuffer: 5 * 1024 * 1024, // 5MB max
        });

        return GitParser.parseDiff(stdout);
      } catch (err: any) {
        throw new Error(`Fallo ejecutando git diff en '${workspace}': ${err.message || String(err)}`);
      }
    },
  };
}
