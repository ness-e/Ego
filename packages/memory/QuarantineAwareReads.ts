import type { SearchHit } from "vantadb/types";

/**
 * Lecturas quarantine-aware compartidas (SEC-09 FIX-01).
 *
 * Implementación única de la fusión live + `quarantine/pending` con marca
 * explícita. La usan el propio `EgoMemoryAdapter` (`getWithQuarantine`,
 * `listWithQuarantine`) y los lectores directos de namespaces sensibles en
 * otros paquetes (`CharacterProfile`, `SubEgoBudget`, `SelfImprovementLoop`,
 * `SubEgoSoul`, `CrmDomain`, `SessionCheckpointPolicy`, `EgoMemoryLifecycle`,
 * `SubEgoMemoryGuard`) para no duplicar la lógica de resolución.
 *
 * El gateway es estructural y mínimo: cualquier objeto con `get/list`
 * (más `searchMulti` opcional para búsquedas) sirve, incluidos los mocks de
 * tests. Sin `any`: todo lo desconocido se estrecha con narrowing.
 */

export interface QuarantineAwareRecord {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  quarantined: boolean;
  quarantineReason?: string;
}

export interface QuarantineAwareListRow {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/** Superficie mínima de lectura que un gateway debe exponer. */
export interface QuarantineAwareGateway {
  get(namespace: string, key: string): Promise<unknown>;
  list?(namespace: string, limit?: number): Promise<unknown>;
  searchMulti?(
    namespaces: string[],
    query: string,
    options?: { topK?: number; excludeSuperseded?: boolean; minConfidence?: number }
  ): Promise<SearchHit[]>;
}

export const QUARANTINE_PENDING_NAMESPACE = "quarantine/pending";

function quarantineKeyFor(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

/** Lee un metadato como string tolerando variantes etiquetadas `{String}`. */
export function readQuarantineMeta(meta: unknown, field: string): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const v = (meta as Record<string, unknown>)[field];
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const tagged = (v as Record<string, unknown>)["String"];
    if (typeof tagged === "string") return tagged;
  }
  return undefined;
}

function splitEnvelope(raw: unknown, fallbackKey: string): { key: string; payload: unknown; metadata?: Record<string, unknown> } {
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    const payload = "payload" in rec ? rec["payload"] : raw;
    const meta = rec["metadata"];
    return {
      key: typeof rec["key"] === "string" ? (rec["key"] as string) : fallbackKey,
      payload,
      metadata: meta && typeof meta === "object" ? (meta as Record<string, unknown>) : undefined,
    };
  }
  return { key: fallbackKey, payload: raw };
}

function toListRows(raw: unknown): QuarantineAwareListRow[] {
  if (Array.isArray(raw)) return raw as QuarantineAwareListRow[];
  if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>)["records"])) {
    return (raw as Record<string, Array<QuarantineAwareListRow>>)["records"] ?? [];
  }
  return [];
}

/**
 * Lectura por clave: live primero, `quarantine/pending` después, con marca
 * explícita. Retorna `null` si no existe en ningún lado. Nunca lanza por
 * fallos del barrido de cuarentena (degrada a live).
 */
export async function getQuarantineAware(
  gateway: QuarantineAwareGateway,
  namespace: string,
  key: string
): Promise<QuarantineAwareRecord | null> {
  let live: unknown = null;
  try {
    live = await gateway.get(namespace, key);
  } catch {
    live = null;
  }
  if (live !== null && live !== undefined) {
    const split = splitEnvelope(live, key);
    return { key: split.key, payload: split.payload, metadata: split.metadata, quarantined: false };
  }
  let quarantined: unknown = null;
  try {
    quarantined = await gateway.get(QUARANTINE_PENDING_NAMESPACE, quarantineKeyFor(namespace, key));
  } catch {
    return null;
  }
  if (quarantined === null || quarantined === undefined) return null;
  const split = splitEnvelope(quarantined, key);
  const reason = readQuarantineMeta(split.metadata, "quarantine_reason") ?? "quarantined";
  return {
    key,
    payload: split.payload,
    metadata: { ...(split.metadata ?? {}), quarantined: true },
    quarantined: true,
    quarantineReason: reason,
  };
}

