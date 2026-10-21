import { describe, it, expect } from "vitest";
import * as runtime from "../src/index.js";

/**
 * T5 (A2-bis) — Guard de retirement de código muerto (A5-S9, A5-S16).
 *
 * `SyntheticRuntime` (COUC-14) y `StructuredInput` (OCLW-12) se asimilaron
 * sin cablear: su único consumidor era su propio test. Se retiran del barrel
 * para que **no vuelvan a colarse** por un `export *`.
 */
describe("T5 — código muerto retirado de `@ego/runtime` (A5-S9, A5-S16)", () => {
  it("el barrel ya NO exporta `SyntheticRuntime` (COUC-14)", () => {
    expect(Object.keys(runtime)).not.toContain("SyntheticRuntime");
  });

  it("el barrel ya NO exporta `StructuredInput` (OCLW-12)", () => {
    expect(Object.keys(runtime)).not.toContain("StructuredInput");
  });

  it("el barrel SIGUE exportando el `TrustBoundary` (vivo: el re-rank compuesto con confianza de `memoryRecall` — VDB-REQ-15)", () => {
    expect(Object.keys(runtime)).toContain("trustedAllowPrefixes");
  });
});
