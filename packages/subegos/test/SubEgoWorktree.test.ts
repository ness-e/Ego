import { describe, it, expect, vi } from "vitest";
import { SubEgoWorktreeManager, type WorktreeInfo } from "../src/SubEgoWorktree.js";

describe("HERM-17: SubEgoWorktreeManager (Aislamiento con Git Worktrees)", () => {
  it("crea un worktree aislado configurando la ruta y la rama temporal", async () => {
    const mockExec = vi.fn((args: string[]) => {
      if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return "/mock/repo";
      if (args[0] === "rev-parse" && args[1] === "HEAD") return "commit123";
      if (args[0] === "worktree" && args[1] === "add") return "";
      return "";
    });

    const manager = new SubEgoWorktreeManager(mockExec, () => false);
    const info = await manager.createWorktree("/mock/repo", "dev-agent");

    expect(info).not.toBeNull();
    expect(info?.branch).toBe("ego-subego/subego-dev-agent");
    expect(info?.repoRoot).toBe("/mock/repo");
    expect(info?.baseCommit).toBe("commit123");
  });

  it("poda (prune) el worktree si no hubo commits y el árbol quedó limpio", async () => {
    const mockExec = vi.fn((args: string[]) => {
      if (args[0] === "status") return ""; // limpio
      if (args[0] === "rev-list") return "0"; // 0 commits
      if (args[0] === "worktree" && args[1] === "remove") return "";
      if (args[0] === "branch" && args[1] === "-D") return "";
      return "";
    });

    const manager = new SubEgoWorktreeManager(mockExec, () => true);
    const info: WorktreeInfo = {
      path: "/mock/repo/.ego-worktrees/subego-test",
      branch: "ego-subego/subego-test",
      repoRoot: "/mock/repo",
      baseCommit: "commit123",
    };

    const result = await manager.finalizeWorktree(info, { pruneIfClean: true });

    expect(result.pruned).toBe(true);
    expect(result.commits).toBe(0);
    expect(result.dirty).toBe(false);
  });

  it("preserva el worktree para revisión HITL si contiene commits o cambios dirty", async () => {
    const mockExec = vi.fn((args: string[]) => {
      if (args[0] === "status") return "M src/feature.ts\n"; // dirty
      if (args[0] === "rev-list") return "2"; // 2 commits
      return "";
    });

    const manager = new SubEgoWorktreeManager(mockExec, () => true);
    const info: WorktreeInfo = {
      path: "/mock/repo/.ego-worktrees/subego-test",
      branch: "ego-subego/subego-test",
      repoRoot: "/mock/repo",
      baseCommit: "commit123",
    };

    const result = await manager.finalizeWorktree(info, { pruneIfClean: true });

    expect(result.pruned).toBe(false);
    expect(result.preservedForReview).toBe(true);
    expect(result.commits).toBe(2);
    expect(result.dirty).toBe(true);
    expect(result.note).toContain("Trabajo detectado");
  });
});
