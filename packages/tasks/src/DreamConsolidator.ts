import { EgoMemoryAdapter } from '@ego/memory';

export interface DreamConsolidationStats {
  deduplicatedCount: number;
  supersededCount: number;
  quarantinePurgedCount: number;
  durationMs: number;
  timestamp: number;
}

export interface DreamConsolidatorOptions {
  idleThresholdMs?: number; // Por defecto 5 minutos (300_000 ms)
  batchSize?: number; // Tamaño de micro-lote (por defecto 50)
}

export class DreamConsolidator {
  private idleThresholdMs: number;
  private batchSize: number;

  constructor(
    private memoryAdapter: EgoMemoryAdapter,
    options: DreamConsolidatorOptions = {}
  ) {
    this.idleThresholdMs = options.idleThresholdMs ?? 300000;
    this.batchSize = options.batchSize ?? 50;
  }

  public isSystemIdle(lastActivityTimestamp: number, now = Date.now()): boolean {
    return now - lastActivityTimestamp >= this.idleThresholdMs;
  }

  public async runCycle(now = Date.now()): Promise<DreamConsolidationStats> {
    const startTime = Date.now();
    let deduplicatedCount = 0;
    let supersededCount = 0;
    let quarantinePurgedCount = 0;

    // 1. Purga de cuarentena expirada (quarantine/pending)
    try {
      const quarantineItems = await this.memoryAdapter.list('quarantine/pending', this.batchSize);
      for (const item of quarantineItems) {
        const metadata = item.metadata as Record<string, unknown> | undefined;
        const expiresAt = typeof metadata?.expiresAt === 'number' ? metadata.expiresAt : 0;
        if (expiresAt > 0 && expiresAt <= now) {
          await this.memoryAdapter.delete('quarantine/pending', item.key);
          quarantinePurgedCount++;
        }
      }
    } catch {
      // Namespace no existe o está vacío
    }

    // 2. Consolidación de hechos y deduplicación en kb/facts
    try {
      const facts = await this.memoryAdapter.list('kb/facts', this.batchSize);
      const seenSignatures = new Map<string, string>(); // signature -> key

      for (const fact of facts) {
        const payload =
          typeof fact.payload === 'string'
            ? JSON.parse(fact.payload)
            : (fact.payload as Record<string, unknown>);

        const subject = String(payload?.subject || '');
        const predicate = String(payload?.predicate || '');
        const object = String(payload?.object || '');
        const sig = `${subject.toLowerCase()}::${predicate.toLowerCase()}::${object.toLowerCase()}`;

        if (seenSignatures.has(sig)) {
          // Hecho duplicado idéntico: marcar superseded
          const previousKey = seenSignatures.get(sig)!;
          await this.memoryAdapter.put({
            namespace: 'kb/facts',
            key: fact.key,
            payload: {
              ...payload,
              is_latest: false,
              superseded_by: previousKey,
            },
            metadata: {
              ...(fact.metadata as Record<string, unknown>),
              state: 'superseded',
            },
          });
          deduplicatedCount++;
          supersededCount++;
        } else {
          seenSignatures.set(sig, fact.key);
        }
      }
    } catch {
      // Namespace no existe o está vacío
    }

    const durationMs = Date.now() - startTime;
    return {
      deduplicatedCount,
      supersededCount,
      quarantinePurgedCount,
      durationMs,
      timestamp: now,
    };
  }
}
