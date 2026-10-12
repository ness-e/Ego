import { type DecisionRunContext } from './schemas/verdict.js';

export interface DelegationTraceEntry {
  runId: string;
  subEgoId: string;
  intentDigest: string;
  depth: number;
  confidence: number;
  timestamp: number;
}

export interface ClarificationDirective {
  question: string;
  options: string[];
  suggestedAction: 'halt' | 'fallback_nucleus' | 'ask_user';
}

export interface LoopBreakCheckResult {
  shouldBreak: boolean;
  reason?: 'max_depth_exceeded' | 'circular_delegation' | 'stagnation_low_confidence';
  clarification?: ClarificationDirective;
}

export interface LoopBreakerOptions {
  maxDepth?: number;
  maxConsecutiveLowConfidence?: number;
}

/**
 * Rompedor de bucles infinitos y ciclos de delegación circular (DEC-06).
 * Asimila OCLW-02 (límite de profundidad y ciclos) y HERM-03 (clarificación interactiva).
 */
export class LoopBreaker {
  private maxDepth: number;
  private maxConsecutiveLowConfidence: number;
  private history: DelegationTraceEntry[] = [];

  constructor(options: LoopBreakerOptions = {}) {
    this.maxDepth = options.maxDepth ?? 4;
    this.maxConsecutiveLowConfidence = options.maxConsecutiveLowConfidence ?? 2;
  }

  /**
   * Registra una delegación en la traza y evalúa si se debe romper el bucle.
   */
  public evaluate(
    subEgoId: string,
    intentDigest: string,
    runContext: DecisionRunContext,
    confidence: number
  ): LoopBreakCheckResult {
    const entry: DelegationTraceEntry = {
      runId: runContext.runId,
      subEgoId,
      intentDigest,
      depth: runContext.depth,
      confidence,
      timestamp: runContext.timestamp
    };

    // 1. Verificación de profundidad máxima (OCLW-02)
    if (runContext.depth > this.maxDepth) {
      return {
        shouldBreak: true,
        reason: 'max_depth_exceeded',
        clarification: {
          question: `Se ha alcanzado la profundidad máxima de delegación recursiva (${runContext.depth} > ${this.maxDepth}). ¿Deseas detener la tarea o simplificar el objetivo?`,
          options: [
            'Detener la tarea actual',
            'Delegar inmediatamente a ego.nucleus sin más sub-agentes',
            'Modificar el objetivo de la solicitud'
          ],
          suggestedAction: 'ask_user'
        }
      };
    }

    // 2. Verificación de ciclos circulares (A -> B -> A con misma huella)
    const cycleDetected = this.history.some(
      h => h.subEgoId === subEgoId && h.intentDigest === intentDigest && h.runId === runContext.runId
    );

    if (cycleDetected) {
      return {
        shouldBreak: true,
        reason: 'circular_delegation',
        clarification: {
          question: `Se ha detectado un ciclo de delegación circular repetido en el Sub-Ego '${subEgoId}' con la misma intención. Se requiere intervención humana para desambiguar.`,
          options: [
            'Pausar ejecución y revisar contexto',
            'Continuar forzando ego.nucleus',
            'Cancelar tarea'
          ],
          suggestedAction: 'ask_user'
        }
      };
    }

    // 3. Verificación de estancamiento por baja confianza consecutiva (HERM-03)
    if (confidence < 0.60) {
      const recentLowConfidenceCount = this.history
        .slice(-this.maxConsecutiveLowConfidence)
        .filter(h => h.confidence < 0.60).length;

      if (recentLowConfidenceCount >= this.maxConsecutiveLowConfidence) {
        return {
          shouldBreak: true,
          reason: 'stagnation_low_confidence',
          clarification: {
            question: `La confianza en la interpretación de la tarea se mantiene por debajo del 60% (${(confidence * 100).toFixed(0)}%). Por favor clarifica tu intención:`,
            options: [
              'Reescribir la consulta con más detalles',
              'Continuar como tarea de ingeniería de software',
              'Continuar como consulta de conocimiento'
            ],
            suggestedAction: 'ask_user'
          }
        };
      }
    }

    // Registrar en historial si es válido
    this.history.push(entry);

    return {
      shouldBreak: false
    };
  }

  public reset(): void {
    this.history = [];
  }
}
