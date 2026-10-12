import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  id: string;
  repoRoot: string;
  branch: string;
  worktreePath: string;
  createdAt: string;
  isMain: boolean;
}

/**
 * Approval explícita HITL para mutaciones git (M16). Las operaciones que
 * mutan el repositorio exigen `{ approved: true }`; sin ella lanzan antes
 * de ejecutar ningún subproceso. `approvedBy` documenta quién aprobó.
 */
export interface MutationApproval {
  approved?: boolean;
  approvedBy?: string;
}

/**
 * Valida un nombre de rama en modo fail-closed (M16). No mutila: rechaza.
 * Cierra traversal (`..`), inyección de opciones en argv de git (líder `-`)
 * y sintaxis prohibida por `git check-ref-format` (`@{`, `~^:?*[\`, espacios,
 * controles, líder `/`/`.`, cola `/`/`.`/`.lock`).
 */
export function validateBranchName(name: string): string {
  if (typeof name !== "string" || name.length === 0 || name.length > 250) {
    throw new Error(`[WorktreeManager] Nombre de rama inválido (vacío o >250): '${name}'.`);
  }
  if (name.includes("\0")) {
    throw new Error("[WorktreeManager] Nombre de rama inválido: contiene byte nulo.");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(name)) {
    throw new Error(
      `[WorktreeManager] Nombre de rama inválido (caracteres fuera de [A-Za-z0-9._/-]): '${name}'.`
    );
  }
  if (name.startsWith("-") || name.startsWith("/") || name.startsWith(".")) {
    throw new Error(
      `[WorktreeManager] Nombre de rama inválido (líder prohibido '-//./'): '${name}'.`
    );
  }
  if (
    name.endsWith("/") ||
    name.endsWith(".") ||
    name.endsWith(".lock") ||
    name.includes("..") ||
    name.includes("@{")
  ) {
    throw new Error(
      `[WorktreeManager] Nombre de rama inválido (secuencia git prohibida '..'/'@{' o cola inválida): '${name}'.`
    );
  }
  return name;
}

/**
 * Valida una referencia objetivo para `git diff <ref>...HEAD` (M16): rama
 * válida, SHA hexadecimal (corto o completo) o `HEAD`. Rechaza cualquier
 * cosa con forma de opción (`-x`, `--opt`) antes de que llegue a git.
 */
export function validateTargetRef(ref: string): string {
  if (ref === "HEAD" || /^[0-9a-fA-F]{4,40}$/.test(ref)) {
    return ref;
  }
  return validateBranchName(ref);
}

/** Normaliza y valida un repoRoot (cadena no vacía, sin bytes nulos). */
export function resolveRepoRoot(repoRoot: string): string {
  if (typeof repoRoot !== "string" || repoRoot.trim().length === 0) {
    throw new Error("[WorktreeManager] repoRoot inválido (vacío).");
  }
  if (repoRoot.includes("\0")) {
    throw new Error("[WorktreeManager] repoRoot inválido: contiene byte nulo.");
  }
  return path.resolve(repoRoot);
}

/**
 * Confina un path candidato dentro del repoRoot (M16). Lanza si escapa
 * (`..`, absoluto externo). Devuelve el path resuelto.
 */
export function assertInsideRoot(repoRoot: string, candidatePath: string): string {
  if (typeof candidatePath !== "string" || candidatePath.length === 0) {
    throw new Error("[WorktreeManager] Path candidato inválido (vacío).");
  }
  if (candidatePath.includes("\0")) {
    throw new Error("[WorktreeManager] Path candidato inválido: contiene byte nulo.");
  }
  const resolvedRoot = path.resolve(repoRoot);
  const resolved = path.resolve(candidatePath);
  const rel = path.relative(resolvedRoot, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `[WorktreeManager] Path fuera del repositorio ('${candidatePath}' escapa de '${resolvedRoot}').`
    );
  }
  return resolved;
}

function requireApproval(action: string, opts?: MutationApproval): void {
  if (opts?.approved !== true) {
    throw new Error(
      `[WorktreeManager] HITL requerido: '${action}' es una mutación git y exige approval explícita ({ approved: true }).`
    );
  }
}

/**
 * Gestor de entornos de desarrollo aislados mediante Git Worktrees (HERM-17 / DOM-01).
 * Impide que las mutaciones de código en vuelo ensucien el directorio principal de trabajo del usuario.
 *
 * Matriz de aprobación HITL (M16):
 * - REQUIEREN approval `{ approved: true }`: `createWorktree`, `removeWorktree`, `prune`.
 * - Solo lectura (sin approval): `isGitRepository`, `listWorktrees`.
 *
 * Nota de alcance: `execFile` no usa shell, así que `; rm` llega a git como
 * argumento literal (no hay inyección de comandos). El riesgo real cubierto
 * aquí es inyección de OPCIONES (`-x`, `--output=…` llegan a git como flags)
 * y path traversal (`..`/absolutos que escapan del workspace).
 */
