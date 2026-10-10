import { createHash, randomUUID } from 'node:crypto';
import {
  type IntentRequest,
  type ClassifiedIntent,
  type IntentEntity,
  ClassifiedIntentSchema
} from './schemas/intent.js';
import { type Precondition, type EgoDomain } from './schemas/verdict.js';

export interface IntentClassifierOptions {
  strictPreconditions?: boolean;
}

export class IntentClassifier {
  public readonly options: IntentClassifierOptions;

  constructor(options: IntentClassifierOptions = {}) {
    this.options = {
      strictPreconditions: true,
      ...options
    };
  }

  /**
   * Clasifica una intención de usuario analizando entidades, dominios y precondiciones causales (COUC-03).
   */
  public classify(request: IntentRequest): ClassifiedIntent {
    const prompt = request.prompt.trim();
    const normalizedPrompt = prompt.toLowerCase();

    // 1. Cálculo criptográfico del IntentDigest (COUC-03)
    const digestPayload = `${request.projectId}:${request.activeSubEgoId}:${normalizedPrompt}`;
    const intentDigest = createHash('sha256').update(digestPayload).digest('hex');
    const intentId = randomUUID();

    // 2. Extracción de entidades
    const entities = this.extractEntities(prompt);

    // 3. Detección de dominio y herramientas
    const { primaryDomain, secondaryDomains, suggestedTools, confidence } =
      this.detectDomainsAndTools(normalizedPrompt, entities);

    // 4. Detección de urgencia y requerimiento de aprobación
    const urgency = this.detectUrgency(normalizedPrompt);
    const requiresApproval = this.detectRequiresApproval(normalizedPrompt, suggestedTools);

    // 5. Evaluación causal de precondiciones (COUC-03)
    const preconditions = this.evaluatePreconditions(request, suggestedTools);

    const classified: ClassifiedIntent = {
      intentId,
      intentDigest,
      primaryDomain,
      secondaryDomains,
      urgency,
      confidence,
      entities,
      suggestedTools,
      preconditions,
      requiresApproval
    };

    return ClassifiedIntentSchema.parse(classified);
  }

  private extractEntities(prompt: string): IntentEntity[] {
    const entities: IntentEntity[] = [];

    // Archivos y rutas
    const fileMatches = prompt.match(/\b[\w-./\\]+\.(?:ts|tsx|js|jsx|json|md|html|css|py|rs|yml|yaml|toml|sql)\b/gi);
    if (fileMatches) {
      for (const file of fileMatches) {
        entities.push({ type: 'file', value: file });
      }
    }

    // Comandos git
    const gitMatches = prompt.match(/\bgit\s+(status|commit|push|pull|checkout|diff|log|branch|merge|rebase)\b/gi);
    if (gitMatches) {
      for (const cmd of gitMatches) {
        entities.push({ type: 'git_command', value: cmd });
      }
    }

    // URLs
    const urlMatches = prompt.match(/https?:\/\/[^\s)]+/gi);
    if (urlMatches) {
      for (const url of urlMatches) {
        entities.push({ type: 'url', value: url });
      }
    }

