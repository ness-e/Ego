import { describe, it, expect, vi } from "vitest";
import * as path from "node:path";
import { SubEgoWorktreeManager } from "../src/SubEgoWorktree.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const wt = (...segs: string[]) => path.join("/repo", ".ego-worktrees", ...segs);

function porcelain(worktrees: string[]): string {
  return worktrees.map((w) => `worktree ${w}\n`).join("");
}

describe("SubEgoWorktreeManager.pruneOrphanWorktrees (STAB-05)", () => {
  it("poda el huérfano stale en disco fuera de `git worktree list`", async () => {
    const mockExec = vi.fn((args: string[]) => {
      if (args[0] === "worktree" && args[1] === "list") {
        return porcelain(["/repo", "/repo/.ego-worktrees/subego-active"]);
      }
      if (args[0] === "worktree" && args[1] === "remove") return "";
      if (args[0] === "worktree" && args[1] === "prune") return "";
      return "";
    });
    const manager = new SubEgoWorktreeManager(mockExec, () => true);
    const readdir = async () => ["subego-active", "subego-orphan"];
    const stat = async (p: string) => ({
      mtimeMs: p.endsWith("subego-orphan") ? NOW - 40 * DAY_MS : NOW - DAY_MS,
    });

    const report = await manager.pruneOrphanWorktrees("/repo", {
      nowMs: NOW,
      cleanupPeriodDays: 30,
      readdirFn: readdir as never,
      statFn: stat as never,
    });

    expect(report.scanned).toBe(2);
    expect(report.pruned.map((p) => p.path)).toEqual([wt("subego-orphan")]);
    expect(report.preserved.map((p) => p.path)).toEqual([wt("subego-active")]);
  });

  it("preserva el huérfano joven (menor a 30d) sin tocar git", async () => {
    const mockExec = vi.fn((args: string[]) => {
      if (args[0] === "worktree" && args[1] === "list") return porcelain(["/repo"]);
      return "";
    });
    const manager = new SubEgoWorktreeManager(mockExec, () => true);

    const report = await manager.pruneOrphanWorktrees("/repo", {
      nowMs: NOW,
      cleanupPeriodDays: 30,
      readdirFn: (async () => ["subego-young"]) as never,
      statFn: (async () => ({ mtimeMs: NOW - 2 * DAY_MS })) as never,
    });

    expect(report.pruned).toHaveLength(0);
    expect(report.preserved[0].reason).toBe("orphan-young");
    expect(mockExec).not.toHaveBeenCalledWith(
      expect.arrayContaining(["remove"]),
      expect.anything()
    );
  });

  it("fallo de inspección git → reporte vacío conservador (no poda)", async () => {
    const mockExec = vi.fn(() => {
      throw new Error("git roto");
    });
    const manager = new SubEgoWorktreeManager(mockExec, () => true);

    const report = await manager.pruneOrphanWorktrees("/repo", {
      nowMs: NOW,
      readdirFn: (async () => ["subego-x"]) as never,
      statFn: (async () => ({ mtimeMs: 0 })) as never,
    });

    expect(report.pruned).toHaveLength(0);
    expect(report.preserved).toHaveLength(0);
    expect(report.inspectionFailed).toBe(true);
  });

  it("fallo de remove → huérfano preservado con razón explícita", async () => {
    const mockExec = vi.fn((args: string[]) => {
      if (args[0] === "worktree" && args[1] === "list") return porcelain(["/repo"]);
      throw new Error("remove roto");
    });
    const manager = new SubEgoWorktreeManager(mockExec, () => true);

    const report = await manager.pruneOrphanWorktrees("/repo", {
      nowMs: NOW,
      cleanupPeriodDays: 30,
      readdirFn: (async () => ["subego-orphan"]) as never,
      statFn: (async () => ({ mtimeMs: NOW - 40 * DAY_MS })) as never,
    });

    expect(report.pruned).toHaveLength(0);
    expect(report.preserved[0].reason).toBe("prune-failed");
  });
});
