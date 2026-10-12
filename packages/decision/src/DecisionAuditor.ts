import { type EgoMemoryAdapter } from '@ego/memory';
import { type DecisionVerdict, DecisionVerdictSchema } from './schemas/verdict.js';

export interface DecisionAuditorOptions {
  namespace?: string;
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

    const recordPayload = {
      type: 'decision_verdict',
      verdict,
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
