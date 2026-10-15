import type { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";

/**
 * Retención de sesiones (CFG-05).
 *
 * - `cleanupPeriodDays` (30): sesiones sin actividad durante este período
 *   se consideran stale y son podables.
 * - `autoMemory` (true): el job de retención archiva un aviso en
 *   `gov/audit` por cada poda para memoria curada y auditable.
 */
export interface SessionRetentionSettings {
  cleanupPeriodDays: number;
  autoMemory: boolean;
}

export const DEFAULT_SESSION_RETENTION_SETTINGS: SessionRetentionSettings = {
  cleanupPeriodDays: 30,
  autoMemory: true,
};

/** Namespace por defecto donde viven los timelines de sesión. */
export const SESSION_TIMELINE_NAMESPACE = "sessions/timelines";

export interface SessionRetentionReport {
  namespace: string;
  kept: string[];
  pruned: string[];
  cleanupPeriodDays: number;
}

export function resolveSessionRetentionSettings(
  partial?: Partial<SessionRetentionSettings>
): SessionRetentionSettings {
  const merged: SessionRetentionSettings = {
    ...DEFAULT_SESSION_RETENTION_SETTINGS,
    ...partial,
  };
  if (!Number.isFinite(merged.cleanupPeriodDays) || merged.cleanupPeriodDays < 1) {
    throw new Error(
      `[SessionRetention] cleanupPeriodDays debe ser >= 1 (recibido: ${merged.cleanupPeriodDays})`
    );
  }
  return merged;
}

/** `true` si la última actividad supera el período de limpieza. */
export function isSessionStale(
  lastActiveMs: number,
  nowMs: number,
  cleanupPeriodDays: number
): boolean {
  if (!Number.isFinite(lastActiveMs) || lastActiveMs <= 0) return false;
  const ageMs = nowMs - lastActiveMs;
  if (ageMs <= 0) return false;
  return ageMs > cleanupPeriodDays * 24 * 60 * 60 * 1000;
}

export interface SessionActivity {
  key: string;
  lastActiveMs: number;
}

/** Partición pura stale/activas (sin I/O, testeable). */
export function selectStaleSessions(
  sessions: SessionActivity[],
  nowMs: number,
  cleanupPeriodDays: number
): { stale: SessionActivity[]; active: SessionActivity[] } {
  const stale: SessionActivity[] = [];
  const active: SessionActivity[] = [];
  for (const s of sessions) {
    if (isSessionStale(s.lastActiveMs, nowMs, cleanupPeriodDays)) stale.push(s);
    else active.push(s);
  }
  return { stale, active };
}

interface RetentionListItem {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

function extractLastActive(item: RetentionListItem): number {
  const payload = item.payload;
  if (payload !== null && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p["timestamp"] === "number") return p["timestamp"] as number;
    const turns = p["turns"];
    if (Array.isArray(turns)) {
      let max = 0;
      for (const t of turns) {
        if (t !== null && typeof t === "object") {
          const ts = (t as Record<string, unknown>)["timestamp"];
          if (typeof ts === "number" && ts > max) max = ts;
        }
      }
      if (max > 0) return max;
    }
  }
  const meta = item.metadata;
  if (meta) {
    if (typeof meta["ts"] === "number") return meta["ts"] as number;
    if (typeof meta["timestamp"] === "number") return meta["timestamp"] as number;
  }
  // Sin marca temporal legible: conservador, nunca podar lo desconocido.
  return 0;
}

export interface PruneStaleSessionsOptions {
  namespace?: string;
  nowMs?: number;
  limit?: number;
}

/**
 * Job de retención: lista sesiones del namespace, poda las stale y
 * archiva el aviso en `gov/audit` cuando `autoMemory` está activo.
 *
 * Defensivo: fallo de `list` → reporte vacío (no lanza); fallo de
 * `delete` individual → la clave queda en `kept`.
 */
export async function pruneStaleSessions(
  adapter: EgoMemoryAdapter,
  settings: SessionRetentionSettings = DEFAULT_SESSION_RETENTION_SETTINGS,
  options: PruneStaleSessionsOptions = {}
): Promise<SessionRetentionReport> {
  const resolved = resolveSessionRetentionSettings(settings);
  const namespace = options.namespace ?? SESSION_TIMELINE_NAMESPACE;
  const nowMs = options.nowMs ?? Date.now();
  const limit = options.limit ?? 500;
  const empty: SessionRetentionReport = {
    namespace,
    kept: [],
    pruned: [],
    cleanupPeriodDays: resolved.cleanupPeriodDays,
  };

  let rows: RetentionListItem[];
  try {
    rows = await adapter.list(namespace, limit);
  } catch {
    return empty;
  }
  if (rows.length === 0) return empty;

  const activities: SessionActivity[] = rows.map((r) => ({
    key: r.key,
    lastActiveMs: extractLastActive(r),
  }));
  const { stale, active } = selectStaleSessions(activities, nowMs, resolved.cleanupPeriodDays);

  const kept = active.map((s) => s.key);
  const pruned: string[] = [];
  for (const s of stale) {
    try {
      const ok = await adapter.delete(namespace, s.key);
      if (ok) pruned.push(s.key);
      else kept.push(s.key);
    } catch {
      kept.push(s.key);
    }
  }

  if (resolved.autoMemory && pruned.length > 0) {
    try {
      await adapter.recordAudit("session_retention_prune", "ego.memory_lifecycle", {
        namespace,
        prunedKeys: pruned,
        count: pruned.length,
        cleanupPeriodDays: resolved.cleanupPeriodDays,
        timestamp: nowMs,
      });
    } catch {
      // El aviso es curaduría, nunca bloquea la poda ya ejecutada.
    }
  }

  return {
    namespace,
    kept: kept.sort(),
    pruned: pruned.sort(),
    cleanupPeriodDays: resolved.cleanupPeriodDays,
  };
}
