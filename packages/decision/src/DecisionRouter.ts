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
import { DecisionCascade, type DecisionCascadeOptions } from './DecisionCascade.js';
import { DeterministicRules } from './rules/DeterministicRules.js';
import type { DecisionScorerProvider } from './providers/DecisionScorerProvider.js';

export interface DecisionRouterOptions {
  classifier?: IntentClassifier;
  defaultSubEgoMapping?: Record<string, string>;
  /**
   * Scorer especializado (nivel 2 de la cascada DEC-03). Si se inyecta —junto
   * con `llmFallbackFn` o por sí solo— el router delega en `DecisionCascade`
   * para que los niveles 2 y 3 dejen de ser código muerto (EGO-FIND-36).
   */
  scorerProvider?: DecisionScorerProvider;
  /** Fallback a LLM estructurado (nivel 3 de la cascada DEC-03). */
  llmFallbackFn?: DecisionCascadeOptions["llmFallbackFn"];
  /** Reglas deterministas del nivel 1 (opcional; por defecto las canónicas). */
  deterministicRules?: DeterministicRules;
}

export class DecisionRouter {
  private classifier: IntentClassifier;
  private subEgoMapping: Record<string, string>;
  /**
   * Cascada de 3 niveles. Sólo existe cuando hay un nivel 2 o un nivel 3
   * configurados: sin ellos, el router conserva su camino determinista de
   * un solo nivel (comportamiento histórico).
   */
  private readonly cascade?: DecisionCascade;

  constructor(options: DecisionRouterOptions = {}) {
    this.classifier = options.classifier ?? new IntentClassifier();
    this.subEgoMapping = options.defaultSubEgoMapping ?? {
      ...DOMAIN_SUB_EGO_MAP
    };

    if (options.scorerProvider || options.llmFallbackFn) {
      this.cascade = new DecisionCascade({
        classifier: this.classifier,
        deterministicRules: options.deterministicRules,
        scorerProvider: options.scorerProvider,
        llmFallbackFn: options.llmFallbackFn,
      });
    }
  }

  /**
   * Evalúa y decide deterministamente el enrutamiento de una solicitud de usuario o tarea (DEC-01).
   *
   * Con `scorerProvider`/`llmFallbackFn` configurados se ejecuta la cascada
   * completa de 3 niveles (EGO-FIND-36); sin ellos, se degrada al nivel 1.
   */
  public async decide(rawRequest: IntentRequestInput): Promise<DecisionVerdict> {
    if (this.cascade) {
      return this.cascade.evaluate(rawRequest);
    }

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

    // 4. Configuración de namespaces de memoria.
    // A2-12 / EGO-FIND-34: se emite el esquema canónico
    // (`dominio/subespacio`): `projects/<id>` para el proyecto y
    // `egos/<id>/state` para el estado privado del Sub-Ego. Antes se usaban
    // `proj/<id>` y `agent/<id>`, que no existen en `ego.namespaces.json`.
    const namespaceTargets = [
      `projects/${request.projectId}`,
      `egos/${subEgoId}/state`
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
