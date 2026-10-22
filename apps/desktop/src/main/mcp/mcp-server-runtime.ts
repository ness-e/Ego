/**
 * T2 (VERDICT R1) — Arranque del `EgoMcpServer` de Ego desde el main.
 *
 * `AGENTS.md` §7: *"Ego = MCP Client **y** MCP Server"*. `EgoMcpServer`
 * (`packages/integrations/src/mcp/McpServer.ts`) estaba implementado y
 * testeado, pero **no se instanciaba en `src/`**: el servidor no existía en
 * producción.
 *
 * ## Transporte (decisión del orquestador, ratificada aquí)
 * **HTTP streamable en `127.0.0.1`, en-proceso (NO proceso hijo stdio).**
 * Razón: las tools y la memoria de Ego viven en el proceso main (VantaDB,
 * `ToolRegistry`, `ApprovalEngine`). Un hijo stdio obligaría a proxiar todo
 * por el pipe y duplicaría el runtime → el catálogo expuesto sería una
 * copia desincronizada, no el catálogo real.
 *
 * ## Seguridad
 *  - **Solo loopback**: `127.0.0.1` (el servidor HTTP rechaza cualquier
 *    otra interfaz).
 *  - **Bearer token obligatorio**: generado al arrancar con 32 bytes
 *    aleatorios (`base64url`), **persistido cifrado** en el almacén de
 *    credenciales (keychain del SO) bajo `mcp/ego-mcp-server`, y
 *    **reutilizado** entre arranques (así un cliente puede cachearlo).
 *    Nunca se expone al renderer ni aparece en la URL.
 *  - **Gate HITL fail-closed**: `tools/call` de una tool que exige aprobación
 *    pasa por el gate; sin gate, el `EgoMcpServer` la rechaza.
 */
import { randomBytes } from "node:crypto";
import { EgoMcpServer, type McpApprovalGate } from "@ego/integrations";
import { PayloadRegistry } from "@ego/ui-runtime";
import type { ToolRegistry } from "@ego/tools";
import {
  startEgoMcpHttpServer,
  type EgoMcpHttpServerHandle,
} from "./mcp-http-server.js";
import {
  startMcpTokenBroker,
  type McpTokenBrokerHandle,
} from "./mcp-token-broker.js";
import {
  McpTokenKeychain,
  MCP_TOKEN_KEYCHAIN_SERVICE,
  MCP_TOKEN_KEYCHAIN_ACCOUNT,
  type McpTokenVault,
} from "../credentials/mcp-token-keychain.js";

export type { McpTokenVault } from "../credentials/mcp-token-keychain.js";

/**
 * Servicio y cuenta del token en el keychain del SO.
 *
 * Ola 9 (A3): la clave es **namespacada** (`mcp.server` / `token`) para que
 * el token del servidor MCP no pueda colisionar con un secreto de proveedor
 * (servicio = nombre del proveedor) ni con los secretos de env MCP
 * (`mcp/<serverId>/env`). Antes era `mcp` / `ego-mcp-server`.
 */
export const MCP_SERVER_TOKEN_SERVICE = MCP_TOKEN_KEYCHAIN_SERVICE;
export const MCP_SERVER_TOKEN_ACCOUNT = MCP_TOKEN_KEYCHAIN_ACCOUNT;


