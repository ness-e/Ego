import type { ToolCall } from "@ego/models";
import type { ToolRegistry } from "@ego/tools";
import type {
  CausalErrorCategory,
  EnrichedCausalError,
  ErrorHandlerConfig
} from "./types.js";

/**
 * Registro de una llamada fallida para detección de bucles de reintento ciego.
 */
interface FailedCallSignature {
  toolName: string;
  argumentsHash: string;
  timestamp: number;
}

/**
 * ErrorHandler — Manejo de errores y reintentos con contexto causal (ACT-08).
 *
 * Implementa las compuertas de extracción de OpenClaw:
 * - OCLW-03: Auto-reparación en vuelo de llamadas a herramientas malformadas.
 * - OCLW-04: Normalización y coerción estricta de argumentos previa a Zod.
 *
 * Proporciona:
 * 1. Auto-reparación sintáctica heurística de payloads JSON.
 * 2. Clasificación causal formal de fallos y generación de remedy hints.
 * 3. Detección de bucles estériles con llamadas idénticas consecutivas.
 */
export class ErrorHandler {
  private readonly config: Required<ErrorHandlerConfig>;
  private readonly failureHistory: FailedCallSignature[] = [];
  private consecutiveErrorCount = 0;

  constructor(
    private readonly registry?: ToolRegistry,
    config: ErrorHandlerConfig = {}
  ) {
    this.config = {
      maxConsecutiveToolErrors: config.maxConsecutiveToolErrors ?? 3,
      enableArgumentRepair: config.enableArgumentRepair ?? true,
      enableLoopGuard: config.enableLoopGuard ?? true
    };
  }

  /**
   * Intenta reparar y normalizar heurísticamente los argumentos de una llamada
   * antes de someterlos al validador estricto Zod (OCLW-03, OCLW-04).
   */
  public repairArguments(_toolName: string, rawArgs: unknown): Record<string, unknown> {
    if (!this.config.enableArgumentRepair) {
      return typeof rawArgs === "object" && rawArgs !== null
        ? (rawArgs as Record<string, unknown>)
        : {};
    }

    let parsed: unknown = rawArgs;

    // 1. Si los argumentos vienen como texto JSON serializado
    if (typeof rawArgs === "string") {
      const trimmed = rawArgs.trim();
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Intento de reparación sintáctica heurística
        const repairedJson = this.attemptSyntaxRepair(trimmed);
        try {
          parsed = JSON.parse(repairedJson);
        } catch {
          // Si es un string simple y no JSON, creamos un mapa si la herramienta tiene un parámetro obvio
          parsed = { input: rawArgs };
        }
      }
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { value: parsed };
    }

    const obj = parsed as Record<string, unknown>;

    // 2. Desenvolver contenedores redundantes ({ params: {...} }, { arguments: {...} }, { input: {...} })
    const unwrapped = this.unwrapRedundantContainers(obj);

