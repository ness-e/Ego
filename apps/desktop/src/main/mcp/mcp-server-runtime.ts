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

/** Servicio y cuenta del token en el almacén de credenciales. */
export const MCP_SERVER_TOKEN_SERVICE = "mcp";
export const MCP_SERVER_TOKEN_ACCOUNT = "ego-mcp-server";

/** Almacén de credenciales mínimo (el `CredentialManager` del main lo cumple). */
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
}

/**
 * Obtiene (o crea) el token bearer del servidor MCP de Ego.
 *
 * Se persiste **cifrado** en el keychain del SO: no está en claro en disco
 * ni en el renderer. Se reutiliza entre arranques para que un cliente MCP
 * externo pueda cachearlo.
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
  const existing = await store.getSecret(
    MCP_SERVER_TOKEN_SERVICE,
    MCP_SERVER_TOKEN_ACCOUNT
  );
  if (typeof existing === "string" && existing.length >= 32) {
    return existing;
  }
  const token = randomBytes(32).toString("base64url");
  try {
    await store.storeSecret(MCP_SERVER_TOKEN_SERVICE, MCP_SERVER_TOKEN_ACCOUNT, token);
  } catch (err) {
    // Fail-soft: el token vive solo en memoria durante esta sesión. La app
    // arranca; lo que se pierde es la persistencia entre arranques.
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
 * sobreviviera en el keychain, el siguiente arranque lo reutilizaría y un
 * cliente externo que lo hubiera cacheado seguiría autenticando contra un
 * servidor que el usuario cree apagado. Con la revocación, el token viejo
 * devuelve 401 y el arranque siguiente genera uno nuevo.
 */
export async function revokeMcpServerToken(store: McpTokenVault): Promise<void> {
  if (typeof store.deleteSecret !== "function") return;
  try {
    await store.deleteSecret(
      MCP_SERVER_TOKEN_SERVICE,
      MCP_SERVER_TOKEN_ACCOUNT
    );
  } catch {
    // Fail-soft: si el almacén no puede borrar, el token caduca con el
    // proceso (no se filtra a ningún sitio).
  }
}

/**
 * Arranca el servidor MCP de Ego (HTTP streamable en loopback).
 *
 * Devuelve el handle (URL, puerto y cierre) para que el main lo cierre en
 * `before-quit`. El `close()` **revoca además el token bearer**.
 */
export async function startEgoMcpServer(
  options: StartEgoMcpServerOptions
): Promise<EgoMcpHttpServerHandle> {
  const token = await resolveMcpServerToken(options.credentialStore);

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

  // `close()` cierra el listener Y revoca el token. Es idempotente: cerrar dos
  // veces no lanza ni revoca dos veces.
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await handle.close();
    await revokeMcpServerToken(options.credentialStore);
  };

  return { ...handle, close };
}
