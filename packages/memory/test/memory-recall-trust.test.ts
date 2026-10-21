import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";

/**
 * T2 (A2-bis) — `memoryRecall({trust_aware: true})` con el `TrustBoundary`.
 *
 * La capacidad **ya existe** en el motor 0.9.0 (re-rank compuesto con
 * confianza: relevancia + recencia + importancia — S8/FIND-320, MEMG-21).
 * Lo que faltaba era el cableado en Ego.
 *
 * Verifica (contra el motor REAL, no contra un mock):
 * 1. `trust_aware: true` reordena por el score compuesto; `false` conserva el
 *    orden legacy (relevancia pura).
 * 2. La ACL de inyección (`allow_prefixes`, derivada del `TrustBoundary`)
 *    EXCLUYE la memoria no confiable y lo reporta en `governance.denied`
 *    (la denegación nunca es silenciosa).
 * 3. Sin el binding cognitivo disponible, el recall degrada a `null` sin
 *    romper el turno (fail-soft).
 */

const NOW = "2026-01-31T00:00:00.000Z";
const NOW_MS = 1_769_817_600_000;
const OLD = "2025-12-02T00:00:00.000Z";

interface L1Payload {
  id: string;
  content: string;
  type: string;
  priority: number;
  scene_name: string;
  source_message_ids: string[];
  metadata: null;
  timestamps: string[];
  created_at: string;
  updated_at: string;
  version: number;
  session_key: string;
  session_id: string;
  task_id: null;
  team_id: string;
  user_id: null;
  agent_id: string;
  heat: number;
}

function l1Record(
  id: string,
  content: string,
  priority: number,
  sessionKey: string,
  updatedAt: string
): L1Payload {
  return {
    id,
    content,
    type: "episodic",
    priority,
    scene_name: "s",
    source_message_ids: [],
    metadata: null,
    timestamps: [updatedAt],
    created_at: updatedAt,
    updated_at: updatedAt,
    version: 1,
    session_key: sessionKey,
    session_id: "",
    task_id: null,
    team_id: "default",
    user_id: null,
    agent_id: "default",
    heat: 0,
  };
}

