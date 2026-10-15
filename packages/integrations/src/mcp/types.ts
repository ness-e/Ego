import { NetPolicy, type ToolRiskLevel } from "@ego/tools";

/**
 * Mensajes base JSON-RPC 2.0 según especificación MCP.
 */
export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: TParams;
}

export interface JsonRpcNotification<TParams = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: TParams;
}

export interface JsonRpcResponse<TResult = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result?: TResult;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Parámetros del handshake `initialize` (MCP 2024-11-05).
 */
export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: {
    roots?: { listChanged?: boolean };
    sampling?: Record<string, unknown>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * Resultado devuelto por el servidor MCP en `initialize`.
 */
export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    logging?: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version?: string;
  };
}

/**
 * Especificación de herramienta expuesta por un servidor MCP.
 */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Respuesta a la llamada `tools/list`.
 */
export interface McpListToolsResult {
  tools: McpToolDefinition[];
  nextCursor?: string;
}

/**
 * Bloque de contenido devuelto por `tools/call`.
 */
export interface McpCallToolContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: unknown;
}

/**
 * Resultado de ejecución de una herramienta en un servidor MCP.
 */
export interface McpCallToolResult {
  content: McpCallToolContent[];
  isError?: boolean;
}

/**
 * Niveles de confianza de un servidor MCP (docs/engineering/integraciones.md
 * §Catálogo). Solo `official`/`verified` cuentan como firmados: el resto
 * exige aprobación HITL en las herramientas que importa (H31).
 */
export type McpServerTrustLevel =
  | "official"
  | "verified"
  | "community"
  | "custom"
  | "experimental";

/**
 * Fuente de secretos para PATs/tokens (orden prod: Credential Manager).
 * Interfaz estructural: `CredentialManager` de `@ego/security` la satisface
 * sin crear dependencia entre paquetes.
 */
export interface McpTokenStore {
  getSecret(service: string, account: string): Promise<string | null>;
}

/**
 * Configuración declarativa de conexión a un servidor MCP.
 * - `stdio`: subproceso local (ACT-09). `command` en allowlist, `shell` prohibido.
 * - `sse`: servidor remoto SSE legacy (config declarativa; el handshake vive en main).
 * - `streamable-http` (STAB-12): POST JSON-RPC stateless sobre HTTPS con
 *   validación SSRF fail-closed (`assertSafeMcpHttpUrl`): https-only, sin
 *   credenciales en URL, sin loopback/RFC1918/link-local/metadata.
 */
export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  toolPrefix?: string;
  timeoutMs?: number;
  /**
   * URL base del endpoint streamable-http (STAB-12). Solo aplica con
   * `transport: "streamable-http"`. Debe ser `https:` pública (validada por
   * `assertSafeMcpHttpUrl`); los servidores locales usan `stdio`.
   * NUNCA incluye credenciales (`user:pass@` se rechaza fail-closed).
   */
  url?: string;
  /**
   * Cabeceras extra para `streamable-http` (p. ej. `X-Api-Key` público).
   * Fail-closed: `authorization`/`proxy-authorization` se rechazan (los
   * secretos viajan vía `env` → Credential Manager, patrón F1T2/F5T10).
   */
  headers?: Record<string, string>;
  /**
   * Debe ser `false`/ausente siempre. `shell:true` se rechaza en spawn
   * (H31): el spawn es directo sin intérprete para cerrar RCE por config,
   * incluidas configs persistidas sin tipar (`gov/mcp_servers`).
   */
  shell?: boolean;
  /** Nivel de confianza del servidor; ausente = no firmado (fail-closed). */
  trustLevel?: McpServerTrustLevel;
  /**
   * Firma Ed25519 (base64) del payload canónico R10
   * (`mcp-server-signature-v1\n{id}\n{name}\n{command}\n`, ver
   * `signature.ts:buildSignaturePayload`). Solo cuenta con `trustLevel`
   * `official`/`verified` Y `publicKey` presente Y verificación exitosa;
   * en cualquier otro caso el servidor se trata como no firmado (HITL).
   */
  signature?: string;
  /**
   * Clave pública Ed25519 del firmante (R10): PEM SPKI
   * (`-----BEGIN PUBLIC KEY-----...`) o base64 crudo de 32 bytes.
   * No es secreta. Ausente o malformada = firma no verificable
   * (fail-closed: servidor no firmado).
   */
  publicKey?: string;
}

/**
 * Estados del ciclo de vida del cliente MCP.
 */
export type McpClientStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * Opciones para importar herramientas MCP al ToolRegistry de Ego.
 */
export interface McpImportOptions {
  prefix?: string;
  overrideExisting?: boolean;
  defaultRiskLevel?: ToolRiskLevel;
}

/** Cabeceras que NUNCA viajan en config en claro (secretos → env/vault). */
const BLOCKED_MCP_HTTP_HEADERS = new Set(["authorization", "proxy-authorization"]);

/**
 * Valida la URL + headers de un servidor `streamable-http` (STAB-12, Spec D2/D3).
 * Fail-closed: cualquier violación lanza (sin eco de credenciales: el mensaje
 * usa `NetPolicy.redactUrl`). Punto único de estrangulamiento: la usan
 * `McpClient.connect`, `McpManager.registerServer` y el schema IPC de main.
 */
export function assertSafeMcpHttpUrl(config: McpServerConfig): URL {
  const raw = typeof config.url === "string" ? config.url.trim() : "";
  if (raw.length === 0) {
    throw new Error(
      `[McpHttp] servidor "${config.id}": transport streamable-http exige url.`
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`[McpHttp] servidor "${config.id}": url malformada.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      `[McpHttp] servidor "${config.id}": solo https permitido (SSRF fail-closed).`
    );
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new Error(
      `[McpHttp] servidor "${config.id}": credenciales en URL prohibidas (usar env/vault).`
    );
  }
  const verdict = NetPolicy.validateUrl(parsed.toString());
  if (!verdict.safe) {
    throw new Error(
      `[McpHttp] servidor "${config.id}": URL bloqueada por SSRF policy (${verdict.reason ?? "host no permitido"}).`
    );
  }
  if (config.headers) {
    for (const name of Object.keys(config.headers)) {
      if (BLOCKED_MCP_HTTP_HEADERS.has(name.toLowerCase())) {
        throw new Error(
          `[McpHttp] servidor "${config.id}": header "${name}" prohibido en config (secreto → env/vault).`
        );
      }
      const value = config.headers[name] ?? "";
      if (value.length > 4096) {
        throw new Error(
          `[McpHttp] servidor "${config.id}": header "${name}" excede 4096 caracteres.`
        );
      }
    }
  }
  return parsed;
}
