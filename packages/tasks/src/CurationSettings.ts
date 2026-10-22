import { z } from "zod";

/**
 * Ajustes de la curaduría programada de memoria (CFG-08) — `EGO-FIND-113`.
 *
 * ## Por qué viven en `gov/settings`
 *
 * Antes, la cadencia (`intervalHours`) y la ventana de antigüedad
 * (`staleAfterDays`) eran **literales en el arranque** de la app
 * (`apps/desktop/src/main/window/create-window.ts`):
 *
 * ```ts
 * startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 });
 * ```
 *
 * Eso sacaba la configuración del producto de la única fuente de verdad del
 * producto (`gov/settings`, donde ya viven voz, permisos, MCP, credenciales y
 * compresión) y además dejaba **dos opciones muertas** en el contrato
 * (`staleNamespaces`, `staleBatchSize`): el cableado sólo propagaba 2 de 4
 * (`EGO-FIND-112`). Un contrato con parámetros que el cableado no puede
 * mover es una trampa.
 *
 * ## Contrato
 *
 * Persistencia canónica: VantaDB `gov/settings/memory_curation` (espejo del
 * patrón `gov/settings/compression` de `STAB-05`).
 *
 * | Clave | Por defecto | Significado |
 * |---|---|---|
 * | `intervalHours` | 24 | Horas entre corridas programadas. |
 * | `staleAfterDays` | 90 | Días de antigüedad para considerar un registro stale. |
 * | `staleNamespaces` | `["kb/facts","kb/docs"]` | Namespaces barridos. |
 * | `maxRecordsPerRun` | 500 | **Presupuesto** de registros examinados por namespace y corrida. |
 *
 * ## Precedencia (explícita, sin sorpresas)
 *
 * `opción explícita en el código` > `ajuste persistido` > `default del paquete`.
 * Un ajuste inválido o ilegible **nunca** tumba la curaduría: se degrada a los
 * defaults (fail-soft, igual que `parseCompressionSettings`).
 */
export const CurationSettingsSchema = z.object({
  /** Horas entre corridas programadas. */
  intervalHours: z.number().gt(0).max(24 * 30),
  /** Días de antigüedad para considerar un registro stale. */
  staleAfterDays: z.number().gt(0).max(3650),
  /** Namespaces barridos en busca de stale. */
  staleNamespaces: z.array(z.string().min(1)).min(1),
  /**
   * Presupuesto de registros EXAMINADOS por namespace y corrida (el límite de
   * trabajo de la curaduría: leer + evaluar + marcar).
   */
  maxRecordsPerRun: z.number().int().gt(0).max(100_000),
});

export type CurationSettings = z.infer<typeof CurationSettingsSchema>;

export const DEFAULT_CURATION_SETTINGS: CurationSettings = {
  intervalHours: 24,
  staleAfterDays: 90,
  staleNamespaces: ["kb/facts", "kb/docs"],
  maxRecordsPerRun: 500,
};

export const CURATION_SETTINGS_NAMESPACE = "gov/settings";
export const CURATION_SETTINGS_KEY = "memory_curation";

/** Resuelve parciales contra los defaults con validación fail-fast. */
export function resolveCurationSettings(partial?: Partial<CurationSettings>): CurationSettings {
  const merged: CurationSettings = {
    ...DEFAULT_CURATION_SETTINGS,
    ...(partial ?? {}),
  };
  const parsed = CurationSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`[CurationSettings] ajustes inválidos: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Parse tolerante: payload ausente o inválido → defaults (fail-closed).
 * Un ajuste corrupto NO puede dejar la memoria sin curar.
 */
export function parseCurationSettings(payload: unknown): CurationSettings {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ...DEFAULT_CURATION_SETTINGS };
  }
  try {
    return resolveCurationSettings(payload as Partial<CurationSettings>);
  } catch {
    return { ...DEFAULT_CURATION_SETTINGS };
  }
}

/** Lector mínimo de memoria que necesita la lectura de ajustes. */
export interface CurationSettingsReader {
  get(
    namespace: string,
    key: string,
  ): Promise<{ key: string; payload: unknown; metadata?: Record<string, unknown> } | null>;
}

/**
 * Lee `gov/settings/memory_curation` y devuelve los ajustes efectivos.
 *
 * - Sin registro → defaults.
 * - Con registro ilegible o inválido → defaults + `console.warn` (la curaduría
 *   sigue funcionando; el ajuste se corrige en la siguiente lectura).
 */
export async function readCurationSettings(
  adapter: CurationSettingsReader,
): Promise<CurationSettings> {
  try {
    const saved = await adapter.get(CURATION_SETTINGS_NAMESPACE, CURATION_SETTINGS_KEY);
    if (!saved) return { ...DEFAULT_CURATION_SETTINGS };
    // `EgoMemoryAdapter.get` devuelve el payload YA parseado (JSON.parse con
    // fallback al texto crudo); un lector legacy puede devolverlo como texto.
    let payload: unknown = saved.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        return { ...DEFAULT_CURATION_SETTINGS };
      }
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ...DEFAULT_CURATION_SETTINGS };
    }
    return parseCurationSettings(payload);
  } catch (err) {
    console.warn(
      `[CurationSettings] ajustes ilegibles, usando defaults: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { ...DEFAULT_CURATION_SETTINGS };
  }
}
