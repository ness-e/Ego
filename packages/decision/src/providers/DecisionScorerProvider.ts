export interface ScorerEvaluationRequest {
  prompt: string;
  options: string[];
  context?: Record<string, unknown>;
}

export interface ScorerEvaluationResponse {
  chosenOption: string;
  confidence: number;
  scores: Record<string, number>;
  latencyMs: number;
}

export interface DecisionScorerProvider {
  readonly name: string;
  isAvailable(): boolean;
  evaluate(request: ScorerEvaluationRequest): Promise<ScorerEvaluationResponse | null>;
}
