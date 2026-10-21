import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitParser, type GitDiffSummary } from "./GitParser.js";

const execFileAsync = promisify(execFile);

export type GitCommandRunner = (cwd: string, args: string[]) => Promise<string>;

export interface SessionCommitRecord {
  sha: string;
  message: string;
  author?: string;
  timestamp?: number;
}

export interface SessionDiffRevisionResult {
  sessionId: string;
  baselineCommit: string;
  currentHead: string;
  commitsCreated: SessionCommitRecord[];
  diffSummary: GitDiffSummary;
  isDirty: boolean;
}

const defaultGitRunner: GitCommandRunner = async (cwd: string, args: string[]) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
};

/**
 * Rastreador acumulativo de revisiones y diffs por sesión (OCLW-07).
 * Implementación propia de Ego: el patrón (diff acumulado de la sesión) se
 * estudió en OpenClaw (`src/sessions/session-diff-revisions.ts`), pero **este
 * código no es un port**: allí se resuelve el *merge-base* de una rama; aquí
 * se registra el SHA base de la sesión y se listan sus revisiones. Sin
 * atribución de código derivado.
 *
 * Alimenta la vista de cambios de archivos y diffs acumulados en el
 * Canvas del Dynamic Workspace de Ego.
 */
export class SessionDiffRevisions {
  private static readonly baselines = new Map<string, string>();

  /**
   * Registra el commit SHA base (baseline) al iniciar o activar la sesión.
   */
  public static async recordBaseline(
    sessionId: string,
    repoRoot: string,
    runner: GitCommandRunner = defaultGitRunner
  ): Promise<string> {
    try {
      const stdout = await runner(repoRoot, ["rev-parse", "HEAD"]);
      const sha = stdout.trim();
      this.baselines.set(sessionId, sha);
      return sha;
    } catch {
      // Repositorio vacío o sin commits aún
      const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
      this.baselines.set(sessionId, emptyTree);
      return emptyTree;
    }
  }

  /**
   * Obtiene el commit base registrado para una sesión.
   */
  public static getBaseline(sessionId: string): string | undefined {
    return this.baselines.get(sessionId);
  }

  /**
   * Establece un baseline explícito en memoria.
   */
  public static setBaseline(sessionId: string, sha: string): void {
    this.baselines.set(sessionId, sha);
  }

  /**
   * Limpia baselines registrados.
   */
  public static clearBaselines(): void {
    this.baselines.clear();
  }

  /**
   * Calcula los diffs y commits acumulados realizados por la sesión en el repositorio.
   */
  public static async computeRevisions(
    sessionId: string,
    repoRoot: string,
    runner: GitCommandRunner = defaultGitRunner
  ): Promise<SessionDiffRevisionResult> {
    let baseline = this.baselines.get(sessionId);
    if (!baseline) {
      baseline = await this.recordBaseline(sessionId, repoRoot, runner);
    }

    let currentHead = baseline;
    try {
      const stdout = await runner(repoRoot, ["rev-parse", "HEAD"]);
      currentHead = stdout.trim();
    } catch {
      // Repositorio sin commits
    }

    // 1. Obtener commits creados desde el baseline
    const commitsCreated: SessionCommitRecord[] = [];
    if (baseline !== currentHead) {
      try {
        const stdout = await runner(repoRoot, [
          "log",
          `${baseline}..${currentHead}`,
          "--pretty=format:%H%x00%s%x00%an%x00%ct",
        ]);
        const lines = stdout.split("\n").filter(Boolean);
        for (const line of lines) {
          const [sha, message, author, ts] = line.split("\0");
          if (sha && message) {
            commitsCreated.push({
              sha,
              message,
              author,
              timestamp: ts ? Number(ts) * 1000 : undefined,
            });
          }
        }
      } catch {
        // Fallback si la comparación de rango falla
      }
    }

    // 2. Obtener diff acumulado (desde baseline hasta working tree actual)
    let rawDiff = "";
    try {
      rawDiff = await runner(repoRoot, ["diff", baseline]);
    } catch {
      try {
        rawDiff = await runner(repoRoot, ["diff", "HEAD"]);
      } catch {
        rawDiff = "";
      }
    }

    const diffSummary = GitParser.parseDiff(rawDiff);

    // 3. Comprobar si hay cambios sin commit (working directory sucio)
    let isDirty = false;
    try {
      const stdout = await runner(repoRoot, ["status", "--porcelain"]);
      isDirty = stdout.trim().length > 0;
    } catch {
      isDirty = false;
    }

    return {
      sessionId,
      baselineCommit: baseline,
      currentHead,
      commitsCreated,
      diffSummary,
      isDirty,
    };
  }
}
