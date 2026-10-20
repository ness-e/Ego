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
import type { PermissionsSettings } from "../../ipc/schema.js";

/** Id del proyecto activo (`"default"` hasta que se seleccione uno). */
export let activeProjectId: string = "default";

/** Fija el proyecto activo. */
export function setActiveProjectId(value: string): void {
  activeProjectId = value;
}

/** Caché de la política de permisos resuelta (Zod fail-closed). */
export let cachedPermissionsSettings: PermissionsSettings | null = null;

/** Actualiza la caché de permisos. */
export function setCachedPermissionsSettings(value: PermissionsSettings | null): void {
  cachedPermissionsSettings = value;
}

/** La ventana flotante ya se mostró automáticamente al minimizar. */
export let floatingAutoShownOnMinimize = false;

/** Marca/limpia el auto-mostrado de la ventana flotante. */
export function setFloatingAutoShownOnMinimize(value: boolean): void {
  floatingAutoShownOnMinimize = value;
}

/** El usuario pineó la ventana flotante manualmente. */
export let floatingPinnedManually = false;

/** Marca/limpia el pin manual de la ventana flotante. */
export function setFloatingPinnedManually(value: boolean): void {
  floatingPinnedManually = value;
}
