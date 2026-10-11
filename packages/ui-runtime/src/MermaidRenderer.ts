export interface MermaidThemeTokens {
  background: string;
  foreground: string;
  primary: string;
  border: string;
  darkMode: boolean;
}

export interface MermaidValidationResult {
  valid: boolean;
  diagramType?: string;
  error?: string;
}

const MAX_SOURCE_LENGTH = 25_000;
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
];

const KNOWN_DIAGRAM_TYPES = [
  "flowchart",
  "graph",
  "sequencediagram",
  "classdiagram",
  "statediagram",
  "statediagram-v2",
  "erdiagram",
  "gantt",
  "pie",
  "gitgraph",
  "mindmap",
  "timeline",
  "xychart-beta",
];

/**
 * Validador y preparador de seguridad de diagramas Mermaid para Canvas (OCLW-11).
 * Extraído y adaptado de OpenClaw packages/mermaid-renderer.
 *
 * Valida la sintaxis, previene inyecciones XSS y normaliza directivas
 * antes de renderizar gráficos SVG dinámicos en el Workspace de Ego.
 */
export class MermaidRenderer {
  /**
   * Valida sintáctica y estructuralmente una definición Mermaid.
   */
  public static validate(source: string): MermaidValidationResult {
    const trimmed = source.trim();

    if (!trimmed) {
      return { valid: false, error: "El código del diagrama Mermaid está vacío." };
    }

    if (trimmed.length > MAX_SOURCE_LENGTH) {
      return {
        valid: false,
        error: `El tamaño del diagrama (${trimmed.length} chars) excede el límite máximo de ${MAX_SOURCE_LENGTH}.`,
      };
    }

    // Comprobación de seguridad XSS
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          error: "El diagrama contiene patrones inseguros o scripts prohibidos.",
        };
      }
    }

    // Extraer primera línea no vacía para verificar tipo de diagrama
    const lines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("%%"));

    if (lines.length === 0) {
      return { valid: false, error: "El diagrama solo contiene comentarios." };
    }

    const firstWord = lines[0].split(/\s+/)[0].toLowerCase();
    const isKnown = KNOWN_DIAGRAM_TYPES.includes(firstWord);

    if (!isKnown) {
      return {
        valid: false,
        error: `Tipo de diagrama Mermaid no reconocido: '${firstWord}'.`,
      };
    }

    return {
      valid: true,
      diagramType: firstWord,
    };
  }

  /**
   * Sanitiza y limpia el código fuente de Mermaid eliminando inyecciones y normalizando saltos de línea.
   */
  public static sanitize(source: string): string {
    let sanitized = source.replace(/\r\n/g, "\n");

    for (const pattern of DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, "/* blocked */");
    }

    return sanitized.trim();
  }

  /**
   * Genera la directiva de configuración de tema para incrustar en el renderizado de Mermaid.
   */
  public static generateThemeDirectives(tokens: MermaidThemeTokens): string {
    const themeName = tokens.darkMode ? "dark" : "default";
    return `%%{init: {'theme': '${themeName}', 'themeVariables': { 'primaryColor': '${tokens.primary}', 'primaryTextColor': '${tokens.foreground}', 'primaryBorderColor': '${tokens.border}', 'lineColor': '${tokens.border}', 'secondaryColor': '${tokens.background}', 'tertiaryColor': '${tokens.background}' }}}%%`;
  }
}
