/**
 * Ola 10 (A2-bis) — El BARRIDO REAL de la curaduría de memoria.
 *
 * Estos tests cubren los cuatro hallazgos de la curaduría:
 *
 *  - `EGO-FIND-110` (L1): el barrido solo veía 50 registros por namespace
 *    (una sola llamada `list()` sin bucle de cursor) → los registros más allá
 *    del puesto 50 NUNCA se curaban.
 *  - `EGO-FIND-111` (L2): el barrido-era por orden de clave, no por
 *    antigüedad → el conjunto examinado era estable e independiente de la
 *    edad (un registro nuevo nunca entraba).
 *  - `EGO-FIND-112` (L3): opciones muertas en el contrato
 *    (`staleNamespaces`, `staleBatchSize`): el producto sólo propagaba 2 de 4.
 *  - `EGO-FIND-113` (L4): cadencia y ventana hardcodeadas fuera de
 *    `gov/settings`.
 *
 * Cada test FALLA si se deshace el arreglo (si el barrido vuelve a leer 50
 * registros por clave, o si las opciones dejan de ser alcanzables).
 */
import { describe, it, expect, vi } from "vitest";
import { MemoryCurator, type CuratorRunStats } from "../src/MemoryCurator.js";
import {
  CURATION_SETTINGS_KEY,
  CURATION_SETTINGS_NAMESPACE,
} from "../src/CurationSettings.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

interface Item {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Adapter de memoria en memoria con paginación por cursor **fiel al motor**:
 * `listPaged` devuelve los registros ORDENADOS POR CLAVE (como VantaDB) y un
 * cursor opaco (índice). `list` devuelve la primera página.
 */
function makeAdapter(initial: Record<string, Item[]> = {}, settings?: unknown) {
  const storage = new Map<string, Item[]>(Object.entries(initial));
  const calls = { list: 0, listPaged: 0, get: 0 };

  const sorted = (ns: string): Item[] =>
    [...(storage.get(ns) ?? [])].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const adapter = {
    calls,
    list: vi.fn(async (ns: string, limit = 100) => {
      calls.list++;
      return sorted(ns).slice(0, limit);
    }),
    listPaged: vi.fn(async (ns: string, limit = 100, cursor?: number | string) => {
      calls.listPaged++;
      const items = sorted(ns);
      const start = typeof cursor === "number" ? cursor : 0;
      const records = items.slice(start, start + limit);
      const next = start + limit;
      return {
        records,
        nextCursor: next < items.length ? next : undefined,
      };
    }),
    get: vi.fn(async (ns: string, key: string) => {
      calls.get++;
      if (ns === CURATION_SETTINGS_NAMESPACE && key === CURATION_SETTINGS_KEY) {
        return settings === undefined ? null : { key, payload: settings, metadata: {} };
      }
      const found = (storage.get(ns) ?? []).find((i) => i.key === key);
      return found ? { key, payload: found.payload, metadata: found.metadata ?? {} } : null;
    }),
    put: vi.fn(async (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) => {
      const items = storage.get(item.namespace) ?? [];
      const index = items.findIndex((i) => i.key === item.key);
      const row: Item = { key: item.key, payload: item.payload, metadata: item.metadata };
      if (index >= 0) items[index] = row;
      else items.push(row);
      storage.set(item.namespace, items);
      return { routedTo: "live" };
    }),
    putMulti: vi.fn(async (batch: Array<{ namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }>) => {
      const items = storage.get(batch[0]?.namespace ?? "") ?? [];
      for (const item of batch) {
        const index = items.findIndex((i) => i.key === item.key);
        const row: Item = { key: item.key, payload: item.payload, metadata: item.metadata };
        if (index >= 0) items[index] = row;
        else items.push(row);
      }
      storage.set(batch[0]?.namespace ?? "", items);
      return batch.map(() => ({ routedTo: "live" }));
    }),
    recordAudit: vi.fn(async () => "audit:key"),
  };
  return { adapter, storage };
}

function fact(key: string, ts: number): Item {
  return { key, payload: { subject: key, predicate: "p", object: "o" }, metadata: { ts, state: "active" } };
}

describe("L1 — EGO-FIND-110: el barrido pagina con cursor y cubre el namespace", () => {
  it("cura un fact MÁS ALLÁ del puesto 50 (el límite antiguo era 50 por clave)", async () => {
    // 120 facts: el 116º por clave es stale. Con el barrido antiguo
    // (`list(ns, 50)`) nunca se veía → 0 curados.
    const facts: Item[] = [];
    for (let i = 0; i < 120; i++) {
      const key = `fact-${String(i).padStart(3, "0")}`;
      const stale = i === 115;
      facts.push(fact(key, stale ? NOW - 200 * DAY_MS : NOW - 2 * DAY_MS));
    }
    const { adapter } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    const stats = await curator.runOnce(NOW);

    expect(stats.staleConsolidatedCount, "el fact del puesto 115 debe curarse").toBe(1);
    expect(stats.scannedCount, "el barrido debe LEER el namespace entero").toBe(120);
    // Y debe haber paginado (varias páginas), no leído una sola.
    expect(adapter.calls.listPaged, "el barrido debe usar el bucle de cursor").toBeGreaterThan(1);
  });

  it("no se queda en la primera página cuando el cursor avanza", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 250; i++) facts.push(fact(`f-${String(i).padStart(3, "0")}`, NOW - 2 * DAY_MS));
    facts.push(fact("f-stale", NOW - 400 * DAY_MS));
    const { adapter } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    const stats = await curator.runOnce(NOW);

    expect(stats.staleConsolidatedCount).toBe(1);
    expect(stats.scannedCount).toBe(251);
  });
});

