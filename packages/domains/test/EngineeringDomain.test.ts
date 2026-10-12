import { describe, it, expect } from "vitest";
import path from "node:path";
import { EngineeringDomain } from "../src/engineering/EngineeringDomain.js";
import { WorktreeManager } from "../src/engineering/WorktreeManager.js";

describe("EngineeringDomain & WorktreeManager (DOM-01 / HERM-17)", () => {
  const engineering = new EngineeringDomain();
  const worktreeMgr = new WorktreeManager();
  const repoRoot = path.resolve(__dirname, "../../.."); // Raíz del proyecto Ego

  it("debe verificar que la raíz del proyecto es un repositorio Git válido", async () => {
    const isGit = await worktreeMgr.isGitRepository(repoRoot);
    expect(isGit).toBe(true);
  });

  it("debe listar los worktrees del repositorio detectando el principal", async () => {
    const worktrees = await worktreeMgr.listWorktrees(repoRoot);
    expect(worktrees.length).toBeGreaterThanOrEqual(1);

    const mainWt = worktrees.find((w) => w.isMain);
    expect(mainWt).toBeDefined();
    expect(path.resolve(mainWt!.worktreePath)).toBe(path.resolve(repoRoot));
  });

  it("debe impedir la eliminación del worktree principal (con approval para llegar al gate)", async () => {
    await expect(
      worktreeMgr.removeWorktree(repoRoot, repoRoot, true, { approved: true })
    ).rejects.toThrow(/Protección innegociable/);
  });

  it("debe escanear el workspace detectando stack Node, manifiesto y testers", async () => {
    const inspection = await engineering.scanWorkspace(repoRoot);
    expect(inspection.isGitRepo).toBe(true);
    expect(inspection.projectType).toBe("node");
    expect(inspection.manifestFiles).toContain("package.json");
    expect(inspection.currentBranch).toBeDefined();
  });

  it("debe obtener el estado de Git del workspace", async () => {
    const status = await engineering.getGitStatus(repoRoot);
    expect(status.branch).toBeDefined();
    expect(typeof status.clean).toBe("boolean");
    expect(Array.isArray(status.staged)).toBe(true);
    expect(Array.isArray(status.unstaged)).toBe(true);
  });

  it("debe obtener el git diff sin arrojar excepciones", async () => {
    const diff = await engineering.getGitDiff(repoRoot);
    expect(typeof diff).toBe("string");
  });
});