export interface StartEgoMcpServerOptions {
  /** Catálogo real de tools que se expone. */
  toolRegistry: ToolRegistry;
  /** Almacén de credenciales (keychain del SO). */
  credentialStore: McpTokenVault;
  /** Gate HITL. Sin él, las tools que exigen aprobación se rechazan. */
  approvalGate?: McpApprovalGate;
  /** Proveedor de recursos de payload (opcional). */
  payloadRegistry?: ConstructorParameters<typeof EgoMcpServer>[0]["payloadRegistry"];
  /** Proveedor de recursos de memoria (opcional). */
  memoryAdapter?: ConstructorParameters<typeof EgoMcpServer>[0]["memoryAdapter"];
  /** Proveedor de prompts de Sub-Egos (opcional). */
  subEgoRegistry?: ConstructorParameters<typeof EgoMcpServer>[0]["subEgoRegistry"];
  /** Contexto de ejecución inyectado en las tools llamadas. */
  executionContext?: {
    sessionId?: string;
    projectId?: string;
    workspacePath?: string;
  };
  /** Nombre del servidor MCP. */
  serverName?: string;
  /**
   * Ruta del pipe del broker local del token (Ola 9 / EGO-FIND-81).
   * Por defecto, la ruta determinista por usuario.
   */
  tokenBrokerPath?: string;
}

/**
 * Genera el token bearer del servidor MCP y lo guarda en el keychain del SO.
 *
 * Ola 9 (A3) — **ROTACIÓN POR ARRANQUE**.
 *
 * Antes (Ola 1c) el token se **reutilizaba** si ya estaba en el almacén
 * ("así un cliente puede cachearlo"). Eso es un fallo de seguridad:
 *
 * 1. el token es un bearer de un servidor en loopback y **se revoca al
 *    cerrar** (ADR-0021 §3). Si sobrevive entre arranques, una credencial
 *    capturada sigue autenticando contra un servidor posterior — la
 *    revocación deja de ser una garantía;
 * 2. el almacén de credenciales del main (`CredentialManager`) tiene su vault
 *    **en memoria** (`packages/security/src/CredentialManager.ts:337`), así
 *    que en la práctica el token **no** sobrevivía a un reinicio: la
 *    reutilización era una promesa que el almacenamiento no cumplía.
 *
 * ⇒ **Decisión: el token rota en cada arranque.** Se genera uno nuevo, se
 * sobrescribe la entrada del keychain y se revoca al cerrar. Un cliente
 * emparejado lo obtiene con `ego mcp token` mientras Ego está en ejecución.
 *
 * ## Fail-soft (bug corregido 2026-10-20)
 * `startEgoMcpServer` se espera DENTRO de `createWindow`: si esta función
 * lanzaba, el error subía por `createWindow` y mataba la app con "Error
 * crítico durante la inicialización" — la ventana nunca aparecía.
 *
 * Ocurría porque el vault del MCP usa el backend **fail-closed**
 * (`SyncSafeStorageBackend`): si el keychain del SO no puede cifrar, lanza.
 * El path de modelos ya loesquivaba con `DegradedObfBackend`; este no.
 *
 * Aquí la persistencia es una **optimización**, no un requisito de
 * seguridad: el token es un bearer de un servidor en loopback y caduca con
 * el proceso (además `close()` lo revoca). Si el vault no puede escribir, el
 * token sigue siendo válido **en memoria** durante esta sesión; lo que se
 * pierde es la reutilización entre arranques.
 */
export async function resolveMcpServerToken(store: McpTokenVault): Promise<string> {
  const keychain = new McpTokenKeychain(store);
  // Ola 9 (A3) — ROTACIÓN POR ARRANQUE: nunca se reutiliza el token de una
  // sesión anterior (ver el docstring). Se genera uno nuevo y se sobrescribe
  // la entrada del keychain.
  const token = randomBytes(32).toString("base64url");
  try {
    await keychain.write(token);
  } catch (err) {
    // Fail-soft: el token vive solo en memoria durante esta sesión. La app
    // arranca; lo que se pierde es su presencia en el keychain.
    console.warn(
      "[MCP] No se pudo persistir el token del servidor MCP en el keychain del SO; " +
        "seguirá siendo válido solo en memoria durante esta sesión.",
      err instanceof Error ? err.message : err
    );
  }
  return token;
}