describe("L2 — EGO-FIND-111: el conjunto examinado es el más ANTIGUO, no el primero por clave", () => {
  it("examina el registro más antiguo aunque su clave ordene al final", async () => {
    const { adapter, storage } = makeAdapter({
      "kb/facts": [
        fact("aaa-nuevo", NOW - 1 * DAY_MS),
        fact("mmm-medio", NOW - 30 * DAY_MS),
        fact("zzz-viejo", NOW - 300 * DAY_MS),
      ],
    });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    const stats = await curator.runOnce(NOW);

    // Orden de examen: de más viejo a más nuevo.
    expect(stats.examinedKeys[0]).toBe("kb/facts:zzz-viejo");
    expect(stats.examinedKeys[1]).toBe("kb/facts:mmm-medio");
    // Y el viejo (que el barrido por clave nunca alcanzaba) se cura.
    expect(stats.staleConsolidatedCount).toBe(1);
    const curado = storage.get("kb/facts")!.find((i) => i.key === "zzz-viejo")!;
    expect(curado.metadata?.["state"]).toBe("superseded");
    expect(curado.metadata?.["superseded_by"]).toBe("curator:stale");
  });

  it("un registro NUEVO entra en el conjunto examinado (antes quedaba fuera para siempre)", async () => {
    // 60 registros → el barrido antiguo (50) nunca veía el 61º.
    const facts: Item[] = [];
    for (let i = 0; i < 60; i++) facts.push(fact(`f-${String(i).padStart(3, "0")}`, NOW - 2 * DAY_MS));
    const { adapter, storage } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    await curator.runOnce(NOW);

    // Aparece un fact nuevo (clave posterior a todos).
    storage.get("kb/facts")!.push(fact("f-nuevo", NOW - 1 * DAY_MS));

    const stats = await curator.runOnce(NOW);
    expect(stats.examinedKeys, "el fact nuevo debe entrar en el conjunto examinado").toContain(
      "kb/facts:f-nuevo",
    );
  });
});

