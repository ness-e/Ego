import { type SubEgoManifest } from '@ego/subegos';
import { type ClassifiedIntent } from './schemas/intent.js';

export interface SubEgoSelectionResult {
  selectedSubEgoId: string;
  affinityScore: number;
  allowedTools: string[];
  reason: string;
}

export class SubEgoSelector {
  /**
   * Selecciona el Sub-Ego óptimo evaluando afinidad de capacidades y dominios (DEC-05).
   */
  public select(
    intent: ClassifiedIntent,
    availableSubEgos: SubEgoManifest[] = []
  ): SubEgoSelectionResult {
    // 1. Filtrar solo Sub-Egos activos
    const activeCandidates = availableSubEgos.filter(s => s.state === 'active');

    let bestCandidate: SubEgoManifest | null = null;
    let highestScore = -1;

    for (const candidate of activeCandidates) {
      const score = this.calculateAffinity(intent, candidate);
      if (score > highestScore) {
        highestScore = score;
        bestCandidate = candidate;
      }
    }

    // 2. Si hay un candidato con afinidad suficiente (>= 0.60)
    if (bestCandidate && highestScore >= 0.60) {
      // Intersección estricta de herramientas requeridas vs permitidas por el manifiesto
      const allowedTools = intent.suggestedTools.filter(tool =>
        bestCandidate?.tools.includes(tool) || bestCandidate?.capabilities.includes(tool)
      );

      return {
        selectedSubEgoId: bestCandidate.id,
        affinityScore: Math.round(highestScore * 100) / 100,
        allowedTools,
        reason: `Sub-Ego especializado '${bestCandidate.id}' seleccionado con afinidad ${(highestScore * 100).toFixed(0)}% para el dominio '${intent.primaryDomain}'.`
      };
    }

    // 3. Fallback seguro e inmutable a ego.nucleus (Decisión P08)
    return {
      selectedSubEgoId: 'ego.nucleus',
      affinityScore: 0.50,
      allowedTools: intent.suggestedTools,
      reason: `Ningún Sub-Ego especializado superó el umbral de afinidad; asignado a 'ego.nucleus' como orquestador general.`
    };
  }

  private calculateAffinity(intent: ClassifiedIntent, candidate: SubEgoManifest): number {
    let score = 0;
    const domain = intent.primaryDomain;

    const searchableText = `${candidate.id} ${candidate.name} ${candidate.role} ${candidate.description} ${candidate.capabilities.join(' ')}`.toLowerCase();

    // Afinidad de dominio primario (peso 0.5)
    if (domain === 'engineering' && (searchableText.includes('dev') || searchableText.includes('software') || searchableText.includes('código') || searchableText.includes('engineering'))) {
      score += 0.5;
    } else if (domain === 'knowledge' && (searchableText.includes('research') || searchableText.includes('investig') || searchableText.includes('knowledge') || searchableText.includes('memoria'))) {
      score += 0.5;
    } else if (domain === 'product' && (searchableText.includes('product') || searchableText.includes('pm') || searchableText.includes('gestor') || searchableText.includes('backlog'))) {
      score += 0.5;
    } else if (domain === 'analytics' && (searchableText.includes('analyst') || searchableText.includes('analytics') || searchableText.includes('datos') || searchableText.includes('métrica'))) {
      score += 0.5;
    } else if (domain === 'crm' && (searchableText.includes('crm') || searchableText.includes('cliente') || searchableText.includes('ventas'))) {
      score += 0.5;
    } else if (domain === 'general' && candidate.id === 'ego.nucleus') {
      score += 0.5;
    }

    // Afinidad de herramientas requeridas (peso 0.4)
    if (intent.suggestedTools.length > 0) {
      let matchedCount = 0;
      for (const reqTool of intent.suggestedTools) {
        if (candidate.tools.includes(reqTool) || candidate.capabilities.includes(reqTool)) {
          matchedCount++;
        }
      }
      const toolRatio = matchedCount / intent.suggestedTools.length;
      score += toolRatio * 0.4;
    } else {
      score += 0.3; // Si no requiere tools pesadas
    }

    // Bonus por coincidencia directa de ID canónico (peso 0.1)
    if (domain === 'engineering' && candidate.id === 'ego.dev') score += 0.1;
    if (domain === 'knowledge' && candidate.id === 'ego.research') score += 0.1;

    return Math.min(1.0, score);
  }
}