/**
 * Revoca el token bearer del servidor MCP.
 *
 * T4 (Ola 1c): cerrar el servidor debe **revocar** su token. Si el token
 * sobreviviera en el keychain, un cliente externo que lo hubiera cacheado
 * seguiría autenticando contra un servidor que el usuario cree apagado. Con
 * la revocación, el token viejo devuelve 401 y el arranque siguiente genera
 * uno nuevo (rotación por arranque, Ola 9).
 */
export async function revokeMcpServerToken(store: McpTokenVault): Promise<void> {
  await new McpTokenKeychain(store).revoke();
}

/**
 * Handle del servidor MCP de Ego con el broker local del token (Ola 9).
 */
export interface EgoMcpServerHandle extends EgoMcpHttpServerHandle {
  /**
   * Ruta del pipe del broker local del token. Es el **único** canal por el
   * que un cliente MCP externo puede obtener el token (`ego mcp token`).
   */
  readonly tokenBrokerPath: string;
}

/**
 * Arranca el servidor MCP de Ego (HTTP streamable en loopback).
 *
 * Devuelve el handle (URL, puerto, broker y cierre) para que el main lo
 * cierre en `before-quit`. El `close()` **cierra el broker, revoca el token
 * bearer** y libera el puerto.
 */
export async function startEgoMcpServer(
  options: StartEgoMcpServerOptions
): Promise<EgoMcpServerHandle> {
  const token = await resolveMcpServerToken(options.credentialStore);
  const keychain = new McpTokenKeychain(options.credentialStore);

  const server = new EgoMcpServer({
    toolRegistry: options.toolRegistry,
    // COUC-08: el `PayloadRegistry` de `@ego/ui-runtime` satisface
    // estructuralmente `McpPayloadResourceProvider` → es el proveedor de
    // `resources/list` y `resources/read` del servidor MCP de Ego. Es un
    // SINGLETON: el main y el renderer comparten el mismo registro.
    payloadRegistry: PayloadRegistry.getInstance(),
    ...(options.payloadRegistry ? { payloadRegistry: options.payloadRegistry } : {}),
    ...(options.memoryAdapter ? { memoryAdapter: options.memoryAdapter } : {}),
    ...(options.subEgoRegistry ? { subEgoRegistry: options.subEgoRegistry } : {}),
    ...(options.approvalGate ? { approvalGate: options.approvalGate } : {}),
    ...(options.executionContext ? { executionContext: options.executionContext } : {}),
    ...(options.serverName ? { serverName: options.serverName } : {}),
  });

  const handle = await startEgoMcpHttpServer({
    server,
    token,
    host: "127.0.0.1",
    port: 0,
  });

  // Ola 9 (A3) / EGO-FIND-81: el broker local del token. Es el canal por el
  // que `ego mcp token` obtiene el token vigente **y** la URL del endpoint
  // (el puerto es efímero: sin ella, el token no basta para conectar).
  // El token se lee del keychain en cada petición ⇒ si se revoca, el broker
  // deja de servirlo.
  let broker: McpTokenBrokerHandle | null = null;
  try {
    broker = await startMcpTokenBroker({
      ...(options.tokenBrokerPath ? { path: options.tokenBrokerPath } : {}),
      readToken: async () => keychain.read(),
      describeEndpoint: () => handle.url,
    });
  } catch (err) {
    // Fail-soft: el servidor MCP sigue funcionando (el token se puede
    // obtener por otra vía), pero sin canal local ⇒ se avisa.
    console.warn(
      "[MCP] No se pudo arrancar el broker local del token MCP; los clientes " +
        "externos no podrán obtenerlo con `ego mcp token`.",
      err instanceof Error ? err.message : err
    );
  }

  // `close()` cierra el listener, cierra el broker Y revoca el token. Es
  // idempotente: cerrar dos veces no lanza ni revoca dos veces.
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    if (broker) {
      await broker.close();
    }
    await handle.close();
    await revokeMcpServerToken(options.credentialStore);
  };

  return { ...handle, close, tokenBrokerPath: broker?.path ?? "" };

}