describe("L1/L2 — el presupuesto por corrida se respeta", () => {
  it("examina como máximo `maxRecordsPerRun` registros y son los más antiguos", async () => {
    const facts: Item[] = [];
    // 20 registros: el último por clave (f-19) es el MÁS VIEJO (39 días).
    for (let i = 0; i < 20; i++) {
      facts.push(fact(`f-${String(i).padStart(2, "0")}`, NOW - (20 + i) * DAY_MS));
    }
    const { adapter } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90, maxRecordsPerRun: 5 });
    const stats = await curator.runOnce(NOW);

    expect(stats.examinedCount, "el presupuesto de examen se respeta").toBe(5);
    expect(stats.examinedKeys.length).toBe(5);
    // Los 5 examinados son los 5 más antiguos (f-19 … f-15).
    expect(stats.examinedKeys).toEqual([
      "kb/facts:f-19",
      "kb/facts:f-18",
      "kb/facts:f-17",
      "kb/facts:f-16",
      "kb/facts:f-15",
    ]);
    // f-19 tiene 39 días ⇒ fresco (la ventana es de 90): el presupuesto se
    // gasta en examinar, no en marcar.
    expect(stats.staleConsolidatedCount).toBe(0);
  });

  it("el presupuesto se gasta en registros ACCIONABLES (los terminales no lo consumen)", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 10; i++) facts.push(fact(`f-${String(i).padStart(2, "0")}`, NOW - 200 * DAY_MS));
    // Los 5 más viejos ya están terminalizados (curados en una corrida previa).
    for (let i = 0; i < 5; i++) facts[i].metadata = { ts: NOW - 200 * DAY_MS, state: "superseded" };

    const { adapter } = makeAdapter({ "kb/facts": facts });
    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90, maxRecordsPerRun: 3 });
    const stats = await curator.runOnce(NOW);

    expect(stats.examinedCount).toBe(3);
    expect(stats.staleConsolidatedCount).toBe(3);
    expect(stats.examinedKeys).toEqual(["kb/facts:f-05", "kb/facts:f-06", "kb/facts:f-07"]);
  });

  it("el presupuesto de LECTURA trunca el namespace y lo declara (`partial`)", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 100; i++) facts.push(fact(`f-${String(i).padStart(3, "0")}`, NOW - 2 * DAY_MS));
    const { adapter } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, {
      staleAfterDays: 90,
      maxScanRecordsPerRun: 10,
      maxRecordsPerRun: 100,
    });
    const stats = await curator.runOnce(NOW);

    expect(stats.scannedCount, "la lectura se acota").toBe(10);
    expect(stats.partial, "el truncamiento se declara (nunca se disimula)").toBe(true);
  });
});

describe("L3 — EGO-FIND-112: ninguna opción del contrato es MUERTA", () => {
  it("`staleNamespaces` decide qué se barre", async () => {
    const { adapter } = makeAdapter({
      "kb/facts": [fact("a", NOW - 300 * DAY_MS)],
      "kb/custom": [fact("b", NOW - 300 * DAY_MS)],
    });

    const curator = new MemoryCurator(adapter as never, {
      staleAfterDays: 90,
      staleNamespaces: ["kb/custom"],
    });
    const stats = await curator.runOnce(NOW);

    expect(stats.staleNamespacesScanned).toEqual(["kb/custom"]);
    expect(stats.staleConsolidatedCount).toBe(1);
  });

  it("`staleAfterDays` decide la ventana", async () => {
    const { adapter } = makeAdapter({ "kb/facts": [fact("a", NOW - 30 * DAY_MS)] });
    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    expect((await curator.runOnce(NOW)).staleConsolidatedCount).toBe(0);

    const { adapter: adapter2 } = makeAdapter({ "kb/facts": [fact("a", NOW - 30 * DAY_MS)] });
    const curator2 = new MemoryCurator(adapter2 as never, { staleAfterDays: 10 });
    expect((await curator2.runOnce(NOW)).staleConsolidatedCount).toBe(1);
  });

  it("`maxRecordsPerRun` decide el presupuesto de examen", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 30; i++) facts.push(fact(`f-${String(i).padStart(2, "0")}`, NOW - 200 * DAY_MS));
    const { adapter } = makeAdapter({ "kb/facts": facts });
    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90, maxRecordsPerRun: 4 });
    const stats = await curator.runOnce(NOW);
    expect(stats.examinedCount).toBe(4);
    expect(stats.staleConsolidatedCount).toBe(4);
  });
});

