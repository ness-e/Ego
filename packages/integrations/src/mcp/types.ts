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
