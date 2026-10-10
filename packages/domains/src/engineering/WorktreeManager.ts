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
 * Gestor de entornos de desarrollo aislados mediante Git Worktrees (HERM-17 / DOM-01).
 * Impide que las mutaciones de código en vuelo ensucien el directorio principal de trabajo del usuario.
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
   */
  public async createWorktree(
    repoRoot: string,
    branchName: string,
    customWorktreePath?: string
  ): Promise<WorktreeInfo> {
    const isGit = await this.isGitRepository(repoRoot);
    if (!isGit) {
      throw new Error(`[WorktreeManager] '${repoRoot}' no es un repositorio Git válido.`);
    }

    const sanitizedBranch = branchName.replace(/[^a-zA-Z0-9_\-./]/g, "-");
    const targetDir =
      customWorktreePath ||
      path.join(repoRoot, ".ego-worktrees", `wt-${sanitizedBranch}-${Date.now()}`);

    // Asegurar directorio padre
    await fs.mkdir(path.dirname(targetDir), { recursive: true });

    try {
      await execFileAsync(
        "git",
        ["worktree", "add", "-b", sanitizedBranch, targetDir],
        { cwd: repoRoot }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[WorktreeManager] Fallo al crear worktree '${sanitizedBranch}': ${msg}`);
    }

    return {
      id: `wt_${Date.now()}`,
      repoRoot: path.resolve(repoRoot),
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
   */
  public async removeWorktree(
    repoRoot: string,
    worktreePath: string,
    force = true
  ): Promise<boolean> {
    const isGit = await this.isGitRepository(repoRoot);
    if (!isGit) {
      throw new Error(`[WorktreeManager] '${repoRoot}' no es un repositorio Git válido.`);
    }

    const resolvedTarget = path.resolve(worktreePath);
    const resolvedRoot = path.resolve(repoRoot);

    if (resolvedTarget === resolvedRoot) {
      throw new Error(
        `[WorktreeManager] Protección innegociable: No se puede eliminar el worktree principal '${repoRoot}'.`
      );
    }

    try {
      const args = ["worktree", "remove"];
      if (force) args.push("--force");
      args.push(resolvedTarget);

      await execFileAsync("git", args, { cwd: repoRoot });

      // Ejecutar prune para limpiar referencias huérfanas
      await execFileAsync("git", ["worktree", "prune"], { cwd: repoRoot });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[WorktreeManager] Error al eliminar worktree '${worktreePath}': ${msg}`);
    }
  }

  /**
   * Ejecuta git worktree prune para eliminar entradas caducas.
   */
  public async prune(repoRoot: string): Promise<void> {
    const isGit = await this.isGitRepository(repoRoot);
    if (!isGit) return;

    try {
      await execFileAsync("git", ["worktree", "prune"], { cwd: repoRoot });
    } catch {
      // Ignorar fallo no crítico en prune
    }
  }
}
