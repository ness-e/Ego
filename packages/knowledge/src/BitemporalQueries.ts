import { EgoMemoryAdapter } from "@ego/memory";
import { Fact, FactSchema } from "./schemas/knowledge.js";

export interface AsOfOptions {
  namespace?: string;
  subject?: string;
  limit?: number;
}

interface ListedRecord {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

interface CursorListPage {
  records: Array<{ key: string; payload: string; metadata: unknown }>;
  next_cursor?: string | number;
}

interface CursorListDb {
  list(input: {
    namespace: string;
    limit: number;
    cursor?: string | number;
  }): Promise<CursorListPage>;
}

/** Tamaño de página para el barrido por cursor (igual que `exportDump`). */
const PAGE_SIZE = 100;
/** Tope de seguridad del fallback incremental vía `adapter.list`. */
const FALLBACK_MAX_LIMIT = 10000;

const VALID_STATES = new Set(["active", "superseded", "quarantined", "rejected"]);
const VALID_SCOPES = new Set(["ephemeral", "persistent", "historical"]);

/**
 * Desenvuelve metadata etiquetada del binding (`{Float, String, Bool}`).
 * Workaround: VDB-BUG-02 (misma lógica que `EgoMemoryAdapter.list`).
 * Idempotente sobre metadata ya desenvuelta.
 */
function unwrapTaggedMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof v === "object" && v !== null) {
      if ("String" in v) clean[k] = (v as { String: unknown }).String;
      else if ("Float" in v) clean[k] = (v as { Float: unknown }).Float;
      else if ("Bool" in v) clean[k] = (v as { Bool: unknown }).Bool;
      else clean[k] = v;
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

/**
 * Motor de consultas bitemporales y reconstrucción histórica AS OF (KB-09, DSEK-02).
 * Resuelve VDB-REQ-06 emulando consultas temporales de intervalo [valid_at, invalid_at)
 * sobre registros versionados de VantaDB sin sobreescritura destructiva.
 *
 * Nota: la validez bitemporal vive en la metadata del registro (esquema KB-09),
 * no en `valid_at_ms` nativo del binding; por eso el filtrado temporal se hace
 * aquí tras agotar el cursor, en vez de delegar a `as_of_ms` nativo.
 */
export class BitemporalQueries {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Reconstruye el estado de los hechos vigentes en un momento exacto del pasado (AS OF <targetTime>).
   * Pagina el namespace completo con cursor hasta agotar (M12) en vez de una
   * ventana fija `limit*2`, que perdía historia en namespaces grandes.
   */
  public async asOf(targetTime: number, options: AsOfOptions = {}): Promise<Fact[]> {
    const namespace = options.namespace ?? "kb/facts";
    const limit = options.limit ?? 100;

    const records = await this.listAllRecords(namespace);
    const historicalFacts: Fact[] = [];

    for (const rec of records) {
      const meta = rec.metadata;
      if (!meta) continue;

      const validAt = typeof meta["valid_at"] === "number" ? meta["valid_at"] : 0;
      const invalidAt =
        typeof meta["invalid_at"] === "number" && meta["invalid_at"] !== -1
          ? meta["invalid_at"]
          : null;

      // Criterio Bitemporal: el hecho nació antes o en targetTime, y no había muerto aún en targetTime
      const wasValidAtTarget = validAt <= targetTime && (invalidAt === null || invalidAt > targetTime);

      if (wasValidAtTarget) {
        if (options.subject && meta["subject"] !== options.subject) {
          continue;
        }

        const scopeRaw = meta["temporal_scope"];
        const stateRaw = meta["state"];
        const isLatestRaw = meta["is_latest"];

        const factCandidate: Fact = {
          id: String(meta["fact_id"] || rec.key),
          subject: String(meta["subject"] || "General"),
          predicate: String(meta["predicate"] || "related_to"),
          object: String(meta["object"] || rec.payload),
          confidence: typeof meta["confidence"] === "number" ? meta["confidence"] : 0.8,
          temporalScope:
            typeof scopeRaw === "string" && VALID_SCOPES.has(scopeRaw)
              ? (scopeRaw as Fact["temporalScope"])
              : "persistent",
          source: String(meta["source"] || "historical"),
          validAt,
          invalidAt,
          supersededBy: typeof meta["superseded_by"] === "string" ? meta["superseded_by"] : null,
          // M12: leer el estado almacenado (`state`/`is_latest`) en vez de
          // derivarlo por fecha; la derivación queda solo como último recurso.
          state:
            typeof stateRaw === "string" && VALID_STATES.has(stateRaw)
              ? (stateRaw as Fact["state"])
              : isLatestRaw === false
                ? "superseded"
                : invalidAt !== null && invalidAt <= Date.now()
                  ? "superseded"
                  : "active",
        };

        if (FactSchema.safeParse(factCandidate).success) {
          historicalFacts.push(factCandidate);
        }
      }
    }

    return historicalFacts.slice(0, limit);
  }

  /**
   * Lista el namespace completo. Vía preferida: cursor del binding nativo
   * (`db.list({ namespace, limit, cursor })` hasta agotar `next_cursor`),
   * accesible sin modificar `@ego/memory` a través de `adapter.getDb()`.
   * Fallback (adapters sin `getDb`, p. ej. mocks legacy): `adapter.list`
   * con límite incremental hasta estabilizar.
   */
  private async listAllRecords(namespace: string): Promise<ListedRecord[]> {
    const db = this.readDbHandle();
    if (db) {
      const all: ListedRecord[] = [];
      let cursor: string | number | undefined = undefined;
      for (;;) {
        const page: CursorListPage =
          cursor === undefined
            ? await db.list({ namespace, limit: PAGE_SIZE })
            : await db.list({ namespace, limit: PAGE_SIZE, cursor });
        for (const r of page.records) {
          all.push({
            key: r.key,
            payload: parsePayload(r.payload),
            metadata: unwrapTaggedMetadata(r.metadata),
          });
        }
        if (page.records.length === 0) {
          break;
        }
        const next: string | number | undefined = page.next_cursor;
        if (typeof next === "number") {
          cursor = next;
        } else if (typeof next === "string" && next !== "") {
          cursor = next;
        } else {
          break;
        }
      }
      return all;
    }
    return this.listViaAdapterIncremental(namespace);
  }

  private readDbHandle(): CursorListDb | null {
    const maybe = this.adapter as unknown as { getDb?: unknown };
    if (typeof maybe.getDb !== "function") {
      return null;
    }
    const db = (maybe.getDb as () => unknown)() as { list?: unknown } | null;
    if (!db || typeof db.list !== "function") {
      return null;
    }
    return db as unknown as CursorListDb;
  }

  private async listViaAdapterIncremental(namespace: string): Promise<ListedRecord[]> {
    let limit = PAGE_SIZE;
    let previousCount = -1;
    let last: ListedRecord[] = [];
    for (;;) {
      const batch = await this.adapter.list(namespace, limit);
      if (batch.length === previousCount || batch.length < limit) {
        return batch;
      }
      previousCount = batch.length;
      last = batch;
      limit *= 2;
      if (limit > FALLBACK_MAX_LIMIT) {
        return last;
      }
    }
  }
}
