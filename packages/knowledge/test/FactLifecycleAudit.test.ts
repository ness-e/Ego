import { describe, it, expect, vi, beforeEach } from "vitest";
import { FactLifecycle } from "../src/FactLifecycle.js";
import type { Fact } from "../src/schemas/knowledge.js";

/**
 * F2T5 Slice 2 (M11) — FactLifecycle: unwrap antes de reinsertar + auditoría.
 *
 * - La metadata leída (tagged `{String}/{Float}/{Bool}` en dumps legacy o
 *   crudos del binding) debe desenvolverse antes de reinsertar: sin unwrap,
 *   `subject` cae a "[object Object]", `confidence` al default y las claves
 *   auditadas que `putMulti` normaliza se corrompen.
 * - `promoteFromQuarantine` no debe filtrar campos de cuarentena
 *   (`quarantine_reason`, `expires_at`, …) al registro `kb/facts`.
 * - Cada transición (promote/supersede/retire) deja registro en `kb/audit`
 *   para reconciliar la ventana no atómica put→delete documentada en M11.
 */

const tagged = (v: number | string | boolean): unknown => {
  if (typeof v === "number") return { Float: v };
  if (typeof v === "string") return { String: v };
  if (typeof v === "boolean") return { Bool: v };
  return v;
};

describe("F2T5 Slice 2 (M11) — FactLifecycle unwrap + auditoría", () => {
  let mockAdapter: {
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let lifecycle: FactLifecycle;

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
  });

  function putCallsTo(namespace: string): Array<Record<string, unknown>> {
    return mockAdapter.put.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((rec) => rec["namespace"] === namespace);
  }

  it("promote desenvuelve metadata tagged y no filtra campos de cuarentena", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      key: "fact_tagged_1",
      payload: "Usuario preferencia_idioma Español",
      metadata: {
        subject: tagged("Usuario"),
        predicate: tagged("preferencia_idioma"),
        object: tagged("Español"),
        confidence: tagged(0.9),
        temporal_scope: tagged("persistent"),
        source: tagged("chat_turn"),
        valid_at: tagged(1000),
        quarantine_reason: tagged("low_confidence"),
        expires_at: tagged(9999999999999),
        state: tagged("quarantined"),
      },
    });

    const promoted = await lifecycle.promoteFromQuarantine("fact_tagged_1", {
      promotedBy: "admin",
    });

    // Fact promovido con valores reales, no "[object Object]" ni defaults.
    expect(promoted.id).toBe("fact_tagged_1");
    expect(promoted.subject).toBe("Usuario");
    expect(promoted.predicate).toBe("preferencia_idioma");
    expect(promoted.object).toBe("Español");
    expect(promoted.confidence).toBe(0.9);
    expect(promoted.confidence).not.toBe(0.85);
    expect(promoted.source).toBe("chat_turn");
    expect(promoted.validAt).toBe(1000);

    // Registro kb/facts con primitivas y sin campos de cuarentena.
    const factPuts = putCallsTo("kb/facts");
    expect(factPuts).toHaveLength(1);
    const meta = factPuts[0]["metadata"] as Record<string, unknown>;
    expect(meta["confidence"]).toBe(0.9);
    expect(typeof meta["confidence"]).toBe("number");
    expect(meta["subject"]).toBe("Usuario");
    expect(meta).not.toHaveProperty("quarantine_reason");
    expect(meta).not.toHaveProperty("expires_at");

    expect(mockAdapter.delete).toHaveBeenCalledWith("quarantine/pending", "fact_tagged_1");
  });

  it("promote deja registro de auditoría en kb/audit", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      key: "fact_audit_1",
      payload: "Ego soporta VantaDB",
      metadata: {
        subject: "Ego",
        predicate: "soporta",
        object: "VantaDB",
        confidence: 0.77,
      },
    });

    await lifecycle.promoteFromQuarantine("fact_audit_1", { promotedBy: "admin" });

    const audits = putCallsTo("kb/audit");
    expect(audits).toHaveLength(1);
    const auditMeta = audits[0]["metadata"] as Record<string, unknown>;
    expect(auditMeta["action"]).toBe("promote");
    expect(auditMeta["fact_id"]).toBe("fact_audit_1");
    expect(auditMeta["actor"]).toBe("admin");
  });

  it("supersede desenvuelve el registro previo y audita la transición", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      key: "fact_old_tagged",
      payload: "Usuario modelo_preferido Claude",
      metadata: {
        fact_id: tagged("fact_old_tagged"),
        subject: tagged("Usuario"),
        confidence: tagged(0.9),
        state: tagged("active"),
        is_latest: tagged(true),
      },
    });

    const newFact: Fact = {
      id: "fact_new_1",
      subject: "Usuario",
      predicate: "modelo_preferido",
      object: "DeepSeek-V3",
      confidence: 0.95,
      temporalScope: "persistent",
      source: "chat_turn",
      validAt: Date.now(),
      invalidAt: null,
      supersededBy: null,
      state: "active",
    };

    await lifecycle.supersedeFact("fact_old_tagged", newFact);

    const oldPuts = putCallsTo("kb/facts").filter((r) => r["key"] === "fact_old_tagged");
    expect(oldPuts).toHaveLength(1);
    const oldMeta = oldPuts[0]["metadata"] as Record<string, unknown>;
    expect(oldMeta["state"]).toBe("superseded");
    expect(oldMeta["is_latest"]).toBe(false);
    expect(oldMeta["superseded_by"]).toBe("fact_new_1");
    // Sin doble etiquetado: primitivas, no objetos {Float}/{String}.
    expect(oldMeta["confidence"]).toBe(0.9);
    expect(typeof oldMeta["confidence"]).toBe("number");
    expect(oldMeta["subject"]).toBe("Usuario");

    const audits = putCallsTo("kb/audit");
    expect(audits).toHaveLength(1);
    expect((audits[0]["metadata"] as Record<string, unknown>)["action"]).toBe("supersede");
  });

  it("retire vía consolidateMemories desenvuelve y audita", async () => {
    mockAdapter.get.mockResolvedValue(async (namespace: string, key: string) => null);
    mockAdapter.get.mockImplementation(async (_namespace: string, key: string) => {
      if (key === "fact_retire_tagged") {
        return {
          key,
          payload: "Obsoleto",
          metadata: {
            fact_id: tagged("fact_retire_tagged"),
            subject: tagged("Legacy"),
            confidence: tagged(0.6),
            state: tagged("active"),
            is_latest: tagged(true),
          },
        };
      }
      return null;
    });

    const result = await lifecycle.consolidateMemories({ retire: ["fact_retire_tagged"] });

    expect(result.retiredCount).toBe(1);
    const retired = putCallsTo("kb/facts").filter((r) => r["key"] === "fact_retire_tagged");
    expect(retired).toHaveLength(1);
    const retiredMeta = retired[0]["metadata"] as Record<string, unknown>;
    expect(retiredMeta["state"]).toBe("retired");
    expect(retiredMeta["confidence"]).toBe(0.6);
    expect(typeof retiredMeta["confidence"]).toBe("number");

    const audits = putCallsTo("kb/audit");
    expect(audits.some((a) => (a["metadata"] as Record<string, unknown>)["action"] === "retire")).toBe(
      true
    );
  });
});
