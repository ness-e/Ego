import type { ModelMessage } from "@ego/models";

/**
 * Ajustes de compresión y compactación de contexto (CFG-05).
 *
 * - `compressionThreshold` (0.50): ratio de uso a partir del cual el
 *   contexto se considera candidato a compactación.
 * - `compressionTargetRatio` (0.20): ratio objetivo tras compactar.
 * - `autoCompactTokens` (200000): techo absoluto de tokens estimados que
 *   dispara la compactación aunque el ratio aún no llegue al umbral.
 * - `autoMemory` (true): la compactación archiva el resumen en memoria
 *   (`kb/history_archive`, patrón Hermes pre-compress) además de devolverlo.
 * - `protectedTailCount` (opcional): cantidad mínima de mensajes recientes a
 *   preservar siempre intactos al final del historial.
 */
export interface ContextCompactionSettings {
  compressionThreshold: number;
  compressionTargetRatio: number;
  autoCompactTokens: number;
  autoMemory: boolean;
  protectedTailCount?: number;
}

export const DEFAULT_CONTEXT_COMPACTION_SETTINGS: ContextCompactionSettings = {
  compressionThreshold: 0.5,
  compressionTargetRatio: 0.2,
  autoCompactTokens: 200000,
  autoMemory: true,
};

export type CompactionTriggerReason = "under_threshold" | "ratio_threshold" | "token_limit";

export interface CompactionEvaluation {
  shouldCompact: boolean;
  reason: CompactionTriggerReason;
}

export interface CompactionInput {
  messages: ModelMessage[];
  /** Tokens estimados del contexto actual (si se conocen). */
  estimatedTokens?: number;
  /** Ratio de uso actual (0..1) si el caller ya lo calculó. */
  usageRatio?: number;
}

export interface CompactionResult {
  /** Historial compactado: head + resumen + tail. */
  messages: ModelMessage[];
  /** Resumen del tramo podado (también archivable en memoria). */
  summary: string;
  /** Ratio resultante respecto al original (por conteo de mensajes). */
  keptRatio: number;
  /**
   * Snapshot volátil congelado en el momento de la compactación.
   * Regla PromptAssembly: el snapshot volátil se congela a inicio de
   * sesión y NUNCA muta mid-turn salvo rebuild por compresión — este
   * campo solo se produce aquí, con `isCompressionRebuild: true`.
   */
  volatileSnapshot: string;
  trigger: Exclude<CompactionTriggerReason, "under_threshold">;
}

/**
 * Prompt de sistema del resumidor de contexto de Ego.
 * Exige explícitamente conservar:
 * 1. Decisiones tomadas
 * 2. Rutas de archivos tocados
 * 3. Errores relevantes y resoluciones
 * 4. Tareas pendientes y estado actual
 * 5. Restricciones y directrices del usuario
 */
export const DEFAULT_SUMMARIZER_SYSTEM_PROMPT = `Eres el componente de compactación de contexto del sistema Ego.
Tu objetivo es generar un resumen denso, estructurado y de alta fidelidad de la conversación previa que va a ser podada para liberar espacio en la ventana de contexto.

REGLAS ESTRICTAS DE CONSERVACIÓN:
1. Decisiones tomadas: enumera con claridad las decisiones arquitectónicas, técnicas y de diseño acordadas.
2. Rutas de archivos tocados: preserva explícitamente todas las rutas de archivos leídos, editados, creados o mencionados (ej. packages/..., docs/..., apps/...).
3. Errores relevantes: conserva errores encontrados, causas identificadas y cómo se resolvieron o mitigaron.
4. Tareas pendientes y estado: describe el estado actual de la tarea, qué se ha completado y cuáles son los siguientes pasos pendientes.
5. Restricciones y directrices del usuario: conserva todas las instrucciones explícitas, reglas de negocio o restricciones impuestas por el usuario.

Formato de salida:
- Sé conciso, denso y directo.
- No añadas introducciones redundantes ni despedidas.
- Usa listas con viñetas agrupadas por sección: [Decisiones], [Archivos y Rutas], [Errores y Soluciones], [Estado y Tareas Pendientes], [Restricciones].`;

/**
 * Resumidor inyectable (async o sync).
 * Recibe los mensajes podados y opcionalmente el prompt de sistema del resumidor.
 */
export type ContextSummarizer = (
  messages: ModelMessage[],
  systemPrompt?: string
) => Promise<string> | string;

