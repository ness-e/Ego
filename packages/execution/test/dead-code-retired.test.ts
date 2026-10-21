import { describe, it, expect } from "vitest";
import * as execution from "../src/index.js";

/**
 * T5 (A2-bis) — Guard de retirement de código muerto (A5-S8).
 *
 * `SafeConfigMutation` (COUC-10) se asimiló sin cablear: el patrón sí está
 * implementado, pero **inline** en `packages/integrations` (MCP), no en este
 * módulo. Se retira del barrel para que no vuelva a colarse por un
 * `export *`.
 *
 * ⚠️ `ZeroContextKernel` (HERM-18) **NO** se retira: tiene un caller real
 * fuera de esta zona (`tests/security/injection-boundaries.test.ts`, SEC-08.C).
 */
describe("T5 — código muerto retirado de `@ego/execution` (A5-S8)", () => {
  it("el barrel ya NO exporta `SafeConfigMutation` (COUC-10)", () => {
    expect(Object.keys(execution)).not.toContain("SafeConfigMutationService");
  });

  it("`ZeroContextKernel` SIGUE vivo (caller real: SEC-08.C en `tests/security`)", () => {
    expect(Object.keys(execution)).toContain("ZeroContextKernel");
  });
});
