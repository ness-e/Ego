import { describe, it, expect } from "vitest";
import { TASK_SAFE_KINDS, isTaskKindSafe } from "../src/main/task-kinds.js";

describe("STAB-09: task-kinds (R5 deny-by-default)", () => {
  it("acepta los 4 kinds documentados", () => {
    for (const kind of ["indexing", "sync", "maintenance", "notification"]) {
      expect(isTaskKindSafe(kind)).toBe(true);
    }
  });

  it("niega cualquier otro kind (deny-by-default)", () => {
    for (const kind of ["shell", "exec", "admin", "INDEXING", "", "indexing "]) {
      expect(isTaskKindSafe(kind)).toBe(false);
    }
  });

  it("niega entradas no-string sin lanzar", () => {
    for (const kind of [undefined, null, 42, {}, [], true]) {
      expect(isTaskKindSafe(kind)).toBe(false);
    }
  });

  it("el conjunto exportado contiene exactamente los 4 kinds", () => {
    expect([...TASK_SAFE_KINDS].sort()).toEqual(
      ["indexing", "maintenance", "notification", "sync"].sort()
    );
  });
});
