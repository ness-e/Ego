/**
 * SubEgoWorktree.ts — Aislamiento de Sub-Egos de Ingeniería mediante Git Worktrees.
 * Extraído y adaptado de Hermes Agent (HERM-17 / RFC-01) para Ego SOC.
 *
 * Crea espacios de trabajo paralelos y aislados en `.worktrees/subego-<id>` para evitar
 * que tareas concurrentes colisionen con el árbol de trabajo local del usuario.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

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

export class SubEgoWorktreeManager {
  private execGit: (args: string[], cwd: string) => string;
  private fileExists: (filePath: string) => boolean;

  constructor(
    customExecGit?: (args: string[], cwd: string) => string,
    customExists?: (filePath: string) => boolean
  ) {
    this.execGit =
      customExecGit ||
      ((args, cwd) => {
        return execFileSync("git", args, {
          cwd,
          encoding: "utf8",
          windowsHide: true,
          timeout: 30000,
        }).trim();
      });
    this.fileExists = customExists || ((p) => fs.existsSync(p));
  }

  /**
   * Resuelve el directorio raíz del repositorio Git para una ruta dada.
   */
  resolveRepoRoot(targetPath: string): string | null {
    try {
      const out = this.execGit(["rev-parse", "--show-toplevel"], targetPath);
      return out || null;
    } catch {
      return null;
    }
  }

  /**
   * Asegura que `.worktrees/` esté registrado en `.gitignore` para no ensuciar el status.
   */
  private ensureGitignoreEntry(repoRoot: string): void {
    const gitignorePath = path.join(repoRoot, ".gitignore");
    try {
      let content = "";
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, "utf8");
      }
      if (!content.split(/\r?\n/).includes(".worktrees/")) {
        const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
        fs.appendFileSync(gitignorePath, `${separator}.worktrees/\n`, "utf8");
      }
    } catch {
      // Ignorar fallo permisivo de lectura/escritura de gitignore
    }
  }

  /**
   * Crea un worktree aislado para un Sub-Ego.
   */
  createWorktree(repoRoot: string, subEgoId: string): WorktreeInfo | null {
    const root = this.resolveRepoRoot(repoRoot);
    if (!root) {
      return null;
    }

    const sanitizedId = subEgoId.replace(/[^a-zA-Z0-9_-]/g, "-");
    const wtName = `subego-${sanitizedId}`;
    const branch = `ego-subego/${wtName}`;
    const wtPath = path.join(root, ".worktrees", wtName);

    try {
      this.ensureGitignoreEntry(root);

      let baseCommit = "";
      try {
        baseCommit = this.execGit(["rev-parse", "HEAD"], root);
      } catch {
        baseCommit = "HEAD";
      }

      // Si el directorio ya existe, intentar removerlo
      if (this.fileExists(wtPath)) {
        try {
          this.execGit(["worktree", "remove", "--force", wtPath], root);
        } catch {
          // fallback
        }
      }

      this.execGit(["worktree", "add", "-b", branch, wtPath, "HEAD"], root);

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
  finalizeWorktree(
    info: WorktreeInfo,
    options: { pruneIfClean?: boolean } = { pruneIfClean: true }
  ): FinalizeWorktreeResult {
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
      const statusOut = this.execGit(["status", "--porcelain"], wtPath);
      dirty = statusOut.length > 0;

      // Contar commits producidos respecto al commit base
      if (baseCommit) {
        const revOut = this.execGit(
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
        this.execGit(["worktree", "remove", "--force", wtPath], repoRoot);
        this.execGit(["branch", "-D", branch], repoRoot);
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
