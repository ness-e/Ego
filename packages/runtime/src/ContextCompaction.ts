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
 */
export interface ContextCompactionSettings {
  compressionThreshold: number;
  compressionTargetRatio: number;
  autoCompactTokens: number;
  autoMemory: boolean;
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
  const { compressionThreshold, compressionTargetRatio, autoCompactTokens } = merged;
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

/** Opciones del job de compactación. */
export interface CompactionRunOptions {
  /**
   * `true` solo en rebuild por compresión: único cache-break sancionado
   * (Hermes/PromptAssembly). Sin esto la compactación mid-turn está
   * prohibida y el job lanza en lugar de mutar el snapshot volátil.
   */
  isCompressionRebuild: boolean;
  /** Resumidor inyectable (stdlib por defecto: head/tail determinista). */
  summarize?: (dropped: ModelMessage[]) => string;
}

function defaultSummarize(dropped: ModelMessage[]): string {
  const heads = dropped
    .slice(0, 3)
    .map((m) => `[${m.role}] ${m.content.slice(0, 200)}`);
  return [
    `Context compacted: ${dropped.length} message(s) summarized.`,
    ...heads,
  ].join("\n");
}

function estimateChars(messages: ModelMessage[]): number {
  return messages.reduce((acc, m) => acc + m.content.length, 0);
}

/**
 * Job de compactación de contexto (CFG-05).
 *
 * Sin dependencias: decisión + poda determinista head/tail hasta el
 * `compressionTargetRatio`. El snapshot volátil solo se regenera aquí —
 * nunca mid-turn fuera de compresión.
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

  public compact(input: CompactionInput, opts: CompactionRunOptions): CompactionResult {
    if (opts.isCompressionRebuild !== true) {
      throw new Error(
        "[ContextCompaction] compact() exige { isCompressionRebuild: true }: " +
          "el snapshot volátil es estable desde inicio de sesión y solo la " +
          "compresión sanciona su rebuild mid-turn."
      );
    }
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

    const keepCount = Math.max(1, Math.floor(messages.length * this.settings.compressionTargetRatio));
    if (keepCount >= messages.length) {
      return {
        messages,
        summary: "Context compacted: 0 message(s) summarized.",
        keptRatio: 1,
        volatileSnapshot: `volatile-snapshot ${new Date().toISOString()} (no-op)`,
        trigger,
      };
    }
    // Head (contexto inicial) + tail (turnos recientes); el medio se resume.
    const headCount = Math.max(1, Math.ceil(keepCount * 0.3));
    const tailCount = keepCount - headCount;
    const head = messages.slice(0, headCount);
    const tail = tailCount > 0 ? messages.slice(messages.length - tailCount) : [];
    const dropped = messages.slice(headCount, messages.length - tailCount);
    const summarize = opts.summarize ?? defaultSummarize;
    const summary = summarize(dropped);
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
