export type GitFileStatusCode = "modified" | "added" | "deleted" | "untracked" | "renamed";

export interface GitFileStatus {
  path: string;
  status: GitFileStatusCode;
  staged: boolean;
}

export interface GitStatusSummary {
  branch: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  files: GitFileStatus[];
  staged: string[];
  unstaged: string[];
  untracked: string[];
  isClean: boolean;
}

export interface GitDiffChunk {
  header: string;
}

export interface GitDiffSummary {
  diff: string;
  raw: string;
  files: string[];
  filesChanged: number;
  additions: number;
  deletions: number;
  chunks: GitDiffChunk[];
}

/**
 * Parser estructurado para comandos Git en Ego.
 * Patrón OpenClaw OCLW-08 (Unidiff parser y porcelain status).
 */
export class GitParser {
  /**
   * Parsea la salida de `git status --porcelain=v1 -b`.
   */
  public static parseStatus(output: string): GitStatusSummary {
    const lines = output.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    let branch = "HEAD";
    let upstream: string | undefined;
    let ahead: number | undefined;
    let behind: number | undefined;

    const files: GitFileStatus[] = [];
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        // Formato: ## main...origin/main [ahead 1, behind 2] o ## main
        const header = line.slice(3).trim();
        const branchParts = header.split("...");
        branch = branchParts[0].trim();

        if (branchParts.length > 1) {
          const rest = branchParts[1].trim();
          const bracketIdx = rest.indexOf("[");
          if (bracketIdx !== -1) {
            upstream = rest.slice(0, bracketIdx).trim();
            const branchMeta = rest.slice(bracketIdx);

            const aheadMatch = branchMeta.match(/ahead\s+(\d+)/);
            if (aheadMatch) {
              ahead = parseInt(aheadMatch[1], 10);
            }

            const behindMatch = branchMeta.match(/behind\s+(\d+)/);
            if (behindMatch) {
              behind = parseInt(behindMatch[1], 10);
            }
          } else {
            upstream = rest;
          }
        }
        continue;
      }

      if (line.length < 3) continue;

      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();

      if (x === "?" && y === "?") {
        untracked.push(filePath);
        files.push({ path: filePath, status: "untracked", staged: false });
      } else {
        // En índice (staged)
        if (x !== " " && x !== "?") {
          staged.push(filePath);
          const status = GitParser.mapStatusCode(x);
          files.push({ path: filePath, status, staged: true });
        }
        // En working tree (unstaged)
        if (y !== " " && y !== "?") {
          unstaged.push(filePath);
          const status = GitParser.mapStatusCode(y);
          files.push({ path: filePath, status, staged: false });
        }
      }
    }

    return {
      branch,
      upstream,
      ahead,
      behind,
      files,
      staged,
      unstaged,
      untracked,
      isClean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    };
  }

  /**
   * Parsea la salida cruda de `git diff` calculando métricas de adición y eliminación.
   */
  public static parseDiff(output: string): GitDiffSummary {
    const lines = output.split("\n");
    const files: string[] = [];
    const chunks: GitDiffChunk[] = [];
    let filesChanged = 0;
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith("diff --git ")) {
        filesChanged++;
        const parts = line.split(" ");
        if (parts.length >= 4) {
          const bPath = parts[3].replace(/^b\//, "");
          if (!files.includes(bPath)) {
            files.push(bPath);
          }
        }
      } else if (line.startsWith("@@")) {
        const headerEnd = line.indexOf("@@", 2);
        const header = headerEnd !== -1 ? line.slice(0, headerEnd + 2) : line;
        chunks.push({ header });
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        additions++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions++;
      }
    }

    return {
      diff: output,
      raw: output,
      files,
      filesChanged,
      additions,
      deletions,
      chunks,
    };
  }

  private static mapStatusCode(code: string): GitFileStatusCode {
    switch (code) {
      case "M":
        return "modified";
      case "A":
        return "added";
      case "D":
        return "deleted";
      case "R":
        return "renamed";
      default:
        return "modified";
    }
  }
}
