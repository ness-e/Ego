import { describe, it, expect } from "vitest";
import * as memory from "../index.js";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * T5 (A2-bis) — Guard de retirement de código muerto (A5-S10, S12, S13, S14,
 * S15, S18).
 *
 * Estos seis módulos se asimilaron sin cablear: su único consumidor era su
 * propio test. Se retiran del barrel (y sus módulos del árbol) para que no
 * vuelvan a colarse por un `export *`.
 *
 * `OpaqueId` (DSEK-03) y `SessionCheckpointPolicy` (DSEK-05) **NO** se
 * retiran: admiten dos salidas (retirar vs cablear) ⇒ es decisión de
 * producto (ver handoff A2-bis §"Solicitudes fuera de zona").
 */
describe("T5 — código muerto retirado de `@ego/memory` (A5-S10, S12, S13, S14, S15, S18)", () => {
  const retired = [
    "SessionTimelineRewind",
    "DataContract",
    "DataContractError",
    "UntrustedContentSanitizer",
    "SessionLifecycleLocks",
    "TranscriptReadWindow",
  ] as const;

  for (const symbol of retired) {
    it(`el barrel ya NO exporta \`${symbol}\``, () => {
      expect(Object.keys(memory)).not.toContain(symbol);
    });
  }

  it("`EgoMemoryAdapter` ya NO expone `getVersionHistory` (DSEK-02)", () => {
    const proto = EgoMemoryAdapter.prototype as unknown as Record<string, unknown>;
    expect(proto["getVersionHistory"]).toBeUndefined();
  });

  it("`EgoMemoryAdapter` ya NO expone `getAtTimestamp` (DSEK-02)", () => {
    const proto = EgoMemoryAdapter.prototype as unknown as Record<string, unknown>;
    expect(proto["getAtTimestamp"]).toBeUndefined();
  });

  it("`OpaqueId` y `SessionCheckpointPolicy` SIGUEN vivos (decisión de producto pendiente)", () => {
    expect(Object.keys(memory)).toContain("generateOpaqueId");
    expect(Object.keys(memory)).toContain("SessionCheckpointPolicy");
  });
});
