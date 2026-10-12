import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import {
  WorktreeManager,
  validateTargetRef,
  type MutationApproval,
  type WorktreeInfo,
} from "./WorktreeManager.js";

const execFileAsync = promisify(execFile);

export interface WorkspaceInspection {
  workspaceRoot: string;
  isGitRepo: boolean;
  currentBranch?: string;
  projectType: "node" | "rust" | "python" | "go" | "generic";
  manifestFiles: string[];
  detectedLinters: string[];
  detectedFormatters: string[];
  detectedTesters: string[];
}

export interface GitStatusSummary {
  branch: string;
  clean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface ChangeProposal {
  proposalId: string;
  sourceWorktree: string;
  targetBranch: string;
  diffSummary: string;
  filesChanged: string[];
  checksum: string;
  createdAt: string;
}

/**
 * Dominio de Ingeniería de Software (DOM-01 / HERM-17).
 * Provee herramientas especializadas para inspección, Git y aislamiento de código en worktrees.
 */
export class EngineeringDomain {
  private worktreeManager = new WorktreeManager();

  public getWorktreeManager(): WorktreeManager {
    return this.worktreeManager;
  }

  /**
   * Inspecciona exhaustivamente el espacio de trabajo para identificar stack, manifiestos y herramientas.
   */
  public async scanWorkspace(workspaceRoot: string): Promise<WorkspaceInspection> {
    const isGit = await this.worktreeManager.isGitRepository(workspaceRoot);
    let currentBranch: string | undefined;

    if (isGit) {
      try {
        const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
          cwd: workspaceRoot,
        });
        currentBranch = stdout.trim() || "HEAD (detached)";
      } catch {
        currentBranch = undefined;
      }
    }

    const manifestFiles: string[] = [];
    const detectedLinters: string[] = [];
    const detectedFormatters: string[] = [];
    const detectedTesters: string[] = [];
    let projectType: WorkspaceInspection["projectType"] = "generic";

