import { describe, it, expect } from "vitest";
import * as events from "../src/index.js";

/**
 * T5 (A2-bis) — Guard de retirement de código muerto (A5-S6, A5-S7).
 *
 * `EventNormalizer` (COUC-01) y `EventIngress` (COUC-02) se asimilaron sin
 * cablear: su único consumidor era el otro (y sus propios tests). Se retiran
 * del barrel para que **no vuelvan a colarse** por un `export *`.
 */
describe("T5 — código muerto retirado de `@ego/events` (A5-S6, A5-S7)", () => {
  it("el barrel ya NO exporta `EventNormalizer` (COUC-01)", () => {
    expect(Object.keys(events)).not.toContain("EventNormalizer");
  });

  it("el barrel ya NO exporta `EventIngress` (COUC-02)", () => {
    expect(Object.keys(events)).not.toContain("EventIngress");
  });
});
