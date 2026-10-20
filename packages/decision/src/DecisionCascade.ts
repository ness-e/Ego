import { randomUUID } from 'node:crypto';
import {
  type DecisionVerdict,
  type DecisionRunContext,
  type EgoDomain,
  DecisionVerdictSchema
} from './schemas/verdict.js';
import {
  type IntentRequest,
  type IntentRequestInput,
  type ClassifiedIntent,
  IntentRequestSchema
} from './schemas/intent.js';
import { IntentClassifier } from './IntentClassifier.js';
import { DeterministicRules } from './rules/DeterministicRules.js';
import { resolveSubEgoId } from './routing/domainSubEgoMap.js';
import { type DecisionScorerProvider } from './providers/DecisionScorerProvider.js';

export interface DecisionCascadeOptions {
  classifier?: IntentClassifier;
  deterministicRules?: DeterministicRules;
  scorerProvider?: DecisionScorerProvider;
  llmFallbackFn?: (prompt: string, domain: EgoDomain) => Promise<{
    domain: EgoDomain;
    subEgoId: string;
    tools: string[];
    confidence: number;
  } | null>;
}

/**
 * Cascada de decisión en 3 niveles gobernada (DEC-03):
 * 1) Reglas regex deterministas ($0, <1ms)
 * 2) Modelo especializado de decisión (Jev hosted / ultrabajo coste / 70-500ms)
 * 3) Fallback a LLM estructurado o núcleo seguro
 */
export class DecisionCascade {
  private classifier: IntentClassifier;
  private deterministicRules: DeterministicRules;
  private scorerProvider?: DecisionScorerProvider;
  private llmFallbackFn?: DecisionCascadeOptions['llmFallbackFn'];

  constructor(options: DecisionCascadeOptions = {}) {
    this.classifier = options.classifier ?? new IntentClassifier();
    this.deterministicRules = options.deterministicRules ?? new DeterministicRules();
    this.scorerProvider = options.scorerProvider;
    this.llmFallbackFn = options.llmFallbackFn;
  }

  public async evaluate(rawRequest: IntentRequestInput): Promise<DecisionVerdict> {
    const request: IntentRequest = IntentRequestSchema.parse(rawRequest);
    const classified: ClassifiedIntent = this.classifier.classify(request);

    const admittedRunContext: DecisionRunContext = request.runContext ?? {
      runId: randomUUID(),
      timestamp: Date.now(),
      depth: 0,
      origin: 'user_prompt'
    };

    // A2-12 / EGO-FIND-34: esquema canónico de namespaces
    // (`projects/<id>` + `egos/<id>/state`).
    const namespaceTargets = [
      `projects/${request.projectId}`,
      `egos/${request.activeSubEgoId}/state`
    ];

    // ==========================================
    // NIVEL 1: Reglas Deterministas ($0, <1ms)
    // ==========================================
    const ruleMatch = this.deterministicRules.match(request.prompt);
    if (ruleMatch && ruleMatch.confidence >= 0.90) {
      return DecisionVerdictSchema.parse({
        intentId: classified.intentId,
        intentDigest: classified.intentDigest,
        domain: ruleMatch.domain,
        subEgoId: ruleMatch.subEgoId,
        namespaceTargets: [`projects/${request.projectId}`, `egos/${ruleMatch.subEgoId}/state`],
        requiresApproval: classified.requiresApproval,
        llmTier: 'fast',
        toolsEnabled: ruleMatch.tools,
        confidence: ruleMatch.confidence,
        decidedBy: 'deterministic_rule',
        preconditions: classified.preconditions,
        admittedRunContext,
        metadata: {
          tier: 'tier-1-rules',
          matchedKeywords: true
        }
      });
    }

    // ==========================================
    // NIVEL 2: Modelo de Scoring Especializado (Jev / 70-500ms)
    // ==========================================
    if (this.scorerProvider && this.scorerProvider.isAvailable()) {
      try {
        const scorerResult = await this.scorerProvider.evaluate({
          prompt: request.prompt,
          options: ['engineering', 'knowledge', 'product', 'analytics', 'crm', 'general'],
          context: { projectId: request.projectId }
        });

        if (scorerResult && scorerResult.confidence >= 0.75) {
          const domain = (scorerResult.chosenOption as EgoDomain) || classified.primaryDomain;
          const subEgoId = resolveSubEgoId(domain);

          return DecisionVerdictSchema.parse({
            intentId: classified.intentId,
            intentDigest: classified.intentDigest,
            domain,
            subEgoId,
            namespaceTargets: [`projects/${request.projectId}`, `egos/${subEgoId}/state`],
            requiresApproval: classified.requiresApproval,
            llmTier: 'fast',
            toolsEnabled: classified.suggestedTools,
            confidence: scorerResult.confidence,
            decidedBy: 'specialized_scorer',
            preconditions: classified.preconditions,
            admittedRunContext,
            metadata: {
              tier: 'tier-2-scorer',
              provider: this.scorerProvider.name,
              latencyMs: scorerResult.latencyMs
            }
          });
        }
      } catch {
        // Fallback al Nivel 3 si el Nivel 2 falla
      }
    }

    // ==========================================
    // NIVEL 3: LLM Estructurado / Fallback Núcleo
    // ==========================================
    if (this.llmFallbackFn) {
      try {
        const llmResult = await this.llmFallbackFn(request.prompt, classified.primaryDomain);
        if (llmResult) {
          return DecisionVerdictSchema.parse({
            intentId: classified.intentId,
            intentDigest: classified.intentDigest,
            domain: llmResult.domain,
            subEgoId: llmResult.subEgoId,
            namespaceTargets: [`projects/${request.projectId}`, `egos/${llmResult.subEgoId}/state`],
            requiresApproval: classified.requiresApproval,
            llmTier: 'advanced',
            toolsEnabled: llmResult.tools,
            confidence: llmResult.confidence,
            decidedBy: 'structured_llm',
            preconditions: classified.preconditions,
            admittedRunContext,
            metadata: {
              tier: 'tier-3-structured-llm'
            }
          });
        }
      } catch {
        // Degrada a fallback de núcleo seguro
      }
    }

    // Fallback Núcleo Seguro por Defecto
    return DecisionVerdictSchema.parse({
      intentId: classified.intentId,
      intentDigest: classified.intentDigest,
      domain: classified.primaryDomain,
      subEgoId: resolveSubEgoId(classified.primaryDomain),
      namespaceTargets,
      requiresApproval: classified.requiresApproval,
      llmTier: 'advanced',
      toolsEnabled: classified.suggestedTools,
      confidence: classified.confidence,
      decidedBy: 'fallback_nucleus',
      preconditions: classified.preconditions,
      admittedRunContext,
      metadata: {
        tier: 'fallback-nucleus'
      }
    });
  }
}
