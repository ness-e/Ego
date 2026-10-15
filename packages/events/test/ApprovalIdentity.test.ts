import { describe, expect, it } from "vitest";
import {
  ApprovalIdentityMismatchError,
  assertSameApproval,
  buildApprovalIdentity,
  digestInput,
  isSameApproval,
} from "../src/ApprovalIdentity.js";

describe("STAB-14: ApprovalIdentity (decisión cruzada rechazada)", () => {
  const base = { runId: "run_1", taskId: "task_1", subEgoId: "sub_1", toolId: "fs_write", input: { path: "a.txt" } };

  it("sella identidad con inputDigest SHA-256 determinista", () => {
    const a = buildApprovalIdentity(base);
    const b = buildApprovalIdentity({ ...base, input: { path: "a.txt" } });
    expect(a.inputDigest).toBe(b.inputDigest);
    expect(a.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(digestInput({ b: 1, a: 2 })).toBe(digestInput({ a: 2, b: 1 }));
  });

  it("acepta la misma aprobación (isSameApproval true, assert no throw)", () => {
    const expected = buildApprovalIdentity(base);
    const actual = buildApprovalIdentity({ ...base });
    expect(isSameApproval(expected, actual)).toBe(true);
    expect(() => assertSameApproval(expected, actual)).not.toThrow();
  });

  it("rechaza decisión cruzada por runId distinto", () => {
    const expected = buildApprovalIdentity(base);
    const actual = buildApprovalIdentity({ ...base, runId: "run_2" });
    expect(isSameApproval(expected, actual)).toBe(false);
    expect(() => assertSameApproval(expected, actual)).toThrowError(ApprovalIdentityMismatchError);
    try {
      assertSameApproval(expected, actual);
    } catch (e) {
      expect((e as ApprovalIdentityMismatchError).field).toBe("runId");
    }
  });

  it("rechaza decisión cruzada por input distinto (mismo tool, otro payload)", () => {
    const expected = buildApprovalIdentity(base);
    const actual = buildApprovalIdentity({ ...base, input: { path: "b.txt" } });
    expect(() => assertSameApproval(expected, actual)).toThrowError(/inputDigest/);
  });

  it("input undefined sella digest determinista sin throw", () => {
    const a = buildApprovalIdentity({ runId: "r", taskId: "t", subEgoId: "s", toolId: "tool" });
    const b = buildApprovalIdentity({ runId: "r", taskId: "t", subEgoId: "s", toolId: "tool", input: undefined });
    expect(a.inputDigest).toBe(b.inputDigest);
  });
});
