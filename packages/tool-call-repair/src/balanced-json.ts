/**
 * Utilidades para extracción, balanceo y auto-cierre de fragmentos JSON (OCLW-03).
 * Extraído y adaptado de OpenClaw packages/normalization-core/balanced-json.ts.
 */

export interface BalancedJsonFragment {
  json: string;
  startIndex: number;
  endIndex: number;
  repaired: boolean;
}

type JsonOpeningDelimiter = "{" | "[";

function isJsonOpeningDelimiter(char: string | undefined): char is JsonOpeningDelimiter {
  return char === "{" || char === "[";
}

/**
 * Extrae el primer fragmento JSON balanceado o intenta reparar un JSON truncado.
 */
export function extractAndRepairJson(raw: string): BalancedJsonFragment | null {
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (isJsonOpeningDelimiter(raw[i])) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    return null;
  }

  const stack: JsonOpeningDelimiter[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (isJsonOpeningDelimiter(char)) {
      stack.push(char);
    } else if (stack.length > 0 && char === (stack[stack.length - 1] === "{" ? "}" : "]")) {
      stack.pop();
      if (stack.length === 0) {
        return {
          json: raw.slice(start, i + 1),
          startIndex: start,
          endIndex: i,
          repaired: false,
        };
      }
    }
  }

  // Si llegamos al final del string y la pila no está vacía o inString quedó abierto, el JSON fue truncado
  if (stack.length > 0 || inString) {
    let repairedSlice = raw.slice(start);
    if (inString) {
      // Cerramos la comilla abierta si quedó truncada
      repairedSlice += '"';
    }
    // Cerramos los delimitadores pendientes en orden inverso
    while (stack.length > 0) {
      const top = stack.pop();
      repairedSlice += top === "{" ? "}" : "]";
    }

    try {
      JSON.parse(repairedSlice);
      return {
        json: repairedSlice,
        startIndex: start,
        endIndex: raw.length - 1,
        repaired: true,
      };
    } catch {
      // Si la reparación ingenua falla por tokens incompletos (ej: trailing comma o clave sin valor), limpiamos comas huérfanas
      const cleaned = repairedSlice.replace(/,\s*([}\]])/g, "$1");
      try {
        JSON.parse(cleaned);
        return {
          json: cleaned,
          startIndex: start,
          endIndex: raw.length - 1,
          repaired: true,
        };
      } catch {
        return null;
      }
    }
  }

  return null;
}