    // 3. Coerción suave y normalización recursiva de tipos primitivos
    return this.normalizeValues(unwrapped);
  }

  /**
   * Clasifica y enriquece un fallo cuando la herramienta no se encuentra en el registro.
   */
  public handleToolNotFound(call: ToolCall, availableTools: string[] = []): EnrichedCausalError {
    this.consecutiveErrorCount++;
    const tools =
      availableTools.length > 0
        ? availableTools
        : (this.registry?.list().map((t) => t.name) ?? []);
    const suggested = this.findSimilarTools(call.name, tools);

    const suggestionText = suggested.length > 0
      ? ` ¿Quisiste decir: ${suggested.map((s) => `"${s}"`).join(", ")}?`
      : "";

    return {
      status: "error",
      category: "TOOL_NOT_FOUND",
      toolName: call.name,
      callId: call.id,
      message: `La herramienta "${call.name}" no está registrada en el entorno de Ego.${suggestionText}`,
      remedyHint: suggested.length > 0
        ? `Invoca "${suggested[0]}" en su lugar o revisa la lista de herramientas disponibles.`
        : "Verifica el nombre exacto de la herramienta según las declaraciones provistas.",
      suggestedTools: suggested,
      rawError: `Tool "${call.name}" not found.`
    };
  }

  /**
   * Clasifica y enriquece errores de validación de esquemas Zod con detalles por campo.
   */
  public handleValidationError(
    call: ToolCall,
    zodError: { issues?: Array<{ path: (string | number)[]; message: string; code?: string }> }
  ): EnrichedCausalError {
    this.consecutiveErrorCount++;
    const issues = zodError.issues ?? [];
    const details = issues.map((iss) => ({
      path: iss.path.join(".") || "(root)",
      message: iss.message
    }));

    const formattedIssues = details
      .map((d) => `- Propiedad "${d.path}": ${d.message}`)
      .join("\n");

    return {
      status: "error",
      category: "VALIDATION_FAILED",
      toolName: call.name,
      callId: call.id,
      message: `Argumentos inválidos para la herramienta "${call.name}":\n${formattedIssues}`,
      remedyHint: "Corrige los tipos y nombres de los argumentos señalados arriba asegurándote de no omitir campos requeridos.",
      validationDetails: details,
      rawError: JSON.stringify(issues)
    };
  }

  /**
   * Clasifica errores materiales de ejecución según patrones conocidos (FS, proceso, timeout, permisos).
   */
  public handleExecutionError(
    call: ToolCall,
    errorMsg: string,
    _durationMs?: number
  ): EnrichedCausalError {
    this.consecutiveErrorCount++;
    const category = this.categorizeError(errorMsg);
    const remedyHint = this.getRemedyHint(category, call.name, errorMsg);

    // Comprobar riesgo de loop por fallo recurrente
    const loopStatus = this.recordAndCheckLoop(call);

    return {
      status: "error",
      category: loopStatus.isLoopRisk ? "LOOP_DETECTED" : category,
      toolName: call.name,
      callId: call.id,
      message: loopStatus.isLoopRisk
        ? `${loopStatus.warning}\nDetalle original: ${errorMsg}`
        : `Fallo durante la ejecución de "${call.name}": ${errorMsg}`,
      remedyHint: loopStatus.isLoopRisk
        ? "⚠️ Detén los reintentos idénticos. Cambia de estrategia, verifica rutas o pide clarificación al usuario."
        : remedyHint,
      isLoopRisk: loopStatus.isLoopRisk,
      rawError: errorMsg
    };
  }

  /**
   * Reinicia los contadores tras una ejecución exitosa.
   */
  public notifySuccess(): void {
    this.consecutiveErrorCount = 0;
    this.failureHistory.length = 0;
  }

  /**
   * Formatea el error causal en una cadena JSON apta para ser inyectada al LLM en el rol tool.
   */
  public formatErrorResponse(error: EnrichedCausalError): string {
    return JSON.stringify(
      {
        status: error.status,
        category: error.category,
        tool: error.toolName,
        message: error.message,
        hint: error.remedyHint,
        suggestedTools: error.suggestedTools,
        validationIssues: error.validationDetails,
        loopRisk: error.isLoopRisk
      },
      null,
      2
    );
  }

  // --- MÉTODOS PRIVADOS DE APOYO ---

  private categorizeError(msg: string): CausalErrorCategory {
    const lower = msg.toLowerCase();

    if (
      lower.includes("enoent") ||
      lower.includes("no such file") ||
      lower.includes("not found") ||
      lower.includes("archivo no encontrado")
    ) {
      return "FILE_NOT_FOUND";
    }

    if (
      lower.includes("eacces") ||
      lower.includes("eperm") ||
      lower.includes("permission denied") ||
      lower.includes("permiso denegado") ||
      lower.includes("sandbox") ||
      lower.includes("fuera del sandbox")
    ) {
      return "PERMISSION_DENIED";
    }

    if (
      lower.includes("timeout") ||
      lower.includes("timed out") ||
      lower.includes("exceeded") ||
      lower.includes("tiempo de espera")
    ) {
      return "EXECUTION_TIMEOUT";
    }

    if (
      lower.includes("exit code") ||
      lower.includes("código de salida") ||
      lower.includes("command failed") ||
      lower.includes("spawn") ||
      lower.includes("error de proceso")
    ) {
      return "PROCESS_FAILED";
    }

    return "UNKNOWN_ERROR";
  }

  private getRemedyHint(category: CausalErrorCategory, _toolName: string, _raw: string): string {
    switch (category) {
      case "FILE_NOT_FOUND":
        return `El archivo o directorio no existe. Verifica la ruta con fs_read_file o git_status antes de intentar modificarlo.`;
      case "PERMISSION_DENIED":
        return `Acceso bloqueado por política de seguridad o permisos del sistema. Verifica que la ruta esté dentro del workspace permitido.`;
      case "EXECUTION_TIMEOUT":
        return `La herramienta excedió el tiempo límite. Reduce la complejidad del comando o divide la tarea en operaciones más pequeñas.`;
      case "PROCESS_FAILED":
        return `El comando falló con código de error. Examina la sintaxis, variables de entorno o prerequisitos locales.`;
      default:
        return `Revisa los parámetros y el mensaje de error para ajustar la siguiente acción.`;
    }
  }

  private recordAndCheckLoop(call: ToolCall): { isLoopRisk: boolean; warning?: string } {
    if (!this.config.enableLoopGuard) {
      return { isLoopRisk: false };
    }

    const hash = this.hashArguments(call.arguments);
    const signature: FailedCallSignature = {
      toolName: call.name,
      argumentsHash: hash,
      timestamp: Date.now()
    };

    // Comprobar si la última llamada fallida tenía exactamente la misma firma
    const lastFailure = this.failureHistory[this.failureHistory.length - 1];
    this.failureHistory.push(signature);

    if (
      lastFailure &&
      lastFailure.toolName === call.name &&
      lastFailure.argumentsHash === hash
    ) {
      return {
        isLoopRisk: true,
        warning: `Bucle detectado: Has llamado a "${call.name}" con exactamente los mismos argumentos fallidos en turnos consecutivos.`
      };
    }

    if (this.consecutiveErrorCount >= this.config.maxConsecutiveToolErrors) {
      return {
        isLoopRisk: true,
        warning: `Límite de fallos consecutivos alcanzado (${this.consecutiveErrorCount}). Detén los reintentos repetidos.`
      };
    }

    return { isLoopRisk: false };
  }

  private hashArguments(args: unknown): string {
    try {
      return JSON.stringify(args);
    } catch {
      return String(args);
    }
  }

  private attemptSyntaxRepair(jsonText: string): string {
    let text = jsonText.trim();

    // Reemplazar comillas simples con dobles (respetando escapadas simples)
    text = text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    // Cerrar comilla abierta si hay número impar de comillas dobles
    const quotes = (text.match(/(?<!\\)"/g) || []).length;
    if (quotes % 2 !== 0) {
      text += '"';
    }

    // Eliminar coma terminal al final del texto si existe
    text = text.replace(/,\s*$/, "");

    // Eliminar trailing commas antes de cerrar llaves o corchetes
    text = text.replace(/,(\s*[}\]])/g, "$1");

    // Si faltan llaves o corchetes al final por truncamiento
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/\]/g) || []).length;

    if (openBrackets > closeBrackets) {
      text += "]".repeat(openBrackets - closeBrackets);
    }
    if (openBraces > closeBraces) {
      text += "}".repeat(openBraces - closeBraces);
    }

    return text;
  }

  private unwrapRedundantContainers(obj: Record<string, unknown>): Record<string, unknown> {
    const keys = Object.keys(obj);
    if (keys.length === 1) {
      const singleKey = keys[0];
      if (
        (singleKey === "params" || singleKey === "arguments" || singleKey === "input") &&
        typeof obj[singleKey] === "object" &&
        obj[singleKey] !== null &&
        !Array.isArray(obj[singleKey])
      ) {
        return obj[singleKey] as Record<string, unknown>;
      }
    }
    return obj;
  }

  private normalizeValues(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        const trimmed = val.trim();

        // Booleano stringificado
        if (trimmed === "true") {
          result[key] = true;
          continue;
        }
        if (trimmed === "false") {
          result[key] = false;
          continue;
        }

        // Número stringificado (si no parece ruta ni hash)
        if (
          /^-?\d+(\.\d+)?$/.test(trimmed) &&
          !key.toLowerCase().includes("path") &&
          !key.toLowerCase().includes("id") &&
          !key.toLowerCase().includes("name") &&
          !key.toLowerCase().includes("hash")
        ) {
          const num = Number(trimmed);
          if (!Number.isNaN(num)) {
            result[key] = num;
            continue;
          }
        }

        // JSON anidado dentro de string
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            result[key] = JSON.parse(trimmed);
            continue;
          } catch {
            // Mantener como string si no parsea
          }
        }

        result[key] = val;
      } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        result[key] = this.normalizeValues(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }

    return result;
  }

  private findSimilarTools(query: string, available: string[]): string[] {
    const q = query.toLowerCase();
    const scored: Array<{ name: string; score: number }> = [];

    for (const t of available) {
      const lowerT = t.toLowerCase();
      let score = 0;

      if (lowerT === q) score = 1.0;
      else if (lowerT.includes(q) || q.includes(lowerT)) score = 0.8;
      else if (this.levenshteinDistance(q, lowerT) <= 3) score = 0.6;

      if (score >= 0.5) {
        scored.push({ name: t, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score).map((s) => s.name);
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
