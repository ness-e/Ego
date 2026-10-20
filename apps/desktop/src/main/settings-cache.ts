/**
 * T11 (Ola 1c) — Caché de settings del main process (permisos y compresión).
 *
 * Extraído del god-file `main.ts`: el bloque es cohesivo (lee y escribe
 * las mismas variables de módulo) y no depende de Electron, así que
 * puede vivir en su propio módulo con sus propios tests.
 *
 * ## UNA sola fuente de verdad para los permisos
 * El estado de la caché de permisos vive en `ipc/ipc-state.ts` (estado
 * compartido con los handlers IPC). Este módulo lo CONSUME, no lo duplica:
 * si se guardara aquí una segunda copia, el getter y los handlers
 * divergirían (el bug silencioso más caro de esta familia).
 */
import {
  parseCompressionSettings,
  COMPRESSION_SETTINGS_KEY,
  COMPRESSION_SETTINGS_NAMESPACE,
  type CompressionSettings,
} from "@ego/memory";
import {
  PermissionsSettingsSchema,
  type PermissionsSettings,
} from "../ipc/schema.js";
import {
  cachedPermissionsSettings,
  setCachedPermissionsSettings,
} from "./ipc/ipc-state.js";

/** Cache en memoria de `gov/settings/permissions` (STAB-02; fuente: VantaDB).
 *  Estado compartido con los handlers IPC (`ipc-state.ts`). */

/**
 * Lector de memoria mínimo que necesita la caché (el EgoMemoryAdapter lo cumple).
 */
export interface SettingsCacheReader {
  get(namespace: string, key: string): Promise<unknown>;
}

/**
 * Valida settings crudos (VantaDB `gov/settings/permissions`) fail-closed:
 * payload inválido → lanza antes de tocar motores. Aplica los defaults
 * CFG-06 (`acceptEdits` + `smart`/60s/`deny`).
 */
export function parsePermissionsSettings(raw: unknown): PermissionsSettings {
  const parsed = PermissionsSettingsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new Error(`[IPC Security] Settings de permisos inválidos: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Settings efectivos: cache de boot o defaults CFG-06 (nunca lanza). */
export function getCachedPermissionsSettings(): PermissionsSettings {
  if (cachedPermissionsSettings) return cachedPermissionsSettings;
  return parsePermissionsSettings({});
}

/** Solo tests: fija o limpia el cache sin tocar VantaDB. */
export function setCachedPermissionsSettingsForTests(settings: PermissionsSettings | null): void {
  setCachedPermissionsSettings(settings);
}

/**
 * Carga `gov/settings/permissions` al cache (boot, tras `adapter` listo).
 * Payload ausente → defaults; inválido → defaults + warn (no tumba el boot).
 */
export async function loadPermissionsSettingsIntoCache(adapter: SettingsCacheReader): Promise<PermissionsSettings> {
  try {
    const saved = await adapter.get("gov/settings", "permissions");
    let payload: unknown = saved;
    if (typeof saved === "object" && saved !== null && "payload" in saved) {
      payload = (saved as { payload: unknown }).payload;
    }
    if (payload && typeof payload === "object") {
      const parsed = parsePermissionsSettings(payload);
      setCachedPermissionsSettings(parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("[Ego Main] Settings de permisos ilegibles, usando defaults CFG-06:", err);
  }
  const defaults = parsePermissionsSettings({});
  setCachedPermissionsSettings(defaults);
  return defaults;
}

// ---------------------------------------------------------------------------
// STAB-05: Compresión con thresholds + cleanupPeriod (Gate P vinculante).
//
// `gov/settings/compression` gobierna el trigger pre-`toolLoop.run`
// (threshold 70% ventana, target 40%, auto_compact) y el job periódico
// (cleanup 30d worktrees/sesiones/leases, max_snapshots). Patrón espejo de
// STAB-02: payload ausente/inválido → defaults, boot nunca tumba.
// ---------------------------------------------------------------------------

/** Cache en memoria de `gov/settings/compression` (fuente: VantaDB). */
let cachedCompressionSettings: CompressionSettings | null = null;

/** Settings efectivos: cache de boot o defaults Gate P (nunca lanza). */
export function getCachedCompressionSettings(): CompressionSettings {
  if (cachedCompressionSettings) return cachedCompressionSettings;
  return parseCompressionSettings({});
}

/** Solo tests: fija o limpia el cache sin tocar VantaDB. */
export function setCachedCompressionSettingsForTests(settings: CompressionSettings | null): void {
  cachedCompressionSettings = settings;
}

/**
 * Carga `gov/settings/compression` al cache (boot, tras `adapter` listo).
 * Payload ausente → defaults; inválido → defaults + warn (no tumba el boot).
 */
export async function loadCompressionSettingsIntoCache(adapter: SettingsCacheReader): Promise<CompressionSettings> {
  try {
    const saved = await adapter.get(COMPRESSION_SETTINGS_NAMESPACE, COMPRESSION_SETTINGS_KEY);
    let payload: unknown = saved;
    if (typeof saved === "object" && saved !== null && "payload" in saved) {
      payload = (saved as { payload: unknown }).payload;
    }
    if (payload && typeof payload === "object") {
      cachedCompressionSettings = parseCompressionSettings(payload);
      return cachedCompressionSettings;
    }
  } catch (err) {
    console.warn("[Ego Main] Settings de compresión ilegibles, usando defaults STAB-05:", err);
  }
  cachedCompressionSettings = parseCompressionSettings({});
  return cachedCompressionSettings;
}
