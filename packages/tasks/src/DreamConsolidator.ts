import { EgoMemoryAdapter, type EgoListPage } from '@ego/memory';

export interface DreamConsolidationStats {
  deduplicatedCount: number;
  supersededCount: number;
  quarantinePurgedCount: number;
  durationMs: number;
  timestamp: number;
  /**
   * EGO-FIND-22 / T10: registros cuyo payload no se pudo parsear (JSON
   * corrupto). Antes abortaban el lote y el `catch {}` externo lo silenciaba:
   * el dedup quedaba parcial y sin visibilidad.
   */
  parseErrors: number;
  /**
   * `true` si el barrido se detuvo antes de agotar el namespace (límite de
   * páginas o de iteraciones alcanzado). El resumen no es entonces completo.
   */
  truncated: boolean;
  /** Total de registros leídos en el barrido. */
  scannedCount: number;
}

export interface DreamConsolidatorOptions {
  idleThresholdMs?: number; // Por defecto 5 minutos (300_000 ms)
  batchSize?: number; // Tamaño de página del barrido (por defecto 50)
  /**
   * Límite de páginas por barrido (protección contra bucles infinitos de
   * cursor). Por defecto 1000.
   */
  maxPages?: number;
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

/**
 * Extrae el timestamp de un hecho (payload o metadata) para decidir cuál es
 * la versión vigente de una firma.
 */
function factTimestamp(payload: Record<string, unknown>, metadata?: Record<string, unknown>): number {
  const candidates = [
    payload['valid_at'],
    payload['timestamp'],
    payload['created_at'],
    payload['updated_at'],
    metadata?.['ts'],
    metadata?.['timestamp'],
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string') {
      const parsed = Date.parse(candidate);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
}

/**
 * DreamConsolidator — consolidación de memoria (fase "sueño").
 *
 * EGO-FIND-22 / T10. Dos defectos previos:
 *
 * 1. `JSON.parse(fact.payload)` **sin try/catch dentro del bucle**: un payload
 *    corrupto abortaba el lote y el `catch {}` externo lo silenciaba → dedup
 *    parcial e invisible.
 * 2. El índice de firmas (`seenSignatures`) se **reiniciaba en cada ciclo**:
 *    un fact canónico marcado `is_latest: true` en un ciclo anterior nunca se
 *    desmarcaba, de modo que podían coexistir varios "últimos" para la misma
 *    firma.
 *
 * SOLUCIÓN: la verdad vive en el **metadato persistido** (`state`,
 * `is_latest`, `superseded_by`). Cada barrido recalcula la versión vigente de
 * cada firma (la de mayor timestamp) y marca el resto como `superseded`. Es
 * idempotente y no depende de memoria entre ciclos.
 */
export class DreamConsolidator {
  private idleThresholdMs: number;
  private batchSize: number;
  private maxPages: number;

  constructor(
    private memoryAdapter: EgoMemoryAdapter,
    options: DreamConsolidatorOptions = {}
  ) {
    this.idleThresholdMs = options.idleThresholdMs ?? 300000;
    this.batchSize = options.batchSize ?? 50;
    this.maxPages = options.maxPages ?? 1000;
  }

  public isSystemIdle(lastActivityTimestamp: number, now = Date.now()): boolean {
    return now - lastActivityTimestamp >= this.idleThresholdMs;
  }

  /**
   * Itera sobre todos los registros de un namespace en lotes de tamaño `batchSize`.
   * Si el adapter expone `listPaged`, usa paginación con cursor y límite seguro de iteraciones.
   * Si el cursor no avanza o no hay más páginas, corta inmediatamente.
   * Si el adapter no expone `listPaged`, recurre a `list()`.
   *
   * Devuelve `null` si el barrido se truncó (límite de páginas alcanzado).
   */
  private async processNamespaceInBatches(
    namespace: string,
    processBatch: (
      records: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>
    ) => Promise<void>
  ): Promise<{ truncated: boolean; scanned: number }> {
    const adapter = this.memoryAdapter as EgoMemoryAdapter & {
      listPaged?: (
        namespace: string,
        limit?: number,
        cursor?: number | string
      ) => Promise<EgoListPage>;
    };

    let scanned = 0;

    if (typeof adapter.listPaged === 'function') {
      let cursor: number | string | undefined = undefined;
      let iterations = 0;

      while (iterations < this.maxPages) {
        iterations++;
        const page: EgoListPage = await adapter.listPaged(namespace, this.batchSize, cursor);
        const records: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }> =
          page?.records ?? [];

        if (records.length > 0) {
          scanned += records.length;
          await processBatch(records);
        }

        if (!page?.nextCursor || page.nextCursor === cursor || records.length === 0) {
          return { truncated: false, scanned };
        }
        cursor = page.nextCursor;
      }

      // Se agotó el límite de páginas: el barrido es INCOMPLETO.
      return { truncated: true, scanned };
    }

    const records = await this.memoryAdapter.list(namespace, this.batchSize);
    if (records.length > 0) {
      scanned += records.length;
      await processBatch(records);
    }
    return { truncated: false, scanned };
  }

  public async runCycle(now = Date.now()): Promise<DreamConsolidationStats> {
    const startTime = Date.now();
    let deduplicatedCount = 0;
    let supersededCount = 0;
    let quarantinePurgedCount = 0;
    let parseErrors = 0;
    let truncated = false;
    let scannedCount = 0;

    // 1. Purga de cuarentena expirada (quarantine/pending) paginada
    try {
      const result = await this.processNamespaceInBatches('quarantine/pending', async (records) => {
        for (const item of records) {
          const metadata = item.metadata as Record<string, unknown> | undefined;
          const expiresAt = typeof metadata?.expiresAt === 'number' ? metadata.expiresAt : 0;
          if (expiresAt > 0 && expiresAt <= now) {
            await this.memoryAdapter.delete('quarantine/pending', item.key);
            quarantinePurgedCount++;
          }
        }
      });
      truncated = truncated || result.truncated;
      scannedCount += result.scanned;
    } catch (err: unknown) {
      // Namespace no existe o está vacío. Se registra para que el ciclo sea
      // observable (antes era un `catch {}` mudo).
      console.warn(
        `[DreamConsolidator] Purga de cuarentena omitida: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // 2. Consolidación de hechos y deduplicación en kb/facts paginada
    //
    // ESTRATEGIA PERSISTENTE (T10): se agrupan los hechos por firma
    // normalizada; la versión vigente es la de mayor timestamp y el resto se
    // marca `superseded` en el METADATO persistido. Así el estado sobrevive
    // entre ciclos (antes vivía en un Map en memoria que se reiniciaba).
    const bySignature = new Map<
      string,
      Array<{
        key: string;
        payload: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        timestamp: number;
      }>
    >();

    try {
      const result = await this.processNamespaceInBatches('kb/facts', async (records) => {
        for (const fact of records) {
          // Parseo tolerante: un payload corrupto NO aborta el lote.
          let payload: Record<string, unknown>;
          if (typeof fact.payload === 'string') {
            try {
              const parsed = JSON.parse(fact.payload);
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                parseErrors++;
                continue;
              }
              payload = parsed as Record<string, unknown>;
            } catch {
              parseErrors++;
              continue;
            }
          } else if (fact.payload && typeof fact.payload === 'object' && !Array.isArray(fact.payload)) {
            payload = fact.payload as Record<string, unknown>;
          } else {
            parseErrors++;
            continue;
          }

          const subject = normalizeFactTerm(String(payload?.subject || ''));
          const predicate = normalizeFactTerm(String(payload?.predicate || ''));
          const object = normalizeFactTerm(String(payload?.object || ''));
          if (subject.length === 0 && predicate.length === 0 && object.length === 0) {
            // Hecho sin firma utilizable: no se puede deduplicar.
            parseErrors++;
            continue;
          }
          const sig = `${subject}::${predicate}::${object}`;

          const bucket = bySignature.get(sig);
          const entry = {
            key: fact.key,
            payload,
            metadata: fact.metadata,
            timestamp: factTimestamp(payload, fact.metadata),
          };

          if (bucket) {
            bucket.push(entry);
          } else {
            bySignature.set(sig, [entry]);
          }
        }
      });
      truncated = truncated || result.truncated;
      scannedCount += result.scanned;
    } catch (err: unknown) {
      console.warn(
        `[DreamConsolidator] Consolidación de hechos omitida: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // 3. Aplicar el estado persistido (canónico vs superseded)
    for (const [, entries] of bySignature) {
      if (entries.length < 2) {
        // Firma única: si venía marcada como superseded (de un ciclo previo),
        // se restaura como vigente.
        const only = entries[0];
        if (only && only.metadata?.['state'] === 'superseded') {
          await this.writeFact(only.key, only.payload, only.metadata, {
            isLatest: true,
            state: 'active',
          });
        }
        continue;
      }

      // La versión vigente es la de mayor timestamp (desempate: orden de clave).
      const sorted = [...entries].sort((a, b) => {
        if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
        return a.key.localeCompare(b.key);
      });
      const canonical = sorted[0]!;

      for (const superseded of sorted.slice(1)) {
        await this.writeFact(superseded.key, superseded.payload, superseded.metadata, {
          isLatest: false,
          state: 'superseded',
          supersededBy: canonical.key,
        });
        deduplicatedCount++;
        supersededCount++;
      }

      // El canónico debe quedar explícitamente vigente en el metadato. Antes
      // (T10) un canónico marcado `is_latest: true` en un ciclo anterior
      // conservaba la marca pero un fact que NUNCA se había marcado quedaba
      // sin `is_latest` en metadata (estado ambiguo para los consumidores).
      if (
        canonical.metadata?.['state'] === 'superseded' ||
        canonical.metadata?.['is_latest'] !== true
      ) {
        await this.writeFact(canonical.key, canonical.payload, canonical.metadata, {
          isLatest: true,
          state: 'active',
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      deduplicatedCount,
      supersededCount,
      quarantinePurgedCount,
      durationMs,
      timestamp: now,
      parseErrors,
      truncated,
      scannedCount,
    };
  }

  /**
   * Escribe un hecho con su estado de vigencia.
   *
   * El contrato de persistencia EXISTENTE se conserva: `is_latest` y
   * `superseded_by` viajan en el **payload** (así los leen los consumidores
   * de `kb/facts`). Además se refleja el estado en el **metadato**
   * (`state`, `is_latest`), que es lo que permite que el dedup sea
   * PERSISTENTE entre ciclos (T10).
   *
   * Tolerante a fallos: un registro que no se puede escribir no aborta el
   * ciclo.
   */
  private async writeFact(
    key: string,
    payload: Record<string, unknown>,
    metadata: Record<string, unknown> | undefined,
    flags: { isLatest: boolean; state: string; supersededBy?: string }
  ): Promise<void> {
    const nextPayload: Record<string, unknown> = {
      ...payload,
      is_latest: flags.isLatest,
    };
    if (flags.supersededBy !== undefined) {
      nextPayload['superseded_by'] = flags.supersededBy;
    }

    const nextMetadata: Record<string, unknown> = {
      ...(metadata ?? {}),
      state: flags.state,
      is_latest: flags.isLatest,
    };

    try {
      await this.memoryAdapter.put({
        namespace: 'kb/facts',
        key,
        payload: nextPayload,
        metadata: nextMetadata,
      });
    } catch (err: unknown) {
      console.warn(
        `[DreamConsolidator] No se pudo actualizar el hecho '${key}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