    return entities;
  }

  private detectDomainsAndTools(
    normalizedPrompt: string,
    entities: IntentEntity[]
  ): {
    primaryDomain: EgoDomain;
    secondaryDomains: EgoDomain[];
    suggestedTools: string[];
    confidence: number;
  } {
    const hasGit = entities.some(e => e.type === 'git_command') || /\b(git|commit|push|pull|branch|repo)\b/.test(normalizedPrompt);
    const hasFiles = entities.some(e => e.type === 'file') || /\b(archivo|file|código|code|refactor|test|terminal|npm|pnpm|cargo|tsc)\b/.test(normalizedPrompt);
    const hasKnowledge = /\b(buscar|recuperar|memoria|knowledge|documento|docs|wiki|concept|explicar|qué es|definición)\b/.test(normalizedPrompt);
    const hasProduct = /\b(producto|roadmap|feature|requisito|spec|backlog|epic|story|user)\b/.test(normalizedPrompt);
    const hasAnalytics = /\b(métrica|analytics|telemetría|latencia|gráfico|chart|kpi|rendimiento)\b/.test(normalizedPrompt);
    const hasCrm = /\b(contacto|cliente|crm|conversación|lead|reunión|feedback)\b/.test(normalizedPrompt);

    const tools: string[] = [];
    if (hasFiles || hasGit) {
      tools.push('fs');
      if (hasGit) tools.push('git');
      if (/\b(terminal|npm|pnpm|cargo|test|build|ejecutar|run)\b/.test(normalizedPrompt)) {
        tools.push('terminal');
      }
    }

    if (hasGit || (hasFiles && !hasProduct)) {
      return {
        primaryDomain: 'engineering',
        secondaryDomains: hasKnowledge ? ['knowledge'] : [],
        suggestedTools: tools,
        confidence: 0.95
      };
    }

    if (hasKnowledge) {
      return {
        primaryDomain: 'knowledge',
        secondaryDomains: hasFiles ? ['engineering'] : [],
        suggestedTools: tools,
        confidence: 0.90
      };
    }

    if (hasProduct) {
      return {
        primaryDomain: 'product',
        secondaryDomains: hasFiles ? ['engineering'] : [],
        suggestedTools: tools,
        confidence: 0.88
      };
    }

    if (hasAnalytics) {
      return {
        primaryDomain: 'analytics',
        secondaryDomains: [],
        suggestedTools: tools,
        confidence: 0.85
      };
    }

    if (hasCrm) {
      return {
        primaryDomain: 'crm',
        secondaryDomains: [],
        suggestedTools: tools,
        confidence: 0.85
      };
    }

    return {
      primaryDomain: 'general',
      secondaryDomains: [],
      suggestedTools: tools,
      confidence: 0.70
    };
  }

  private detectUrgency(normalizedPrompt: string): 'low' | 'normal' | 'high' | 'critical' {
    if (/\b(urgente|inmediato|crítico|critical|emergencia|bloqueante|asap)\b/.test(normalizedPrompt)) {
      return 'critical';
    }
    if (/\b(rápido|prioritario|importante|pronto)\b/.test(normalizedPrompt)) {
      return 'high';
    }
    if (/\b(cuando puedas|sin apuro|baja prioridad|eventual)\b/.test(normalizedPrompt)) {
      return 'low';
    }
    return 'normal';
  }

  private detectRequiresApproval(normalizedPrompt: string, suggestedTools: string[]): boolean {
    // Acciones de escritura destructivas o de red
    if (
      /\b(borrar|eliminar|destruir|rm\s|drop|delete|force|push\s+--force|reset\s+--hard)\b/.test(normalizedPrompt)
    ) {
      return true;
    }
    // Modificación de archivos o ejecución de comandos en terminal
    if (suggestedTools.includes('terminal') || /\b(escribir|modificar|actualizar|sobrescribir|write)\b/.test(normalizedPrompt)) {
      return true;
    }
    return false;
  }

  private evaluatePreconditions(request: IntentRequest, suggestedTools: string[]): Precondition[] {
    const preconditions: Precondition[] = [];

    // Precondición 1: Proyecto activo
    const hasProject = Boolean(request.projectId && request.projectId.trim().length > 0);
    preconditions.push({
      name: 'project_active',
      satisfied: hasProject,
      reason: hasProject ? undefined : 'No hay un proyecto activo seleccionado en la sesión.'
    });

    // Precondición 2: Workspace disponible para herramientas de disco
    if (suggestedTools.includes('fs') || suggestedTools.includes('git') || suggestedTools.includes('terminal')) {
      const hasWorkspace = Boolean(request.workspacePath && request.workspacePath.trim().length > 0);
      preconditions.push({
        name: 'workspace_available',
        satisfied: hasWorkspace,
        reason: hasWorkspace ? undefined : 'Se requieren herramientas de sistema pero no se ha configurado la ruta de workspace.'
      });
    }

    return preconditions;
  }
}
