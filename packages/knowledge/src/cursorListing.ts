import type { EgoMemoryAdapter } from "@ego/memory";

export interface ListedRecord {
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

/** Tope de seguridad del fallback incremental vía `adapter.list`. */
const FALLBACK_MAX_LIMIT = 10000;

/**
 * Desenvuelve metadata etiquetada del binding (`{Float, String, Bool}`).
 * Workaround: VDB-BUG-02 (misma lógica que `BitemporalQueries`).
 * Idempotente sobre metadata ya desenvuelta.
 */
export function unwrapTaggedMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (v === "Null") {
      clean[k] = null;
    } else if (typeof v === "object" && v !== null) {
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

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== "string") {
    return payload;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

/**
 * Lista un namespace completo (F2T5, patrón probado en `BitemporalQueries` F2T3).
 * Vía preferida: cursor del binding nativo (`db.list({ namespace, limit, cursor })`
 * hasta agotar `next_cursor`), accesible sin modificar `@ego/memory` vía `getDb()`.
 * Fallback (adapters sin `getDb`, p. ej. mocks legacy): `adapter.list` con
 * límite incremental hasta estabilizar. La metadata siempre vuelve desenvuelta.
 */
export async function listAllNamespaceRecords(
  adapter: EgoMemoryAdapter,
  namespace: string,
  pageSize = 100
): Promise<ListedRecord[]> {
  const db = readDbHandle(adapter);
  if (db) {
    const all: ListedRecord[] = [];
    let cursor: string | number | undefined = undefined;
    for (;;) {
      const page: CursorListPage =
        cursor === undefined
          ? await db.list({ namespace, limit: pageSize })
          : await db.list({ namespace, limit: pageSize, cursor });
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
  return listViaAdapterIncremental(adapter, namespace, pageSize);
}

function readDbHandle(adapter: EgoMemoryAdapter): CursorListDb | null {
  const maybe = adapter as unknown as { getDb?: unknown };
  if (typeof maybe.getDb !== "function") {
    return null;
  }
  const db = (maybe.getDb as () => unknown)() as { list?: unknown } | null;
  if (!db || typeof db.list !== "function") {
    return null;
  }
  return db as unknown as CursorListDb;
}

async function listViaAdapterIncremental(
  adapter: EgoMemoryAdapter,
  namespace: string,
  pageSize: number
): Promise<ListedRecord[]> {
  let limit = pageSize;
  let previousCount = -1;
  let last: ListedRecord[] = [];
  for (;;) {
    const batch = await adapter.list(namespace, limit);
    const mapped: ListedRecord[] = batch.map((r) => ({
      key: r.key,
      payload: r.payload,
      metadata: r.metadata ? unwrapTaggedMetadata(r.metadata) : undefined,
    }));
    if (mapped.length === previousCount || mapped.length < limit) {
      return mapped;
    }
    previousCount = mapped.length;
    last = mapped;
    limit *= 2;
    if (limit > FALLBACK_MAX_LIMIT) {
      return last;
    }
  }
}

/**
 * Barrera de durabilidad best-effort (no-op en adapters sin `flush`;
 * avisa pero no bloquea si el motor falla al sincronizar).
 */
export async function flushBestEffort(
  adapter: EgoMemoryAdapter,
  context: string
): Promise<void> {
  const maybe = adapter as unknown as { flush?: unknown };
  if (typeof maybe.flush !== "function") {
    return;
  }
  try {
    await (maybe.flush as () => Promise<void>).call(adapter);
  } catch (err) {
    console.warn(`[knowledge] flush best-effort falló tras ${context}:`, err);
  }
}