/** Opciones del job de compactación. */
export interface CompactionRunOptions {
  /**
   * `true` solo en rebuild por compresión: único cache-break sancionado
   * (Hermes/PromptAssembly). Sin esto la compactación mid-turn está
   * prohibida y el job lanza en lugar de mutar el snapshot volátil.
   */
  isCompressionRebuild: boolean;
  /** Resumidor inyectable asíncrono o síncrono (LLM o fake). */
  summarizer?: ContextSummarizer;
  /** Resumidor síncrono de retrocompatibilidad. */
  summarize?: (dropped: ModelMessage[]) => string;
  /** Timeout en ms para la ejecución del summarizer (por defecto 15000). */
  summarizerTimeoutMs?: number;
  /** Prompt de sistema personalizado para el summarizer. */
  summarizerSystemPrompt?: string;
  /** Cantidad mínima de mensajes recientes a proteger al final (tail). */
  protectedTailCount?: number;
}

/**
 * Resuelve ajustes parciales contra los defaults CFG-05 con validación
 * estricta (falla rápido ante valores sin sentido).
 */
export function resolveContextCompactionSettings(
  partial?: Partial<ContextCompactionSettings>
): ContextCompactionSettings {
  const merged: ContextCompactionSettings = {
    ...DEFAULT_CONTEXT_COMPACTION_SETTINGS,
    ...partial,
  };
  const { compressionThreshold, compressionTargetRatio, autoCompactTokens, protectedTailCount } = merged;
  if (
    !Number.isFinite(compressionThreshold) ||
    compressionThreshold <= 0 ||
    compressionThreshold >= 1
  ) {
    throw new Error(
      `[ContextCompaction] compressionThreshold debe estar en (0,1) (recibido: ${compressionThreshold})`
    );
  }
  if (
    !Number.isFinite(compressionTargetRatio) ||
    compressionTargetRatio <= 0 ||
    compressionTargetRatio >= 1
  ) {
    throw new Error(
      `[ContextCompaction] compressionTargetRatio debe estar en (0,1) (recibido: ${compressionTargetRatio})`
    );
  }
  if (compressionTargetRatio > compressionThreshold) {
    throw new Error(
      `[ContextCompaction] compressionTargetRatio (${compressionTargetRatio}) no puede superar compressionThreshold (${compressionThreshold})`
    );
  }
  if (!Number.isInteger(autoCompactTokens) || autoCompactTokens < 1) {
    throw new Error(
      `[ContextCompaction] autoCompactTokens debe ser entero >= 1 (recibido: ${autoCompactTokens})`
    );
  }
  if (
    protectedTailCount !== undefined &&
    (!Number.isInteger(protectedTailCount) || protectedTailCount < 0)
  ) {
    throw new Error(
      `[ContextCompaction] protectedTailCount debe ser entero >= 0 (recibido: ${protectedTailCount})`
    );
  }
  return merged;
}

/**
 * Decisión pura de compactación: ratio >= umbral O tokens >= techo.
 */
export function evaluateCompactionNeed(
  input: CompactionInput,
  settings: ContextCompactionSettings = DEFAULT_CONTEXT_COMPACTION_SETTINGS
): CompactionEvaluation {
  if (
    input.estimatedTokens !== undefined &&
    Number.isFinite(input.estimatedTokens) &&
    input.estimatedTokens >= settings.autoCompactTokens
  ) {
    return { shouldCompact: true, reason: "token_limit" };
  }
  if (
    input.usageRatio !== undefined &&
    Number.isFinite(input.usageRatio) &&
    input.usageRatio >= settings.compressionThreshold
  ) {
    return { shouldCompact: true, reason: "ratio_threshold" };
  }
  return { shouldCompact: false, reason: "under_threshold" };
}

const PATH_REGEX = /(?:[a-zA-Z]:[\\/][^\s"'`<>]+|(?:\.{1,2}[\\/]|[a-zA-Z0-9_.-]+[\\/])[^\s"'`<>]+\.[a-zA-Z0-9]+|\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9]+)?)/g;

/**
 * Extrae rutas de archivos detectadas en los mensajes usando regex simple.
 */
export function extractDetectedPaths(messages: ModelMessage[]): string[] {
  const detected = new Set<string>();
  for (const m of messages) {
    if (!m.content) continue;
    const matches = m.content.match(PATH_REGEX);
    if (matches) {
      for (const raw of matches) {
        const cleaned = raw.replace(/[.,;:)\]}>]+$/, "").trim();
        if (cleaned.length > 2) {
          detected.add(cleaned);
        }
      }
    }
  }
  return Array.from(detected);
}