/**
 * Listado por namespace exacto: fusiona live + copias en cuarentena cuyo
 * `original_namespace` coincide, marcadas. Ante fallo del barrido de
 * cuarentena degrada al listado live (con aviso, nunca vacío silencioso).
 */
export async function listQuarantineAware(
  gateway: QuarantineAwareGateway,
  namespace: string,
  limit: number = 100,
  onQuarantineSweepError?: (err: unknown) => void
): Promise<QuarantineAwareRecord[]> {
  const list = gateway.list;
  if (typeof list !== "function") return [];
  let liveRaw: unknown = [];
  try {
    liveRaw = await list.call(gateway, namespace, limit);
  } catch {
    liveRaw = [];
  }
  const merged: QuarantineAwareRecord[] = toListRows(liveRaw).map((r) => ({
    key: typeof r.key === "string" ? r.key : "",
    payload: (r as QuarantineAwareListRow).payload,
    metadata: r.metadata,
    quarantined: false,
  }));
  const seen = new Set(merged.map((r) => r.key));
  try {
    const pendingRaw = await list.call(gateway, QUARANTINE_PENDING_NAMESPACE, Math.max(limit, 100));
    for (const rec of toListRows(pendingRaw)) {
      if (rec.metadata?.["original_namespace"] !== undefined) {
        const original = readQuarantineMeta(rec.metadata, "original_namespace");
        if (original !== namespace) continue;
      } else {
        continue;
      }
      const originalKey = readQuarantineMeta(rec.metadata, "original_key") ?? rec.key;
      if (seen.has(originalKey)) continue;
      seen.add(originalKey);
      merged.push({
        key: originalKey,
        payload: rec.payload,
        metadata: { ...(rec.metadata ?? {}), quarantined: true },
        quarantined: true,
        quarantineReason: readQuarantineMeta(rec.metadata, "quarantine_reason") ?? "quarantined",
      });
    }
  } catch (err) {
    if (onQuarantineSweepError) {
      onQuarantineSweepError(err);
    }
  }
  return merged;
}

/**
 * Búsqueda federada con expansión a cuarentena: fusiona hits live + hits de
 * `quarantine/pending` cuyo `original_namespace` cae bajo algún namespace
 * solicitado (exacto o subprefijo `ns/`), marcados. Sin `searchMulti` en el
 * gateway retorna `[]`.
 */
export async function searchQuarantineAware(
  gateway: QuarantineAwareGateway,
  namespaces: string[],
  query: string,
  options?: { topK?: number; excludeSuperseded?: boolean; minConfidence?: number }
): Promise<SearchHit[]> {
  if (typeof gateway.searchMulti !== "function") return [];
  const live = await gateway.searchMulti(namespaces, query, options);
  let pending: SearchHit[] = [];
  try {
    pending = await gateway.searchMulti([QUARANTINE_PENDING_NAMESPACE], query, options);
  } catch {
    return live;
  }
  const tagged: SearchHit[] = [];
  for (const hit of pending) {
    const record = (hit as { record?: { metadata?: unknown } }).record;
    const original = readQuarantineMeta(record?.metadata, "original_namespace");
    if (!original) continue;
    const covered = namespaces.some((ns) => original === ns || original.startsWith(`${ns}/`));
    if (!covered) continue;
    const reason = readQuarantineMeta(record?.metadata, "quarantine_reason") ?? "quarantined";
    tagged.push({
      ...(hit as unknown as Record<string, unknown>),
      record: {
        ...((record ?? {}) as unknown as Record<string, unknown>),
        metadata: {
          ...(((record?.metadata ?? {}) as unknown as Record<string, unknown>)),
          quarantined: true,
          quarantine_reason: reason,
        },
      },
    } as unknown as SearchHit);
  }
  return [...live, ...tagged];
}