    try {
      const entries = await fs.readdir(workspaceRoot);

      if (entries.includes("package.json")) {
        projectType = "node";
        manifestFiles.push("package.json");

        // Leer package.json para detectar dependencias
        try {
          const raw = await fs.readFile(path.join(workspaceRoot, "package.json"), "utf8");
          const pkg = JSON.parse(raw);
          const allDeps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
          };

          if (allDeps.eslint) detectedLinters.push("eslint");
          if (allDeps["@biomejs/biome"] || entries.includes("biome.json")) {
            detectedLinters.push("biome");
            detectedFormatters.push("biome");
          }
          if (allDeps.prettier || entries.includes(".prettierrc")) {
            detectedFormatters.push("prettier");
          }
          if (allDeps.vitest) detectedTesters.push("vitest");
          if (allDeps.jest) detectedTesters.push("jest");
        } catch {
          // Ignorar fallo de parseo de package.json
        }
      } else if (entries.includes("Cargo.toml")) {
        projectType = "rust";
        manifestFiles.push("Cargo.toml");
        detectedLinters.push("clippy");
        detectedFormatters.push("rustfmt");
        detectedTesters.push("cargo test");
      } else if (entries.includes("pyproject.toml") || entries.includes("requirements.txt")) {
        projectType = "python";
        if (entries.includes("pyproject.toml")) manifestFiles.push("pyproject.toml");
        if (entries.includes("requirements.txt")) manifestFiles.push("requirements.txt");
        if (entries.includes("ruff.toml")) detectedLinters.push("ruff");
        detectedTesters.push("pytest");
      } else if (entries.includes("go.mod")) {
        projectType = "go";
        manifestFiles.push("go.mod");
        detectedLinters.push("golangci-lint");
        detectedFormatters.push("gofmt");
        detectedTesters.push("go test");
      }
    } catch {
      // Ignorar errores al leer el directorio
    }

    return {
      workspaceRoot: path.resolve(workspaceRoot),
      isGitRepo: isGit,
      currentBranch,
      projectType,
      manifestFiles,
      detectedLinters,
      detectedFormatters,
      detectedTesters,
    };
  }

  /**
   * Obtiene el estado resumido de Git para el directorio de trabajo.
   */
  public async getGitStatus(workspaceRoot: string): Promise<GitStatusSummary> {
    const isGit = await this.worktreeManager.isGitRepository(workspaceRoot);
    if (!isGit) {
      return {
        branch: "none",
        clean: true,
        staged: [],
        unstaged: [],
        untracked: [],
      };
    }

    const { stdout: branchOut } = await execFileAsync("git", ["branch", "--show-current"], {
      cwd: workspaceRoot,
    });
    const branch = branchOut.trim() || "HEAD";

    const { stdout: statusOut } = await execFileAsync(
      "git",
      ["status", "--porcelain=v1"],
      { cwd: workspaceRoot }
    );

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    const lines = statusOut.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const x = line[0];
      const y = line[1];
      const filePath = line.substring(3).trim();

      if (x === "?" && y === "?") {
        untracked.push(filePath);
      } else {
        if (x !== " " && x !== "?") staged.push(filePath);
        if (y !== " " && y !== "?") unstaged.push(filePath);
      }
    }

    return {
      branch,
      clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
      staged,
      unstaged,
      untracked,
    };
  }

  /**
   * Obtiene el diff de Git (staged o un-staged). Solo lectura.
   */
  public async getGitDiff(
    workspaceRoot: string,
    options?: { staged?: boolean; pathFilter?: string }
  ): Promise<string> {
    const isGit = await this.worktreeManager.isGitRepository(workspaceRoot);
    if (!isGit) return "";

    if (options?.pathFilter?.includes("\0")) {
      throw new Error("[EngineeringDomain] pathFilter inválido: contiene byte nulo.");
    }

    const args = ["diff"];
    if (options?.staged) args.push("--staged");
    if (options?.pathFilter) {
      args.push("--", options.pathFilter);
    }

    try {
      const { stdout } = await execFileAsync("git", args, { cwd: workspaceRoot });
      return stdout;
    } catch {
      return "";
    }
  }

  /**
   * Crea un espacio de trabajo aislado (Worktree) para realizar mutaciones de software seguras (HERM-17).
   * Mutación: exige approval HITL (propagada a `WorktreeManager.createWorktree`).
   */
  public async createIsolatedWorkspace(
    repoRoot: string,
    taskSlug: string,
    opts?: MutationApproval
  ): Promise<WorktreeInfo> {
    const branchName = `ego-task-${taskSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
    return this.worktreeManager.createWorktree(repoRoot, branchName, undefined, opts);
  }

  /**
   * Limpia un entorno de desarrollo aislado cuando la tarea concluye.
   * Mutación: exige approval HITL (propagada a `WorktreeManager.removeWorktree`).
   */
  public async cleanupIsolatedWorkspace(
    repoRoot: string,
    worktreePath: string,
    opts?: MutationApproval
  ): Promise<boolean> {
    return this.worktreeManager.removeWorktree(repoRoot, worktreePath, true, opts);
  }

  /**
   * Genera una propuesta de cambio formal comparando el worktree aislado con la rama base.
   * Solo lectura (`git diff`): no exige approval, pero valida `targetBranch`
   * como ref (cierra inyección de opciones en argv).
   */
  public async proposeChanges(
    isolatedWorktreePath: string,
    targetBranch: string
  ): Promise<ChangeProposal> {
    if (
      typeof isolatedWorktreePath !== "string" ||
      isolatedWorktreePath.length === 0 ||
      isolatedWorktreePath.includes("\0")
    ) {
      throw new Error("[EngineeringDomain] isolatedWorktreePath inválido.");
    }
    const safeRef = validateTargetRef(targetBranch);
    const cwd = path.resolve(isolatedWorktreePath);
    const { stdout: diffOut } = await execFileAsync(
      "git",
      ["diff", `${safeRef}...HEAD`],
      { cwd }
    );

    const { stdout: filesOut } = await execFileAsync(
      "git",
      ["diff", "--name-only", `${safeRef}...HEAD`],
      { cwd }
    );

    const filesChanged = filesOut
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const checksum = crypto.createHash("sha256").update(diffOut).digest("hex");

    return {
      proposalId: `prop_${Date.now()}`,
      sourceWorktree: path.resolve(isolatedWorktreePath),
      targetBranch: safeRef,
      diffSummary: diffOut,
      filesChanged,
      checksum,
      createdAt: new Date().toISOString(),
    };
  }
}
