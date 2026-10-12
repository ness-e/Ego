import { type EgoDomain } from '../schemas/verdict.js';
import { resolveSubEgoId } from '../routing/domainSubEgoMap.js';
import { FS_TOOLS, GIT_TOOLS, TERMINAL_EXEC_TOOL } from '../canonicalTools.js';

export interface DeterministicRuleMatch {
  domain: EgoDomain;
  subEgoId: string;
  tools: string[];
  confidence: number;
}

export class DeterministicRules {
  /**
   * Evalúa patrones deterministas de ultra-baja latencia ($0, <1ms).
   */
  public match(prompt: string): DeterministicRuleMatch | null {
    const text = prompt.trim().toLowerCase();

    // Regla 1: Git y control de versiones
    if (/^(git\s+|hacer\s+commit|crear\s+rama|hacer\s+push|hacer\s+pull|revisar\s+diff)/.test(text)) {
      return {
        domain: 'engineering',
        subEgoId: resolveSubEgoId('engineering'),
        tools: [...FS_TOOLS, ...GIT_TOOLS, TERMINAL_EXEC_TOOL],
        confidence: 1.0
      };
    }

    // Regla 2: Terminal y ejecución de comandos
    if (/^(pnpm|npm|yarn|cargo|node|tsc|pytest|vitest|build|compilar|ejecutar\s+tests?)\b/.test(text)) {
      return {
        domain: 'engineering',
        subEgoId: resolveSubEgoId('engineering'),
        tools: [...FS_TOOLS, TERMINAL_EXEC_TOOL],
        confidence: 1.0
      };
    }

    // Regla 3: Búsqueda explícita en memoria o documentación
    if (/^(buscar|consultar|recuperar|memoria|qué\s+es|definición\s+de|documentación\s+de)\b/.test(text)) {
      return {
        domain: 'knowledge',
        subEgoId: resolveSubEgoId('knowledge'),
        tools: [],
        confidence: 1.0
      };
    }

    // Regla 4: Gestión de producto o backlog
    if (/^(backlog|roadmap|plan\s+de|especificación|user\s+story|crear\s+tarea)\b/.test(text)) {
      return {
        domain: 'product',
        subEgoId: resolveSubEgoId('product'),
        tools: [],
        confidence: 0.95
      };
    }

    // Regla 5: Métricas y telemetría
    if (/^(métrica|analytics|telemetría|latencia|graficar|kpis?)\b/.test(text)) {
      return {
        domain: 'analytics',
        subEgoId: resolveSubEgoId('analytics'),
        tools: [],
        confidence: 0.95
      };
    }

    return null;
  }
}
