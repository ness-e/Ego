/**
 * CFG-11 — Cola priorizada de pushes main→renderer (módulo PURO).
 *
 * Problema: todos los `win.webContents.send` compiten en FIFO ciego — una
 * ráfaga de `ipc.event` background puede demorar mensajes críticos
 * (`turn-cancelled`, `chat.error`, `approval.request`).
 *
 * Diseño (Spec S1–S5): 3 niveles (critical > interactive > background),
 * FIFO por nivel, coalescing por `coalesceKey` SOLO para lecturas
 * idempotentes (ej. `recall_status` del turno; NUNCA deltas de texto ni
 * `terminal.output` — reemplazarlos perdería datos), expiración de
 * obsoletos (TTL default 5s) y fairness: tras N pops no-background
 * consecutivos, un background en espera obtiene un slot (nunca muere).
 *
 * Sin dependencias Electron: reloj inyectable (`now` por llamada) para
 * tests deterministas sin timers. El drenaje con `setImmediate` vive en
 * `main.ts` (sección CFG-11); acá solo la estructura de datos.
 */

/** Obsoleto más allá de este TTL se descarta al desencolar (Spec S3). */
export const CFG11_OBSOLETE_TTL_MS = 5000;

/**
 * Fairness (Spec S5): tras esta cantidad de pops no-background
 * consecutivos, el próximo pop cede a un background en espera.
 */
export const CFG11_MAX_CONSECUTIVE_NON_BG = 8;

export type IpcPriority = "critical" | "interactive" | "background";

export interface QueuedIpc {
  channel: string;
  payload: unknown;
  priority: IpcPriority;
  /** Solo lecturas idempotentes: mismo key → el último reemplaza. */
  coalesceKey?: string;
  enqueuedAt: number;
  ttlMs: number;
}

export interface EnqueueIpcInput {
  channel: string;
  payload: unknown;
  priority: IpcPriority;
  coalesceKey?: string;
  /** Reloj inyectable (tests deterministas). Default: `Date.now()`. */
  now?: number;
  ttlMs?: number;
}

export interface IpcQueueStats {
  enqueued: number;
  dequeued: number;
  coalesced: number;
  expired: number;
}

const LEVEL_ORDER: readonly IpcPriority[] = ["critical", "interactive", "background"];

/** Cola priorizada con coalescing, TTL y fairness background. */
export class IpcPriorityQueue {
  private readonly levels: Record<IpcPriority, QueuedIpc[]> = {
    critical: [],
    interactive: [],
    background: [],
  };
  /** Índice coalesceKey → mensaje vivo (solo niveles con key). */
  private readonly byKey = new Map<string, QueuedIpc>();
  private nonBgStreak = 0;
  readonly stats: IpcQueueStats = { enqueued: 0, dequeued: 0, coalesced: 0, expired: 0 };

  size(): number {
    return this.levels.critical.length + this.levels.interactive.length + this.levels.background.length;
  }

  clear(): void {
    this.levels.critical.length = 0;
    this.levels.interactive.length = 0;
    this.levels.background.length = 0;
    this.byKey.clear();
    this.nonBgStreak = 0;
  }

  enqueue(input: EnqueueIpcInput): void {
    const now = input.now ?? Date.now();
    // Coalescing: la misma key idempotente se reemplaza in-place (último
    // gana); el TTL se renueva. Sin key → FIFO clásico.
    if (input.coalesceKey) {
      const live = this.byKey.get(input.coalesceKey);
      if (live) {
        live.channel = input.channel;
        live.payload = input.payload;
        live.enqueuedAt = now;
        live.ttlMs = input.ttlMs ?? CFG11_OBSOLETE_TTL_MS;
        this.stats.coalesced++;
        return;
      }
    }
    const msg: QueuedIpc = {
      channel: input.channel,
      payload: input.payload,
      priority: input.priority,
      coalesceKey: input.coalesceKey,
      enqueuedAt: now,
      ttlMs: input.ttlMs ?? CFG11_OBSOLETE_TTL_MS,
    };
    this.levels[input.priority].push(msg);
    if (input.coalesceKey) this.byKey.set(input.coalesceKey, msg);
    this.stats.enqueued++;
  }

  /** Desencola el próximo mensaje (null si vacía o todo expiró). */
  dequeue(now?: number): QueuedIpc | null {
    const t = now ?? Date.now();
    this.dropExpired(t);
    // Fairness: un background en espera obtiene slot tras N pops
    // no-background consecutivos (aunque haya críticas/interactivas).
    if (
      this.levels.background.length > 0 &&
      this.nonBgStreak >= CFG11_MAX_CONSECUTIVE_NON_BG
    ) {
      return this.pop("background");
    }
    for (const level of LEVEL_ORDER) {
      if (this.levels[level].length > 0) return this.pop(level);
    }
    return null;
  }

  /** Drena hasta `limit` mensajes en orden de prioridad (default: todo). */
  drain(now?: number, limit = Number.POSITIVE_INFINITY): QueuedIpc[] {
    const out: QueuedIpc[] = [];
    while (out.length < limit) {
      const m = this.dequeue(now);
      if (!m) break;
      out.push(m);
    }
    return out;
  }

  private pop(level: IpcPriority): QueuedIpc {
    const msg = this.levels[level].shift() as QueuedIpc;
    if (msg.coalesceKey && this.byKey.get(msg.coalesceKey) === msg) {
      this.byKey.delete(msg.coalesceKey);
    }
    this.nonBgStreak = level === "background" ? 0 : this.nonBgStreak + 1;
    this.stats.dequeued++;
    return msg;
  }

  private dropExpired(now: number): void {
    for (const level of LEVEL_ORDER) {
      const keel = this.levels[level];
      for (let i = keel.length - 1; i >= 0; i--) {
        const m = keel[i] as QueuedIpc;
        if (now - m.enqueuedAt > m.ttlMs) {
          keel.splice(i, 1);
          if (m.coalesceKey && this.byKey.get(m.coalesceKey) === m) {
            this.byKey.delete(m.coalesceKey);
          }
          this.stats.expired++;
        }
      }
    }
  }
}
