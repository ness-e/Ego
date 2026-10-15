import { describe, expect, it } from "vitest";
import { ChangeSetService } from "../src/native/git/ChangeSetService.js";

describe("STAB-14: ChangeSet artifactId/payloadRef (delta aditivo)", () => {
  it("changesets existentes siguen sin payloadRef (backward compatible)", () => {
    const cs = ChangeSetService.createChangeSet([], "empty");
    expect(cs.artifactId).toBeUndefined();
    expect(cs.payloadRef).toBeUndefined();
  });

  it("withPayloadRef adjunta artifactId + sha256 ref determinista", () => {
    const diff = ChangeSetService.fromEdit("a\n", "a\nb\n", "kb/doc.md");
    const cs = ChangeSetService.createChangeSet([diff]);
    const a = ChangeSetService.withPayloadRef(cs, "kb/doc");
    const b = ChangeSetService.withPayloadRef(cs, "kb/doc");
    expect(a.artifactId).toBe("kb/doc");
    expect(a.payloadRef).toMatch(/^sha256:[0-9a-f]{12}$/);
    expect(a.payloadRef).toBe(b.payloadRef);
    // Inmutable: original intacto.
    expect(cs.payloadRef).toBeUndefined();
  });

  it("sin artifactId no hay payloadRef", () => {
    const cs = ChangeSetService.createChangeSet([]);
    expect(ChangeSetService.withPayloadRef(cs).payloadRef).toBeUndefined();
  });

  it("buildPayloadRef es estable ante CRLF", () => {
    expect(ChangeSetService.buildPayloadRef("a\r\nb")).toBe(ChangeSetService.buildPayloadRef("a\nb"));
  });
});
