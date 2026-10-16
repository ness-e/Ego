import { extractAndRepairJson } from "./balanced-json.js";
import { scanPlainTextToolCalls } from "./grammar.js";
import { normalizeToolArguments } from "./coercion.js";

export interface RepairedToolCall {
  name: string;
  arguments: Record<string, unknown>;
  repaired: boolean;
  repairReason?: string;
  originalRaw?: string;
}

export interface RepairToolCallInput {
  name?: string;
  arguments?: unknown;
  rawText?: string;
}

/**
 * Motor de auto-reparación y normalización determinista de llamadas a herramientas (OCLW-03, OCLW-04).
 * Evita fallos operacionales cuando modelos locales o pequeños truncan JSON o emiten sintaxis en texto plano.
 */
export class ToolCallRepairEngine {
  /**
   * Intenta reparar una llamada individual recibida del modelo.
   */
  public static repair(input: RepairToolCallInput): RepairedToolCall | null {
    // Caso 1: Se provee nombre y argumentos en formato string o incompleto
    if (input.name && input.arguments !== undefined) {
      if (typeof input.arguments === "object" && input.arguments !== null && !Array.isArray(input.arguments)) {
        const normalized = normalizeToolArguments(input.arguments as Record<string, unknown>);
        return {
          name: input.name,
          arguments: normalized,
          repaired: false,
        };
      }

      if (typeof input.arguments === "string") {
        const rawArgs = input.arguments.trim();
        try {
          const parsed = JSON.parse(rawArgs);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return {
              name: input.name,
              arguments: normalizeToolArguments(parsed),
              repaired: false,
            };
          }
        } catch {
          // Intentar auto-cierre con balanced-json
          const fragment = extractAndRepairJson(rawArgs);
          if (fragment) {
            try {
              const repairedObj = JSON.parse(fragment.json);
              return {
                name: input.name,
                arguments: normalizeToolArguments(repairedObj),
                repaired: true,
                repairReason: "JSON truncado o mal balanceado reparado sintácticamente",
                originalRaw: rawArgs,
              };
            } catch {
              // Fallback
            }
          }
        }
      }
    }

    // Caso 2: Se provee texto sin procesar donde el modelo emitió llamadas en texto plano
    if (input.rawText) {
      const calls = this.extractFromText(input.rawText);
      const firstCall = calls[0];
      if (firstCall) {
        return firstCall;
      }
    }

    return null;
  }

  /**
   * Extrae y repara todas las llamadas a herramientas incrustadas en un bloque de texto plano.
   */
  public static extractFromText(text: string): RepairedToolCall[] {
    const scanned = scanPlainTextToolCalls(text);
    const results: RepairedToolCall[] = [];

    for (const block of scanned) {
      let argsObj: Record<string, unknown> = {};
      let repaired = false;
      let reason: string | undefined;

      try {
        argsObj = JSON.parse(block.argumentsRaw);
      } catch {
        const fragment = extractAndRepairJson(block.argumentsRaw);
        if (fragment) {
          try {
            argsObj = JSON.parse(fragment.json);
            repaired = true;
            reason = `Argumentos sintácticos en formato ${block.syntax} reparados con cierre de delimitadores`;
          } catch {
            argsObj = { _unparsed: block.argumentsRaw };
          }
        } else {
          argsObj = { _unparsed: block.argumentsRaw };
        }
      }

      results.push({
        name: block.name,
        arguments: normalizeToolArguments(argsObj),
        repaired: repaired || block.syntax !== "direct-json",
        repairReason: reason ?? `Extraído de formato textual sintáctico (${block.syntax})`,
        originalRaw: block.argumentsRaw,
      });
    }

    return results;
  }

  /**
   * Limpia y despoja los bloques de tool call de un texto para presentar solo el contenido conversacional al usuario.
   */
  public static stripToolCalls(text: string): string {
    const scanned = scanPlainTextToolCalls(text);
    if (scanned.length === 0) return text;

    let cleaned = text;
    // Reemplazar de atrás hacia adelante para preservar índices
    const sorted = [...scanned].sort((a, b) => b.startIndex - a.startIndex);
    for (const item of sorted) {
      cleaned = cleaned.slice(0, item.startIndex) + cleaned.slice(item.endIndex);
    }

    return cleaned.trim();
  }
}
