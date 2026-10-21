/**
 * T11 (EGO-FIND-54) — Estado mutable compartido entre `main.ts` y los
 * handlers IPC (`src/main/ipc/register-ipc.ts`).
 *
 * Antes de la descomposición, estas cuatro variables eran `let` de módulo
 * en `main.ts` y los handlers las capturaban por closure. Al mover los
 * handlers a su propio módulo, viven aquí con **live bindings** (ESM): main
 * y los handlers leen y escriben la MISMA variable, sin copias ni getters
 * manuales.
 *
 * - `activeProjectId`: proyecto activo (cambia al seleccionar proyecto).
 * - `cachedPermissionsSettings`: caché de la política de permisos.
 * - `floatingAutoShownOnMinimize` / `floatingPinnedManually`: flags de la
 *   ventana flotante (auto-mostrado y pin manual).
 */
/**
 * E6 (Ola 2) — El estado vive en `state/app-context.ts` (único sitio con
 * estado mutable del proceso). Este módulo lo re-exporta para no romper la
 * API pública (`main.ts` y `register-ipc.ts` lo importan desde aquí).
 */
export {
  activeProjectId,
  setActiveProjectId,
  cachedPermissionsSettings,
  setCachedPermissionsSettings,
  floatingAutoShownOnMinimize,
  setFloatingAutoShownOnMinimize,
  floatingPinnedManually,
  setFloatingPinnedManually,
} from "../state/app-context.js";