describe("L4 — EGO-FIND-113: la cadencia y la ventana salen de `gov/settings`", () => {
  it("lee `gov/settings/memory_curation` y aplica la ventana y los namespaces", async () => {
    const { adapter } = makeAdapter(
      {
        "kb/facts": [fact("viejo-20d", NOW - 20 * DAY_MS)],
        "kb/otros": [fact("no-tocado", NOW - 20 * DAY_MS)],
      },
      {
        intervalHours: 6,
        staleAfterDays: 10,
        staleNamespaces: ["kb/facts"],
        maxRecordsPerRun: 100,
      },
    );

    const curator = new MemoryCurator(adapter as never);
    const stats = await curator.runOnce(NOW);

    expect(adapter.calls.get, "el curator debe leer `gov/settings`").toBeGreaterThan(0);
    expect(stats.staleConsolidatedCount, "con ventana de 10 días, un fact de 20 días se cura").toBe(1);
    expect(stats.staleNamespacesScanned).toEqual(["kb/facts"]);
  });

  it("si no hay ajustes, se usan los defaults (no se rompe la curaduría)", async () => {
    const { adapter } = makeAdapter({ "kb/facts": [fact("a", NOW - 300 * DAY_MS)] });
    const curator = new MemoryCurator(adapter as never);
    const stats = await curator.runOnce(NOW);
    expect(stats.staleConsolidatedCount).toBe(1);
    expect(stats.staleNamespacesScanned).toEqual(["kb/facts", "kb/docs"]);
  });

  it("una opción explícita gana al ajuste persistido (el código explícito manda)", async () => {
    const { adapter } = makeAdapter(
      { "kb/facts": [fact("a", NOW - 300 * DAY_MS)] },
      { staleAfterDays: 10, staleNamespaces: ["kb/facts"], maxRecordsPerRun: 100 },
    );
    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    const stats = await curator.runOnce(NOW);
    // La ventana explícita (90d) manda sobre la persistida (10d): un fact de
    // 300 días se cura igual, pero la ventana efectiva es la explícita.
    expect(stats.staleAfterDays).toBe(90);
  });
});

describe("la corrida deja auditoría del barrido real", () => {
  it("la auditoría `curator_run` declara lo que se leyó y lo que se examinó", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 70; i++) facts.push(fact(`f-${String(i).padStart(2, "0")}`, NOW - 2 * DAY_MS));
    const { adapter } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    await curator.runOnce(NOW);

    const call = adapter.recordAudit.mock.calls[0];
    expect(call[0]).toBe("curator_run");
    const details = call[2] as Record<string, unknown>;
    expect(details["scannedCount"]).toBe(70);
    expect(details["examinedCount"]).toBe(70);
    expect(details["maxRecordsPerRun"]).toBeGreaterThan(0);
    expect(details["staleAfterDays"]).toBe(90);
  });
});

describe("el marcado se escribe EN LOTE (medido: 27× más barato)", () => {
  it("usa `putMulti` cuando el adapter lo expone, y no un `put` por registro", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 12; i++) facts.push(fact(`f-${String(i).padStart(2, "0")}`, NOW - 300 * DAY_MS));
    const { adapter } = makeAdapter({ "kb/facts": facts });

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    const stats = await curator.runOnce(NOW);

    expect(stats.staleConsolidatedCount).toBe(12);
    expect(adapter.putMulti, "el lote debe usarse").toHaveBeenCalledTimes(1);
    expect(adapter.putMulti.mock.calls[0][0]).toHaveLength(12);
    expect(adapter.put, "no debe haber un put por registro").not.toHaveBeenCalled();
  });

  it("si el lote falla, reintenta registro a registro (fail-soft)", async () => {
    const facts: Item[] = [];
    for (let i = 0; i < 3; i++) facts.push(fact(`f-${String(i).padStart(2, "0")}`, NOW - 300 * DAY_MS));
    const { adapter } = makeAdapter({ "kb/facts": facts });
    adapter.putMulti.mockRejectedValueOnce(new Error("lote rechazado"));

    const curator = new MemoryCurator(adapter as never, { staleAfterDays: 90 });
    const stats = await curator.runOnce(NOW);

    expect(stats.staleConsolidatedCount, "el reintento secuencial debe salvar la corrida").toBe(3);
    expect(adapter.put).toHaveBeenCalledTimes(3);
  });
});
