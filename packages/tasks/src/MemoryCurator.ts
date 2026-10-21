import type { EgoMemoryAdapter } from '@ego/memory';
import { DreamConsolidator, type DreamConsolidationStats } from '@ego/memory';

export interface MemoryCuratorOptions {
  /** Horas entre corridas programadas (por defecto 24). Debe ser > 0. */
  intervalHours?: number;
  /** Días de antigüedad para considerar un registro stale (por defecto 90). Debe ser > 0. */
  staleAfterDays?: number;
  /** Namespaces barridos en busca de stale (por defecto kb/facts + kb/docs). */
  staleNamespaces?: string[];
  /** Tamaño de lote por namespace (por defecto 50). */
  staleBatchSize?: number;
}

export interface CuratorRunStats {
  timestamp: number;
  durationMs: number;
  staleConsolidatedCount: number;
  staleNamespacesScanned: string[];
  /** Presente solo cuando se configuró un DreamConsolidator. */
  dream?: DreamConsolidationStats;
}

interface CuratorListItem {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/** Superficie mínima del adapter que usa el curator (list/put/recordAudit). */
interface CuratorGateway {
  list(namespace: string, limit?: number): Promise<CuratorListItem[]>;
  put(item: {
    namespace: string;
    key: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
  recordAudit?(action: string, actor: string, details: Record<string, unknown>): Promise<unknown>;
}

function asGateway(adapter: EgoMemoryAdapter): CuratorGateway {
  return adapter as unknown as CuratorGateway;
}

function isQuarantined(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  if (metadata['quarantined'] === true) return true;
  if (metadata['state'] === 'quarantined') return true;
  // Envoltorio de quarantine/pending: solo el DreamConsolidator lo toca.
  if (typeof metadata['original_namespace'] === 'string') return true;
  return false;
}

function isTerminalState(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  const state = metadata['state'];
  return state === 'superseded' || state === 'archived';
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Timestamp de última actividad del registro (metadata primero, payload después). */
function readRecordTimestamp(item: CuratorListItem): number | null {
  const meta = item.metadata;
  if (meta) {
    for (const field of ['ts', 'created_at', 'updated_at', 'timestamp']) {
      const ts = readNumber(meta[field]);
      if (ts !== null) return ts;
    }
  }
  const payload = item.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;
    for (const field of ['timestamp', 'updated_at', 'created_at']) {
      const ts = readNumber(p[field]);
      if (ts !== null) return ts;
    }
  }
  return null;
}

/**
 * Job programado de curaduría de memoria (CFG-08).
 *
 * Cada corrida:
 * 1. Delega en `DreamConsolidator.runCycle` si se configuró (purga de
 *    cuarentena expirada + deduplicación) — el curator NUNCA toca
 *    `quarantine/pending` por su cuenta: los registros marcados como
 *    cuarentena se omiten siempre.
 * 2. Marca como `superseded` (soft-replace, nunca borra en caliente) los
 *    registros de `staleNamespaces` sin actividad por más de
 *    `staleAfterDays`. Sin timestamp evidenciable → no se toca.
 *
 * ## Quién es el dueño de la consolidación ("sueño")
 *
 * En el producto, la consolidación de hechos la dispara **el lifecycle**
 * (`EgoMemoryLifecycle.runDreamConsolidation`, en el hook de inactividad de
 * 5 min): es el que tiene el disparador natural y deja la evidencia en
 * `gov/audit`. Por eso **el producto NO le pasa un `DreamConsolidator` a este
 * curator**: hacerlo consolidaría dos veces por el mismo ciclo. Este job
 * aporta la capacidad que el lifecycle no tiene: **marcar stale**.
 */
export class MemoryCurator {
  private readonly gateway: CuratorGateway;
  private readonly consolidator?: DreamConsolidator;
  private readonly intervalHours: number;
  private readonly staleAfterDays: number;
  private readonly staleNamespaces: string[];
  private readonly staleBatchSize: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    adapter: EgoMemoryAdapter,
    options: MemoryCuratorOptions = {},
    consolidator?: DreamConsolidator
  ) {
    const intervalHours = options.intervalHours ?? 24;
    const staleAfterDays = options.staleAfterDays ?? 90;
    if (!(intervalHours > 0) || !Number.isFinite(intervalHours)) {
      throw new Error(
        `[MemoryCurator] intervalHours debe ser > 0 (recibido: ${options.intervalHours})`
      );
    }
    if (!(staleAfterDays > 0) || !Number.isFinite(staleAfterDays)) {
      throw new Error(
        `[MemoryCurator] staleAfterDays debe ser > 0 (recibido: ${options.staleAfterDays})`
      );
    }
    this.gateway = asGateway(adapter);
    this.consolidator = consolidator;
    this.intervalHours = intervalHours;
    this.staleAfterDays = staleAfterDays;
    this.staleNamespaces = options.staleNamespaces ?? ['kb/facts', 'kb/docs'];
    this.staleBatchSize = options.staleBatchSize ?? 50;
  }

  public get running(): boolean {
    return this.timer !== null;
  }

  public async runOnce(now: number = Date.now()): Promise<CuratorRunStats> {
    const startTime = Date.now();
    let dream: DreamConsolidationStats | undefined;
    if (this.consolidator) {
      dream = await this.consolidator.runCycle(now);
    }

    const cutoff = now - this.staleAfterDays * 24 * 60 * 60 * 1000;
    let staleConsolidatedCount = 0;
    const scanned: string[] = [];

    for (const ns of this.staleNamespaces) {
      let items: CuratorListItem[];
      try {
        items = await this.gateway.list(ns, this.staleBatchSize);
      } catch {
        continue;
      }
      scanned.push(ns);
      for (const item of items) {
        if (isQuarantined(item.metadata)) continue;
        if (isTerminalState(item.metadata)) continue;
        const ts = readRecordTimestamp(item);
        if (ts === null || ts > cutoff) continue;

        let payload: Record<string, unknown>;
        if (typeof item.payload === 'string') {
          try {
            const parsed: unknown = JSON.parse(item.payload);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
            payload = parsed as Record<string, unknown>;
          } catch {
            continue;
          }
        } else if (item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)) {
          payload = { ...(item.payload as Record<string, unknown>) };
        } else {
          continue;
        }

        await this.gateway.put({
          namespace: ns,
          key: item.key,
          payload: {
            ...payload,
            is_latest: false,
            superseded_by: 'curator:stale',
          },
          metadata: {
            ...(item.metadata ?? {}),
            state: 'superseded',
            superseded_by: 'curator:stale',
            superseded_at: now,
          },
        });
        staleConsolidatedCount++;
      }
    }

    if (this.gateway.recordAudit) {
      try {
        await this.gateway.recordAudit('curator_run', 'ego.memory_curator', {
          staleConsolidatedCount,
          staleNamespacesScanned: scanned,
          staleAfterDays: this.staleAfterDays,
          timestamp: now,
        });
      } catch (err) {
        console.warn(
          `[MemoryCurator] auditoría de corrida falló (resultado intacto): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return {
      timestamp: now,
      durationMs: Date.now() - startTime,
      staleConsolidatedCount,
      staleNamespacesScanned: scanned,
      ...(dream !== undefined ? { dream } : {}),
    };
  }

  /**
   * Inicia la corrida periódica (idempotente; cada `intervalHours`).
   *
   * El temporizador **no retiene el proceso** (`unref`): en Electron, un
   * `setInterval` vivo impediría que la app cerrase.
   *
   * Una corrida fallida **no** detiene la programación: se registra y el
   * siguiente tick sigue igual (fail-soft).
   */
  public start(onRun?: (stats: CuratorRunStats) => void): void {
    if (this.timer !== null) return;
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      void this.runOnce()
        .then((stats) => {
          onRun?.(stats);
        })
        .catch((err: unknown) => {
          // Defensive: una corrida fallida no detiene la programación.
          console.warn(
            `[MemoryCurator] corrida fallida (resultado intacto): ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });
    }, intervalMs);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") {
      t.unref();
    }
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
