import { createHash, randomUUID } from 'node:crypto';
import {
  type IntentRequest,
  type ClassifiedIntent,
  type IntentEntity,
  ClassifiedIntentSchema
} from './schemas/intent.js';
import { type Precondition, type EgoDomain } from './schemas/verdict.js';
import { FS_TOOLS, GIT_TOOLS, TERMINAL_EXEC_TOOL, FS_READ_FILE_TOOL, FS_WRITE_FILE_TOOL, isMutatingToolName } from './canonicalTools.js';

export interface IntentClassifierOptions {
  strictPreconditions?: boolean;
}

/** Vocabularios por dominio funcional (A2-20). */
const ENGINEERING_WORDS = [
  "git", "commit", "push", "pull", "branch", "repo",
  "archivo", "file", "código", "code", "refactor", "test",
  "terminal", "npm", "pnpm", "cargo", "tsc",
] as const;
const KNOWLEDGE_WORDS = [
  "buscar", "busca", "recuperar", "memoria", "knowledge",
  "documento", "documentos", "docs", "wiki", "concept", "explicar",
  "qué es", "definición",
] as const;
const PRODUCT_WORDS = [
  "producto", "roadmap", "feature", "requisito", "spec", "backlog", "epic", "story", "user",
] as const;
const ANALYTICS_WORDS = [
  "métrica", "analytics", "telemetría", "latencia", "gráfico", "chart", "kpi", "rendimiento",
] as const;
const CRM_WORDS = [
  "contacto", "cliente", "crm", "conversación", "lead", "reunión", "feedback",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Formas plurales válidas de una palabra (ES/EN) para que un vocabulario en
 * singular matchee también su plural.
 *
 * Regresión A7 §2.2: `countWordHits('ejecutar tests', ['test']) === 0`
 * deprimía la confianza calibrada (0.76 vs 0.94 para el mismo prompt en
 * singular) y rompía el contrato DEC-09 (`confidence >= 0.9`).
 *
 * Se generan **variantes explícitas** por regla de pluralización, no un
 * sufijo ciego: así no se arrastran falsos positivos (`testing`/`latest` no
 * son `test`, `reforma` no es `forma`, `documentación` no es `documento`).
 */
function pluralForms(word: string): string[] {
  const lower = word.toLowerCase();
  const forms = [lower];
  if (/[aeiouáéíóú]$/.test(lower)) {
    // código → códigos, métrica → métricas, producto → productos
    forms.push(`${lower}s`);
  } else if (/(ción|sión)$/.test(lower)) {
    // definición → definiciones, confusión → confusiones
    // (el plural reemplaza "ción"/"sión" por "ciones"/"siones"; NO es un
    // sufijo: añadir "es" daría "definiciónes").
    forms.push(lower.replace(/ción$/, "ciones").replace(/sión$/, "siones"));
  } else if (/(s|x|z|ch|sh|h)$/.test(lower)) {
    // branch → branches, push → pushes, class → classes
    forms.push(`${lower}es`);
  } else if (/[^aeiouáéíóú]y$/.test(lower)) {
    // story → stories
    forms.push(`${lower.slice(0, -1)}ies`);
  } else {
    // test → tests, commit → commits, file → files
    forms.push(`${lower}s`);
    // Plural español tras consonante: test → testes, código → códigos.
    forms.push(`${lower}es`);
  }
  return forms;
}

/**
 * Cuenta cuántas palabras del vocabulario aparecen como palabras completas
 * (no como subcadena), aceptando la forma singular y su plural.
 * Es la base de la calibración de confianza (A2-20, A2-20b).
 *
 * Cuenta **claves distintas** (no ocurrencias): "test test" vale 1.
 */
export function countWordHits(normalizedText: string, words: readonly string[]): number {
  let hits = 0;
  for (const word of words) {
    for (const form of pluralForms(word)) {
      const re = new RegExp(
        `(^|[^\\p{L}\\p{N}_])${escapeRegExp(form)}([^\\p{L}\\p{N}_]|$)`,
        "u"
      );
      if (re.test(normalizedText)) {
        hits++;
        break;
      }
    }
  }
  return hits;
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
    // Vocabularios por dominio (se cuentan las coincidencias: la cantidad de
    // señales es lo que calibra la confianza, A2-20).
    const engineeringHits = countWordHits(normalizedPrompt, ENGINEERING_WORDS);
    const knowledgeHits = countWordHits(normalizedPrompt, KNOWLEDGE_WORDS);
    const productHits = countWordHits(normalizedPrompt, PRODUCT_WORDS);
    const analyticsHits = countWordHits(normalizedPrompt, ANALYTICS_WORDS);
    const crmHits = countWordHits(normalizedPrompt, CRM_WORDS);

    const hasGit = entities.some(e => e.type === 'git_command') || engineeringHits > 0;
    const hasFiles = entities.some(e => e.type === 'file') || engineeringHits > 0;
    const hasKnowledge = knowledgeHits > 0;
    const hasProduct = productHits > 0;
    const hasAnalytics = analyticsHits > 0;
    const hasCrm = crmHits > 0;

    // Intención de escritura (A2-20): una herramienta de escritura sólo se
    // sugiere si el prompt la pide; no se sugieren todas las de FS siempre.
    const hasWriteIntent = /\b(escribe|escribir|escritura|crea|crear|modifica|modificar|actualiza|actualizar|sobrescribe|sobrescribir|guarda|guardar|borra|borrar|elimina|eliminar|write|create|update|save|delete|remove|refactor|commit|commitea|commitear|cambios)\b/.test(normalizedPrompt);
    const hasTerminalIntent = /\b(terminal|npm|pnpm|cargo|test|tests|build|compila|ejecuta|ejecutar|run|install)\b/.test(normalizedPrompt);

    const tools: string[] = [];
    if (hasFiles || hasGit) {
      tools.push(FS_READ_FILE_TOOL);
      if (hasWriteIntent) tools.push(FS_WRITE_FILE_TOOL);
      if (hasGit) tools.push(...GIT_TOOLS);
      if (hasTerminalIntent) tools.push(TERMINAL_EXEC_TOOL);
    }

    // Confianza CALIBRADA (A2-20): base por dominio + bonus por señales
    // corroborantes independientes. Antes era una constante por rama.
    const matchedDomains = [hasGit, hasFiles, hasKnowledge, hasProduct, hasAnalytics, hasCrm].filter(Boolean).length;
    const explicitConcept = /\b(qué es|definición|definicion|how does|what is)\b/.test(normalizedPrompt);
    let signals = 0;
    if (entities.some(e => e.type === 'file')) signals++;
    if (entities.some(e => e.type === 'git_command')) signals++;
    if (entities.some(e => e.type === 'url')) signals++;
    if (tools.length > 0) signals++;
    if (matchedDomains > 1) signals++;
    if (explicitConcept) signals++;

    const calibrate = (base: number, domainHits: number): number =>
      Math.min(0.98, Math.round((base + 0.08 * signals + 0.1 * domainHits) * 100) / 100);

    if (hasGit || (hasFiles && !hasProduct)) {
      return {
        primaryDomain: 'engineering',
        secondaryDomains: hasKnowledge ? ['knowledge'] : [],
        suggestedTools: tools,
        confidence: calibrate(0.6, engineeringHits)
      };
    }

    if (hasKnowledge) {
      return {
        primaryDomain: 'knowledge',
        secondaryDomains: hasFiles ? ['engineering'] : [],
        suggestedTools: tools,
        confidence: calibrate(0.6, knowledgeHits)
      };
    }

    if (hasProduct) {
      return {
        primaryDomain: 'product',
        secondaryDomains: hasFiles ? ['engineering'] : [],
        suggestedTools: tools,
        confidence: calibrate(0.55, productHits)
      };
    }

    if (hasAnalytics) {
      return {
        primaryDomain: 'analytics',
        secondaryDomains: [],
        suggestedTools: tools,
        confidence: calibrate(0.5, analyticsHits)
      };
    }

    if (hasCrm) {
      return {
        primaryDomain: 'crm',
        secondaryDomains: [],
        suggestedTools: tools,
        confidence: calibrate(0.5, crmHits)
      };
    }

    return {
      primaryDomain: 'general',
      secondaryDomains: [],
      suggestedTools: tools,
      confidence: calibrate(0.3, 0)
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
    // A2-20: la aprobación se deriva del RIESGO de la herramienta sugerida
    // (cualquier herramienta mutante la exige), no de regex sueltas.
    if (suggestedTools.some(isMutatingToolName)) {
      return true;
    }
    // Acciones de escritura destructivas o de red explícitas en el prompt.
    if (
      /\b(borrar|eliminar|destruir|rm\s|drop|delete|force|push\s+--force|reset\s+--hard)\b/.test(normalizedPrompt)
    ) {
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
    const needsWorkspace = suggestedTools.some(
      (tool) => FS_TOOLS.includes(tool) || GIT_TOOLS.includes(tool) || tool === TERMINAL_EXEC_TOOL
    );
    if (needsWorkspace) {
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
