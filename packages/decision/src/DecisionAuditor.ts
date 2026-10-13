import { createHash } from 'node:crypto';
import { type EgoMemoryAdapter } from '@ego/memory';
import { type DecisionVerdict, DecisionVerdictSchema } from './schemas/verdict.js';

export interface DecisionAuditorOptions {
  namespace?: string;
}

/**
 * Serialización canónica determinista del veredicto para digest (SEC-06).
 * Claves ordenadas; espeja `canonicalAuditJson` de `@ego/memory` sin
 * acoplar el build de decision al dist de memory en tests.
 */
function canonicalVerdictJson(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val) ?? 'null';
  if (Array.isArray(val)) return `[${val.map(canonicalVerdictJson).join(',')}]`;
  const obj = val as Record<string, unknown>;
  const pairs: string[] = [];
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
    pairs.push(`${JSON.stringify(k)}:${canonicalVerdictJson(v)}`);
  }
  return `{${pairs.join(',')}}`;
}

/**
 * Digest SHA-256 recomputable de un veredicto (SEC-06). Cualquier alteración
 * posterior del veredicto asentado produce otro digest (ver test H4).
 */
export function computeVerdictDigest(verdict: DecisionVerdict): string {
  return createHash('sha256').update(canonicalVerdictJson(verdict), 'utf8').digest('hex');
}

/**
 * Auditor inmutable de veredictos de decisión en VantaDB (DEC-07).
 * Registra cada decisión cognitiva bajo el namespace canónico 'gov/audit'.
 */
export class DecisionAuditor {
  private adapter: EgoMemoryAdapter;
  private namespace: string;

  constructor(adapter: EgoMemoryAdapter, options: DecisionAuditorOptions = {}) {
    this.adapter = adapter;
    this.namespace = options.namespace ?? 'gov/audit';
  }

  /**
   * Asienta de manera inmutable un veredicto de decisión en VantaDB.
   */
  public async recordVerdict(verdict: DecisionVerdict): Promise<string> {
    const key = `verdict:${verdict.admittedRunContext.runId}:${verdict.admittedRunContext.timestamp}`;
    // SEC-06: digest SHA-256 del veredicto para verificar integridad posterior.
    const verdictDigest = computeVerdictDigest(verdict);

    const recordPayload = {
      type: 'decision_verdict',
      verdict,
      verdictDigest,
      recordedAt: Date.now()
    };

    try {
      await this.adapter.put({
        namespace: this.namespace,
        key,
        payload: recordPayload,
        metadata: {
          run_id: verdict.admittedRunContext.runId,
          domain: verdict.domain,
          sub_ego: verdict.subEgoId,
          decided_by: verdict.decidedBy,
          confidence: verdict.confidence,
          verdict_digest: verdictDigest,
          ts: verdict.admittedRunContext.timestamp
        }
      });
    } catch (error) {
      // Registrar defensivamente sin colgar el ciclo de turno
      console.warn(`[DecisionAuditor] Fallo al asentar veredicto en ${this.namespace}:`, error);
    }

    return key;
  }

  /**
   * Recupera un veredicto registrado por su clave canónica.
   */
  public async getVerdict(key: string): Promise<DecisionVerdict | null> {
    try {
      const stored = ((await this.adapter.get(this.namespace, key))?.payload as {
        type?: string;
        verdict?: unknown;
      } | null);

      if (!stored?.verdict) {
        return null;
      }

      return DecisionVerdictSchema.parse(stored.verdict);
    } catch {
      return null;
    }
  }

  /**
   * Lista los veredictos recientes guardados en gov/audit.
   */
  public async listRecentVerdicts(limit = 50): Promise<DecisionVerdict[]> {
    try {
      const items = await this.adapter.list(this.namespace, limit);
      const verdicts: DecisionVerdict[] = [];

      for (const item of items) {
        const payload = item.payload as { verdict?: unknown } | null;
        if (payload?.verdict) {
          const parsed = DecisionVerdictSchema.safeParse(payload.verdict);
          if (parsed.success) {
            verdicts.push(parsed.data);
          }
        }
      }

      return verdicts;
    } catch {
      return [];
    }
  }
}
