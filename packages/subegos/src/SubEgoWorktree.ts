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
import * as fsp from "node:fs/promises";
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

export interface OrphanWorktreeEntry {
  path: string;
  pruned: boolean;
  reason: string;
}

export interface PruneOrphanWorktreesReport {
  repoRoot: string;
  scanned: number;
  pruned: OrphanWorktreeEntry[];
  preserved: OrphanWorktreeEntry[];
  /** `true` si `git worktree list` falló: nada se podó (conservador). */
  inspectionFailed: boolean;
}

export interface PruneOrphanWorktreesOptions {
  nowMs?: number;
  /** Días de antigüedad para podar huérfanos (default 30, Gate P). */
  cleanupPeriodDays?: number;
  /** Inyectables para tests (default: `node:fs/promises`). */
  readdirFn?: (dir: string) => Promise<string[]> | string[];
  statFn?: (filePath: string) => Promise<{ mtimeMs: number }> | { mtimeMs: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class SubEgoWorktreeManager {
  private execGit: ExecGitFn;
  private fileExists: (filePath: string) => Promise<boolean> | boolean;

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
    // EGO-FIND-66 (T11): sin I/O síncrono. customExists puede ser sync (tests).
    this.fileExists =
      customExists ||
      (async (p: string) => {
        try {
          await fs.promises.access(p);
          return true;
        } catch {
          return false;
        }
      });
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
  private async ensureGitignoreEntry(repoRoot: string): Promise<void> {
    const gitignorePath = path.join(repoRoot, ".gitignore");
    try {
      let content = "";
      try {
        content = await fs.promises.readFile(gitignorePath, "utf8");
      } catch {
        // El .gitignore no existe todavía: se creará.
      }
      if (!content.split(/\r?\n/).includes(`${SUBEGO_WORKTREES_DIR}/`)) {
        const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
        await fs.promises.appendFile(
          gitignorePath,
          `${separator}${SUBEGO_WORKTREES_DIR}/\n`,
          "utf8"
        );
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
      await this.ensureGitignoreEntry(root);

      let baseCommit = "";
      try {
        baseCommit = await this.execGit(["rev-parse", "HEAD"], root);
      } catch {
        baseCommit = "HEAD";
      }

      // Si el directorio ya existe, intentar removerlo
      if (await this.fileExists(wtPath)) {
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

    if (!(await this.fileExists(wtPath))) {
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

  /**
   * Poda de worktrees huérfanos (STAB-05, job cleanupPeriod).
   *
   * Huérfano = directorio bajo `.ego-worktrees/` que NO figura en
   * `git worktree list --porcelain`. Solo se poda si supera
   * `cleanupPeriodDays` (mtime); joven o fallo de `remove` → preservado
   * con razón explícita. Fallo de inspección git → reporte vacío con
   * `inspectionFailed: true` (conservador: nunca podar a ciegas).
   */
  async pruneOrphanWorktrees(
    repoRoot: string,
    options: PruneOrphanWorktreesOptions = {}
  ): Promise<PruneOrphanWorktreesReport> {
    const nowMs = options.nowMs ?? Date.now();
    const cleanupPeriodDays = options.cleanupPeriodDays ?? 30;
    const readdir = options.readdirFn ?? ((dir: string) => fsp.readdir(dir));
    const stat = options.statFn ?? (async (p: string) => fsp.stat(p));
    const base: PruneOrphanWorktreesReport = {
      repoRoot,
      scanned: 0,
      pruned: [],
      preserved: [],
      inspectionFailed: false,
    };

    let registered = new Set<string>();
    try {
      const out = await this.execGit(["worktree", "list", "--porcelain"], repoRoot);
      registered = new Set(
        out
          .split(/\r?\n/)
          .filter((line) => line.startsWith("worktree "))
          .map((line) => path.resolve(line.slice("worktree ".length).trim()))
      );
    } catch {
      return { ...base, inspectionFailed: true };
    }

    const dir = path.join(repoRoot, SUBEGO_WORKTREES_DIR);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return base;
    }
    base.scanned = entries.length;

    const maxAgeMs = cleanupPeriodDays * DAY_MS;
    for (const entry of entries) {
      const fullPath = path.join(repoRoot, SUBEGO_WORKTREES_DIR, entry);
      if (registered.has(path.resolve(fullPath))) {
        base.preserved.push({ path: fullPath, pruned: false, reason: "active" });
        continue;
      }
      let mtimeMs = 0;
      try {
        const st = await stat(fullPath);
        mtimeMs = st.mtimeMs;
      } catch {
        base.preserved.push({ path: fullPath, pruned: false, reason: "stat-failed" });
        continue;
      }
      if (nowMs - mtimeMs <= maxAgeMs) {
        base.preserved.push({ path: fullPath, pruned: false, reason: "orphan-young" });
        continue;
      }
      try {
        await this.execGit(["worktree", "remove", "--force", fullPath], repoRoot);
        await this.execGit(["worktree", "prune"], repoRoot);
        base.pruned.push({ path: fullPath, pruned: true, reason: "orphan-stale" });
      } catch {
        base.preserved.push({ path: fullPath, pruned: false, reason: "prune-failed" });
      }
    }
    return base;
  }
}
