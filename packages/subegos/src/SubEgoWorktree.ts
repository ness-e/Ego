/**
 * SubEgoWorktree.ts — Aislamiento de Sub-Egos de Ingeniería mediante Git Worktrees.
 * Extraído y adaptado de Hermes Agent (HERM-17 / RFC-01) para Ego SOC.
 *
 * Crea espacios de trabajo paralelos y aislados en `.ego-worktrees/subego-<id>`
 * para evitar que tareas concurrentes colisionen con el árbol de trabajo local
 * del usuario.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

/** A6: directorio canónico de worktrees (alineado con `WorktreeManager`). */
export const SUBEGO_WORKTREES_DIR = ".ego-worktrees";

export interface WorktreeInfo {
  path: string;
  branch: string;
  repoRoot: string;
  baseCommit: string;
}

export interface FinalizeWorktreeResult {
  path: string;
  branch: string;
  commits: number;
  dirty: boolean;
  pruned: boolean;
  preservedForReview?: boolean;
  note?: string;
}

/** Ejecutor git inyectable (sync o async); el manager siempre lo `await`. */
export type ExecGitFn = (args: string[], cwd: string) => string | Promise<string>;

export class SubEgoWorktreeManager {
  private execGit: ExecGitFn;
  private fileExists: (filePath: string) => boolean;

  constructor(
    customExecGit?: ExecGitFn,
    customExists?: (filePath: string) => boolean
  ) {
    this.execGit =
      customExecGit ||
      (async (args, cwd) => {
        const { stdout } = await execFileAsync("git", args, {
          cwd,
          windowsHide: true,
          timeout: 30000,
        });
        return stdout.trim();
      });
    this.fileExists = customExists || ((p) => fs.existsSync(p));
  }

  /**
   * Resuelve el directorio raíz del repositorio Git para una ruta dada.
   */
  async resolveRepoRoot(targetPath: string): Promise<string | null> {
    try {
      const out = await this.execGit(["rev-parse", "--show-toplevel"], targetPath);
      return out || null;
    } catch {
      return null;
    }
  }

  /**
   * Asegura que `.ego-worktrees/` esté registrado en `.gitignore` para no ensuciar el status.
   */
  private ensureGitignoreEntry(repoRoot: string): void {
    const gitignorePath = path.join(repoRoot, ".gitignore");
    try {
      let content = "";
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, "utf8");
      }
      if (!content.split(/\r?\n/).includes(`${SUBEGO_WORKTREES_DIR}/`)) {
        const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
        fs.appendFileSync(gitignorePath, `${separator}${SUBEGO_WORKTREES_DIR}/\n`, "utf8");
      }
    } catch {
      // Ignorar fallo permisivo de lectura/escritura de gitignore
    }
  }

  /**
   * Crea un worktree aislado para un Sub-Ego.
   * A6: `add -B` (reusa la rama si ya existe en vez de fallar con `-b`).
   */
  async createWorktree(repoRoot: string, subEgoId: string): Promise<WorktreeInfo | null> {
    const root = await this.resolveRepoRoot(repoRoot);
    if (!root) {
      return null;
    }

    const sanitizedId = subEgoId.replace(/[^a-zA-Z0-9_-]/g, "-");
    const wtName = `subego-${sanitizedId}`;
    const branch = `ego-subego/${wtName}`;
    const wtPath = path.join(root, SUBEGO_WORKTREES_DIR, wtName);

    try {
      this.ensureGitignoreEntry(root);

      let baseCommit = "";
      try {
        baseCommit = await this.execGit(["rev-parse", "HEAD"], root);
      } catch {
        baseCommit = "HEAD";
      }

      // Si el directorio ya existe, intentar removerlo
      if (this.fileExists(wtPath)) {
        try {
          await this.execGit(["worktree", "remove", "--force", wtPath], root);
        } catch {
          // fallback
        }
      }

      await this.execGit(["worktree", "add", "-B", branch, wtPath, "HEAD"], root);

      return {
        path: wtPath,
        branch,
        repoRoot: root,
        baseCommit,
      };
    } catch {
      return null;
    }
  }

  /**
   * Inspecciona y finaliza el worktree del Sub-Ego.
   * Si no hubo commits y el árbol está limpio, lo poda (prune).
   * Si contiene cambios o commits, lo preserva para revisión del usuario (HITL).
   */
  async finalizeWorktree(
    info: WorktreeInfo,
    options: { pruneIfClean?: boolean } = { pruneIfClean: true }
  ): Promise<FinalizeWorktreeResult> {
    const { path: wtPath, branch, repoRoot, baseCommit } = info;

    if (!this.fileExists(wtPath)) {
      return {
        path: wtPath,
        branch,
        commits: 0,
        dirty: false,
        pruned: true,
      };
    }

    let commits = 0;
    let dirty = false;

    try {
      // Verificar estado dirty (archivos modificados o untracked)
      const statusOut = await this.execGit(["status", "--porcelain"], wtPath);
      dirty = statusOut.length > 0;

      // Contar commits producidos respecto al commit base
      if (baseCommit) {
        const revOut = await this.execGit(
          ["rev-list", "--count", `${baseCommit}..HEAD`],
          wtPath
        );
        commits = parseInt(revOut, 10) || 0;
      }
    } catch {
      // En caso de fallo de inspección, no podar por seguridad
      return {
        path: wtPath,
        branch,
        commits,
        dirty,
        pruned: false,
        preservedForReview: true,
        note: "Inspección git indeterminada; worktree preservado para revisión manual.",
      };
    }

    // Si está limpio y sin commits, y pruneIfClean es true -> eliminar
    if (!dirty && commits === 0 && options.pruneIfClean) {
      try {
        await this.execGit(["worktree", "remove", "--force", wtPath], repoRoot);
        await this.execGit(["branch", "-D", branch], repoRoot);
        return {
          path: wtPath,
          branch,
          commits: 0,
          dirty: false,
          pruned: true,
        };
      } catch {
        // fallo al podar
      }
    }

    // Preservar para revisión HITL
    return {
      path: wtPath,
      branch,
      commits,
      dirty,
      pruned: false,
      preservedForReview: true,
      note: `Trabajo detectado (${commits} commits, dirty: ${dirty}). Worktree preservado en ${wtPath} (rama ${branch}).`,
    };
  }
}
