import { describe, it, expect, beforeEach } from "vitest";
import {
  SessionDiffRevisions,
  type GitCommandRunner,
} from "../src/native/git/SessionDiffRevisions.js";

describe("SessionDiffRevisions Suite (OCLW-07)", () => {
  const sessionId = "session-test-01";
  const repoRoot = "C:/mock/repo";

  beforeEach(() => {
    SessionDiffRevisions.clearBaselines();
  });

  it("debe registrar el baseline y detectar diffs y commits acumulados", async () => {
    const mockRunner: GitCommandRunner = async (_cwd, args) => {
      const cmd = args.join(" ");

      if (cmd === "rev-parse HEAD") {
        return "1111111111111111111111111111111111111111\n";
      }

      if (cmd.startsWith("log")) {
        return "2222222222222222222222222222222222222222\0feat: agregar modulo\0Ego Dev\01700000000\n";
      }

      if (cmd.startsWith("diff")) {
        return `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
`;
      }

      if (cmd === "status --porcelain") {
        return " M src/app.ts\n";
      }

      return "";
    };

    // 1. Grabar baseline
    const baseSha = await SessionDiffRevisions.recordBaseline(sessionId, repoRoot, mockRunner);
    expect(baseSha).toBe("1111111111111111111111111111111111111111");

    // 2. Simular cambio de HEAD para el cómputo posterior
    const updatedRunner: GitCommandRunner = async (_cwd, args) => {
      const cmd = args.join(" ");
      if (cmd === "rev-parse HEAD") {
        return "2222222222222222222222222222222222222222\n";
      }
      return mockRunner(_cwd, args);
    };

    const revisions = await SessionDiffRevisions.computeRevisions(
      sessionId,
      repoRoot,
      updatedRunner
    );

    expect(revisions.sessionId).toBe(sessionId);
    expect(revisions.baselineCommit).toBe(baseSha);
    expect(revisions.currentHead).toBe("2222222222222222222222222222222222222222");
    expect(revisions.commitsCreated).toHaveLength(1);
    expect(revisions.commitsCreated[0].sha).toBe("2222222222222222222222222222222222222222");
    expect(revisions.commitsCreated[0].message).toBe("feat: agregar modulo");
    expect(revisions.diffSummary.files).toContain("src/app.ts");
    expect(revisions.diffSummary.additions).toBe(1);
    expect(revisions.isDirty).toBe(true);
  });
});
