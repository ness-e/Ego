/**
 * T1 (VERDICT R2) — `SecretResolver` de la decisión D2 respaldado por el
 * `CredentialManager` (keychain del SO).
 *
 * D2 (EGO-FIND-33): el subproceso MCP **nunca** ve el token real. Recibe
 * `EGO_SECRET_<X>={{SECRET:<clave>}}` en su `env`, y el cliente MCP (que vive
 * en el main process, único con acceso al keychain) resuelve el marcador
 * **en el punto de uso**: la petición saliente al servidor.
 *
 * ## Formato de la clave
 * `<servicio>:<cuenta>` — p. ej. `github:pat`, `d2svc:d2acct`. Es el mismo
 * par `(service, account)` que usa `CredentialManager.getSecret()`.
 * Una clave sin `:` se interpreta como una cuenta del servicio por defecto
 * (`mcp`), de modo que `{{SECRET:mi-token}}` también es válida.
 *
 * ## Fail-closed
 * - Clave desconocida → el resolver devuelve `undefined` → `resolveSecretMarkers`
 *   deja el marcador INTACTO (el servidor recibe `{{SECRET:…}}`, nunca un
 *   valor vacío o inventado).
 * - El resolver NUNCA lanza: un fallo del keychain se traduce en `undefined`.
 * - El valor resuelto **no se loguea** en ningún punto (cero `console.*`).
 */
import type { CredentialManager } from "@ego/security";
import type { SecretResolver } from "@ego/integrations";

/** Servicio por defecto cuando la clave no lleva `servicio:cuenta`. */
export const DEFAULT_SECRET_SERVICE = "mcp";

/**
 * Clave mínima que necesita el resolver (evita atar el módulo a la clase
 * completa del `CredentialManager` y permite testearlo con un doble).
 */
export interface SecretStore {
  getSecret(service: string, account: string): Promise<string | null>;
}

/** Divide `servicio:cuenta` en sus dos partes. */
export function parseSecretKey(
  key: string,
  defaultService: string = DEFAULT_SECRET_SERVICE
): { service: string; account: string } {
  const trimmed = key.trim();
  const idx = trimmed.indexOf(":");
  if (idx <= 0) {
    return { service: defaultService, account: trimmed };
  }
  const service = trimmed.slice(0, idx).trim();
  const account = trimmed.slice(idx + 1).trim();
  if (service.length === 0 || account.length === 0) {
    return { service: defaultService, account: trimmed };
  }
  return { service, account };
}

/**
 * Construye el `SecretResolver` de D2 sobre el `CredentialManager` del main.
 *
 * El resolver esfail-closed y nunca propaga errores: si el keychain falla,
 * el marcador viaja intacto.
 */
export function createCredentialSecretResolver(
  store: SecretStore | CredentialManager,
  defaultService: string = DEFAULT_SECRET_SERVICE
): SecretResolver {
  return async (key: string): Promise<string | undefined> => {
    if (typeof key !== "string" || key.length === 0) return undefined;
    const { service, account } = parseSecretKey(key, defaultService);
    if (account.length === 0) return undefined;
    try {
      const value = await store.getSecret(service, account);
      if (typeof value === "string" && value.length > 0) return value;
      return undefined;
    } catch {
      // Fail-closed: sin secreto => el marcador viaja intacto.
      return undefined;
    }
  };
}
