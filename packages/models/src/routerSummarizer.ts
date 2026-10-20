import type { ModelMessage, ModelRole } from "./types.js";
import type { ModelRouter } from "./ModelRouter.js";

/**
 * Contrato de resumidor para compactación de contexto.
 *
 * Estructuralmente idéntico a `SummarizerFn` de `@ego/runtime`, pero declarado
 * aquí para que `packages/models` no dependa de `packages/runtime` (DIP): el
 * runtime sólo necesita una función `(messages, systemPrompt?) => Promise<string>`.
 */
export type RouterSummarizer = (
  messages: ModelMessage[],
  systemPrompt?: string
) => Promise<string>;

export interface RouterSummarizerOptions {
  /** Rol con el que se invoca al router. Por defecto `fast-classifier`. */
  role?: ModelRole;
  /** Modelo concreto preferido (alias o id). */
  preferredModelId?: string;
  /** Tope de tokens de la respuesta. */
  maxTokens?: number;
}

/**
 * Transforma el tramo podado en un prompt plano para el modelo.
 * El contenido de las herramientas se marca explícitamente para que el
 * resumidor conserve nombres y resultados.
 */
export function renderCompactionTranscript(messages: ModelMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const toolInfo = m.toolCalls?.length
      ? ` tool_calls=[${m.toolCalls.map((tc) => tc.name).join(", ")}]`
      : "";
    const nameInfo = m.name ? ` name=${m.name}` : "";
    lines.push(`[${m.role}${nameInfo}${toolInfo}] ${m.content ?? ""}`);
  }
  return lines.join("\n");
}

/**
 * Adaptador que produce el resumen de compactación usando el `ModelRouter`.
 *
 * Sustituye al `fallbackSummarize` heurístico cuando hay un router real
 * disponible: el modelo recibe el tramo podado + el prompt de sistema
 * regulado y devuelve un resumen estructurado.
 */
export function createRouterSummarizer(
  router: ModelRouter,
  options: RouterSummarizerOptions = {}
): RouterSummarizer {
  const role: ModelRole = options.role ?? "fast-classifier";
  const preferred = options.preferredModelId
    ? { modelId: options.preferredModelId }
    : undefined;

  return async (messages: ModelMessage[], systemPrompt?: string): Promise<string> => {
    const transcript = renderCompactionTranscript(messages);
    const result = await router.generateText(
      role,
      {
        messages: [{ role: "user", content: transcript }],
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
      },
      ["text"],
      preferred
    );
    return result.text;
  };
}
