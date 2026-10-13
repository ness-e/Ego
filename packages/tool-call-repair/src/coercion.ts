/**
 * Heurísticas deterministas de normalización y coerción de argumentos (OCLW-04).
 * Extraído y adaptado de OpenClaw packages/normalization-core.
 */

/**
 * Intenta convertir un valor arbitrario a boolean según heurísticas permisivas.
 */
export function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off") return false;
  }
  return undefined;
}

/**
 * Intenta convertir un string numérico a number.
 */
export function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !isNaN(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num)) return num;
    }
  }
  return undefined;
}

/**
 * Coerción inteligente de arrays.
 */
export function coerceArray<T = unknown>(value: unknown): T[] | undefined {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed as T[];
      } catch {
        // Fallback a split
      }
    }
    // Si contiene comas y no es una ruta ni URL
    if (trimmed.includes(",") && !trimmed.includes("/") && !trimmed.includes("\\")) {
      return trimmed.split(",").map((s) => s.trim()) as unknown as T[];
    }
    return [trimmed as unknown as T];
  }
  return [value as T];
}

/**
 * Normaliza y limpia recursivamente un objeto de argumentos para adaptarlo a esquemas Zod o contratos tipados.
 */
export function normalizeToolArguments(args: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(args)) {
    // 1. Limpieza de claves espurias o comillas en claves
    const cleanKey = key.replace(/^["']|["']$/g, "").trim();

    if (val === null || val === undefined) {
      normalized[cleanKey] = val;
      continue;
    }

    if (typeof val === "string") {
      // Payload verbatim (fix trim-content): las claves de contenido llevan
      // bytes exactos (ej. trailing newline de fs_write_file) — ni trim,
      // ni unquote, ni coerción. Coherente con la exención JSON de abajo
      // ("nunca en content/body/code").
      if (
        cleanKey === "content" ||
        cleanKey === "text" ||
        cleanKey === "body" ||
        cleanKey === "code" ||
        cleanKey === "script" ||
        cleanKey === "query" ||
        cleanKey === "message" ||
        cleanKey === "prompt"
      ) {
        normalized[cleanKey] = val;
        continue;
      }
      let strVal = val.trim();
      // Remover comillas envolventes erróneas o duplicadas (ej: '""valor""' -> 'valor')
      while (
        strVal.length >= 2 &&
        ((strVal.startsWith('"') && strVal.endsWith('"')) ||
          (strVal.startsWith("'") && strVal.endsWith("'")))
      ) {
        strVal = strVal.slice(1, -1).trim();
      }

      // Probar coerción booleana si es exactamente true/false
      const boolVal = coerceBoolean(strVal);
      if (boolVal !== undefined && (strVal.toLowerCase() === "true" || strVal.toLowerCase() === "false")) {
        normalized[cleanKey] = boolVal;
        continue;
      }

      // Probar coerción numérica si es un número estricto
      const numVal = coerceNumber(strVal);
      if (numVal !== undefined && /^-?\d+(\.\d+)?$/.test(strVal)) {
        normalized[cleanKey] = numVal;
        continue;
      }

      // Probar si es un JSON serializado como string (solo en claves contenedoras, nunca en content/body/code)
      if ((strVal.startsWith("{") && strVal.endsWith("}")) || (strVal.startsWith("[") && strVal.endsWith("]"))) {
        const isJsonContainerKey =
          cleanKey === "arguments" ||
          cleanKey === "parameters" ||
          cleanKey === "input" ||
          cleanKey === "metadata" ||
          cleanKey === "options" ||
          cleanKey === "params" ||
          cleanKey === "config" ||
          cleanKey.endsWith("_json") ||
          cleanKey.endsWith("_params");
        const isPreservedStringKey =
          cleanKey === "content" ||
          cleanKey === "text" ||
          cleanKey === "body" ||
          cleanKey === "code" ||
          cleanKey === "script" ||
          cleanKey === "query" ||
          cleanKey === "message" ||
          cleanKey === "prompt";

        if (isJsonContainerKey && !isPreservedStringKey) {
          try {
            const parsedJson = JSON.parse(strVal);
            if (typeof parsedJson === "object" && parsedJson !== null) {
              normalized[cleanKey] = Array.isArray(parsedJson)
                ? parsedJson
                : normalizeToolArguments(parsedJson as Record<string, unknown>);
              continue;
            }
          } catch {
            // Mantener como string si no parsea
          }
        }
      }

      normalized[cleanKey] = strVal;
    } else if (Array.isArray(val)) {
      normalized[cleanKey] = val.map((item) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? normalizeToolArguments(item as Record<string, unknown>)
          : item
      );
    } else if (typeof val === "object") {
      normalized[cleanKey] = normalizeToolArguments(val as Record<string, unknown>);
    } else {
      normalized[cleanKey] = val;
    }
  }

  return normalized;
}
