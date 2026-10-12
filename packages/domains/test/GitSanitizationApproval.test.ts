import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  validateBranchName,
  validateTargetRef,
  assertInsideRoot,
} from "../src/engineering/WorktreeManager.js";
import { EngineeringDomain } from "../src/engineering/EngineeringDomain.js";
import { WorktreeManager } from "../src/engineering/WorktreeManager.js";

/**
 * F2T5 Slice 4 (M16) — Git: sanitización fail-closed + approval HITL.
 *
 * - Ramas: rechaza traversal (`..`), inyección de opciones (líder `-`),
 *   separadores inválidos y refs con sintaxis git prohibida.
 * - Paths: el worktree destino debe vivir DENTRO del repoRoot; eliminar
 *   fuera del root o el principal está prohibido.
 * - Mutaciones (create/remove/prune) exigen approval explícita HITL;
 *   lecturas (isGit/list/scan/status/diff/propose) no mutan y no la exigen.
 */
describe("F2T5 Slice 4 (M16) — sanitización git + approval HITL", () => {
  describe("validateBranchName (fail-closed)", () => {
    it("acepta ramas normales con / y guiones", () => {
      expect(validateBranchName("ego-task-f2t5")).toBe("ego-task-f2t5");
      expect(validateBranchName("feature/mi-rama_1")).toBe("feature/mi-rama_1");
    });

    it("rechaza traversal con ..", () => {
      expect(() => validateBranchName("../../x")).toThrow(/rama/i);
      expect(() => validateBranchName("a/../b")).toThrow(/rama/i);
    });

    it("rechaza líder - (inyección de opción en git argv)", () => {
      expect(() => validateBranchName("-evil-flag")).toThrow(/rama/i);
      expect(() => validateBranchName("--upload-pack=touch")).toThrow(/rama/i);
    });

    it("rechaza sintaxis git prohibida y vacíos", () => {
      expect(() => validateBranchName("")).toThrow(/rama/i);
      expect(() => validateBranchName("a@{b}")).toThrow(/rama/i);
      expect(() => validateBranchName("a b")).toThrow(/rama/i);
      expect(() => validateBranchName("a:b")).toThrow(/rama/i);
      expect(() => validateBranchName("a~b")).toThrow(/rama/i);
      expect(() => validateBranchName("/lider")).toThrow(/rama/i);
      expect(() => validateBranchName("trail/")).toThrow(/rama/i);
    });
  });

  describe("assertInsideRoot (confinamiento)", () => {
    const root = path.resolve("C:/repo");

    it("acepta rutas dentro del root", () => {
      const inside = path.join(root, ".ego-worktrees", "wt-x");
      expect(assertInsideRoot(root, inside)).toBe(path.resolve(inside));
    });

    it("rechaza escape con ..", () => {
      expect(() => assertInsideRoot(root, path.join(root, "..", "outside"))).toThrow(
        /fuera del repositorio/i
      );
    });

    it("rechaza ruta absoluta fuera del root", () => {
      const outside = path.resolve("C:/otro/lado");
      expect(() => assertInsideRoot(root, outside)).toThrow(/fuera del repositorio/i);
    });
  });

  describe("approval HITL en mutaciones", () => {
    const worktreeMgr = new WorktreeManager();
    const engineering = new EngineeringDomain();
    const repoRoot = path.resolve(__dirname, "../../..");

    it("createWorktree sin approval lanza antes de mutar", async () => {
      await expect(
        worktreeMgr.createWorktree(repoRoot, "ego-task-denied")
      ).rejects.toThrow(/approval/i);
    });

    it("removeWorktree sin approval lanza (no llega a git)", async () => {
      await expect(worktreeMgr.removeWorktree(repoRoot, repoRoot)).rejects.toThrow(
        /approval/i
      );
    });

    it("prune sin approval lanza", async () => {
      await expect(worktreeMgr.prune(repoRoot)).rejects.toThrow(/approval/i);
    });

    it("removeWorktree con approval conserva la protección del principal", async () => {
      await expect(
        worktreeMgr.removeWorktree(repoRoot, repoRoot, true, { approved: true })
      ).rejects.toThrow(/principal/i);
    });

    it("createIsolatedWorkspace propaga el gate HITL", async () => {
      await expect(engineering.createIsolatedWorkspace(repoRoot, "denied")).rejects.toThrow(
        /approval/i
      );
    });

    it("cleanupIsolatedWorkspace propaga el gate HITL", async () => {
      await expect(
        engineering.cleanupIsolatedWorkspace(repoRoot, path.join(repoRoot, "x"))
      ).rejects.toThrow(/approval/i);
    });

    it("proposeChanges rechaza targetBranch con forma de opción git", async () => {
      await expect(
        engineering.proposeChanges(repoRoot, "--upload-pack=touch")
      ).rejects.toThrow(/rama|ref/i);
      expect(() => validateTargetRef("-b")).toThrow(/rama|ref/i);
    });
  });
});
