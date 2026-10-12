import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import { BitemporalQueries } from "../src/BitemporalQueries.js";
import { QuarantineManager } from "../src/QuarantineManager.js";
import { FactLifecycle } from "../src/FactLifecycle.js";
import type { Fact } from "../src/schemas/knowledge.js";

/**
 * Verificación C03-list Task 3: cada lector knowledge vía `list()` devuelve
 * valores reales (no fallbacks) con metadata desenvuelta.
 *
 * A diferencia de los tests con mocks (que inyectan metadata ya plana),
 * aquí se escribe metadata plana vía `adapter.put` —el adapter la etiqueta
 * internamente ({String}/{Float})— y se verifica que `list()` la devuelva
 * como primitivas y que los lectores no caigan a sus defaults:
 * - BitemporalQueries: validAt 0 / confidence 0.8 / subject "General"
 * - QuarantineManager.listPending: subject "Unknown" / confidence 0.5
 * - QuarantineManager.purgeExpired: expires_at 0 (purga inoperante)
 */
describe("C03-list Task 3 — lectores knowledge sobre list() desenvuelto (integración real)", () => {
  let dir: string;
  let adapter: EgoMemoryAdapter;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-c03-list-"));
    adapter = new EgoMemoryAdapter(dir);
    await adapter.init();
  });

  afterEach(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos de Windows
    }
  });

  it("list() desenvuelve primitivas y asOf devuelve validAt/confidence/fact_id reales", async () => {
    await adapter.put({
      namespace: "kb/facts",
      key: "c03_fact_1",
      payload: "Arquitectura usa SQLite",
      metadata: {
        fact_id: "c03_fact_1",
        subject: "Arquitectura",
        predicate: "usa",
        object: "SQLite",
        confidence: 0.9,
        temporal_scope: "persistent",
        source: "test",
        valid_at: 1000,
        invalid_at: 2000,
      },
    });
    await adapter.put({
      namespace: "kb/facts",
      key: "c03_fact_2",
      payload: "Arquitectura usa VantaDB",
      metadata: {
        fact_id: "c03_fact_2",
        subject: "Arquitectura",
        predicate: "usa",
        object: "VantaDB",
        confidence: 0.95,
        temporal_scope: "persistent",
        source: "test",
        valid_at: 2000,
        invalid_at: -1,
      },
    });

    // Nivel list(): primitivas, no objetos tagged {Float}/{String}
    const raw = await adapter.list("kb/facts", 10);
    expect(raw).toHaveLength(2);
    for (const rec of raw) {
      expect(typeof rec.metadata?.["valid_at"]).toBe("number");
      expect(typeof rec.metadata?.["confidence"]).toBe("number");
      expect(typeof rec.metadata?.["fact_id"]).toBe("string");
    }

    // Nivel lector: valores reales, no fallbacks (0 / 0.8 / "General")
    const bitemporal = new BitemporalQueries(adapter);
    const pastFacts = await bitemporal.asOf(1500);
    expect(pastFacts).toHaveLength(1);
    expect(pastFacts[0].id).toBe("c03_fact_1");
    expect(pastFacts[0].object).toBe("SQLite");
    expect(pastFacts[0].subject).toBe("Arquitectura");
    expect(pastFacts[0].validAt).toBe(1000);
    expect(pastFacts[0].validAt).not.toBe(0);
    expect(pastFacts[0].confidence).toBe(0.9);
    expect(pastFacts[0].confidence).not.toBe(0.8);

    const presentFacts = await bitemporal.asOf(2500);
    expect(presentFacts).toHaveLength(1);
    expect(presentFacts[0].id).toBe("c03_fact_2");
    expect(presentFacts[0].validAt).toBe(2000);
    expect(presentFacts[0].confidence).toBe(0.95);
  });

  it("listPending devuelve fact_id/subject/confidence reales vía list() desenvuelto", async () => {
    const validAt = Date.now() - 5000;
    const quarantine = new QuarantineManager(adapter);
    const fact: Fact = {
      id: "c03_q_1",
      subject: "Usuario",
      predicate: "preferencia_idioma",
      object: "Español",
      confidence: 0.55,
      temporalScope: "persistent",
      source: "chat_turn",
      validAt,
      invalidAt: null,
      supersededBy: null,
      state: "active",
    };
    await quarantine.quarantine(fact, "low_confidence");

    // Nivel list(): primitivas reales
    const raw = await adapter.list("quarantine/pending", 10);
    expect(raw).toHaveLength(1);
    expect(raw[0].metadata?.["fact_id"]).toBe("c03_q_1");
    expect(typeof raw[0].metadata?.["confidence"]).toBe("number");
    expect(raw[0].metadata?.["confidence"]).toBe(0.55);

    // Nivel lector: sin fallbacks ("Unknown" / 0.5 / Date.now())
    const pending = await quarantine.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("c03_q_1");
    expect(pending[0].subject).toBe("Usuario");
    expect(pending[0].predicate).toBe("preferencia_idioma");
    expect(pending[0].object).toBe("Español");
    expect(pending[0].confidence).toBe(0.55);
    expect(pending[0].confidence).not.toBe(0.5);
    expect(pending[0].validAt).toBe(validAt);
    expect(pending[0].source).toBe("chat_turn");
  });

  it("FactLifecycle.promote escribe y el hecho es legible con valores reales vía list()", async () => {
    const validAt = Date.now() - 8000;
    const quarantine = new QuarantineManager(adapter);
    const lifecycle = new FactLifecycle(adapter);
    const fact: Fact = {
      id: "c03_prom_1",
      subject: "Ego",
      predicate: "soporta",
      object: "VantaDB",
      confidence: 0.77,
      temporalScope: "persistent",
      source: "chat_turn",
      validAt,
      invalidAt: null,
      supersededBy: null,
      state: "active",
    };
    await quarantine.quarantine(fact, "unreviewed_external_source");
    const promoted = await lifecycle.promoteFromQuarantine("c03_prom_1");
    expect(promoted.id).toBe("c03_prom_1");
    expect(promoted.subject).toBe("Ego");
    expect(promoted.confidence).toBe(0.77);

    // El hecho promovido debe leerse vía list() con primitivas reales
    const raw = await adapter.list("kb/facts", 10);
    const rec = raw.find((r) => r.key === "c03_prom_1");
    expect(rec).toBeDefined();
    expect(typeof rec?.metadata?.["confidence"]).toBe("number");
    expect(rec?.metadata?.["confidence"]).toBe(0.77);
    expect(rec?.metadata?.["subject"]).toBe("Ego");

    const bitemporal = new BitemporalQueries(adapter);
    const facts = await bitemporal.asOf(Date.now());
    const found = facts.find((f) => f.id === "c03_prom_1");
    expect(found).toBeDefined();
    expect(found?.confidence).toBe(0.77);
    expect(found?.validAt).toBe(validAt);
    expect(found?.validAt).not.toBe(0);
  });

  it("purgeExpired elimina solo expirados con expires_at real desenvuelto", async () => {
    const now = Date.now();
    await adapter.put({
      namespace: "quarantine/pending",
      key: "c03_expired",
      payload: "viejo",
      metadata: { fact_id: "c03_expired", expires_at: now - 1000, subject: "T" },
    });
    await adapter.put({
      namespace: "quarantine/pending",
      key: "c03_active",
      payload: "vigente",
      metadata: { fact_id: "c03_active", expires_at: now + 1000000, subject: "T" },
    });

    const quarantine = new QuarantineManager(adapter);
    const purged = await quarantine.purgeExpired();
    // Con tagged sin desenvolver, expires_at caería a 0 y purged sería 0.
    expect(purged).toBe(1);

    const remaining = await adapter.list("quarantine/pending", 10);
    expect(remaining.map((r) => r.key)).toEqual(["c03_active"]);
  });
});
