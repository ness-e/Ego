import type { ToolRiskLevel } from "@ego/tools";

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
 * Configuración declarativa de conexión a un servidor MCP local sobre stdio.
 */
export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  toolPrefix?: string;
  timeoutMs?: number;
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
