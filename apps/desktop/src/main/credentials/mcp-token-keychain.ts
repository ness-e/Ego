/**
 * Ola 9 (A3) — EGO-FIND-81: el token del servidor MCP en el keychain del SO.
 *
 * ## Qué decide
 *
 * El token bearer del servidor MCP es una credencial. La decisión del owner
 * (2026-10-21) es **"Keychain + CLI local"**:
 *
 * 1. el token **se guarda en el keychain del SO** (el `CredentialManager` que
 *    ya existe, con `safeStorage`/DPAPI/Keychain como backend), **nunca** en
 *    un fichero en claro;
 * 2. **sólo** se expone por un comando CLI local;
 * 3. el renderer **nunca** lo ve (`AGENTS.md`: el renderer es *untrusted*).
 *
 * ## La clave es NAMESPACADA
 *
 * `mcp.server` / `token` — no es un secreto de proveedor. Los secretos de
 * proveedor usan el nombre del proveedor como servicio
 * (`CredentialPool.serviceFor`), y los secretos de env MCP usan
 * `mcp/<serverId>/env`. `mcp.server::token` no colisiona con ninguno.
 *
 * ## Rotación (decisión de A3, justificada en el handoff)
 *
 * El token **rota en cada arranque** y **se revoca al cerrar**. Reutilizar el
 * token de la sesión anterior dejaría viva una credencial capturada contra
 * un servidor posterior, y debilitaría la revocación que ADR-0021 §3 declara
 * como invariante.
 */

/**
 * Servicio del keychain donde vive el token del servidor MCP.
 * Namespace propio: no es un secreto de proveedor.
 */
export const MCP_TOKEN_KEYCHAIN_SERVICE = "mcp.server";

/**
 * Cuenta del keychain donde vive el token del servidor MCP.
 */
export const MCP_TOKEN_KEYCHAIN_ACCOUNT = "token";

/**
 * Almacén de credenciales mínimo (el `CredentialManager` del main lo cumple).
 *
 * Superficie **estructural** a propósito: `packages/security` no se importa
 * aquí (el vault del main ya cumple esta forma) y el test puede usar un doble
 * sin dependencias.
 */
export interface McpTokenVault {
  getSecret(service: string, account: string): Promise<string | null>;
  storeSecret(
    service: string,
    account: string,
    secret: string
  ): Promise<void> | void;
  /**
   * Borra el secreto. **Opcional**: un almacén que no sepa borrar simply
   * no revoca (el token caduca con el proceso), pero el `CredentialManager`
   * real sí lo hace (`deleteSecret` es síncrono y devuelve `boolean`).
   */
  deleteSecret?(
    service: string,
    account: string
  ): boolean | void | Promise<boolean | void>;
}

/**
 * Fachada tipada sobre el keychain para el token del servidor MCP.
 *
 * Es la **única** puerta de entrada/salida del token: el runtime lo escribe,
 * el broker lo lee, y `revoke()` lo borra al cerrar. Nadie más lo toca.
 */
export class McpTokenKeychain {
  constructor(private readonly vault: McpTokenVault) {}

  /** Clave canónica `servicio::cuenta` (la que usa el `CredentialManager`). */
  public get key(): string {
    return `${MCP_TOKEN_KEYCHAIN_SERVICE}::${MCP_TOKEN_KEYCHAIN_ACCOUNT}`;
  }

  /** Lee el token vigente del keychain (`null` si no hay). */
  public async read(): Promise<string | null> {
    const secret = await this.vault.getSecret(
      MCP_TOKEN_KEYCHAIN_SERVICE,
      MCP_TOKEN_KEYCHAIN_ACCOUNT
    );
    return typeof secret === "string" && secret.length > 0 ? secret : null;
  }

  /** Escribe (o sobreescribe) el token en el keychain. */
  public async write(token: string): Promise<void> {
    await this.vault.storeSecret(
      MCP_TOKEN_KEYCHAIN_SERVICE,
      MCP_TOKEN_KEYCHAIN_ACCOUNT,
      token
    );
  }

  /** Revoca el token (lo borra del keychain). Idempotente. */
  public async revoke(): Promise<void> {
    if (typeof this.vault.deleteSecret !== "function") return;
    try {
      await this.vault.deleteSecret(
        MCP_TOKEN_KEYCHAIN_SERVICE,
        MCP_TOKEN_KEYCHAIN_ACCOUNT
      );
    } catch {
      // Fail-soft: si el almacén no puede borrar, el token caduca con el
      // proceso (no se filtra a ningún sitio).
    }
  }
}
