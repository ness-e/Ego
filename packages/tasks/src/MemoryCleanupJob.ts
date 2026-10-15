import type { EgoMemoryAdapter } from '@ego/memory';
import {
  pruneStaleSessions,
  resolveSessionRetentionSettings,
  SESSION_TIMELINE_NAMESPACE,
  type SessionRetentionReport,
} from '@ego/memory';

/**
 * Job periódico de limpieza de memoria y disco (STAB-05, cleanupPeriod 30d
 * Gate P vinculante).
 *
 * Barre, en orden:
 * 1. `sessions/timelines` — sesiones stale (vía `pruneStaleSessions`).
 * 2. `session/turns` — turnos stale (mismo criterio; `TurnRecord.timestamp`
 *    es legible por `extractLastActive`). Conservador: sin timestamp
 *    legible nunca se poda.
 * 3. Leases expirados — callback inyectado (`SharedMemory.cleanExpiredLeases`).
 * 4. Worktrees huérfanos — callback inyectado
 *    (`SubEgoWorktreeManager.pruneOrphanWorktrees`).
 * 5. Snapshots `.vdbdump` — callback inyectado (`pruneSnapshotDumps`, fs
 *    vive fuera de este paquete).
 *
 * Los hooks 3-5 son opcionales: ausentes → sección `null` sin lanzar.
 * Fallo de un hook → esa sección `null` + `*Error` con el mensaje, el resto
 * del job continúa (fail-safe: la limpieza nunca tumba el turno).
 */
export interface WorktreePruneEntry {
  path: string;
  pruned: boolean;
  reason: string;
}

export interface WorktreePruneReport {
  repoRoot: string;
  scanned: number;
  pruned: WorktreePruneEntry[];
  preserved: WorktreePruneEntry[];
}

export interface SnapshotPruneReport {
  directory: string;
  kept: string[];
  pruned: string[];
  activePreserved: boolean;
  maxSnapshots: number;
}

export interface MemoryCleanupOptions {
  /** Días de inactividad para stale (default 30, Gate P). Debe ser >= 1. */
  cleanupPeriodDays?: number;
  /** Namespace de timelines (default `sessions/timelines`). */
  sessionsNamespace?: string;
  /** Namespace de turnos (default `session/turns`). */
  turnsNamespace?: string;
  /** Limpieza de leases expirados (retorna cantidad podada). */
  cleanExpiredLeases?: () => number | Promise<number>;
  /** Poda de worktrees huérfanos. */
  pruneOrphanWorktrees?: (olderThanMs: number) => WorktreePruneReport | Promise<WorktreePruneReport>;
  /** Rotación de snapshots `.vdbdump`. */
  pruneSnapshots?: () => SnapshotPruneReport | Promise<SnapshotPruneReport>;
}

export interface MemoryCleanupRunOptions {
  nowMs?: number;
  limit?: number;
}

export interface MemoryCleanupReport {
  timestamp: number;
  durationMs: number;
  cleanupPeriodDays: number;
  sessions: SessionRetentionReport;
  turns: SessionRetentionReport;
  leasesCleaned: number | null;
  leasesError?: string;
  worktrees: WorktreePruneReport | null;
  worktreesError?: string;
  snapshots: SnapshotPruneReport | null;
  snapshotsError?: string;
}

/** Superficie mínima del adapter que usa el job (list/delete/recordAudit). */
interface CleanupGateway {
  list(namespace: string, limit?: number): Promise<Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>>;
  delete(namespace: string, key: string): Promise<boolean>;
  recordAudit?(action: string, actor: string, details: Record<string, unknown>): Promise<unknown>;
}

function asGateway(adapter: EgoMemoryAdapter): CleanupGateway {
  return adapter as unknown as CleanupGateway;
}

export class MemoryCleanupJob {
  private readonly adapter: CleanupGateway;
  private readonly cleanupPeriodDays: number;
  private readonly sessionsNamespace: string;
  private readonly turnsNamespace: string;
  private readonly cleanExpiredLeases?: () => number | Promise<number>;
  private readonly pruneOrphanWorktrees?: (olderThanMs: number) => WorktreePruneReport | Promise<WorktreePruneReport>;
  private readonly pruneSnapshots?: () => SnapshotPruneReport | Promise<SnapshotPruneReport>;

  constructor(adapter: EgoMemoryAdapter, options: MemoryCleanupOptions = {}) {
    if (
      options.cleanupPeriodDays !== undefined &&
      (!Number.isFinite(options.cleanupPeriodDays) || options.cleanupPeriodDays < 1)
    ) {
      throw new Error(
        `[MemoryCleanupJob] cleanupPeriodDays debe ser >= 1 (recibido: ${options.cleanupPeriodDays})`
      );
    }
    this.adapter = asGateway(adapter);
    this.cleanupPeriodDays = options.cleanupPeriodDays ?? 30;
    this.sessionsNamespace = options.sessionsNamespace ?? SESSION_TIMELINE_NAMESPACE;
    this.turnsNamespace = options.turnsNamespace ?? 'session/turns';
    this.cleanExpiredLeases = options.cleanExpiredLeases;
    this.pruneOrphanWorktrees = options.pruneOrphanWorktrees;
    this.pruneSnapshots = options.pruneSnapshots;
  }

  public get currentCleanupPeriodDays(): number {
    return this.cleanupPeriodDays;
  }

  public async run(runOptions: MemoryCleanupRunOptions = {}): Promise<MemoryCleanupReport> {
    const start = Date.now();
    const nowMs = runOptions.nowMs ?? start;
    const limit = runOptions.limit ?? 500;
    const settings = resolveSessionRetentionSettings({ cleanupPeriodDays: this.cleanupPeriodDays });

    const sessions = await pruneStaleSessions(this.adapter as never, settings, {
      namespace: this.sessionsNamespace,
      nowMs,
      limit,
    });
    const turns = await pruneStaleSessions(this.adapter as never, settings, {
      namespace: this.turnsNamespace,
      nowMs,
      limit,
    });

    let leasesCleaned: number | null = null;
    let leasesError: string | undefined;
    if (this.cleanExpiredLeases) {
      try {
        leasesCleaned = await this.cleanExpiredLeases();
      } catch (err) {
        leasesError = err instanceof Error ? err.message : String(err);
      }
    }

    let worktrees: WorktreePruneReport | null = null;
    let worktreesError: string | undefined;
    if (this.pruneOrphanWorktrees) {
      try {
        worktrees = await this.pruneOrphanWorktrees(this.cleanupPeriodDays * 24 * 60 * 60 * 1000);
      } catch (err) {
        worktreesError = err instanceof Error ? err.message : String(err);
      }
    }

    let snapshots: SnapshotPruneReport | null = null;
    let snapshotsError: string | undefined;
    if (this.pruneSnapshots) {
      try {
        snapshots = await this.pruneSnapshots();
      } catch (err) {
        snapshotsError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      timestamp: nowMs,
      durationMs: Date.now() - start,
      cleanupPeriodDays: this.cleanupPeriodDays,
      sessions,
      turns,
      leasesCleaned,
      ...(leasesError !== undefined ? { leasesError } : {}),
      worktrees,
      ...(worktreesError !== undefined ? { worktreesError } : {}),
      snapshots,
      ...(snapshotsError !== undefined ? { snapshotsError } : {}),
    };
  }
}
