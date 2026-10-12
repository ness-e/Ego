import { randomUUID } from 'node:crypto';
import {
  type DecisionVerdict,
  type DecisionRunContext,
  DecisionVerdictSchema
} from './schemas/verdict.js';
import {
  type IntentRequest,
  type IntentRequestInput,
  type ClassifiedIntent,
  IntentRequestSchema
} from './schemas/intent.js';
import { IntentClassifier } from './IntentClassifier.js';
import { DOMAIN_SUB_EGO_MAP, DEFAULT_SUB_EGO_ID } from './routing/domainSubEgoMap.js';

export interface DecisionRouterOptions {
  classifier?: IntentClassifier;
  defaultSubEgoMapping?: Record<string, string>;
}

export class DecisionRouter {
  private classifier: IntentClassifier;
  private subEgoMapping: Record<string, string>;

  constructor(options: DecisionRouterOptions = {}) {
    this.classifier = options.classifier ?? new IntentClassifier();
    this.subEgoMapping = options.defaultSubEgoMapping ?? {
      ...DOMAIN_SUB_EGO_MAP
    };
  }

  /**
   * Evalúa y decide deterministamente el enrutamiento de una solicitud de usuario o tarea (DEC-01).
   */
  public async decide(rawRequest: IntentRequestInput): Promise<DecisionVerdict> {
    const request: IntentRequest = IntentRequestSchema.parse(rawRequest);

    // 1. Clasificación causal e identificación (COUC-03)
    const classified: ClassifiedIntent = this.classifier.classify(request);

    // 2. Contexto de admisión inmutable (OCLW-01)
    const admittedRunContext: DecisionRunContext = request.runContext ?? {
      runId: randomUUID(),
      timestamp: Date.now(),
      depth: 0,
      origin: 'user_prompt'
    };

    // 3. Resolución de Sub-Ego sugerido por dominio (tabla única F3T6/M03)
    const subEgoId = this.subEgoMapping[classified.primaryDomain] ?? DEFAULT_SUB_EGO_ID;

    // 4. Configuración de namespaces de memoria
    const namespaceTargets = [
      `proj/${request.projectId}`,
      `agent/${subEgoId}`
    ];

    // 5. Tier de modelo sugerido
    const llmTier: 'local' | 'fast' | 'advanced' =
      classified.urgency === 'critical' || classified.primaryDomain === 'engineering'
        ? 'advanced'
        : classified.confidence >= 0.9
          ? 'fast'
          : 'advanced';

    // 6. Si alguna precondición falló, requiere atención/aprobación
    const failedPreconditions = classified.preconditions.some(p => !p.satisfied);
    const requiresApproval = classified.requiresApproval || failedPreconditions;

    const verdict: DecisionVerdict = {
      intentId: classified.intentId,
      intentDigest: classified.intentDigest,
      domain: classified.primaryDomain,
      subEgoId,
      namespaceTargets,
      requiresApproval,
      llmTier,
      toolsEnabled: classified.suggestedTools,
      confidence: classified.confidence,
      decidedBy: 'deterministic_rule',
      preconditions: classified.preconditions,
      admittedRunContext,
      metadata: {
        secondaryDomains: classified.secondaryDomains,
        urgency: classified.urgency,
        entitiesCount: classified.entities.length
      }
    };

    return DecisionVerdictSchema.parse(verdict);
  }
}
