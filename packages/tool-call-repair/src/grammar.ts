/**
 * Gramática y detectores de sintaxis de tool calls emitidas en texto plano (OCLW-03).
 * Extraído y adaptado de OpenClaw packages/tool-call-repair/src/grammar.ts.
 */

export interface ParsedToolCallBlock {
  name: string;
  argumentsRaw: string;
  syntax: "bracket" | "xmlish" | "markdown-fence" | "harmony" | "direct-json";
  startIndex: number;
  endIndex: number;
}

export const END_TOOL_REQUEST = "[END_TOOL_REQUEST]";
export const HARMONY_CHANNEL_MARKER = "<|channel|>";
export const HARMONY_MESSAGE_MARKER = "<|message|>";
export const HARMONY_CALL_MARKER = "<|call|>";

/**
 * Escanea texto buscando bloques de tool call en formatos conocidos.
 */
export function scanPlainTextToolCalls(text: string): ParsedToolCallBlock[] {
  const results: ParsedToolCallBlock[] = [];

  // 1. Detección XML-ish: <function=name>...</function>
  const xmlFunctionRegex = /<function=([a-zA-Z0-9_\-\.]+)>([\s\S]*?)<\/function>/g;
  let match: RegExpExecArray | null;
  while ((match = xmlFunctionRegex.exec(text)) !== null) {
    const name = match[1];
    const body = match[2];
    // Extraer parámetros si están en formato <parameter=key>value</parameter>
    const paramRegex = /<parameter=([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/parameter>/g;
    const argsObj: Record<string, unknown> = {};
    let paramMatch: RegExpExecArray | null;
    let foundParams = false;
    while ((paramMatch = paramRegex.exec(body)) !== null) {
      foundParams = true;
      const key = paramMatch[1];
      const val = paramMatch[2].trim();
      try {
        argsObj[key] = JSON.parse(val);
      } catch {
        argsObj[key] = val;
      }
    }

    const argumentsRaw = foundParams ? JSON.stringify(argsObj) : body.trim();

    results.push({
      name,
      argumentsRaw,
      syntax: "xmlish",
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // 2. Detección Tool-call tag: <tool_call>...</tool_call>
  const toolCallTagRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  while ((match = toolCallTagRegex.exec(text)) !== null) {
    const body = match[1].trim();
    // Intenta extraer JSON interno
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
        results.push({
          name: parsed.name,
          argumentsRaw: JSON.stringify(parsed.arguments ?? parsed.parameters ?? {}),
          syntax: "xmlish",
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    } catch {
      // Ignorar si no es JSON válido
    }
  }

  // 3. Detección Bracket syntax: [tool: name {args}] o [name\n{args}]
  const bracketToolRegex = /\[(?:tool:\s*)?([a-zA-Z0-9_\-]+)\s*\n?([\s\S]*?)\]/g;
  while ((match = bracketToolRegex.exec(text)) !== null) {
    const name = match[1];
    const rawArgs = match[2].trim();
    if (rawArgs.startsWith("{") && rawArgs.endsWith("}")) {
      results.push({
        name,
        argumentsRaw: rawArgs,
        syntax: "bracket",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // 4. Detección Markdown Code Fence con objeto conteniendo name/tool:
  const markdownFenceRegex = /```(?:json)?\s*\n([\s\S]*?)\n```/g;
  while ((match = markdownFenceRegex.exec(text)) !== null) {
    const inner = match[1].trim();
    try {
      const parsed = JSON.parse(inner);
      if (parsed && typeof parsed === "object") {
        const candidateName = parsed.name ?? parsed.tool ?? parsed.tool_name;
        if (typeof candidateName === "string") {
          results.push({
            name: candidateName,
            argumentsRaw: JSON.stringify(parsed.arguments ?? parsed.parameters ?? parsed.input ?? {}),
            syntax: "markdown-fence",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          });
        }
      }
    } catch {
      // Puede haber JSON truncado dentro del bloque
    }
  }

  return results;
}
