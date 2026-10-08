import { EgoEvent, EventSeverity } from "./types.js";
import { EventBus } from "./EventBus.js";

/**
 * Patrones de expresiones regulares para ofuscar secretos sensibles en logs y telemetría.
 * Principio Zero Secrets in Storage (AGENTS.md §Seguridad).
 */
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g,                  // OpenAI / Anthropic API keys
  /ghp_[a-zA-Z0-9]{20,}/g,                  // GitHub Personal Access Tokens
  /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,       // Bearer tokens
  /password\s*[:=]\s*["']?[^"'\s]{4,}["']?/gi, // Passwords en texto plano
];

/**
 * Logger estructurado para diagnóstico y auditoría de Ego (ACT-05).
 * Emite líneas JSON formateadas con saneamiento obligatorio de secretos.
 */
export class StructuredLogger {
  private outputStream: (line: string) => void;
  private minSeverityLevel: number;

  private static readonly SEVERITY_WEIGHTS: Record<EventSeverity, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    critical: 50,
  };

  constructor(options: {
    outputStream?: (line: string) => void;
    minSeverity?: EventSeverity;
  } = {}) {
    this.outputStream = options.outputStream ?? ((line) => console.log(line));
    this.minSeverityLevel = StructuredLogger.SEVERITY_WEIGHTS[options.minSeverity ?? "info"];
  }

  /**
   * Conecta el logger al EventBus para capturar y registrar automáticamente todos los eventos del sistema.
   */
  public attachToEventBus(eventBus: EventBus): () => void {
    const sub = eventBus.onAny((event) => {
      this.logEvent(event);
    });
    return sub.unsubscribe;
  }

  /**
   * Registra un evento estructurado sanitizado.
   */
  public logEvent(event: EgoEvent): void {
    const severity = event.severity ?? "info";
    const weight = StructuredLogger.SEVERITY_WEIGHTS[severity] ?? 20;

    if (weight < this.minSeverityLevel) {
      return;
    }

    const logRecord = {
      ts: new Date(event.timestamp).toISOString(),
      level: severity.toUpperCase(),
      source: event.source,
      type: event.type,
      eventId: event.id,
      sessionId: event.sessionId,
      traceId: event.traceId,
      data: this.sanitize(event.payload),
    };

    const rawJson = JSON.stringify(logRecord);
    this.outputStream(this.maskSecrets(rawJson));
  }

  /**
   * Ofusca cualquier token o credencial que coincida con patrones conocidos.
   */
  public maskSecrets(text: string): string {
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, "[REDACTED_SECRET]");
    }
    return result;
  }

  /**
   * Sanitización recursiva de objetos antes de serializar.
   */
  private sanitize(data: unknown): unknown {
    if (typeof data === "string") {
      return this.maskSecrets(data);
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }
    if (data && typeof data === "object") {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (/token|secret|password|apikey|authorization/i.test(key)) {
          clean[key] = "[REDACTED_SECRET]";
        } else {
          clean[key] = this.sanitize(value);
        }
      }
      return clean;
    }
    return data;
  }
}
