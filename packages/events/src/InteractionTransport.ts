/**
 * Transporte de interacción HITL con admisión por timeout (STAB-14).
 *
 * Patrón coucou island/fsm + bridge (reimplementación TS): un solicitante
 * publica una interacción (`submit`) y espera admisión (`admit`) con timeout
 * corto. `admit` NUNCA rechaza ni bloquea: ante timeout, cancelación o id
 * desconocido resuelve `false` (fallback sin bloqueo) para que el caller
 * aplique su política fail-closed/degenerada sin colgar el loop.
 */
export type InteractionOutcome = "approved" | "denied" | "cancelled";

export interface InteractionRecord {
  readonly id: string;
  readonly createdAt: number;
  settled: boolean;
  outcome: InteractionOutcome | null;
  reason: string | null;
}

export interface AdmitOptions {
  timeoutMs?: number;
}

const DEFAULT_ADMIT_TIMEOUT_MS = 250;

export class InteractionTransport {
  private readonly pending = new Map<string, InteractionRecord>();
  private readonly waiters = new Map<string, Array<(v: boolean) => void>>();

  public submit(id: string): InteractionRecord {
    const existing = this.pending.get(id);
    if (existing && !existing.settled) return existing;
    const record: InteractionRecord = {
      id,
      createdAt: Date.now(),
      settled: false,
      outcome: null,
      reason: null,
    };
    this.pending.set(id, record);
    return record;
  }

  public resolve(id: string, outcome: Exclude<InteractionOutcome, "cancelled"> = "approved"): boolean {
    return this.settle(id, outcome, null);
  }

  public cancel(id: string, reason = "cancelled"): boolean {
    return this.settle(id, "cancelled", reason);
  }

  private settle(id: string, outcome: InteractionOutcome, reason: string | null): boolean {
    const record = this.pending.get(id);
    if (!record || record.settled) return false;
    record.settled = true;
    record.outcome = outcome;
    record.reason = reason;
    const waiters = this.waiters.get(id) ?? [];
    this.waiters.delete(id);
    for (const w of waiters) {
      try {
        w(outcome === "approved");
      } catch {
        // Defensive: un waiter roto no rompe el transporte.
      }
    }
    return true;
  }

  /**
   * Espera admisión de la interacción hasta `timeoutMs` (default 250ms).
   * Resuelve `true` solo si se aprobó antes del timeout; `false` en
   * timeout/cancel/denegación/id desconocido. Nunca rechaza.
   */
  public admit(id: string, options: AdmitOptions = {}): Promise<boolean> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_ADMIT_TIMEOUT_MS;
    const record = this.pending.get(id);
    if (!record) return Promise.resolve(false);
    if (record.settled) return Promise.resolve(record.outcome === "approved");
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        const list = this.waiters.get(id);
        if (list) {
          const idx = list.indexOf(done);
          if (idx >= 0) list.splice(idx, 1);
          if (list.length === 0) this.waiters.delete(id);
        }
        resolve(false);
      }, Math.max(0, timeoutMs));
      const done = (v: boolean) => {
        clearTimeout(timer);
        resolve(v);
      };
      const list = this.waiters.get(id) ?? [];
      list.push(done);
      this.waiters.set(id, list);
    });
  }

  public get(id: string): InteractionRecord | null {
    return this.pending.get(id) ?? null;
  }

  public pendingCount(): number {
    let n = 0;
    for (const r of this.pending.values()) if (!r.settled) n++;
    return n;
  }
}
