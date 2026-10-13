import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FactLifecycle } from "../src/FactLifecycle.js";
import type { Fact } from "../src/schemas/knowledge.js";

/**
 * HIG-05 (residual M16) — unicidad de audit keys bajo el mismo ms.
 *
 * La key era `audit_${now}_${action}_${factId}`: dos eventos con igual
 * (ms, action, factId) — p.ej. doble `supersedeFact` del mismo hecho en un
 * loop de `consolidateMemories`, o reintento idempotente dentro del mismo
 * milisegundo — colisionan y el segundo `put` sobrescribe al primero:
 * se pierde un registro de auditoría (best-effort, pero la M11 promete
 * "cada transición deja registro"). La key debe llevar un sufijo único.
 */
describe("HIG-05 — unicidad de audit keys bajo el mismo ms", () => {
  let mockAdapter: {
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let lifecycle: FactLifecycle;

  const FIXED_NOW = 1786723200000;

  beforeEach(() => {
    mockAdapter = {
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      delete: vi.fn(async () => true),
      list: vi.fn(async () => []),
    };
    lifecycle = new FactLifecycle(
      mockAdapter as unknown as Parameters<FactLifecycle["constructor"]>[0]
    );
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function auditKeys(): string[] {
    return mockAdapter.put.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((rec) => rec["namespace"] === "kb/audit")
      .map((rec) => rec["key"] as string);
  }

  function newFact(id: string): Fact {
    return {
      id,
      subject: "Usuario",
      predicate: "modelo_preferido",
      object: "X",
      confidence: 0.9,
      temporalScope: "persistent",
      source: "chat_turn",
      validAt: FIXED_NOW,
      invalidAt: null,
      supersededBy: null,
      state: "active",
    };
  }

  it("dos supersede del mismo hecho en el mismo ms dejan 2 registros distintos", async () => {
    await lifecycle.supersedeFact("fact_dup", newFact("fact_new_a"));
    await lifecycle.supersedeFact("fact_dup", newFact("fact_new_b"));

    const keys = auditKeys();
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  it("la key conserva prefijo auditable action+fact para reconciliación", async () => {
    await lifecycle.supersedeFact("fact_dup", newFact("fact_new_a"));

    const keys = auditKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain(`supersede_fact_dup`);
    expect(keys[0]).toContain(String(FIXED_NOW));
  });
});
