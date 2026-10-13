import { describe, it, expect } from "vitest";
import { fromMemoryManifest } from "../src/SubEgoManifest.js";
import type { SubEgoManifest as MemorySubEgoManifest } from "@ego/memory";

/**
 * HIG-03-F2 — El manifiesto legacy mínimo persistido por `@ego/memory`
 * (rama custom de `ipc.subegos.create`) debe promoverse al tipo canónico
 * de `@ego/subegos` sin casts `as unknown as`, rellenando defaults
 * validados por `SubEgoManifestSchema`.
 */
describe("@ego/subegos — fromMemoryManifest adapter (HIG-03-F2)", () => {
  const legacyMinimal: MemorySubEgoManifest = {
    id: "ego.legacy-tester",
    name: "Legacy Tester",
    role: "QA manual",
    description: "Manifiesto legacy mínimo persistido en gov/sub_egos",
    systemPrompt: "Actúa como tester manual con rigor y precisión técnica.",
    creator: "user",
    createdAtMs: 1700000000000,
    namespaces: {
      read: ["kb/docs", "egos/ego.legacy-tester/*"],
      write: ["egos/ego.legacy-tester/*", "quarantine/pending"],
    },
    tools: ["memory_recall", "propose_draft"],
    budget: {
      maxTokensPerCall: 4000,
      maxDailyCostUsd: 2.0,
      requiresApprovalAboveUsd: 0.5,
    },
    trigger: "manual",
    state: "active",
  };

  it("promueve un manifiesto legacy mínimo a canónico con defaults", () => {
    const canonical = fromMemoryManifest(legacyMinimal);

    expect(canonical.id).toBe("ego.legacy-tester");
    expect(canonical.name).toBe("Legacy Tester");
    expect(canonical.systemPrompt).toBe(legacyMinimal.systemPrompt);
    expect(canonical.responsibilities).toEqual([]);
    expect(canonical.capabilities).toEqual([]);
    expect(canonical.permissions).toEqual([]);
    expect(canonical.behavior).toEqual({
      tone: "analytical",
      proactivity: "moderate",
      verbosity: "balanced",
    });
    expect(canonical.autonomy).toBe("supervised");
    expect(canonical.trigger).toBe("manual");
    expect(canonical.state).toBe("active");
    expect(canonical.creator).toBe("user");
    expect(typeof canonical.updatedAtMs).toBe("number");
  });

  it("preserva el creador template de la modalidad fromTemplate", () => {
    const canonical = fromMemoryManifest({ ...legacyMinimal, creator: "template" });
    expect(canonical.creator).toBe("template");
  });

  it("lanza ante un manifiesto legacy inválido", () => {
    expect(() =>
      fromMemoryManifest({ ...legacyMinimal, systemPrompt: "corto" })
    ).toThrow();
  });
});
