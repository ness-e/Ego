import { EgoMemoryAdapter, type EgoListPage } from '@ego/memory';

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

/**
 * Normaliza un término para deduplicación:
 * 1. Minúsculas
 * 2. Trim
 * 3. Colapso de espacios múltiples
 * 4. Eliminación de signos de puntuación final (. , ; : ! ?)
 */
export function normalizeFactTerm(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/, '')
    .trim();
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

  /**
   * Itera sobre todos los registros de un namespace en lotes de tamaño `batchSize`.
   * Si el adapter expone `listPaged`, usa paginación con cursor y límite seguro de iteraciones.
   * Si el cursor no avanza o no hay más páginas, corta inmediatamente.
   * Si el adapter no expone `listPaged`, recurre a `list()`.
   */
  private async processNamespaceInBatches(
    namespace: string,
    processBatch: (
      records: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>
    ) => Promise<void>
  ): Promise<void> {
    const adapter = this.memoryAdapter as EgoMemoryAdapter & {
      listPaged?: (
        namespace: string,
        limit?: number,
        cursor?: number | string
      ) => Promise<EgoListPage>;
    };

    if (typeof adapter.listPaged === 'function') {
      let cursor: number | string | undefined = undefined;
      let iterations = 0;
      const MAX_ITERATIONS = 1000; // Límite de seguridad contra bucles infinitos

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        const page: EgoListPage = await adapter.listPaged(namespace, this.batchSize, cursor);
        const records: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }> =
          page?.records ?? [];

        if (records.length > 0) {
          await processBatch(records);
        }

        if (!page?.nextCursor || page.nextCursor === cursor || records.length === 0) {
          break;
        }
        cursor = page.nextCursor;
      }
    } else {
      const records = await this.memoryAdapter.list(namespace, this.batchSize);
      if (records.length > 0) {
        await processBatch(records);
      }
    }
  }

  public async runCycle(now = Date.now()): Promise<DreamConsolidationStats> {
    const startTime = Date.now();
    let deduplicatedCount = 0;
    let supersededCount = 0;
    let quarantinePurgedCount = 0;

    // 1. Purga de cuarentena expirada (quarantine/pending) paginada
    try {
      await this.processNamespaceInBatches('quarantine/pending', async (records) => {
        for (const item of records) {
          const metadata = item.metadata as Record<string, unknown> | undefined;
          const expiresAt = typeof metadata?.expiresAt === 'number' ? metadata.expiresAt : 0;
          if (expiresAt > 0 && expiresAt <= now) {
            await this.memoryAdapter.delete('quarantine/pending', item.key);
            quarantinePurgedCount++;
          }
        }
      });
    } catch {
      // Namespace no existe o está vacío
    }

    // 2. Consolidación de hechos y deduplicación en kb/facts paginada
    try {
      const seenSignatures = new Map<string, string>(); // signature -> key
      await this.processNamespaceInBatches('kb/facts', async (records) => {
        for (const fact of records) {
          const payload =
            typeof fact.payload === 'string'
              ? JSON.parse(fact.payload)
              : (fact.payload as Record<string, unknown>);

          const subject = normalizeFactTerm(String(payload?.subject || ''));
          const predicate = normalizeFactTerm(String(payload?.predicate || ''));
          const object = normalizeFactTerm(String(payload?.object || ''));
          const sig = `${subject}::${predicate}::${object}`;

          if (seenSignatures.has(sig)) {
            // Hecho duplicado idéntico o normalizado: marcar superseded
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
      });
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