/**
 * Extrae nombres de herramientas usadas en los mensajes (por nombre de tool o toolCalls).
 */
export function extractToolsUsed(messages: ModelMessage[]): string[] {
  const tools = new Set<string>();
  for (const m of messages) {
    if (m.name && typeof m.name === "string") {
      tools.add(m.name);
    }
    if (Array.isArray(m.toolCalls)) {
      for (const tc of m.toolCalls) {
        if (tc && typeof tc.name === "string") {
          tools.add(tc.name);
        }
      }
    }
    if (m.content) {
      const toolMatch = m.content.matchAll(/(?:tool(?:_call)?|herramienta)\s*[:=]\s*([a-zA-Z0-9_-]+)/gi);
      for (const match of toolMatch) {
        if (match[1]) tools.add(match[1]);
      }
    }
  }
  return Array.from(tools);
}

/**
 * Heurístico de fallback enriquecido (sin LLM):
 * Conserva rol + primeras líneas significativas de cada mensaje comprimido hasta un presupuesto
 * de caracteres, e informa explícitamente tools usadas y rutas de archivo detectadas.
 */
export function fallbackSummarize(dropped: ModelMessage[], maxChars: number = 2500): string {
  const tools = extractToolsUsed(dropped);
  const paths = extractDetectedPaths(dropped);

  const toolsLine = `Tools usadas: ${tools.length > 0 ? tools.join(", ") : "ninguna"}`;
  const pathsLine = `Rutas detectadas: ${paths.length > 0 ? paths.join(", ") : "ninguna"}`;

  const header = [
    `Context compacted: ${dropped.length} message(s) summarized.`,
    toolsLine,
    pathsLine,
    "",
  ].join("\n");

  const budgetForMessages = Math.max(500, maxChars - header.length);
  const snippets: string[] = [];
  let currentChars = 0;

  for (let i = 0; i < dropped.length; i++) {
    const m = dropped[i];
    if (!m) continue;
    const lines = (m.content || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const significant = lines.slice(0, 2).join(" ");
    const snippet = significant.length > 180 ? `${significant.slice(0, 180)}...` : significant;
    const entry = `[${m.role}] ${snippet}`;

    if (currentChars + entry.length + 1 <= budgetForMessages) {
      snippets.push(entry);
      currentChars += entry.length + 1;
    } else {
      const omittedCount = dropped.length - i;
      snippets.push(`... [y ${omittedCount} mensaje(s) más omitidos por presupuesto de caracteres]`);
      break;
    }
  }

  return header + snippets.join("\n");
}

function estimateChars(messages: ModelMessage[]): number {
  return messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
}

/**
 * Job de compactación de contexto (CFG-05).
 *
 * Sin dependencias obligatorias: soporta summarizer LLM inyectable con fallback
 * automático a heurística enriquecida. Preserva invariantes canónicas:
 * 1. Nunca comprime el system prompt inicial.
 * 2. Respeta los últimos N mensajes protegidos (tail).
 * 3. Nunca parte un par assistant tool_call / tool result.
 */
export class ContextCompactionJob {
  private readonly settings: ContextCompactionSettings;

  constructor(settings?: Partial<ContextCompactionSettings>) {
    this.settings = resolveContextCompactionSettings(settings);
  }

  public get currentSettings(): ContextCompactionSettings {
    return { ...this.settings };
  }

  public evaluate(input: CompactionInput): CompactionEvaluation {
    return evaluateCompactionNeed(input, this.settings);
  }

  /**
   * Calcula las fronteras head/tail respetando las invariantes:
   * - System prompt inicial preservado
   * - Protected tail respetado
   * - Pares assistant tool_call / tool result nunca partidos
   */
  private calculateBoundaries(
    messages: ModelMessage[],
    opts: CompactionRunOptions
  ): { headIndex: number; tailStartIndex: number; canCompact: boolean } {
    const total = messages.length;
    if (total <= 1) {
      return { headIndex: total, tailStartIndex: total, canCompact: false };
    }

    const keepCount = Math.max(1, Math.floor(total * this.settings.compressionTargetRatio));
    if (keepCount >= total) {
      return { headIndex: total, tailStartIndex: total, canCompact: false };
    }

    // 1. Invariante system prompt: nunca comprimir system prompt(s) inicial(es)
    let leadingSystemCount = 0;
    while (leadingSystemCount < total && messages[leadingSystemCount]?.role === "system") {
      leadingSystemCount++;
    }
    const minHead = Math.max(leadingSystemCount > 0 ? leadingSystemCount : 1, 1);
    let headIndex = Math.max(minHead, Math.ceil(keepCount * 0.3));

    // 2. Invariante protected tail
    const protectedTail = opts.protectedTailCount ?? this.settings.protectedTailCount ?? 0;
    const tailCount = Math.max(protectedTail, keepCount - headIndex);
    let tailStartIndex = Math.max(headIndex, total - tailCount);

    if (headIndex >= tailStartIndex) {
      return { headIndex: total, tailStartIndex: total, canCompact: false };
    }

    // 3. Invariante de pares tool: nunca partir un par assistant tool_call / tool result
    // (a) Ajuste en la frontera tail:
    // Si tailStartIndex apunta a un mensaje 'tool', retrocedemos tailStartIndex para incluir
    // el 'assistant' llamante en el tail.
    while (tailStartIndex > headIndex && tailStartIndex < total && messages[tailStartIndex]?.role === "tool") {
      tailStartIndex--;
    }

    // (b) Ajuste en la frontera head:
    // Si head termina en un assistant con toolCalls o hay resultados de tool inmediatamente después en dropped:
    const lastHead = headIndex > 0 ? messages[headIndex - 1] : undefined;
    const nextDropped = headIndex < total ? messages[headIndex] : undefined;
    const headHasPendingToolCalls =
      lastHead?.role === "assistant" &&
      ((lastHead.toolCalls && lastHead.toolCalls.length > 0) || nextDropped?.role === "tool");
    const nextIsOrphanToolResult = nextDropped?.role === "tool";

    if (headHasPendingToolCalls || nextIsOrphanToolResult) {
      // Intentar retroceder headIndex para mover el bloque completo a dropped:
      let groupStart = headIndex - 1;
      while (groupStart > 0 && messages[groupStart]?.role === "tool") {
        groupStart--;
      }
      if (groupStart >= minHead) {
        headIndex = groupStart;
      } else {
        // Si no se puede retroceder sin violar el system prompt inicial o vaciar head,
        // avanzamos headIndex para incluir todos los resultados de herramientas en head:
        while (headIndex < tailStartIndex && messages[headIndex]?.role === "tool") {
          headIndex++;
        }
      }
    }

    if (headIndex >= tailStartIndex) {
      return { headIndex: total, tailStartIndex: total, canCompact: false };
    }

    return { headIndex, tailStartIndex, canCompact: true };
  }

  /**
   * Ejecuta la compactación de contexto de forma asíncrona.
   * Si se provee `summarizer`, invoca el LLM/fake con el system prompt regulado.
   * Si falla, agota timeout o retorna vacío, cae automáticamente al fallback heurístico.
   */
  public compact(
    input: CompactionInput,
    opts: CompactionRunOptions
  ): Promise<CompactionResult> {
    if (opts.isCompressionRebuild !== true) {
      throw new Error(
        "[ContextCompaction] compact() exige { isCompressionRebuild: true }: " +
          "el snapshot volátil es estable desde inicio de sesión y solo la " +
          "compresión sanciona su rebuild mid-turn."
      );
    }
    return this.compactInternal(input, opts);
  }

  /**
   * Variante síncrona para callers sin pipeline asíncrono o pruebas puras.
   */
  public compactSync(
    input: CompactionInput,
    opts: CompactionRunOptions
  ): CompactionResult {
    if (opts.isCompressionRebuild !== true) {
      throw new Error(
        "[ContextCompaction] compact() exige { isCompressionRebuild: true }: " +
          "el snapshot volátil es estable desde inicio de sesión y solo la " +
          "compresión sanciona su rebuild mid-turn."
      );
    }
    return this.compactInternalSync(input, opts);
  }

  private async compactInternal(
    input: CompactionInput,
    opts: CompactionRunOptions
  ): Promise<CompactionResult> {
    const messages = [...input.messages];
    if (messages.length === 0) {
      return {
        messages: [],
        summary: "Context compacted: 0 message(s) summarized.",
        keptRatio: 1,
        volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (empty)`,
        trigger: "ratio_threshold",
      };
    }
    const evaluation = this.evaluate(input);
    const trigger: Exclude<CompactionTriggerReason, "under_threshold"> =
      evaluation.reason === "under_threshold" ? "ratio_threshold" : evaluation.reason;

    const { headIndex, tailStartIndex, canCompact } = this.calculateBoundaries(messages, opts);

    if (!canCompact) {
      return {
        messages,
        summary: "Context compacted: 0 message(s) summarized.",
        keptRatio: 1,
        volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (no-op)`,
        trigger,
      };
    }

    const head = messages.slice(0, headIndex);
    const dropped = messages.slice(headIndex, tailStartIndex);
    const tail = messages.slice(tailStartIndex);

    let summary = "";

    if (opts.summarizer) {
      try {
        const timeoutMs = opts.summarizerTimeoutMs ?? 15000;
        const prompt = opts.summarizerSystemPrompt ?? DEFAULT_SUMMARIZER_SYSTEM_PROMPT;
        const summarizerPromise = Promise.resolve(opts.summarizer(dropped, prompt));

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<string>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Context compaction summarizer timed out")), timeoutMs);
        });

        const res = await Promise.race([summarizerPromise, timeoutPromise]).finally(() => {
          if (timer) clearTimeout(timer);
        });

        if (typeof res === "string" && res.trim().length > 0) {
          summary = res.trim();
        }
      } catch {
        // Resumidor falló o agotó timeout -> fallback sin lanzar
        summary = "";
      }
    } else if (opts.summarize) {
      try {
        const syncRes = opts.summarize(dropped);
        if (typeof syncRes === "string" && syncRes.trim().length > 0) {
          summary = syncRes.trim();
        }
      } catch {
        summary = "";
      }
    }

    if (!summary) {
      summary = fallbackSummarize(dropped);
    }

    const summaryMessage: ModelMessage = {
      role: "system",
      content: `[COMPRESSED CONTEXT — rebuild por compresión]\n${summary}\n[chars podados: ${estimateChars(dropped)}]`,
    };
    const compacted = [...head, summaryMessage, ...tail];
    return {
      messages: compacted,
      summary,
      keptRatio: compacted.length / messages.length,
      volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (compression rebuild, kept ${compacted.length}/${messages.length})`,
      trigger,
    };
  }

  private compactInternalSync(
    input: CompactionInput,
    opts: CompactionRunOptions
  ): CompactionResult {
    const messages = [...input.messages];
    if (messages.length === 0) {
      return {
        messages: [],
        summary: "Context compacted: 0 message(s) summarized.",
        keptRatio: 1,
        volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (empty)`,
        trigger: "ratio_threshold",
      };
    }
    const evaluation = this.evaluate(input);
    const trigger: Exclude<CompactionTriggerReason, "under_threshold"> =
      evaluation.reason === "under_threshold" ? "ratio_threshold" : evaluation.reason;

    const { headIndex, tailStartIndex, canCompact } = this.calculateBoundaries(messages, opts);

    if (!canCompact) {
      return {
        messages,
        summary: "Context compacted: 0 message(s) summarized.",
        keptRatio: 1,
        volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (no-op)`,
        trigger,
      };
    }

    const head = messages.slice(0, headIndex);
    const dropped = messages.slice(headIndex, tailStartIndex);
    const tail = messages.slice(tailStartIndex);

    let summary = "";
    if (opts.summarize) {
      try {
        const syncRes = opts.summarize(dropped);
        if (typeof syncRes === "string" && syncRes.trim().length > 0) {
          summary = syncRes.trim();
        }
      } catch {
        summary = "";
      }
    }

    if (!summary) {
      summary = fallbackSummarize(dropped);
    }

    const summaryMessage: ModelMessage = {
      role: "system",
      content: `[COMPRESSED CONTEXT — rebuild por compresión]\n${summary}\n[chars podados: ${estimateChars(dropped)}]`,
    };
    const compacted = [...head, summaryMessage, ...tail];
    return {
      messages: compacted,
      summary,
      keptRatio: compacted.length / messages.length,
      volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (compression rebuild, kept ${compacted.length}/${messages.length})`,
      trigger,
    };
  }
}