export class WorktreeManager {
  /**
   * Verifica si una ruta es un repositorio Git válido.
   */
  public async isGitRepository(repoRoot: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: repoRoot,
      });
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  /**
   * Crea un nuevo worktree aislado y su rama correspondiente (HERM-17).
   * Mutación: exige approval HITL. La rama se valida fail-closed y el
   * destino queda confinado dentro del repoRoot.
   */
  public async createWorktree(
    repoRoot: string,
    branchName: string,
    customWorktreePath?: string,
    opts?: MutationApproval
  ): Promise<WorktreeInfo> {
    requireApproval("createWorktree", opts);
    const resolvedRoot = resolveRepoRoot(repoRoot);
    const isGit = await this.isGitRepository(resolvedRoot);
    if (!isGit) {
      throw new Error(`[WorktreeManager] '${repoRoot}' no es un repositorio Git válido.`);
    }

    const sanitizedBranch = validateBranchName(branchName);
    const defaultTarget = path.join(
      resolvedRoot,
      ".ego-worktrees",
      `wt-${sanitizedBranch.replace(/\//g, "-")}-${Date.now()}`
    );
    const targetDir = customWorktreePath
      ? assertInsideRoot(resolvedRoot, customWorktreePath)
      : defaultTarget;

    // Asegurar directorio padre
    await fs.mkdir(path.dirname(targetDir), { recursive: true });

    try {
      await execFileAsync(
        "git",
        ["worktree", "add", "-b", sanitizedBranch, targetDir],
        { cwd: resolvedRoot }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[WorktreeManager] Fallo al crear worktree '${sanitizedBranch}': ${msg}`);
    }

    return {
      id: `wt_${Date.now()}`,
      repoRoot: resolvedRoot,
      branch: sanitizedBranch,
      worktreePath: path.resolve(targetDir),
      createdAt: new Date().toISOString(),
      isMain: false,
    };
  }

  /**
   * Lista todos los worktrees existentes asociados al repositorio.
   */
  public async listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    const isGit = await this.isGitRepository(repoRoot);
    if (!isGit) {
      return [];
    }

    try {
      const { stdout } = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
        cwd: repoRoot,
      });

      const worktrees: WorktreeInfo[] = [];
      const blocks = stdout.trim().split("\n\n");

      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split("\n");
        let worktreePath = "";
        let branch = "HEAD (detached)";
        let isMain = false;

        for (const line of lines) {
          if (line.startsWith("worktree ")) {
            worktreePath = line.substring(9).trim();
          } else if (line.startsWith("branch refs/heads/")) {
            branch = line.substring(18).trim();
          } else if (line === "bare") {
            isMain = true;
          }
        }

        if (worktreePath) {
          // El primer worktree o aquel idéntico a repoRoot se considera principal
          if (path.resolve(worktreePath) === path.resolve(repoRoot)) {
            isMain = true;
          }

          worktrees.push({
            id: `wt_${path.basename(worktreePath)}`,
            repoRoot: path.resolve(repoRoot),
            branch,
            worktreePath: path.resolve(worktreePath),
            createdAt: new Date().toISOString(),
            isMain,
          });
        }
      }

      return worktrees;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[WorktreeManager] Error al listar worktrees: ${msg}`);
    }
  }

  /**
   * Remueve y limpia de forma segura un worktree aislado.
   * Mutación: exige approval HITL. El objetivo debe vivir dentro del
   * repoRoot y nunca ser el principal.
   */
  public async removeWorktree(
    repoRoot: string,
    worktreePath: string,
    force = true,
    opts?: MutationApproval
  ): Promise<boolean> {
    requireApproval("removeWorktree", opts);
    const resolvedRoot = resolveRepoRoot(repoRoot);
    const isGit = await this.isGitRepository(resolvedRoot);
    if (!isGit) {
      throw new Error(`[WorktreeManager] '${repoRoot}' no es un repositorio Git válido.`);
    }

    const resolvedTarget = path.resolve(worktreePath);

    if (resolvedTarget === resolvedRoot) {
      throw new Error(
        `[WorktreeManager] Protección innegociable: No se puede eliminar el worktree principal '${repoRoot}'.`
      );
    }

    assertInsideRoot(resolvedRoot, resolvedTarget);

    try {
      const args = ["worktree", "remove"];
      if (force) args.push("--force");
      args.push(resolvedTarget);

      await execFileAsync("git", args, { cwd: resolvedRoot });

      // Ejecutar prune para limpiar referencias huérfanas
      await execFileAsync("git", ["worktree", "prune"], { cwd: resolvedRoot });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[WorktreeManager] Error al eliminar worktree '${worktreePath}': ${msg}`);
    }
  }

  /**
   * Ejecuta git worktree prune para eliminar entradas caducas.
   * Mutación (borra refs huérfanas): exige approval HITL.
   */
  public async prune(repoRoot: string, opts?: MutationApproval): Promise<void> {
    requireApproval("prune", opts);
    const resolvedRoot = resolveRepoRoot(repoRoot);
    const isGit = await this.isGitRepository(resolvedRoot);
    if (!isGit) return;

    try {
      await execFileAsync("git", ["worktree", "prune"], { cwd: resolvedRoot });
    } catch {
      // Ignorar fallo no crítico en prune
    }
  }
}
