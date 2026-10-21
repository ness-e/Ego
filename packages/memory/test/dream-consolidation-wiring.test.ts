import { describe, it, expect, vi, beforeEach } from "vitest";
import { EgoMemoryLifecycle } from "../EgoMemoryLifecycle.js";
import type { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * T4 (A2-bis, Ola 8) — `DreamConsolidator` **cableado** en el ciclo de vida real.
 *
 * EGO-FIND-22: la clase estaba implementada y testeada, pero **nadie la
 * instanciaba** ⇒ la consolidación de hechos (dedup, procedencia de
 * contradicciones, normalización de fechas) **no ocurría nunca** en el
 * producto y el trabajo de la Ola 1 quedaba muerto en la práctica.
 *
 * Este fichero verifica el **cableado** (no la clase):
 * 1. El hook de "sueño en reposo" (idle, 5 min sin turnos) dispara el ciclo.
 * 2. Un fact duplicado queda `is_latest:false` + `superseded_by`.
 * 3. Un payload corrupto **no** aborta el resto del lote.
 * 4. La consolidación deja **EVIDENCIA** en `gov/audit`
 *    (`action: "dream_consolidation"`) — se puede *demostrar* que ocurrió.
 * 5. Si el sistema **no** está idle, el ciclo no se ejecuta.
 */

interface Row {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

const NOW = 1_800_000_000_000;

describe("T4 — el DreamConsolidator está cableado en el ciclo de vida real", () => {
  let facts: Row[];
  let quarantine: Row[];
  let audits: Array<{ action: string; actor: string; details: Record<string, unknown> }>;
  let lifecycle: EgoMemoryLifecycle;

  beforeEach(() => {
    facts = [];
    quarantine = [];
    audits = [];

    const fake = {
      list: vi.fn(async (namespace: string) => {
        if (namespace === "kb/facts") return [...facts];
        if (namespace === "quarantine/pending") return [...quarantine];
        return [];
      }),
      delete: vi.fn(async (namespace: string, key: string) => {
        if (namespace === "quarantine/pending") {
          quarantine = quarantine.filter((r) => r.key !== key);
          return true;
        }
        return false;
      }),
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) => {
        const rows = item.namespace === "kb/facts" ? facts : item.namespace === "quarantine/pending" ? quarantine : [];
        const idx = rows.findIndex((r) => r.key === item.key);
        if (idx >= 0) rows[idx] = { key: item.key, payload: item.payload, metadata: item.metadata };
        else rows.push({ key: item.key, payload: item.payload, metadata: item.metadata });
      }),
      recordAudit: vi.fn(async (action: string, actor: string, details: Record<string, unknown>) => {
        audits.push({ action, actor, details });
        return `${action}:key`;
      }),
    };

    lifecycle = new EgoMemoryLifecycle(fake as unknown as EgoMemoryAdapter);
  });

  it("(1) el ciclo de sueño deduplica los facts: el duplicado queda is_latest:false", async () => {
    facts = [
      {
        key: "fact-1",
        payload: { subject: "Node.js", predicate: "version", object: "22" },
        metadata: { state: "active" },
      },
      {
        key: "fact-2",
        payload: { subject: "node.js ", predicate: "VERSION", object: "22." },
        metadata: { state: "active" },
      },
    ];

    const outcome = await lifecycle.runDreamConsolidation(NOW);

    expect(outcome.consolidation).not.toBeNull();
    expect(outcome.consolidation!.deduplicatedCount).toBe(1);

    const dup = facts.find((f) => f.key === "fact-2")!;
    const dupPayload = dup.payload as Record<string, unknown>;
    expect(dupPayload["is_latest"]).toBe(false);
    expect(dupPayload["superseded_by"]).toBe("fact-1");
    expect((dup.metadata as Record<string, unknown>)["state"]).toBe("superseded");
  });

  it("(2) un payload corrupto NO aborta el resto del lote", async () => {
    facts = [
      {
        key: "fact-1",
        payload: { subject: "Node.js", predicate: "version", object: "22" },
        metadata: { state: "active" },
      },
      { key: "fact-corrupto", payload: "{esto no es json", metadata: { state: "active" } },
      {
        key: "fact-2",
        payload: { subject: "Node.js", predicate: "version", object: "22" },
        metadata: { state: "active" },
      },
    ];

    const outcome = await lifecycle.runDreamConsolidation(NOW);

    expect(outcome.consolidation!.parseErrors).toBe(1);
    expect(outcome.consolidation!.deduplicatedCount).toBe(1);
    expect(outcome.consolidation!.scannedCount).toBe(3);
  });

  it("(3) la consolidación deja EVIDENCIA consultable en gov/audit", async () => {
    facts = [
      {
        key: "fact-1",
        payload: { subject: "A", predicate: "b", object: "c" },
        metadata: { state: "active" },
      },
    ];

    await lifecycle.runDreamConsolidation(NOW);

    const audit = audits.find((a) => a.action === "dream_consolidation");
    expect(audit, "no hay evidencia de que la consolidación ocurriera").toBeDefined();
    expect(audit!.actor).toBe("ego.memory_lifecycle");
    expect(audit!.details["scannedCount"]).toBe(1);
    expect(audit!.details["timestamp"]).toBe(NOW);
  });

  it("(4) el ciclo purga la cuarentena expirada", async () => {
    quarantine = [
      { key: "q-caducada", payload: "viejo", metadata: { expiresAt: NOW - 1000 } },
      { key: "q-vigente", payload: "nuevo", metadata: { expiresAt: NOW + 100_000 } },
    ];

    const outcome = await lifecycle.runDreamConsolidation(NOW);

    expect(outcome.consolidation!.quarantinePurgedCount).toBe(1);
    expect(quarantine.map((r) => r.key)).toEqual(["q-vigente"]);
  });

  it("(5) si el sistema NO está idle, el ciclo NO se ejecuta", async () => {
    // Un turno justo ahora ⇒ el sistema está activo ⇒ no se consolida.
    // (Se usa el reloj real: `syncTurn` marca la actividad con `Date.now()`.)
    const now = Date.now();
    await lifecycle.syncTurn("sess-1", "turn-1", "hola", "mundo");

    const outcome = await lifecycle.runDreamConsolidation(now);

    expect(outcome.skippedNotIdle).toBe(true);
    expect(outcome.consolidation).toBeNull();
    expect(audits.find((a) => a.action === "dream_consolidation")).toBeUndefined();
  });

  it("(6) tras la inactividad, el ciclo vuelve a ejecutarse", async () => {
    const now = Date.now();
    await lifecycle.syncTurn("sess-1", "turn-1", "hola", "mundo");

    // 10 minutos después (el umbral es `idleDelayMs - 1min` = 4 min) el
    // sistema está idle y la consolidación ocurre.
    const later = now + 10 * 60 * 1000;
    const outcome = await lifecycle.runDreamConsolidation(later);

    expect(outcome.skippedNotIdle).toBe(false);
    expect(outcome.consolidation).not.toBeNull();
    expect(audits.find((a) => a.action === "dream_consolidation")).toBeDefined();
  });
});
