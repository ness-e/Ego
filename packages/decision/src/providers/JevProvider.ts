import {
  type DecisionScorerProvider,
  type ScorerEvaluationRequest,
  type ScorerEvaluationResponse
} from './DecisionScorerProvider.js';

export interface JevProviderOptions {
  apiKey?: string;
  endpoint?: string;
  timeoutMs?: number;
  customFetch?: typeof fetch;
}

/**
 * Adaptador externo opcional para Jev (TypeSafe AI System One - DEC-04).
 * Conector HTTPS a endpoint /v1/systemone para evaluación tipada ultrarrápida (70-500ms).
 * Ego degrada limpiamente a reglas deterministas o LLM si Jev no está configurado o falla.
 */
export class JevProvider implements DecisionScorerProvider {
  public readonly name = 'jev-system-one';
  private apiKey?: string;
  private endpoint: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options: JevProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.JEV_API_KEY;
    this.endpoint = options.endpoint ?? process.env.JEV_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone';
    this.timeoutMs = options.timeoutMs ?? 500;
    this.fetchFn = options.customFetch ?? globalThis.fetch;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async evaluate(request: ScorerEvaluationRequest): Promise<ScorerEvaluationResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const startTime = performance.now();

    try {
      const response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          prompt: request.prompt,
          options: request.options,
          context: request.context
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        chosen?: string;
        confidence?: number;
        scores?: Record<string, number>;
      };

      const latencyMs = Math.round(performance.now() - startTime);

      return {
        chosenOption: data.chosen ?? request.options[0],
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.8,
        scores: data.scores ?? {},
        latencyMs
      };
    } catch {
      // Degrada limpiamente ante caídas de red, timeouts o errores HTTP sin colgar el runtime
      return null;
    }
  }
}
