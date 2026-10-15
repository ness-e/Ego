import { z } from "zod";

/**
 * Ajustes de compresión y limpieza gobernados (STAB-05).
 *
 * Persistencia canónica: VantaDB `gov/settings/compression` (espejo del
 * patrón STAB-02 `gov/settings/permissions`). Valores Gate P vinculantes
 * (plan 2026-10-16): threshold 70% de ventana, target 40%, cleanup 30d.
 *
 * - `thresholdRatio` (0.70): ratio de uso de ventana que dispara pre-compact.
 * - `targetRatio` (0.40): ratio objetivo tras compactar (informativo para el
 *   resumidor; el archive previo siempre se conserva en `kb/history_archive`).
 * - `autoCompact` (true): master-switch; en `false` nada dispara.
 * - `maxWindowTokens` (200000): techo absoluto alineado con CFG-05
 *   (`ContextCompaction autoCompactTokens`, `packages/runtime`).
 * - `cleanupPeriodDays` (30): TTL de sesiones/turns/worktrees huérfanos.
 * - `maxSnapshots` (50): tope de dumps `.vdbdump` (alineado con CFG-08).
 */
export const CompressionSettingsSchema = z.object({
  thresholdRatio: z.number().gt(0).lt(1),
  targetRatio: z.number().gt(0).lt(1),
  autoCompact: z.boolean(),
  maxWindowTokens: z.number().int().min(1),
  cleanupPeriodDays: z.number().min(1),
  maxSnapshots: z.number().int().min(1),
});

export type CompressionSettings = z.infer<typeof CompressionSettingsSchema>;

export const DEFAULT_COMPRESSION_SETTINGS: CompressionSettings = {
  thresholdRatio: 0.7,
  targetRatio: 0.4,
  autoCompact: true,
  maxWindowTokens: 200000,
  cleanupPeriodDays: 30,
  maxSnapshots: 50,
};

export const COMPRESSION_SETTINGS_NAMESPACE = "gov/settings";
export const COMPRESSION_SETTINGS_KEY = "compression";

/** Resuelve parciales contra defaults Gate P con validación fail-fast. */
export function resolveCompressionSettings(
  partial?: Partial<CompressionSettings>
): CompressionSettings {
  const merged: CompressionSettings = {
    ...DEFAULT_COMPRESSION_SETTINGS,
    ...partial,
  };
  const parsed = CompressionSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(
      `[CompressionSettings] settings inválidos: ${parsed.error.message}`
    );
  }
  if (parsed.data.targetRatio > parsed.data.thresholdRatio) {
    throw new Error(
      `[CompressionSettings] targetRatio (${parsed.data.targetRatio}) no puede superar thresholdRatio (${parsed.data.thresholdRatio})`
    );
  }
  return parsed.data;
}

/** Parse tolerante de payloads VantaDB: inválido → defaults (fail-closed). */
export function parseCompressionSettings(payload: unknown): CompressionSettings {
  if (!payload || typeof payload !== "object") {
    return { ...DEFAULT_COMPRESSION_SETTINGS };
  }
  try {
    return resolveCompressionSettings(payload as Partial<CompressionSettings>);
  } catch {
    return { ...DEFAULT_COMPRESSION_SETTINGS };
  }
}

export type CompressionTriggerReason = "under_threshold" | "ratio_threshold" | "token_limit";

export interface CompressionEvaluation {
  shouldCompact: boolean;
  reason: CompressionTriggerReason;
}

/**
 * Decisión pura de pre-compactación: `autoCompact` apagado nunca dispara;
 * techo absoluto primero, ratio de ventana después. Ventana desconocida
 * (`<= 0`) no dispara por ratio (conservador).
 */
export function shouldTriggerCompression(
  estimatedTokens: number,
  windowTokens: number,
  settings: CompressionSettings = DEFAULT_COMPRESSION_SETTINGS
): CompressionEvaluation {
  if (settings.autoCompact !== true) {
    return { shouldCompact: false, reason: "under_threshold" };
  }
  if (
    Number.isFinite(estimatedTokens) &&
    estimatedTokens >= settings.maxWindowTokens
  ) {
    return { shouldCompact: true, reason: "token_limit" };
  }
  if (
    Number.isFinite(estimatedTokens) &&
    Number.isFinite(windowTokens) &&
    windowTokens > 0 &&
    estimatedTokens / windowTokens >= settings.thresholdRatio
  ) {
    return { shouldCompact: true, reason: "ratio_threshold" };
  }
  return { shouldCompact: false, reason: "under_threshold" };
}
