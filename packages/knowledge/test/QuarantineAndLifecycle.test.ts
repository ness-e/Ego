import { describe, it, expect, vi, beforeEach } from "vitest";
import { asEgoAdapter, type KnowledgeAdapterMock } from "./mockAdapter.js";
import { QuarantineManager } from "../src/QuarantineManager.js";
import { FactLifecycle } from "../src/FactLifecycle.js";
import { Fact } from "../src/schemas/knowledge.js";

describe("QuarantineManager & FactLifecycle (KB-07, KB-08 / CARP-04, DSEK-01)", () => {
  let mockAdapter: KnowledgeAdapterMock;
  let quarantine: QuarantineManager;
  let lifecycle: FactLifecycle;

  beforeEach(() => {
    mockAdapter = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as KnowledgeAdapterMock;
    quarantine = new QuarantineManager(asEgoAdapter(mockAdapter));
    lifecycle = new FactLifecycle(asEgoAdapter(mockAdapter));
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

  it("consolida memorias ejecutando create, supersede y retire atómicamente", async () => {
    mockAdapter.get.mockResolvedValueOnce({
      payload: "Usuario modelo_preferido Claude",
      metadata: { state: "active", is_latest: true },
    });

    const newCreatedFact: Fact = {
      ...testFact,
      id: "fact_create_1",
      subject: "Ego",
      predicate: "soporta",
      object: "VantaDB",
    };

    const newSupersedingFact: Fact = {
      ...testFact,
      id: "fact_super_2",
      subject: "Usuario",
      predicate: "modelo_preferido",
      object: "DeepSeek-V3",
    };

    const result = await lifecycle.consolidateMemories({
      create: [newCreatedFact],
      supersede: [{ oldFactId: "fact_super_1", newFact: newSupersedingFact }],
      retire: ["fact_obsolete_9"],
    });

    expect(result.createdCount).toBe(1);
    expect(result.supersededCount).toBe(1);
    expect(result.retiredCount).toBe(0); // Mock get no devolvió obsolete, así que graceful
    expect(result.processedFactIds).toContain("fact_create_1");
    expect(result.processedFactIds).toContain("fact_super_2");
  });

  it("lista pendientes con valores reales vía list() (anti-fallback C03-list)", async () => {
    const now = Date.now();
    mockAdapter.list.mockResolvedValueOnce([
      {
        key: "fact_test_1",
        payload: "Usuario preferencia_idioma Español",
        metadata: {
          fact_id: "fact_test_1",
          subject: "Usuario",
          predicate: "preferencia_idioma",
          object: "Español",
          confidence: 0.55,
          temporal_scope: "persistent",
          source: "chat_turn",
          valid_at: now - 1000,
          invalid_at: -1,
          state: "quarantined",
        },
      },
    ]);

    const pending = await quarantine.listPending();
    expect(pending).toHaveLength(1);
    // Anti-fallback: con metadata tagged sin desenvolver, estos caerían a
    // "Unknown" / 0.5 / Date.now() / rec.key.
    expect(pending[0].id).toBe("fact_test_1");
    expect(pending[0].subject).toBe("Usuario");
    expect(pending[0].predicate).toBe("preferencia_idioma");
    expect(pending[0].object).toBe("Español");
    expect(pending[0].confidence).toBe(0.55);
    expect(pending[0].confidence).not.toBe(0.5);
    expect(pending[0].validAt).toBe(now - 1000);
    expect(pending[0].source).toBe("chat_turn");
  });

  it("purga expirados usando expires_at real vía list() (anti-fallback C03-list)", async () => {
    const now = Date.now();
    mockAdapter.list.mockResolvedValueOnce([
      {
        key: "fact_expired",
        payload: "viejo",
        metadata: { fact_id: "fact_expired", expires_at: now - 1000 },
      },
      {
        key: "fact_active",
        payload: "vigente",
        metadata: { fact_id: "fact_active", expires_at: now + 100000 },
      },
    ]);

    const purged = await quarantine.purgeExpired();
    // Con tagged sin desenvolver, expires_at caería a 0 y la purga sería inoperante (0).
    expect(purged).toBe(1);
    expect(mockAdapter.delete).toHaveBeenCalledWith("quarantine/pending", "fact_expired");
    expect(mockAdapter.delete).not.toHaveBeenCalledWith("quarantine/pending", "fact_active");
  });
});