describe("T2 — `memoryRecall` nativo con confianza (VDB-REQ-15)", () => {
  let dir: string;
  let adapter: EgoMemoryAdapter;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-t2-"));
    adapter = new EgoMemoryAdapter(path.join(dir, "store.vdb"));
    await adapter.init();

    // Sesión de CONFIANZA: tres registros con relevancia/importancia/recencia
    // designed para que el orden legacy (relevancia) difiera del compuesto.
    // El score del motor es el **número de términos distintos compartidos**
    // (la repetición NO suma): de ahí las 3 palabras clave distintas.
    await adapter.put({
      namespace: "l1/sesion-de-confianza",
      key: "rec-legado",
      payload: JSON.stringify(
        l1Record(
          "rec-legado",
          "zorro zorro zorro proyecto zorro liebre",
          0,
          "sesion-de-confianza",
          OLD
        )
      ),
    });
    await adapter.put({
      namespace: "l1/sesion-de-confianza",
      key: "rec-medio",
      payload: JSON.stringify(
        l1Record(
          "rec-medio",
          "zorro proyecto con detalle importante",
          50,
          "sesion-de-confianza",
          NOW
        )
      ),
    });
    await adapter.put({
      namespace: "l1/sesion-de-confianza",
      key: "rec-compuesto",
      payload: JSON.stringify(
        l1Record("rec-compuesto", "zorro y nada mas", 100, "sesion-de-confianza", NOW)
      ),
    });

    // Sesión NO CONFIABLE: mismo texto, misma relevancia.
    await adapter.put({
      namespace: "l1/sesion-no-confiable",
      key: "rec-no-confiable",
      payload: JSON.stringify(
        l1Record(
          "rec-no-confiable",
          "zorro zorro zorro proyecto zorro",
          100,
          "sesion-no-confiable",
          NOW
        )
      ),
    });
  });

  afterAll(async () => {
    await adapter.close?.();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("(1) el recall nativo está disponible y devuelve el shape canónico", async () => {
    const result = await adapter.memoryRecall({
      user_text: "zorro proyecto liebre",
      session_key: "sesion-de-confianza",
      scope: "agent",
      max_results: 5,
      now_ms: NOW_MS,
    });

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.recalled_memories)).toBe(true);
    expect(Array.isArray(result!.governance.sources)).toBe(true);
    expect(Array.isArray(result!.governance.denied)).toBe(true);
  });

  it("(2) `trust_aware: true` reordena por el score compuesto (relevancia + recencia + importancia)", async () => {
    // Se comparan las DOS rutas sobre el MISMO conjunto (la namespace de
    // confianza): lo único que cambia es el flag del re-rank.
    const legacy = await adapter.memoryRecall({
      user_text: "zorro proyecto liebre",
      session_key: "sesion-de-confianza",
      scope: "agent",
      max_results: 5,
      allow_prefixes: ["l1/sesion-de-confianza"],
      trust_aware: false,
      now_ms: NOW_MS,
    });
    const scored = await adapter.memoryRecall({
      user_text: "zorro proyecto liebre",
      session_key: "sesion-de-confianza",
      scope: "agent",
      max_results: 5,
      allow_prefixes: ["l1/sesion-de-confianza"],
      trust_aware: true,
      now_ms: NOW_MS,
    });

    expect(legacy).not.toBeNull();
    expect(scored).not.toBeNull();

    const legacyKeys = legacy!.recalled_memories.map((m) => m.source_key);
    const scoredKeys = scored!.recalled_memories.map((m) => m.source_key);

    // Legacy: manda la relevancia pura ("rec-legado" comparte 3 términos).
    expect(legacyKeys[0]).toBe("rec-legado");
    // Compuesto: la importancia (priority 50) + recencia (NOW) suben a
    // "rec-medio" por delante del de mayor relevancia (priority 0, 60 días old).
    expect(scoredKeys[0]).toBe("rec-medio");
    expect(scoredKeys).not.toEqual(legacyKeys);
  });

  it("(3) la ACL de inyección EXCLUYE la memoria no confiable y la denegación se reporta", async () => {
    const result = await adapter.memoryRecall({
      user_text: "zorro proyecto liebre",
      session_key: "sesion-de-confianza",
      scope: "agent",
      max_results: 5,
      // La lista que produce `trustedAllowPrefixes` (TrustBoundary).
      allow_prefixes: ["l1/sesion-de-confianza"],
      trust_aware: true,
      now_ms: NOW_MS,
    });

    expect(result).not.toBeNull();
    const namespaces = result!.recalled_memories.map((m) => m.source_namespace);
    expect(namespaces.every((ns) => ns === "l1/sesion-de-confianza")).toBe(true);
    expect(namespaces).not.toContain("l1/sesion-no-confiable");
    // La denegación NO es silenciosa.
    expect(result!.governance.denied).toContain("l1/sesion-no-confiable");
    expect(result!.governance.sources).toContain("l1/sesion-de-confianza");
  });

  it("(4) sin ACL, la memoria no confiable también entra (el motor no conoce la confianza de Ego)", async () => {
    const result = await adapter.memoryRecall({
      user_text: "zorro proyecto liebre",
      session_key: "sesion-de-confianza",
      scope: "agent",
      max_results: 5,
      trust_aware: true,
      now_ms: NOW_MS,
    });

    expect(result).not.toBeNull();
    const keys = result!.recalled_memories.map((m) => m.source_key);
    expect(keys).toContain("rec-no-confiable");
    // Y el motor incluso la PROMETE por encima de las de confianza (su
    // `importance` es 100): sin la ACL del `TrustBoundary`, el contenido no
    // confiable manda en el contexto. Ésta es la razón de existir de la ACL.
    expect(keys[0]).toBe("rec-no-confiable");
    expect(result!.governance.denied).not.toContain("l1/sesion-no-confiable");
  });

  it("(5) el recall degrada a null (fail-soft) si el binding cognitivo no está disponible", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = new EgoMemoryAdapter(path.join(dir, "store2.vdb"));
    // Se simula un handle sin la API cognitiva (fachada vieja / binding viejo).
    (broken as unknown as { db: unknown }).db = {};

    const result = await broken.memoryRecall({
      user_text: "zorro",
      session_key: "sesion-de-confianza",
    });

    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("VDB-REQ-16"));
    spy.mockRestore();
  });
});
