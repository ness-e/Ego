import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuarantineManager } from "../src/QuarantineManager.js";
import { FactLifecycle } from "../src/FactLifecycle.js";
import { Fact } from "../src/schemas/knowledge.js";

describe("QuarantineManager & FactLifecycle (KB-07, KB-08 / CARP-04, DSEK-01)", () => {
  let mockAdapter: any;
  let quarantine: QuarantineManager;
  let lifecycle: FactLifecycle;

  beforeEach(() => {
    mockAdapter = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([]),
    };
    quarantine = new QuarantineManager(mockAdapter);
    lifecycle = new FactLifecycle(mockAdapter);
  });

  const testFact: Fact = {
    id: "fact_test_1",
    subject: "Usuario",
    predicate: "preferencia_idioma",
    object: "Español",
    confidence: 0.55,
    temporalScope: "persistent",
    source: "chat_turn",
    validAt: Date.now(),
    invalidAt: null,
    supersededBy: null,
    state: "active",
  };

  it("deposita hechos en quarantine/pending con TTL de 14 días (CARP-04)", async () => {
    await quarantine.quarantine(testFact, "low_confidence");

    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "quarantine/pending",
        key: "fact_test_1",
        ttl_ms: 14 * 24 * 60 * 60 * 1000,
        metadata: expect.objectContaining({
          state: "quarantined",
          quarantine_reason: "low_confidence",
        }),
      })
    );
  });

  it("promueve hechos desde cuarentena a kb/facts eliminándolos del origen", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      payload: "Usuario preferencia_idioma Español",
      metadata: {
        subject: "Usuario",
        predicate: "preferencia_idioma",
        object: "Español",
        confidence: 0.9,
      },
    });

    const promoted = await lifecycle.promoteFromQuarantine("fact_test_1", {
      promotedBy: "admin",
    });

    expect(promoted.id).toBe("fact_test_1");
    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "kb/facts",
        key: "fact_test_1",
      })
    );
    expect(mockAdapter.delete).toHaveBeenCalledWith("quarantine/pending", "fact_test_1");
  });

  it("ejecuta supersesión atómica vinculando SUPERSEDED_BY sin borrado destructivo (DSEK-01)", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      payload: "Usuario preferencia_idioma Español",
      metadata: { state: "active", is_latest: true },
    });

    const newFact: Fact = {
      ...testFact,
      id: "fact_test_2",
      object: "Inglés",
      confidence: 0.95,
    };

    await lifecycle.supersedeFact("fact_test_1", newFact);

    // Inserción del nuevo hecho
    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "kb/facts",
        key: "fact_test_2",
        metadata: expect.objectContaining({
          supersedes: "fact_test_1",
          is_latest: true,
        }),
      })
    );

    // Actualización no destructiva del hecho previo
    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "kb/facts",
        key: "fact_test_1",
        metadata: expect.objectContaining({
          state: "superseded",
          is_latest: false,
          superseded_by: "fact_test_2",
        }),
      })
    );
  });
});
