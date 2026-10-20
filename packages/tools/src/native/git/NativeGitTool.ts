import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../../types.js";
import { getErrorParts } from "../../error-parts.js";
import { GitParser } from "./GitParser.js";
import { PathValidator } from "../fs/PathValidator.js";
import { SessionDiffRevisions } from "./SessionDiffRevisions.js";

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

      const cwd = input.path ? await PathValidator.validatePathAsync(input.path, workspace) : workspace;

      try {
        const { stdout } = await pExecFile("git", ["status", "--porcelain=v1", "-b"], {
          cwd,
          timeout: 10000,
        });

        return GitParser.parseStatus(stdout);
      } catch (err: unknown) {
        throw new Error(`Fallo ejecutando git status en '${cwd}': ${getErrorParts(err).message}`);
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
        const validatedPath = await PathValidator.validatePathAsync(input.path, workspace);
        args.push("--", validatedPath);
      }

      try {
        const { stdout } = await pExecFile("git", args, {
          cwd: workspace,
          timeout: 15000,
          maxBuffer: 5 * 1024 * 1024, // 5MB max
        });

        return GitParser.parseDiff(stdout);
      } catch (err: unknown) {
        throw new Error(`Fallo ejecutando git diff en '${workspace}': ${getErrorParts(err).message}`);
      }
    },
  };
}

/**
 * Esquema de entrada de `git_session_diff` (OCLW-07).
 */
const GitSessionDiffInputSchema = z.object({
  sessionId: z
    .string()
    .min(1)
    .describe("Identificador de la sesión cuyo diff acumulado se quiere obtener."),
  path: z.string().optional().describe("Ruta del repositorio (relativa al workspace)."),
  recordBaseline: z
    .boolean()
    .default(false)
    .describe("Registra el HEAD actual como baseline de la sesión antes de calcular."),
});

/**
 * Crea la herramienta `git_session_diff` (OCLW-07).
 *
 * Expone el **diff acumulado por sesión**: los commits creados y el diff
 * acumulado desde el baseline de la sesión. `SessionDiffRevisions` ya
 * implementaba el rastreador, pero no tenía caller: era código asimilado
 * sin cablear (A5-S6).
 *
 * Es lo que alimenta la vista de cambios acumulados del Dynamic Workspace
 * (`CANV-06`).
 */
export function createGitSessionDiffTool(options: NativeGitOptions = {}): ToolDefinition {
  return {
    name: "git_session_diff",
    description:
      "Obtiene el diff y los commits ACUMULADOS por la sesión en el repositorio (desde el baseline de la sesión). Solo lectura.",
    category: "git",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["git", "diff", "vcs", "session"],
    inputSchema: GitSessionDiffInputSchema,
    execute: async (
      input: z.infer<typeof GitSessionDiffInputSchema>,
      context: ToolExecutionContext
    ) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la operación Git");
      }

      const repoRoot = input.path
        ? await PathValidator.validatePathAsync(input.path, workspace)
        : workspace;

      if (input.recordBaseline) {
        await SessionDiffRevisions.recordBaseline(input.sessionId, repoRoot);
      }

      return await SessionDiffRevisions.computeRevisions(input.sessionId, repoRoot);
    },
  };
}
